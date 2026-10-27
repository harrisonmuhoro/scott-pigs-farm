<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    requireRole(['owner']);
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    $statement = $pdo->prepare('SELECT s.id, s.sale_date, s.customer, s.reference, s.total, s.amount_paid, s.payment_status, s.payment_method, COUNT(l.id) AS line_count FROM sales s JOIN sale_lines l ON l.sale_id=s.id GROUP BY s.id ORDER BY s.sale_date DESC, s.id DESC LIMIT ?');
    $statement->bindValue(1, $limit, PDO::PARAM_INT); $statement->execute();
    respond($statement->fetchAll());
}
if ($method !== 'POST') respond(['error' => 'Method not allowed'], 405);
$actor = requireRole(['owner']);
requireCsrf();
$data = readJsonBody();
$requestKey = $data['request_key'] ?? null;
if (!is_string($requestKey) || !preg_match('/^[0-9a-f-]{36}$/i', $requestKey)) respond(['error' => 'A valid request key is required'], 422);
$existing = $pdo->prepare('SELECT id, total, payment_status FROM sales WHERE request_key=?'); $existing->execute([$requestKey]);
if ($row = $existing->fetch()) respond(['id' => (int)$row['id'], 'total' => $row['total'], 'payment_status' => $row['payment_status'], 'status' => 'already_recorded']);
$saleDate = $data['sale_date'] ?? null;
if (!is_string($saleDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $saleDate) || !checkdate((int)substr($saleDate, 5, 2), (int)substr($saleDate, 8, 2), (int)substr($saleDate, 0, 4)) || $saleDate > date('Y-m-d')) respond(['error' => 'Sale date must be a valid date no later than today'], 422);
$lines = $data['lines'] ?? null;
if (!is_array($lines) || count($lines) < 1 || count($lines) > 50) respond(['error' => 'A sale must contain 1–50 lines'], 422);
$customer = $data['customer'] ?? null; $reference = $data['reference'] ?? null; $notes = $data['notes'] ?? null;
foreach (['Customer' => [$customer,180], 'Reference' => [$reference,120], 'Notes' => [$notes,5000]] as $label => [$value,$max]) if ($value !== null && (!is_string($value) || mb_strlen($value) > $max)) respond(['error' => "$label must be at most $max characters"], 422);
$amountPaid = $data['amount_paid'] ?? '0';
$status = $data['payment_status'] ?? 'unpaid';
$paymentMethod = $data['payment_method'] ?? null;
if (!is_scalar($amountPaid) || preg_match('/^\d{1,12}(\.\d{1,2})?$/', (string)$amountPaid) !== 1) respond(['error' => 'Amount paid must be non-negative with up to two decimals'], 422);
if (!in_array($status, ['paid','partial','unpaid'], true)) respond(['error' => 'Choose a valid payment status'], 422);
if ($paymentMethod !== null && !in_array($paymentMethod, ['cash','mobile_money','bank','credit','other'], true)) respond(['error' => 'Invalid payment method'], 422);
if (!preg_match('/^0+(?:\.0+)?$/', (string)$amountPaid) && $paymentMethod === null) respond(['error' => 'Payment method is required when an amount has been paid'], 422);
$validated = []; $pigIds = [];
foreach ($lines as $line) {
    if (!is_array($line)) respond(['error' => 'Invalid sale line'], 422);
    $pigValue = $line['pig_id'] ?? null;
    $pigId = $pigValue === null || $pigValue === '' ? null : filter_var($pigValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($pigId === false) respond(['error' => 'Pig ID is invalid'], 422);
    $description = $line['description'] ?? null; $quantity = $line['quantity'] ?? null; $price = $line['unit_price'] ?? null;
    if (!is_string($description) || trim($description) === '' || mb_strlen($description) > 255) respond(['error' => 'Sale line description is required'], 422);
    if (!is_scalar($quantity) || preg_match('/^\d{1,9}(\.\d{1,3})?$/', (string)$quantity) !== 1 || preg_match('/^0+(?:\.0+)?$/', (string)$quantity)) respond(['error' => 'Sale quantity must be positive with up to 3 decimals'], 422);
    if (!is_scalar($price) || preg_match('/^\d{1,12}(\.\d{1,2})?$/', (string)$price) !== 1 || preg_match('/^0+(?:\.0+)?$/', (string)$price)) respond(['error' => 'Unit price must be positive with up to 2 decimals'], 422);
    if ($pigId !== null) {
        $exactlyOne = $pdo->prepare('SELECT CAST(? AS DECIMAL(12,3))=1'); $exactlyOne->execute([(string)$quantity]);
        if (!(bool)$exactlyOne->fetchColumn()) respond(['error' => 'A live pig sale line quantity must be exactly one'], 422);
        if (in_array($pigId, $pigIds, true)) respond(['error' => 'A pig can appear only once in a sale'], 422);
        $pigIds[] = $pigId;
    }
    $validated[] = ['pig_id' => $pigId, 'description' => trim($description), 'quantity' => (string)$quantity, 'unit_price' => (string)$price];
}

function salesUuid(): string
{
    $bytes = random_bytes(16); $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40); $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80); $hex = bin2hex($bytes);
    return substr($hex,0,8).'-'.substr($hex,8,4).'-'.substr($hex,12,4).'-'.substr($hex,16,4).'-'.substr($hex,20,12);
}

try {
    $pdo->beginTransaction();
    $pigRows = [];
    if ($pigIds) {
        sort($pigIds);
        $marks = implode(',', array_fill(0, count($pigIds), '?'));
        $lock = $pdo->prepare("SELECT id, tag_id, lifecycle_status FROM pigs WHERE id IN ($marks) AND archived_at IS NULL ORDER BY id FOR UPDATE");
        $lock->execute($pigIds);
        foreach ($lock->fetchAll() as $pig) $pigRows[(int)$pig['id']] = $pig;
        foreach ($pigIds as $pigId) if (!isset($pigRows[$pigId]) || in_array($pigRows[$pigId]['lifecycle_status'], ['sold','deceased'], true)) { $pdo->rollBack(); respond(['error' => 'A selected pig is unavailable for sale'], 409); }
    }
    $sale = $pdo->prepare('INSERT INTO sales (request_key, sale_date, customer, reference, total, amount_paid, payment_status, payment_method, notes, created_by) VALUES (?, ?, ?, ?, 0, 0, \'unpaid\', NULL, ?, ?)');
    $sale->execute([$requestKey, $saleDate, $customer, $reference, $notes, $actor['id']]);
    $saleId = (int)$pdo->lastInsertId();
    foreach ($validated as $line) {
        $description = $line['description'];
        if ($line['pig_id'] !== null) {
            $pig = $pigRows[$line['pig_id']];
            if ($description === '') $description = 'Live pig ' . $pig['tag_id'];
        }
        $insert = $pdo->prepare('INSERT INTO sale_lines (sale_id, pig_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ROUND(CAST(? AS DECIMAL(12,3))*CAST(? AS DECIMAL(12,2)),2))');
        $insert->execute([$saleId, $line['pig_id'], $description, $line['quantity'], $line['unit_price'], $line['quantity'], $line['unit_price']]);
    }
    $totalStmt = $pdo->prepare('SELECT CAST(ROUND(SUM(line_total),2) AS DECIMAL(14,2)) FROM sale_lines WHERE sale_id=?');
    $totalStmt->execute([$saleId]); $total = (string)$totalStmt->fetchColumn();
    $overflow = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2)) > CAST(? AS DECIMAL(14,2))'); $overflow->execute([(string)$amountPaid,$total]);
    if ((bool)$overflow->fetchColumn()) { $pdo->rollBack(); respond(['error' => 'Amount paid cannot exceed sale total'], 422); }
    $zeroStmt = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2))=0'); $zeroStmt->execute([(string)$amountPaid]); $isZero=(bool)$zeroStmt->fetchColumn();
    $equalStmt = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2))=CAST(? AS DECIMAL(14,2))'); $equalStmt->execute([(string)$amountPaid,$total]); $isPaid=(bool)$equalStmt->fetchColumn();
    if (($status === 'unpaid' && !$isZero) || ($status === 'paid' && !$isPaid) || ($status === 'partial' && ($isZero || $isPaid))) { $pdo->rollBack(); respond(['error' => 'Payment status does not match sale total and amount paid'], 422); }
    $updateSale = $pdo->prepare('UPDATE sales SET total=?, amount_paid=?, payment_status=?, payment_method=? WHERE id=?');
    $updateSale->execute([$total, (string)$amountPaid, $status, $paymentMethod, $saleId]);
    foreach ($pigIds as $pigId) {
        $markSold = $pdo->prepare("UPDATE pigs SET lifecycle_status='sold' WHERE id=? AND lifecycle_status NOT IN ('sold','deceased')");
        $markSold->execute([$pigId]);
        if ($markSold->rowCount() !== 1) { $pdo->rollBack(); respond(['error' => 'Pig status changed before sale could be recorded'], 409); }
        auditEvent($pdo, $actor['id'], 'pig.sold', 'pig', (string)$pigId, ['sale_id' => $saleId]);
    }
    $currency = strtoupper(getenv('SCOTT_CURRENCY') ?: 'KES');
    if (!preg_match('/^[A-Z]{3}$/', $currency)) { $pdo->rollBack(); respond(['error' => 'Currency configuration is invalid'], 500); }
    $transaction = $pdo->prepare("INSERT INTO financial_transactions (request_key, transaction_type, accounting_class, transaction_date, category, amount, amount_paid, currency, payment_status, payment_method, counterparty, reference, notes, source_type, source_id, created_by) VALUES (?, 'income', 'sale_revenue', ?, 'Sale', ?, ?, ?, ?, ?, ?, ?, ?, 'sale', ?, ?)");
    $transaction->execute([salesUuid(), $saleDate, $total, (string)$amountPaid, $currency, $status, $paymentMethod, $customer, $reference, $notes, $saleId, $actor['id']]);
    $transactionId = (int)$pdo->lastInsertId();
    if (!$isZero) {
        $payment = $pdo->prepare('INSERT INTO financial_payments (request_key, transaction_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $payment->execute([salesUuid(), $transactionId, $saleDate, (string)$amountPaid, $paymentMethod, $reference, $notes, $actor['id']]);
    }
    auditEvent($pdo, $actor['id'], 'sale.created', 'sale', (string)$saleId, ['total' => $total]);
    $pdo->commit();
    respond(['id' => $saleId, 'sale_date' => $saleDate, 'total' => $total, 'amount_paid' => (string)$amountPaid, 'payment_status' => $status, 'line_count' => count($validated)], 201);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Sale creation failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    if ($exception->getCode() === '23000') respond(['error' => 'Sale request was duplicated or a pig has already been sold'], 409);
    respond(['error' => 'Unable to record sale'], 500);
}
