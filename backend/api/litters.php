<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function litterDate(mixed $value, string $field): ?string
{
    if ($value === null || $value === '') return null;
    if (!is_string($value)) respond(['error' => "$field must be a date"], 422);
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) respond(['error' => "$field must use YYYY-MM-DD"], 422);
    return $value;
}

if ($method === 'GET') {
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    $offset = max(0, min(1000000, (int)($_GET['offset'] ?? 0)));
    $statement = $pdo->prepare('SELECT l.*, d.tag_id AS dam_tag, s.tag_id AS sire_tag FROM litters l JOIN pigs d ON d.id=l.dam_id LEFT JOIN pigs s ON s.id=l.sire_id WHERE l.archived_at IS NULL ORDER BY COALESCE(l.farrowing_date, l.expected_farrowing_date) DESC, l.id DESC LIMIT ? OFFSET ?');
    $statement->bindValue(1, $limit, PDO::PARAM_INT);
    $statement->bindValue(2, $offset, PDO::PARAM_INT);
    $statement->execute();
    respond($statement->fetchAll());
}
if (!in_array($method, ['POST', 'PUT'], true)) respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
$id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (($method === 'PUT' && !$id) || ($method === 'POST' && isset($data['id']))) respond(['error' => 'Invalid litter ID'], 422);
foreach (['litter_code', 'dam_id'] as $field) {
    if (!isset($data[$field]) || !is_scalar($data[$field])) respond(['error' => ucfirst(str_replace('_', ' ', $field)) . ' is required'], 422);
}
$code = trim((string)$data['litter_code']);
if ($code === '' || mb_strlen($code) > 64) respond(['error' => 'Litter code is required and must be 64 characters or fewer'], 422);
$damId = filter_var($data['dam_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$sireId = isset($data['sire_id']) && $data['sire_id'] !== '' ? filter_var($data['sire_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
if (!$damId || ($sireId === false)) respond(['error' => 'Dam and sire IDs must be valid record IDs'], 422);
$matingDate = litterDate($data['mating_date'] ?? null, 'Mating date');
$expectedDate = litterDate($data['expected_farrowing_date'] ?? null, 'Expected farrowing date');
if ($expectedDate === null && $matingDate !== null) {
    $gestationDays = filter_var(getenv('SCOTT_GESTATION_DAYS') ?: '114', FILTER_VALIDATE_INT, ['options' => ['min_range' => 100, 'max_range' => 130]]);
    if ($gestationDays === false) respond(['error' => 'Farm gestation setting is invalid'], 500);
    $expectedDate = (new DateTimeImmutable($matingDate))->modify('+' . $gestationDays . ' days')->format('Y-m-d');
}
if ($expectedDate === null) respond(['error' => 'Enter a mating date or expected farrowing date'], 422);
$farrowingDate = litterDate($data['farrowing_date'] ?? null, 'Actual farrowing date');
$weanedDate = litterDate($data['weaned_date'] ?? null, 'Weaned date');
if ($matingDate !== null && $expectedDate <= $matingDate) respond(['error' => 'Expected farrowing must be after mating'], 422);
if ($matingDate !== null && $farrowingDate !== null && $farrowingDate < $matingDate) respond(['error' => 'Actual farrowing cannot be before mating'], 422);
if ($farrowingDate !== null && $farrowingDate > date('Y-m-d')) respond(['error' => 'Actual farrowing date cannot be in the future'], 422);

function optionalCount(array $data, string $field): ?int
{
    if (!array_key_exists($field, $data) || $data[$field] === '' || $data[$field] === null) return null;
    if (filter_var($data[$field], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 9999]]) === false) respond([ 'error' => ucfirst(str_replace('_', ' ', $field)) . ' must be a non-negative whole number'], 422);
    return (int)$data[$field];
}
$totalBorn = optionalCount($data, 'total_born');
$bornAlive = optionalCount($data, 'born_alive');
$stillborn = optionalCount($data, 'stillborn');
$fostered = optionalCount($data, 'fostered') ?? 0;
$weanedCount = optionalCount($data, 'weaned_count');
if ($farrowingDate === null && ($totalBorn !== null || $bornAlive !== null || $stillborn !== null || $weanedCount !== null || $weanedDate !== null)) respond(['error' => 'Record farrowing before entering litter counts'], 422);
if ($farrowingDate !== null && ($totalBorn === null || $bornAlive === null || $stillborn === null)) respond(['error' => 'Total born, born alive, and stillborn counts are required for a completed farrowing'], 422);
if ($totalBorn !== null && $bornAlive !== null && $stillborn !== null && $bornAlive + $stillborn > $totalBorn) respond(['error' => 'Born alive plus stillborn cannot exceed total born'], 422);
if ($weanedCount !== null && ($bornAlive === null || $weanedCount > $bornAlive + $fostered)) respond(['error' => 'Weaned count cannot exceed born-alive plus fostered piglets'], 422);
if ($weanedDate !== null && ($weanedCount === null || $farrowingDate === null)) respond(['error' => 'Enter farrowing and weaned counts before the weaned date'], 422);
if ($weanedDate !== null && $farrowingDate !== null && $weanedDate < $farrowingDate) respond(['error' => 'Weaned date cannot be before farrowing'], 422);
$notes = $data['notes'] ?? null;
if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 5000)) respond(['error' => 'Notes must be text with at most 5000 characters'], 422);

try {
    $pdo->beginTransaction();
    foreach ([[(int)$damId, 'female', 'Dam'], [$sireId, 'male', 'Sire']] as [$animalId, $requiredSex, $label]) {
        if ($animalId === null) continue;
        $animal = $pdo->prepare('SELECT sex FROM pigs WHERE id=? AND archived_at IS NULL');
        $animal->execute([$animalId]);
        $record = $animal->fetch();
        if (!$record || $record['sex'] !== $requiredSex) { $pdo->rollBack(); respond(['error' => "$label must reference an active pig with sex $requiredSex"], 422); }
    }
    $values = [$code, (int)$damId, $sireId, $matingDate, $expectedDate, 1, $farrowingDate, $totalBorn, $bornAlive, $stillborn, $fostered, $weanedCount, $weanedDate, $notes];
    if ($method === 'POST') {
        $statement = $pdo->prepare('INSERT INTO litters (litter_code, dam_id, sire_id, mating_date, expected_farrowing_date, expected_date_estimated, farrowing_date, total_born, born_alive, stillborn, fostered, weaned_count, weaned_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([...$values, $actor['id']]);
        $litterId = (int)$pdo->lastInsertId();
    } else {
        $statement = $pdo->prepare('UPDATE litters SET litter_code=?, dam_id=?, sire_id=?, mating_date=?, expected_farrowing_date=?, expected_date_estimated=?, farrowing_date=?, total_born=?, born_alive=?, stillborn=?, fostered=?, weaned_count=?, weaned_date=?, notes=? WHERE id=? AND archived_at IS NULL');
        $statement->execute([...$values, (int)$id]);
        $litterId = (int)$id;
    }
    $pdo->commit();
    auditEvent($pdo, $actor['id'], $method === 'POST' ? 'litter.created' : 'litter.updated', 'litter', (string)$litterId);
    $result = $pdo->prepare('SELECT l.*, d.tag_id AS dam_tag, s.tag_id AS sire_tag FROM litters l JOIN pigs d ON d.id=l.dam_id LEFT JOIN pigs s ON s.id=l.sire_id WHERE l.id=?');
    $result->execute([$litterId]);
    respond($result->fetch(), $method === 'POST' ? 201 : 200);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Litter save failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    if ($exception->getCode() === '23000') respond(['error' => 'Litter code already exists or a related record is invalid'], 409);
    respond(['error' => 'Unable to save litter record'], 500);
}
