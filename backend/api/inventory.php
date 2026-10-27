<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$resource = (string)($_GET['resource'] ?? 'items');

function inventoryDate(mixed $value, string $field, bool $required = false): ?string
{
    if ($value === null || $value === '') { if ($required) respond(['error' => "$field is required"], 422); return null; }
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || !checkdate((int)substr($value, 5, 2), (int)substr($value, 8, 2), (int)substr($value, 0, 4))) respond(['error' => "$field must use YYYY-MM-DD"], 422);
    return $value;
}

function inventoryUuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
}

if ($method === 'GET') {
    if ($resource === 'items') {
        $costField = ', COALESCE(SUM(m.quantity_delta * COALESCE(m.unit_cost, 0)), 0) AS stock_value';
        $statement = $pdo->query("SELECT i.id, i.sku, i.name, i.category, i.unit, i.brand, i.description, i.reorder_threshold, i.preferred_supplier_id, i.track_batches, i.active, COALESCE(SUM(m.quantity_delta), 0) AS on_hand $costField FROM inventory_items i LEFT JOIN stock_movements m ON m.item_id=i.id GROUP BY i.id ORDER BY i.name");
        respond($statement->fetchAll());
    }
    if ($resource === 'suppliers') {
        $statement = $pdo->query('SELECT id, name, contact_name, phone, email, notes, active FROM suppliers ORDER BY name LIMIT 500');
        respond($statement->fetchAll());
    }
    if ($resource === 'movements') {
        $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
        $costField = ', m.unit_cost';
        $statement = $pdo->prepare("SELECT m.id, m.item_id, i.sku, i.name AS item_name, m.movement_type, m.quantity_delta, m.unit, m.batch_lot, m.expiry_date, m.movement_date, m.reason, m.notes $costField FROM stock_movements m JOIN inventory_items i ON i.id=m.item_id ORDER BY m.movement_date DESC, m.id DESC LIMIT ?");
        $statement->bindValue(1, $limit, PDO::PARAM_INT);
        $statement->execute();
        respond($statement->fetchAll());
    }
    if ($resource === 'alerts') {
        $low = $pdo->query("SELECT i.id, i.sku, i.name, i.unit, COALESCE(SUM(m.quantity_delta),0) AS on_hand, i.reorder_threshold FROM inventory_items i LEFT JOIN stock_movements m ON m.item_id=i.id WHERE i.active=1 GROUP BY i.id HAVING on_hand <= i.reorder_threshold ORDER BY i.name")->fetchAll();
        $expiry = $pdo->query("SELECT i.id AS item_id, i.sku, i.name, i.unit, m.batch_lot, m.expiry_date, SUM(m.quantity_delta) AS on_hand, CASE WHEN m.expiry_date < CURRENT_DATE THEN 'expired' ELSE 'expiring' END AS status FROM inventory_items i JOIN stock_movements m ON m.item_id=i.id WHERE i.active=1 AND m.expiry_date IS NOT NULL AND m.expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) GROUP BY i.id, i.sku, i.name, i.unit, m.batch_lot, m.expiry_date HAVING on_hand > 0 ORDER BY m.expiry_date")->fetchAll();
        respond(['low_stock' => $low, 'expiry' => $expiry]);
    }
    if ($resource === 'purchases') {
        requireRole(['owner']);
        $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
        $statement = $pdo->prepare('SELECT p.id, p.invoice_reference, p.purchase_date, p.received_date, s.name AS supplier, COUNT(l.id) AS line_count, SUM(l.quantity*l.unit_cost) AS total_cost FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id JOIN purchase_lines l ON l.purchase_id=p.id GROUP BY p.id ORDER BY p.received_date DESC, p.id DESC LIMIT ?');
        $statement->bindValue(1, $limit, PDO::PARAM_INT);
        $statement->execute();
        respond($statement->fetchAll());
    }
    respond(['error' => 'Unknown inventory resource'], 400);
}

if (!in_array($method, ['POST','PATCH'], true)) respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();

if ($method === 'POST' && $resource === 'suppliers') {
    requireRole(['owner']);
    $name = $data['name'] ?? null;
    if (!is_string($name) || trim($name) === '' || mb_strlen($name) > 160) respond(['error' => 'Supplier name is required and must be at most 160 characters'], 422);
    $fields = ['contact_name' => 120, 'phone' => 40, 'email' => 254, 'notes' => 3000];
    $values = [];
    foreach ($fields as $field => $limit) { $value = $data[$field] ?? null; if ($value !== null && (!is_string($value) || mb_strlen($value) > $limit)) respond(['error' => ucfirst(str_replace('_',' ',$field)) . " must be at most $limit characters"], 422); $values[$field] = $value; }
    $statement = $pdo->prepare('INSERT INTO suppliers (name, contact_name, phone, email, notes) VALUES (?, ?, ?, ?, ?)');
    $statement->execute([trim($name), ...array_values($values)]);
    $id = (int)$pdo->lastInsertId();
    auditEvent($pdo, $actor['id'], 'supplier.created', 'supplier', (string)$id);
    respond(['id' => $id, 'name' => trim($name), ...$values, 'active' => 1], 201);
}

if ($method === 'POST' && $resource === 'items') {
    requireRole(['owner']);
    $sku = $data['sku'] ?? null; $name = $data['name'] ?? null; $category = $data['category'] ?? null; $unit = $data['unit'] ?? null;
    $categories = ['feed','medicine_vaccine','supplement','equipment','consumable','other'];
    if (!is_string($sku) || trim($sku) === '' || mb_strlen($sku) > 64 || !is_string($name) || trim($name) === '' || mb_strlen($name) > 180) respond(['error' => 'SKU and item name are required'], 422);
    if (!is_string($category) || !in_array($category, $categories, true)) respond(['error' => 'Choose a valid inventory category'], 422);
    if (!is_string($unit) || trim($unit) === '' || mb_strlen($unit) > 32) respond(['error' => 'Unit of measure is required'], 422);
    $threshold = $data['reorder_threshold'] ?? '0';
    if (!is_scalar($threshold) || preg_match('/^\d{1,9}(\.\d{1,3})?$/', (string)$threshold) !== 1) respond(['error' => 'Reorder threshold must be a non-negative quantity with up to 3 decimals'], 422);
    $supplierId = isset($data['preferred_supplier_id']) && $data['preferred_supplier_id'] !== '' ? filter_var($data['preferred_supplier_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
    if ($supplierId === false) respond(['error' => 'Preferred supplier ID is invalid'], 422);
    $brand = $data['brand'] ?? null; $description = $data['description'] ?? null;
    if ($brand !== null && (!is_string($brand) || mb_strlen($brand) > 120)) respond(['error' => 'Brand must be at most 120 characters'], 422);
    if ($description !== null && (!is_string($description) || mb_strlen($description) > 3000)) respond(['error' => 'Description must be at most 3000 characters'], 422);
    $trackBatches = filter_var($data['track_batches'] ?? false, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($trackBatches === null) respond(['error' => 'Batch tracking must be true or false'], 422);
    try {
        $statement = $pdo->prepare('INSERT INTO inventory_items (sku, name, category, unit, brand, description, reorder_threshold, preferred_supplier_id, track_batches) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([trim($sku), trim($name), $category, trim($unit), $brand, $description, (string)$threshold, $supplierId, $trackBatches ? 1 : 0]);
        $id = (int)$pdo->lastInsertId();
        auditEvent($pdo, $actor['id'], 'inventory_item.created', 'inventory_item', (string)$id);
        respond(['id' => $id, 'sku' => trim($sku), 'name' => trim($name), 'category' => $category, 'unit' => trim($unit), 'brand' => $brand, 'description' => $description, 'reorder_threshold' => (string)$threshold, 'preferred_supplier_id' => $supplierId, 'track_batches' => $trackBatches, 'active' => 1, 'on_hand' => '0.000'], 201);
    } catch (PDOException $exception) {
        error_log('Inventory item creation failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
        if ($exception->getCode() === '23000') respond(['error' => 'SKU already exists or supplier is invalid'], 409);
        respond(['error' => 'Unable to create inventory item'], 500);
    }
}

if ($method === 'PATCH' && $resource === 'items') {
    requireRole(['owner']);
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $active = $data['active'] ?? null;
    if (!$id || !is_bool($active)) respond(['error' => 'Valid item ID and active flag are required'], 422);
    $statement = $pdo->prepare('UPDATE inventory_items SET active=? WHERE id=?');
    $statement->execute([$active ? 1 : 0, $id]);
    auditEvent($pdo, $actor['id'], $active ? 'inventory_item.activated' : 'inventory_item.discontinued', 'inventory_item', (string)$id);
    respond(['status' => 'success']);
}

if ($method === 'POST' && $resource === 'purchases') {
    requireRole(['owner']);
    $requestKey = $data['request_key'] ?? null;
    if (!is_string($requestKey) || !preg_match('/^[0-9a-f-]{36}$/i', $requestKey)) respond(['error' => 'A valid request key is required'], 422);
    $existing = $pdo->prepare('SELECT id FROM purchases WHERE request_key=?');
    $existing->execute([$requestKey]);
    if ($row = $existing->fetch()) respond(['id' => (int)$row['id'], 'status' => 'already_received'], 200);
    $supplierId = isset($data['supplier_id']) && $data['supplier_id'] !== '' ? filter_var($data['supplier_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
    if ($supplierId === false) respond(['error' => 'Supplier ID is invalid'], 422);
    $purchaseDate = inventoryDate($data['purchase_date'] ?? null, 'Purchase date', true);
    $receivedDate = inventoryDate($data['received_date'] ?? null, 'Received date', true);
    if ($purchaseDate > $receivedDate || $receivedDate > date('Y-m-d')) respond(['error' => 'Purchase and received dates must be ordered and no later than today'], 422);
    $reference = $data['invoice_reference'] ?? null; $notes = $data['notes'] ?? null; $lines = $data['lines'] ?? null;
    $amountPaid = $data['amount_paid'] ?? '0';
    $paymentStatus = $data['payment_status'] ?? 'unpaid';
    $paymentMethod = $data['payment_method'] ?? null;
    if ($reference !== null && (!is_string($reference) || mb_strlen($reference) > 120)) respond(['error' => 'Invoice reference must be at most 120 characters'], 422);
    if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 3000)) respond(['error' => 'Notes must be at most 3000 characters'], 422);
    if (!is_scalar($amountPaid) || preg_match('/^\d{1,12}(\.\d{1,2})?$/', (string)$amountPaid) !== 1) respond(['error' => 'Amount paid must be a non-negative amount with up to two decimals'], 422);
    if (!in_array($paymentStatus, ['paid','partial','unpaid'], true)) respond(['error' => 'Invalid purchase payment status'], 422);
    if ($paymentMethod !== null && !in_array($paymentMethod, ['cash','mobile_money','bank','credit','other'], true)) respond(['error' => 'Invalid payment method'], 422);
    if (!preg_match('/^0+(?:\.0+)?$/', (string)$amountPaid) && $paymentMethod === null) respond(['error' => 'Payment method is required when an amount has been paid'], 422);
    if (!is_array($lines) || count($lines) < 1 || count($lines) > 50) respond(['error' => 'A purchase must contain 1–50 lines'], 422);
    $validatedLines = []; $itemIds = [];
    foreach ($lines as $line) {
        if (!is_array($line)) respond(['error' => 'Invalid purchase line'], 422);
        $itemId = filter_var($line['item_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $quantity = $line['quantity'] ?? null; $cost = $line['unit_cost'] ?? null;
        if (!$itemId || !is_scalar($quantity) || preg_match('/^\d{1,9}(\.\d{1,3})?$/', (string)$quantity) !== 1 || (float)$quantity <= 0) respond(['error' => 'Purchase quantity must be positive with up to 3 decimals'], 422);
        if (!is_scalar($cost) || preg_match('/^\d{1,9}(\.\d{1,2})?$/', (string)$cost) !== 1) respond(['error' => 'Unit cost must be a non-negative amount with up to 2 decimals'], 422);
        $lot = $line['batch_lot'] ?? null; if ($lot !== null && (!is_string($lot) || mb_strlen($lot) > 80)) respond(['error' => 'Batch/lot must be at most 80 characters'], 422);
        $expiry = inventoryDate($line['expiry_date'] ?? null, 'Expiry date');
        if ($expiry !== null && $expiry < $receivedDate) respond(['error' => 'Expiry date cannot be before receipt'], 422);
        $validatedLines[] = ['item_id' => $itemId, 'quantity' => (string)$quantity, 'unit_cost' => (string)$cost, 'batch_lot' => $lot, 'expiry_date' => $expiry];
        $itemIds[] = $itemId;
    }
    if ($supplierId !== null) { $check = $pdo->prepare('SELECT id FROM suppliers WHERE id=? AND active=1'); $check->execute([$supplierId]); if (!$check->fetch()) respond(['error' => 'Supplier is not active'], 422); }
    try {
        $pdo->beginTransaction();
        $uniqueIds = array_values(array_unique($itemIds)); sort($uniqueIds);
        $marks = implode(',', array_fill(0, count($uniqueIds), '?'));
        $locked = $pdo->prepare("SELECT id, unit, track_batches, active FROM inventory_items WHERE id IN ($marks) ORDER BY id FOR UPDATE");
        $locked->execute($uniqueIds);
        $items = []; foreach ($locked->fetchAll() as $item) $items[(int)$item['id']] = $item;
        foreach ($validatedLines as $line) {
            $item = $items[$line['item_id']] ?? null;
            if (!$item || !(bool)$item['active']) { $pdo->rollBack(); respond(['error' => 'A purchase item is not active'], 422); }
            if ((bool)$item['track_batches'] && ($line['batch_lot'] === null || $line['batch_lot'] === '')) { $pdo->rollBack(); respond(['error' => 'Batch/lot is required for a batch-tracked item'], 422); }
        }
        $purchase = $pdo->prepare('INSERT INTO purchases (request_key, supplier_id, invoice_reference, purchase_date, received_date, amount_paid, payment_status, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $purchase->execute([$requestKey, $supplierId, $reference, $purchaseDate, $receivedDate, (string)$amountPaid, $paymentStatus, $paymentMethod, $notes, $actor['id']]);
        $purchaseId = (int)$pdo->lastInsertId();
        foreach ($validatedLines as $line) {
            $unit = $items[$line['item_id']]['unit'];
            $insertLine = $pdo->prepare('INSERT INTO purchase_lines (purchase_id, item_id, quantity, unit_cost, batch_lot, expiry_date) VALUES (?, ?, ?, ?, ?, ?)');
            $insertLine->execute([$purchaseId, $line['item_id'], $line['quantity'], $line['unit_cost'], $line['batch_lot'], $line['expiry_date']]);
            $lineId = (int)$pdo->lastInsertId();
            $movement = $pdo->prepare("INSERT INTO stock_movements (request_key, item_id, purchase_line_id, movement_type, quantity_delta, unit, unit_cost, batch_lot, expiry_date, movement_date, reason, notes, created_by) VALUES (?, ?, ?, 'receipt', ?, ?, ?, ?, ?, ?, 'Purchase receipt', ?, ?)");
            $movement->execute([inventoryUuid(), $line['item_id'], $lineId, $line['quantity'], $unit, $line['unit_cost'], $line['batch_lot'], $line['expiry_date'], $receivedDate, $reference, $actor['id']]);
        }
        $totalQuery = $pdo->prepare('SELECT CAST(ROUND(SUM(quantity * unit_cost), 2) AS DECIMAL(14,2)) FROM purchase_lines WHERE purchase_id=?');
        $totalQuery->execute([$purchaseId]);
        $purchaseTotal = (string)$totalQuery->fetchColumn();
        $paidCheck = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2)) > CAST(? AS DECIMAL(14,2))');
        $paidCheck->execute([(string)$amountPaid, $purchaseTotal]);
        if ((bool)$paidCheck->fetchColumn()) { $pdo->rollBack(); respond(['error' => 'Amount paid cannot exceed purchase total'], 422); }
        $paidZero = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2)) = 0'); $paidZero->execute([(string)$amountPaid]); $isZeroPaid = (bool)$paidZero->fetchColumn();
        $paidEqualsTotal = $pdo->prepare('SELECT CAST(? AS DECIMAL(14,2)) = CAST(? AS DECIMAL(14,2))'); $paidEqualsTotal->execute([(string)$amountPaid, $purchaseTotal]); $isFullyPaid = (bool)$paidEqualsTotal->fetchColumn();
        if (($paymentStatus === 'unpaid' && !$isZeroPaid) || ($paymentStatus === 'paid' && !$isFullyPaid) || ($paymentStatus === 'partial' && ($isZeroPaid || $isFullyPaid))) { $pdo->rollBack(); respond(['error' => 'Payment status does not match amount paid and total'], 422); }
        $financial = $pdo->prepare("INSERT INTO financial_transactions (request_key, transaction_type, accounting_class, transaction_date, category, amount, amount_paid, currency, payment_status, payment_method, counterparty, reference, notes, source_type, source_id, created_by) VALUES (?, 'expense', 'inventory_purchase', ?, 'Inventory purchase', ?, ?, 'KES', ?, ?, ?, ?, ?, 'purchase', ?, ?)");
        $financial->execute([inventoryUuid(), $purchaseDate, $purchaseTotal, (string)$amountPaid, $paymentStatus, $paymentMethod, $supplierId === null ? null : (string)$supplierId, $reference, $notes, $purchaseId, $actor['id']]);
        $financeId = (int)$pdo->lastInsertId();
        if (!$isZeroPaid) {
            $payment = $pdo->prepare('INSERT INTO financial_payments (request_key, transaction_id, payment_date, amount, payment_method, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $payment->execute([inventoryUuid(), $financeId, $purchaseDate, (string)$amountPaid, $paymentMethod, $reference, $notes, $actor['id']]);
        }
        auditEvent($pdo, $actor['id'], 'inventory.purchase_received', 'purchase', (string)$purchaseId, ['line_count' => count($validatedLines)]);
        $pdo->commit();
        respond(['id' => $purchaseId, 'status' => 'received', 'line_count' => count($validatedLines)], 201);
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Purchase receipt failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
        if ($exception->getCode() === '23000') respond(['error' => 'Purchase could not be recorded because of a duplicate or invalid reference'], 409);
        respond(['error' => 'Unable to receive purchase'], 500);
    }
}

if ($method === 'POST' && $resource === 'movements') {
    $type = $data['movement_type'] ?? null;
    if (!is_string($type) || !in_array($type, ['usage','wastage','return','adjustment'], true)) respond(['error' => 'Choose usage, wastage, return, or adjustment'], 422);
    if ($type === 'adjustment') requireRole(['owner']);
    $key = $data['request_key'] ?? null;
    if (!is_string($key) || !preg_match('/^[0-9a-f-]{36}$/i', $key)) respond(['error' => 'A valid request key is required'], 422);
    $duplicate = $pdo->prepare('SELECT id FROM stock_movements WHERE request_key=?'); $duplicate->execute([$key]);
    if ($existing = $duplicate->fetch()) respond(['id' => (int)$existing['id'], 'status' => 'already_recorded'], 200);
    $itemId = filter_var($data['item_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $quantity = $data['quantity'] ?? null;
    if (!$itemId || !is_scalar($quantity) || preg_match('/^\d{1,9}(\.\d{1,3})?$/', (string)$quantity) !== 1 || (float)$quantity <= 0) respond(['error' => 'Quantity must be positive with up to 3 decimals'], 422);
    $date = inventoryDate($data['movement_date'] ?? null, 'Movement date', true);
    if ($date > date('Y-m-d')) respond(['error' => 'Movement date cannot be in the future'], 422);
    $reason = $data['reason'] ?? null; $notes = $data['notes'] ?? null;
    if (!is_string($reason) || trim($reason) === '' || mb_strlen($reason) > 1000) respond(['error' => 'A reason is required and must be at most 1000 characters'], 422);
    if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 3000)) respond(['error' => 'Notes must be at most 3000 characters'], 422);
    $lot = $data['batch_lot'] ?? null; if ($lot !== null && (!is_string($lot) || mb_strlen($lot) > 80)) respond(['error' => 'Batch/lot must be at most 80 characters'], 422);
    $direction = $data['direction'] ?? 'negative';
    if ($type === 'adjustment' && !in_array($direction, ['positive','negative'], true)) respond(['error' => 'Adjustment direction must be positive or negative'], 422);
    $expiry = inventoryDate($data['expiry_date'] ?? null, 'Expiry date');
    try {
        $pdo->beginTransaction();
        $itemStmt = $pdo->prepare('SELECT id, unit, track_batches, active, category FROM inventory_items WHERE id=? FOR UPDATE');
        $itemStmt->execute([$itemId]); $item = $itemStmt->fetch();
        if (!$item || !(bool)$item['active']) { $pdo->rollBack(); respond(['error' => 'Inventory item is not active'], 422); }
        if ((bool)$item['track_batches'] && ($lot === null || $lot === '')) { $pdo->rollBack(); respond(['error' => 'Choose a batch/lot for this item'], 422); }
        $quantityDelta = (string)$quantity;
        if ($type === 'usage' || $type === 'wastage' || ($type === 'adjustment' && $direction === 'negative')) $quantityDelta = '-' . $quantityDelta;
        $balanceSql = "SELECT COALESCE(SUM(quantity_delta),0) AS balance, CASE WHEN SUM(quantity_delta)>0 THEN SUM(quantity_delta*COALESCE(unit_cost,0))/SUM(quantity_delta) ELSE NULL END AS average_cost, MIN(CASE WHEN movement_type='receipt' THEN expiry_date ELSE NULL END) AS batch_expiry FROM stock_movements WHERE item_id=?";
        $balanceArgs = [$itemId];
        if ((bool)$item['track_batches']) { $balanceSql .= ' AND batch_lot=?'; $balanceArgs[] = $lot; }
        $balanceStmt = $pdo->prepare($balanceSql); $balanceStmt->execute($balanceArgs); $balance = $balanceStmt->fetch();
        $available = $pdo->prepare('SELECT CAST(? AS DECIMAL(12,3)) > CAST(? AS DECIMAL(12,3))');
        $available->execute([(string)$quantity, (string)$balance['balance']]);
        if ($quantityDelta[0] === '-' && (bool)$available->fetchColumn()) { $pdo->rollBack(); respond(['error' => 'Insufficient stock for this movement'], 409); }
        $movementExpiry = (bool)$item['track_batches'] ? $balance['batch_expiry'] : $expiry;
        if ($type === 'usage' && $movementExpiry !== null && $movementExpiry < date('Y-m-d')) { $pdo->rollBack(); respond(['error' => 'Expired stock cannot be recorded as usage'], 409); }
        $unitCost = $balance['average_cost'];
        if ($type === 'adjustment' && $direction === 'positive' && $unitCost === null) {
            $manualCost = $data['unit_cost'] ?? null;
            if (!is_scalar($manualCost) || preg_match('/^\d{1,9}(\.\d{1,2})?$/', (string)$manualCost) !== 1) { $pdo->rollBack(); respond(['error' => 'Enter a unit cost for a positive adjustment with no existing cost basis'], 422); }
            $unitCost = (string)$manualCost;
        }
        if ($type === 'return' && $unitCost === null) {
            $manualCost = $data['unit_cost'] ?? null;
            if (!is_scalar($manualCost) || preg_match('/^\d{1,9}(\.\d{1,2})?$/', (string)$manualCost) !== 1) { $pdo->rollBack(); respond(['error' => 'Enter a unit cost for a return without an existing cost basis'], 422); }
            $unitCost = (string)$manualCost;
        }
        $movement = $pdo->prepare('INSERT INTO stock_movements (request_key, item_id, movement_type, quantity_delta, unit, unit_cost, batch_lot, expiry_date, movement_date, reason, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $movement->execute([$key, $itemId, $type, $quantityDelta, $item['unit'], $unitCost, $lot, $movementExpiry, $date, trim($reason), $notes, $actor['id']]);
        $id = (int)$pdo->lastInsertId();
        auditEvent($pdo, $actor['id'], 'inventory.stock_' . $type, 'stock_movement', (string)$id, ['item_id' => $itemId]);
        $pdo->commit();
        respond(['id' => $id, 'item_id' => $itemId, 'movement_type' => $type, 'quantity_delta' => $quantityDelta, 'unit' => $item['unit'], 'status' => 'recorded'], 201);
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Stock movement failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
        if ($exception->getCode() === '23000') respond(['error' => 'Duplicate stock request'], 409);
        respond(['error' => 'Unable to record stock movement'], 500);
    }
}
respond(['error' => 'Unknown inventory action'], 400);
