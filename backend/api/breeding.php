<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    $statement = $pdo->prepare('SELECT e.*, p.tag_id AS pig_tag, r.tag_id AS related_tag, l.litter_code FROM breeding_events e JOIN pigs p ON p.id=e.pig_id LEFT JOIN pigs r ON r.id=e.related_pig_id LEFT JOIN litters l ON l.id=e.litter_id ORDER BY e.event_date DESC, e.id DESC LIMIT ?');
    $statement->bindValue(1, $limit, PDO::PARAM_INT);
    $statement->execute();
    respond($statement->fetchAll());
}
if ($method !== 'POST') respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
$pigId = filter_var($data['pig_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$relatedId = isset($data['related_pig_id']) && $data['related_pig_id'] !== '' ? filter_var($data['related_pig_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
$litterId = isset($data['litter_id']) && $data['litter_id'] !== '' ? filter_var($data['litter_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
$types = ['mating','insemination','pregnancy_check','farrowing','weaning','other'];
$type = $data['event_type'] ?? null;
$date = $data['event_date'] ?? null;
if (!$pigId || $relatedId === false || $litterId === false) respond(['error' => 'Animal IDs must be valid record IDs'], 422);
if (!is_string($type) || !in_array($type, $types, true)) respond(['error' => 'Choose a valid breeding event type'], 422);
if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4)) || $date > date('Y-m-d')) respond(['error' => 'Event date must be a valid date no later than today'], 422);
$textFields = ['method' => 120, 'result' => 255, 'notes' => 5000];
$values = [];
foreach ($textFields as $field => $limit) {
    $value = $data[$field] ?? null;
    if ($value !== null && (!is_string($value) || mb_strlen($value) > $limit)) respond(['error' => ucfirst($field) . " must be text with at most $limit characters"], 422);
    $values[$field] = $value === null ? null : trim($value);
}
try {
    $pdo->beginTransaction();
    $check = $pdo->prepare('SELECT id, sex FROM pigs WHERE id=? AND archived_at IS NULL');
    $check->execute([$pigId]);
    $primary = $check->fetch();
    if (!$primary) { $pdo->rollBack(); respond(['error' => 'Pig record not found'], 404); }
    if (in_array($type, ['mating','insemination'], true) && $primary['sex'] !== 'female') { $pdo->rollBack(); respond(['error' => 'The primary animal for mating must be female'], 422); }
    if ($relatedId !== null) {
        $check->execute([$relatedId]);
        $related = $check->fetch();
        if (!$related || $relatedId === $pigId) { $pdo->rollBack(); respond(['error' => 'Related pig record is invalid'], 422); }
        if (in_array($type, ['mating','insemination'], true) && $related['sex'] !== 'male') { $pdo->rollBack(); respond(['error' => 'The related animal for mating must be male'], 422); }
    }
    if ($litterId !== null) {
        $checkLitter = $pdo->prepare('SELECT id FROM litters WHERE id=? AND archived_at IS NULL');
        $checkLitter->execute([$litterId]);
        if (!$checkLitter->fetch()) { $pdo->rollBack(); respond(['error' => 'Litter record not found'], 422); }
    }
    $statement = $pdo->prepare('INSERT INTO breeding_events (pig_id, related_pig_id, litter_id, event_type, event_date, method, result, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $statement->execute([$pigId, $relatedId, $litterId, $type, $date, $values['method'], $values['result'], $values['notes'], $actor['id']]);
    $id = (int)$pdo->lastInsertId();
    auditEvent($pdo, $actor['id'], 'breeding.event_created', 'breeding_event', (string)$id, ['type' => $type, 'pig_id' => $pigId]);
    $pdo->commit();
    respond(['id' => $id, 'pig_id' => $pigId, 'related_pig_id' => $relatedId, 'litter_id' => $litterId, 'event_type' => $type, 'event_date' => $date, ...$values], 201);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Breeding event save failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    respond(['error' => 'Unable to save breeding event'], 500);
}
