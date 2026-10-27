<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$resource = (string)($_GET['resource'] ?? 'transactions');

function financeDateValue(mixed $value, string $label, bool $required = false): ?string
{
    if ($value === null || $value === '') { if ($required) respond(['error' => "$label is required"], 422); return null; }
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || !checkdate((int)substr($value, 5, 2), (int)substr($value, 8, 2), (int)substr($value, 0, 4))) respond(['error' => "$label must use YYYY-MM-DD"], 422);
    return $value;
}

if ($method === 'GET') {
    if ($resource === 'summary') {
        $from = financeDateValue($_GET['from'] ?? date('Y-m-01'), 'From date', true);
        $to = financeDateValue($_GET['to'] ?? date('Y-m-d'), 'To date', true);
        if ($from > $to) respond(['error' => 'From date must be before or equal to to date'], 422);
        $statement = $pdo->prepare("SELECT COALESCE(SUM(CASE WHEN accounting_class IN ('sale_revenue','other_income') THEN amount ELSE 0 END),0) AS revenue, COALESCE(SUM(CASE WHEN accounting_class='operating_expense' THEN amount ELSE 0 END),0) AS operating_expenses, COALESCE(SUM(CASE WHEN accounting_class='inventory_purchase' THEN amount ELSE 0 END),0) AS inventory_purchases, COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount_paid ELSE 0 END),0) AS cash_in, COALESCE(SUM(CASE WHEN transaction_type='expense' THEN amount_paid ELSE 0 END),0) AS cash_out FROM financial_transactions WHERE transaction_date BETWEEN ? AND ?");
        $statement->execute([$from, $to]);
        respond(['from' => $from, 'to' => $to, 'basis' => 'Accrual revenue and operating expenses exclude inventory purchases; cash totals use recorded payments.', 'totals' => $statement->fetch()]);
    }
    if ($resource === 'payments' && isset($_GET['transaction_id'])) {
        $transactionId = filter_var($_GET['transaction_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$transactionId) respond(['error' => 'A valid transaction ID is required'], 422);
        $statement = $pdo->prepare('SELECT id, payment_date, amount, payment_method, reference, notes FROM financial_payments WHERE transaction_id=? ORDER BY payment_date DESC, id DESC LIMIT 200');
        $statement->execute([$transactionId]);
        respond($statement->fetchAll());
    }
    if ($resource === 'payments') {
        $statement = $pdo->query('SELECT p.id,p.transaction_id,p.payment_date,p.amount,p.payment_method,p.reference,t.category,t.transaction_type,t.counterparty FROM financial_payments p JOIN financial_transactions t ON t.id=p.transaction_id ORDER BY p.payment_date DESC,p.id DESC LIMIT 200');
        respond($statement->fetchAll());
    }
    if ($resource !== 'transactions') respond(['error' => 'Unknown finance resource'], 400);
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    $from = financeDateValue($_GET['from'] ?? null, 'From date');
    $to = financeDateValue($_GET['to'] ?? null, 'To date');
    if ($from !== null && $to !== null && $from > $to) respond(['error' => 'From date must be before or equal to to date'], 422);
    $where = []; $params = [];
    if ($from !== null) { $where[] = 'transaction_date>=?'; $params[] = $from; }
    if ($to !== null) { $where[] = 'transaction_date<=?'; $params[] = $to; }
    if (isset($_GET['type'])) {
        $type = (string)$_GET['type'];
        if (!in_array($type, ['income','expense'], true)) respond(['error' => 'Invalid transaction type'], 422);
        $where[] = 'transaction_type=?'; $params[] = $type;
    }
    if (isset($_GET['outstanding']) && $_GET['outstanding'] === '1') $where[] = 'amount_paid < amount';
    $sql = 'SELECT id, transaction_type, accounting_class, transaction_date, category, amount, amount_paid, currency, payment_status, payment_method, counterparty, reference, notes, source_type, source_id FROM financial_transactions' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY transaction_date DESC, id DESC LIMIT ?';
    $statement = $pdo->prepare($sql);
    $index = 1; foreach ($params as $param) $statement->bindValue($index++, $param);
    $statement->bindValue($index, $limit, PDO::PARAM_INT); $statement->execute();
    respond($statement->fetchAll());
}

if ($method !== 'POST') respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
if ($resource === 'payments') {
    $requestKey = $data['request_key'] ?? null;
    if (!is_string($requestKey) || !preg_match('/^[0-9a-f-]{36}$/i', $requestKey)) respond(['error' => 'A valid request key is required'], 422);
    $duplicate = $pdo->prepare('SELECT id, transaction_id, amount FROM financial_payments WHERE request_key=?'); $duplicate->execute([$requestKey]);
    if ($existing = $duplicate->fetch()) respond(['id' => $existing['id'], 'transaction_id' => $existing['transaction_id'], 'amount' => $existing['amount'], 'status' => 'already_recorded']);
    $transactionId = filter_var($data['transaction_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $amount = $data['amount'] ?? null;
    $date = financeDateValue($data['payment_date'] ?? null, 'Payment date', true);
    $methodName = $data['payment_method'] ?? null;
    $reference = $data['reference'] ?? null; $notes = $data['notes'] ?? null;
    if (!$transactionId || !is_scalar($amount) || preg_match('/^\d{1,12}(\.\d{1,2})?$/', (string)$amount) !== 1 || preg_match('/^0+(?:\.0+)?$/', (string)$amount)) respond(['error' => 'Enter a positive payment amount with up to two decimals'], 422);
    if (!in_array($methodName, ['cash','mobile_money','bank','credit','other'], true)) respond(['error' => 'Choose a valid payment method'], 422);
    if ($date > date('Y-m-d')) respond(['error' => 'Payment date cannot be in the future'], 422);
    if ($reference !== null && (!is_string($reference) || mb_strlen($reference) > 120)) respond(['error' => 'Reference must be at most 120 characters'], 422);
    if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 1000)) respond(['error' => 'Notes must be at most 1000 characters'], 422);
    try {
        $pdo->beginTransaction();
        $lock = $pdo->prepare('SELECT amount, amount_paid FROM financial_transactions WHERE id=? FOR UPDATE'); $lock->execute([$transactionId]);
        $transaction = $lock->fetch();
        if (!$transaction) { $pdo->rollBack(); respond(['error' => 'Financial transaction not found'], 404); }
        $overflow = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2)) + CAST(? AS DECIMAL(14,2)) > CAST(? AS DECIMAL(14,2))');
        $overflow->execute([(string)$transaction['amount_paid'], (string)$amount, (string)$transaction['amount']]);
        if ((bool)$overflow->fetchColumn()) { $pdo->rollBack(); respond(['error' => 'Payment would exceed transaction amount'], 409); }
        $payment = $pdo->prepare('INSERT INTO financial_payments (request_key, transaction_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $payment->execute([$requestKey, $transactionId, $date, (string)$amount, $methodName, $reference, $notes, $actor['id']]);
        $update = $pdo->prepare("UPDATE financial_transactions SET amount_paid=amount_paid+?, payment_status=CASE WHEN amount_paid+?>=amount THEN 'paid' ELSE 'partial' END, payment_method=? WHERE id=?");
        $update->execute([(string)$amount, (string)$amount, $methodName, $transactionId]);
        $paymentId = (int)$pdo->lastInsertId();
        auditEvent($pdo, $actor['id'], 'finance.payment_recorded', 'financial_payment', (string)$paymentId, ['transaction_id' => $transactionId]);
        $pdo->commit();
        respond(['id' => $paymentId, 'transaction_id' => $transactionId, 'amount' => (string)$amount, 'status' => 'recorded'], 201);
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Payment record failed for owner ' . $actor['id'] . ': ' . $exception->getMessage());
        if ($exception->getCode() === '23000') respond(['error' => 'Duplicate payment request'], 409);
        respond(['error' => 'Unable to record payment'], 500);
    }
}
if ($resource !== 'transactions') respond(['error' => 'Unknown finance resource'], 400);
$requestKey = $data['request_key'] ?? null;
if (!is_string($requestKey) || !preg_match('/^[0-9a-f-]{36}$/i', $requestKey)) respond(['error' => 'A valid request key is required'], 422);
$duplicate = $pdo->prepare('SELECT id FROM financial_transactions WHERE request_key=?'); $duplicate->execute([$requestKey]);
if ($existing = $duplicate->fetch()) respond(['id' => (int)$existing['id'], 'status' => 'already_recorded']);
$type = $data['transaction_type'] ?? null;
$date = financeDateValue($data['transaction_date'] ?? null, 'Transaction date', true);
$category = $data['category'] ?? null;
$amount = $data['amount'] ?? null;
$amountPaid = $data['amount_paid'] ?? '0';
$status = $data['payment_status'] ?? 'unpaid';
$paymentMethod = $data['payment_method'] ?? null;
if (!in_array($type, ['income','expense'], true)) respond(['error' => 'Choose income or expense'], 422);
if ($date > date('Y-m-d')) respond(['error' => 'Transaction date cannot be in the future'], 422);
if (!is_string($category) || trim($category) === '' || mb_strlen($category) > 100) respond(['error' => 'Category is required and must be at most 100 characters'], 422);
if (!is_scalar($amount) || preg_match('/^\d{1,12}(\.\d{1,2})?$/', (string)$amount) !== 1 || preg_match('/^0+(?:\.0+)?$/', (string)$amount)) respond(['error' => 'Amount must be positive with up to two decimals'], 422);
if (!is_scalar($amountPaid) || preg_match('/^\d{1,12}(\.\d{1,2})?$/', (string)$amountPaid) !== 1) respond(['error' => 'Amount paid must be non-negative with up to two decimals'], 422);
if (!in_array($status, ['paid','partial','unpaid'], true)) respond(['error' => 'Choose a valid payment status'], 422);
if ($paymentMethod !== null && !in_array($paymentMethod, ['cash','mobile_money','bank','credit','other'], true)) respond(['error' => 'Choose a valid payment method'], 422);
if (!preg_match('/^0+(?:\.0+)?$/', (string)$amountPaid) && $paymentMethod === null) respond(['error' => 'Payment method is required when an amount has been paid'], 422);
$counterparty = $data['counterparty'] ?? null; $reference = $data['reference'] ?? null; $notes = $data['notes'] ?? null;
foreach (['Counterparty' => [$counterparty,180], 'Reference' => [$reference,120], 'Notes' => [$notes,5000]] as $label => [$value,$limit]) if ($value !== null && (!is_string($value) || mb_strlen($value) > $limit)) respond(['error' => "$label must be at most $limit characters"], 422);
$currency = strtoupper(getenv('SCOTT_CURRENCY') ?: 'KES');
if (!preg_match('/^[A-Z]{3}$/', $currency)) respond(['error' => 'Currency configuration is invalid'], 500);
$paidCheck = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2)) > CAST(? AS DECIMAL(14,2))'); $paidCheck->execute([(string)$amountPaid, (string)$amount]);
if ((bool)$paidCheck->fetchColumn()) respond(['error' => 'Amount paid cannot exceed transaction amount'], 422);
$paidZero = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2))=0'); $paidZero->execute([(string)$amountPaid]); $isZero = (bool)$paidZero->fetchColumn();
$paidTotal = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2))=CAST(? AS DECIMAL(14,2))'); $paidTotal->execute([(string)$amountPaid,(string)$amount]); $isPaid = (bool)$paidTotal->fetchColumn();
if (($status === 'unpaid' && !$isZero) || ($status === 'paid' && !$isPaid) || ($status === 'partial' && ($isZero || $isPaid))) respond(['error' => 'Payment status does not match the amount paid'], 422);
$class = $type === 'income' ? 'other_income' : 'operating_expense';
try {
    $pdo->beginTransaction();
    $statement = $pdo->prepare('INSERT INTO financial_transactions (request_key, transaction_type, accounting_class, transaction_date, category, amount, amount_paid, currency, payment_status, payment_method, counterparty, reference, notes, source_type, source_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'manual\', NULL, ?)');
    $statement->execute([$requestKey, $type, $class, $date, trim($category), (string)$amount, (string)$amountPaid, $currency, $status, $paymentMethod, $counterparty, $reference, $notes, $actor['id']]);
    $id = (int)$pdo->lastInsertId();
    if (!$isZero) {
        $payment = $pdo->prepare('INSERT INTO financial_payments (request_key, transaction_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $payment->execute([$requestKey, $id, $date, (string)$amountPaid, $paymentMethod, $reference, $notes, $actor['id']]);
    }
    auditEvent($pdo, $actor['id'], 'finance.transaction_created', 'financial_transaction', (string)$id, ['type' => $type, 'class' => $class]);
    $pdo->commit();
    respond(['id' => $id, 'transaction_type' => $type, 'accounting_class' => $class, 'transaction_date' => $date, 'category' => trim($category), 'amount' => (string)$amount, 'amount_paid' => (string)$amountPaid, 'currency' => $currency, 'payment_status' => $status], 201);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Financial transaction create failed for owner ' . $actor['id'] . ': ' . $exception->getMessage());
    if ($exception->getCode() === '23000') respond(['error' => 'Duplicate transaction request'], 409);
    respond(['error' => 'Unable to create financial transaction'], 500);
}
