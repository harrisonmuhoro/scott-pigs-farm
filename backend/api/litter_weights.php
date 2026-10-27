<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $limit = max(1, min(500, (int)($_GET['limit'] ?? 200)));
    $statement = $pdo->prepare('SELECT w.id, w.litter_id, l.litter_code, w.measured_at, w.sample_count, w.average_weight_kg, w.notes, w.created_at FROM litter_weight_records w JOIN litters l ON l.id=w.litter_id ORDER BY w.measured_at DESC, w.id DESC LIMIT ?');
    $statement->bindValue(1, $limit, PDO::PARAM_INT);
    $statement->execute();
    respond($statement->fetchAll());
}

if ($method !== 'POST') respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
$litterId = filter_var($data['litter_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (!$litterId) respond(['error' => 'Choose a valid litter group'], 422);
$litterCheck = $pdo->prepare('SELECT id FROM litters WHERE id=? AND archived_at IS NULL');
$litterCheck->execute([$litterId]);
if (!$litterCheck->fetch()) respond(['error' => 'Litter group not found'], 404);

$date = $data['measured_at'] ?? null;
if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4)) || $date > date('Y-m-d')) respond(['error' => 'Measurement date must be valid and no later than today'], 422);
$sampleCount = filter_var($data['sample_count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]);
if (!$sampleCount) respond(['error' => 'Sample count must be between 1 and 1000 animals'], 422);
$average = $data['average_weight_kg'] ?? null;
if (!is_scalar($average) || !preg_match('/^\d{1,3}(?:\.\d{1,3})?$/', (string)$average) || preg_match('/^0+(?:\.0+)?$/', (string)$average)) respond(['error' => 'Average weight must be positive and use up to three decimals'], 422);
$notes = $data['notes'] ?? null;
if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 1000)) respond(['error' => 'Notes must be at most 1000 characters'], 422);

$statement = $pdo->prepare('INSERT INTO litter_weight_records (litter_id, measured_at, sample_count, average_weight_kg, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)');
$statement->execute([$litterId, $date, $sampleCount, (string)$average, $notes === null ? null : trim($notes), $actor['id']]);
$id = (int)$pdo->lastInsertId();
auditEvent($pdo, $actor['id'], 'litter.group_weight_recorded', 'litter_weight', (string)$id, ['litter_id' => $litterId, 'sample_count' => $sampleCount]);
respond(['id' => (string)$id, 'litter_id' => (string)$litterId, 'measured_at' => $date, 'sample_count' => $sampleCount, 'average_weight_kg' => (string)$average, 'notes' => $notes === null ? null : trim($notes)], 201);
