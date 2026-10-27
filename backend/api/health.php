<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$resource = (string)($_GET['resource'] ?? 'records');

function healthDate(mixed $value, string $field, bool $required = false): ?string
{
    if ($value === null || $value === '') {
        if ($required) respond(['error' => "$field is required"], 422);
        return null;
    }
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || !checkdate((int)substr($value, 5, 2), (int)substr($value, 8, 2), (int)substr($value, 0, 4))) respond(['error' => "$field must use YYYY-MM-DD"], 422);
    return $value;
}

if ($method === 'GET') {
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    if ($resource === 'schedules') {
        $statement = $pdo->prepare('SELECT v.*, p.tag_id, l.litter_code FROM vaccination_schedules v LEFT JOIN pigs p ON p.id=v.pig_id LEFT JOIN litters l ON l.id=v.litter_id ORDER BY v.due_date ASC LIMIT ?');
        $statement->bindValue(1, $limit, PDO::PARAM_INT);
        $statement->execute();
        respond($statement->fetchAll());
    }
    if ($resource === 'reminders') {
        $statement = $pdo->prepare("(SELECT v.id AS reminder_id, 'vaccination' AS reminder_type, vaccine_name AS title, due_date, CASE WHEN due_date < CURRENT_DATE THEN 'overdue' ELSE 'due' END AS reminder_status, COALESCE(p.tag_id, l.litter_code) AS target FROM vaccination_schedules v LEFT JOIN pigs p ON p.id=v.pig_id LEFT JOIN litters l ON l.id=v.litter_id WHERE v.active=1 AND due_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)) UNION ALL (SELECT h.id AS reminder_id, 'follow_up', CONCAT(record_type, ' follow-up'), follow_up_due, CASE WHEN follow_up_due < CURRENT_DATE THEN 'overdue' ELSE 'due' END, COALESCE(p.tag_id, l.litter_code) FROM health_records h LEFT JOIN pigs p ON p.id=h.pig_id LEFT JOIN litters l ON l.id=h.litter_id WHERE follow_up_status='open' AND follow_up_due <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)) ORDER BY due_date LIMIT ?");
        $statement->bindValue(1, $limit, PDO::PARAM_INT);
        $statement->execute();
        respond($statement->fetchAll());
    }
    if ($resource !== 'records') respond(['error' => 'Unknown health resource'], 400);
    $where = [];
    $params = [];
    $pigId = isset($_GET['pig_id']) ? filter_var($_GET['pig_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
    $type = trim((string)($_GET['type'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));
    if (isset($_GET['pig_id']) && !$pigId) respond(['error' => 'Invalid pig ID'], 422);
    if ($pigId) { $where[] = 'h.pig_id=?'; $params[] = $pigId; }
    if ($type !== '') { if (!in_array($type, ['observation','treatment','vaccination'], true)) respond(['error' => 'Invalid health record type'], 422); $where[] = 'h.record_type=?'; $params[] = $type; }
    if ($status !== '') { if (!in_array($status, ['open','completed','cancelled'], true)) respond(['error' => 'Invalid follow-up status'], 422); $where[] = 'h.follow_up_status=?'; $params[] = $status; }
    if (isset($_GET['from'])) { $where[] = 'h.occurred_on>=?'; $params[] = healthDate($_GET['from'], 'From date', true); }
    if (isset($_GET['to'])) { $where[] = 'h.occurred_on<=?'; $params[] = healthDate($_GET['to'], 'To date', true); }
    $sql = 'SELECT h.*, p.tag_id, l.litter_code FROM health_records h LEFT JOIN pigs p ON p.id=h.pig_id LEFT JOIN litters l ON l.id=h.litter_id' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY h.occurred_on DESC, h.id DESC LIMIT ?';
    $statement = $pdo->prepare($sql);
    $index = 1;
    foreach ($params as $param) $statement->bindValue($index++, $param);
    $statement->bindValue($index, $limit, PDO::PARAM_INT);
    $statement->execute();
    respond($statement->fetchAll());
}

if (!in_array($method, ['POST','PATCH'], true)) respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
if ($method === 'PATCH' && $resource === 'records') {
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $status = (string)($data['follow_up_status'] ?? '');
    if (!$id || !in_array($status, ['open','completed','cancelled'], true)) respond(['error' => 'Invalid follow-up update'], 422);
    $statement = $pdo->prepare('UPDATE health_records SET follow_up_status=? WHERE id=?');
    $statement->execute([$status, $id]);
    if ($statement->rowCount() === 0) respond(['error' => 'Health record not found or unchanged'], 404);
    auditEvent($pdo, $actor['id'], 'health.followup_updated', 'health_record', (string)$id, ['status' => $status]);
    respond(['status' => 'success']);
}

if ($method === 'POST' && $resource === 'schedules') {
    $pigId = isset($data['pig_id']) && $data['pig_id'] !== '' ? filter_var($data['pig_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
    $litterId = isset($data['litter_id']) && $data['litter_id'] !== '' ? filter_var($data['litter_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
    $name = $data['vaccine_name'] ?? null;
    $dueDate = healthDate($data['due_date'] ?? null, 'Due date', true);
    $interval = isset($data['interval_days']) && $data['interval_days'] !== '' ? filter_var($data['interval_days'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 3650]]) : null;
    $notes = $data['notes'] ?? null;
    if (($pigId === false) || ($litterId === false) || (($pigId === null) === ($litterId === null))) respond(['error' => 'Choose exactly one valid pig or litter'], 422);
    if (!is_string($name) || trim($name) === '' || mb_strlen($name) > 255) respond(['error' => 'Vaccine name is required and must be at most 255 characters'], 422);
    if ($interval === false) respond(['error' => 'Interval must be 1–3650 days'], 422);
    if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 2000)) respond(['error' => 'Notes must be text with at most 2000 characters'], 422);
    $targetTable = $pigId ? 'pigs' : 'litters';
    $targetId = $pigId ?: $litterId;
    $check = $pdo->prepare("SELECT id FROM $targetTable WHERE id=? AND archived_at IS NULL");
    $check->execute([$targetId]);
    if (!$check->fetch()) respond(['error' => 'Selected animal or litter was not found'], 404);
    $statement = $pdo->prepare('INSERT INTO vaccination_schedules (pig_id, litter_id, vaccine_name, due_date, interval_days, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $statement->execute([$pigId, $litterId, trim($name), $dueDate, $interval, $notes, $actor['id']]);
    $id = (int)$pdo->lastInsertId();
    auditEvent($pdo, $actor['id'], 'vaccination.schedule_created', 'vaccination_schedule', (string)$id);
    respond(['id' => $id, 'pig_id' => $pigId, 'litter_id' => $litterId, 'vaccine_name' => trim($name), 'due_date' => $dueDate, 'interval_days' => $interval, 'notes' => $notes, 'active' => 1], 201);
}
if ($method === 'PATCH' && $resource === 'schedules') {
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $active = $data['active'] ?? null;
    if (!$id || !is_bool($active)) respond(['error' => 'A valid schedule ID and active flag are required'], 422);
    $statement = $pdo->prepare('UPDATE vaccination_schedules SET active=? WHERE id=?');
    $statement->execute([$active ? 1 : 0, $id]);
    auditEvent($pdo, $actor['id'], $active ? 'vaccination.schedule_activated' : 'vaccination.schedule_deactivated', 'vaccination_schedule', (string)$id);
    respond(['status' => 'success']);
}
if ($method !== 'POST' || $resource !== 'records') respond(['error' => 'Unknown health resource'], 400);

$pigId = isset($data['pig_id']) && $data['pig_id'] !== '' ? filter_var($data['pig_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
$litterId = isset($data['litter_id']) && $data['litter_id'] !== '' ? filter_var($data['litter_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
$type = (string)($data['record_type'] ?? '');
$date = healthDate($data['occurred_on'] ?? null, 'Record date', true);
if (($pigId === false) || ($litterId === false) || (($pigId === null) === ($litterId === null))) respond(['error' => 'Choose exactly one valid pig or litter'], 422);
if (!in_array($type, ['observation','treatment','vaccination'], true)) respond(['error' => 'Choose a valid health record type'], 422);
$followupDue = healthDate($data['follow_up_due'] ?? null, 'Follow-up due date');
$followupStatus = (string)($data['follow_up_status'] ?? 'open');
if (!in_array($followupStatus, ['open','completed','cancelled'], true)) respond(['error' => 'Invalid follow-up status'], 422);
$textFields = ['symptoms' => 5000, 'product_name' => 255, 'dose_as_entered' => 80, 'dose_unit' => 40, 'route' => 80, 'responsible_person' => 120, 'notes' => 5000];
$normalized = [];
foreach ($textFields as $field => $limit) {
    $value = $data[$field] ?? null;
    if ($value !== null && (!is_string($value) || mb_strlen($value) > $limit)) respond(['error' => ucfirst(str_replace('_', ' ', $field)) . " must be text with at most $limit characters"], 422);
    $normalized[$field] = $value === null ? null : (trim($value) ?: null);
}
$withdrawal = isset($data['withdrawal_days']) && $data['withdrawal_days'] !== '' ? filter_var($data['withdrawal_days'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 3650]]) : null;
if ($withdrawal === false) respond(['error' => 'Withdrawal days must be a non-negative whole number'], 422);
if ($type === 'treatment' && ($normalized['product_name'] === null || $normalized['dose_as_entered'] === null || $normalized['dose_unit'] === null)) respond(['error' => 'Treatment product, dose as entered, and unit are required'], 422);
if ($type === 'vaccination' && $normalized['product_name'] === null) respond(['error' => 'Vaccine name is required'], 422);
$targetTable = $pigId ? 'pigs' : 'litters';
$targetId = $pigId ?: $litterId;
$check = $pdo->prepare("SELECT id FROM $targetTable WHERE id=? AND archived_at IS NULL");
$check->execute([$targetId]);
if (!$check->fetch()) respond(['error' => 'Selected animal or litter was not found'], 404);
try {
    $statement = $pdo->prepare('INSERT INTO health_records (pig_id, litter_id, record_type, occurred_on, symptoms, product_name, dose_as_entered, dose_unit, route, withdrawal_days, responsible_person, follow_up_due, follow_up_status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $statement->execute([$pigId, $litterId, $type, $date, $normalized['symptoms'], $normalized['product_name'], $normalized['dose_as_entered'], $normalized['dose_unit'], $normalized['route'], $withdrawal, $normalized['responsible_person'], $followupDue, $followupStatus, $normalized['notes'], $actor['id']]);
    $id = (int)$pdo->lastInsertId();
    auditEvent($pdo, $actor['id'], 'health.record_created', 'health_record', (string)$id, ['type' => $type]);
    respond(['id' => $id, 'pig_id' => $pigId, 'litter_id' => $litterId, 'record_type' => $type, 'occurred_on' => $date, ...$normalized, 'withdrawal_days' => $withdrawal, 'follow_up_due' => $followupDue, 'follow_up_status' => $followupStatus], 201);
} catch (PDOException $exception) {
    error_log('Health record save failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    respond(['error' => 'Unable to save health record'], 500);
}
