<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    $pigId = isset($_GET['pig_id']) ? filter_var($_GET['pig_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
    if (isset($_GET['pig_id']) && !$pigId) respond(['error' => 'Invalid pig ID'], 422);
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    $offset = max(0, min(1000000, (int)($_GET['offset'] ?? 0)));
    $sql = 'SELECT w.id, w.pig_id, p.tag_id, w.measured_at, w.weight_kg, w.notes FROM weight_records w JOIN pigs p ON p.id=w.pig_id';
    if ($pigId) $sql .= ' WHERE w.pig_id=?';
    $sql .= ' ORDER BY w.measured_at DESC, w.id DESC LIMIT ? OFFSET ?';
    $statement = $pdo->prepare($sql);
    $param = 1;
    if ($pigId) $statement->bindValue($param++, $pigId, PDO::PARAM_INT);
    $statement->bindValue($param++, $limit, PDO::PARAM_INT);
    $statement->bindValue($param, $offset, PDO::PARAM_INT);
    $statement->execute();
    respond($statement->fetchAll());
}
if ($method !== 'POST') respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
$pigId = filter_var($data['pig_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$date = $data['measured_at'] ?? null;
$weight = $data['weight_kg'] ?? null;
if (!$pigId) respond(['error' => 'Choose a valid pig'], 422);
if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4))) respond(['error' => 'Measurement date must use YYYY-MM-DD'], 422);
if ($date > date('Y-m-d')) respond(['error' => 'Measurement date cannot be in the future'], 422);
if (!is_scalar($weight) || preg_match('/^(?:\d{1,4})(?:\.\d{1,3})?$/', (string)$weight) !== 1 || (float)$weight <= 0 || (float)$weight > 1500) respond(['error' => 'Weight must be greater than 0 and at most 1500 kg, with up to 3 decimals'], 422);
$notes = $data['notes'] ?? null;
if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 1000)) respond(['error' => 'Notes must be text with at most 1000 characters'], 422);
$statement = $pdo->prepare('SELECT tag_id FROM pigs WHERE id=? AND archived_at IS NULL');
$statement->execute([$pigId]);
$pig = $statement->fetch();
if (!$pig) respond(['error' => 'Pig record not found'], 404);
try {
    $statement = $pdo->prepare('INSERT INTO weight_records (pig_id, measured_at, weight_kg, notes, created_by) VALUES (?, ?, ?, ?, ?)');
    $statement->execute([$pigId, $date, (string)$weight, $notes, $actor['id']]);
    $recordId = (int)$pdo->lastInsertId();
    auditEvent($pdo, $actor['id'], 'pig.weight_recorded', 'weight_record', (string)$recordId, ['pig_id' => $pigId]);
    respond(['id' => $recordId, 'pig_id' => $pigId, 'tag_id' => $pig['tag_id'], 'measured_at' => $date, 'weight_kg' => (string)$weight, 'notes' => $notes], 201);
} catch (PDOException $exception) {
    error_log('Weight record insert failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    respond(['error' => 'Unable to save weight record'], 500);
}
