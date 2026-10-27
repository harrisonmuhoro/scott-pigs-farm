<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$photoTableCheck = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='pig_photos'");
$photoTableCheck->execute();
$photoExpression = (int)$photoTableCheck->fetchColumn() > 0
    ? 'EXISTS(SELECT 1 FROM pig_photos pp WHERE pp.pig_id=pigs.id) AS has_photo'
    : '0 AS has_photo';

function validDateOrNull(mixed $value, string $field): ?string
{
    if ($value === null || $value === '') return null;
    if (!is_string($value)) respond(['error' => "$field must be a date"], 422);
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) respond(['error' => "$field must use YYYY-MM-DD"], 422);
    return $value;
}

if ($method === 'GET') {
    $search = trim((string)($_GET['search'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));
    $conditions = ['archived_at IS NULL'];
    $parameters = [];
    if ($search !== '') {
        $conditions[] = '(tag_id LIKE ? OR name LIKE ? OR breed LIKE ?)';
        $term = '%' . mb_substr($search, 0, 80) . '%';
        array_push($parameters, $term, $term, $term);
    }
    if ($status !== '') {
        $conditions[] = 'lifecycle_status = ?';
        $parameters[] = $status;
    }
    $limit = max(1, min(500, (int)($_GET['limit'] ?? 200)));
    $offset = max(0, min(1000000, (int)($_GET['offset'] ?? 0)));
    $statement = $pdo->prepare('SELECT id, tag_id, name, sex, breed, birth_date, birth_date_estimated, source, acquired_date, dam_id, sire_id, litter_id, herd_group_id, pen_id, lifecycle_status, notes, ' . $photoExpression . ', created_at, updated_at FROM pigs WHERE ' . implode(' AND ', $conditions) . ' ORDER BY id DESC LIMIT ? OFFSET ?');
    foreach ($parameters as $index => $parameter) $statement->bindValue($index + 1, $parameter, PDO::PARAM_STR);
    $statement->bindValue(count($parameters) + 1, $limit, PDO::PARAM_INT);
    $statement->bindValue(count($parameters) + 2, $offset, PDO::PARAM_INT);
    $statement->execute();
    respond($statement->fetchAll());
}

if ($method === 'POST' || $method === 'PUT') {
    requireCsrf();
    $data = readJsonBody();
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (($method === 'PUT' && !$id) || ($method === 'POST' && isset($data['id']))) respond(['error' => 'Invalid pig identifier'], 422);
    foreach (['tag_id', 'breed', 'sex', 'lifecycle_status', 'name', 'source'] as $stringField) {
        if (isset($data[$stringField]) && !is_string($data[$stringField])) respond(['error' => ucfirst(str_replace('_', ' ', $stringField)) . ' must be text'], 422);
    }
    $tag = trim((string)($data['tag_id'] ?? ''));
    $breed = trim((string)($data['breed'] ?? ''));
    $sex = (string)($data['sex'] ?? 'unknown');
    $status = (string)($data['lifecycle_status'] ?? 'piglet');
    $statuses = ['piglet','weaner','grower','finisher','breeding_gilt','sow','boar','sold','deceased','transferred'];
    if ($tag === '' || mb_strlen($tag) > 64) respond(['error' => 'Tag ID is required and must be 64 characters or fewer'], 422);
    if ($breed === '' || mb_strlen($breed) > 100) respond(['error' => 'Breed is required and must be 100 characters or fewer'], 422);
    if (!in_array($sex, ['female', 'male', 'unknown'], true)) respond(['error' => 'Choose a valid sex'], 422);
    if (!in_array($status, $statuses, true)) respond(['error' => 'Choose a valid lifecycle status'], 422);
    $birthDate = validDateOrNull($data['birth_date'] ?? null, 'Birth date');
    $acquiredDate = validDateOrNull($data['acquired_date'] ?? null, 'Acquisition date');
    if ($birthDate !== null && $birthDate > date('Y-m-d')) respond(['error' => 'Birth date cannot be in the future'], 422);
    if ($acquiredDate !== null && $acquiredDate > date('Y-m-d')) respond(['error' => 'Acquisition date cannot be in the future'], 422);
    $estimatedValue = $data['birth_date_estimated'] ?? false;
    if (!is_bool($estimatedValue) && !is_scalar($estimatedValue)) respond(['error' => 'Estimated date flag must be true or false'], 422);
    $estimated = filter_var($estimatedValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($estimated === null || ($estimated && $birthDate === null)) respond(['error' => 'An estimated birth date must include a date'], 422);
    foreach (['name' => 100, 'source' => 255] as $field => $max) {
        if (isset($data[$field]) && (!is_string($data[$field]) || mb_strlen(trim($data[$field])) > $max)) respond(['error' => ucfirst($field) . " must be $max characters or fewer"], 422);
    }
    $damValue = $data['dam_id'] ?? null;
    $sireValue = $data['sire_id'] ?? null;
    $damId = $damValue === null || $damValue === '' ? null : filter_var($damValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $sireId = $sireValue === null || $sireValue === '' ? null : filter_var($sireValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (($damValue !== null && $damValue !== '' && $damId === false) || ($sireValue !== null && $sireValue !== '' && $sireId === false)) respond(['error' => 'Parent IDs must be valid positive record IDs'], 422);
    $litterValue = $data['litter_id'] ?? null;
    $litterId = $litterValue === null || $litterValue === '' ? null : filter_var($litterValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($litterValue !== null && $litterValue !== '' && $litterId === false) respond(['error' => 'Litter ID must be a valid record ID'], 422);
    $groupValue = $data['herd_group_id'] ?? null;
    $herdGroupId = $groupValue === null || $groupValue === '' ? null : filter_var($groupValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($groupValue !== null && $groupValue !== '' && $herdGroupId === false) respond(['error' => 'Herd group ID must be a valid record ID'], 422);
    if ($id && ($damId === (int)$id || $sireId === (int)$id)) respond(['error' => 'A pig cannot be its own parent'], 422);
    if (isset($data['notes']) && !is_string($data['notes'])) respond(['error' => 'Notes must be text'], 422);
    $notes = isset($data['notes']) ? trim($data['notes']) : null;
    if ($notes !== null && mb_strlen($notes) > 5000) respond(['error' => 'Notes must be 5000 characters or fewer'], 422);

    try {
        $pdo->beginTransaction();
        foreach ([[$damId, 'female', 'Dam'], [$sireId, 'male', 'Sire']] as [$parentId, $requiredSex, $label]) {
            if ($parentId === null) continue;
            $parent = $pdo->prepare('SELECT sex FROM pigs WHERE id = ? AND archived_at IS NULL');
            $parent->execute([$parentId]);
            $parentRow = $parent->fetch();
            if (!$parentRow) { $pdo->rollBack(); respond(['error' => "$label must reference an active pig"], 422); }
            if ($parentRow['sex'] !== 'unknown' && $parentRow['sex'] !== $requiredSex) { $pdo->rollBack(); respond(['error' => "$label has an incompatible sex"], 422); }
        }
        if ($litterId !== null) {
            $litter = $pdo->prepare('SELECT id FROM litters WHERE id=? AND archived_at IS NULL');
            $litter->execute([$litterId]);
            if (!$litter->fetch()) { $pdo->rollBack(); respond(['error' => 'Litter must reference an active record'], 422); }
        }
        if ($herdGroupId !== null) {
            $group = $pdo->prepare("SELECT id, lifecycle_status FROM herd_groups WHERE id=? AND archived_at IS NULL");
            $group->execute([$herdGroupId]);
            $groupRow = $group->fetch();
            if (!$groupRow || $groupRow['lifecycle_status'] !== 'active') { $pdo->rollBack(); respond(['error' => 'Herd group must reference an active record'], 422); }
        }
        $values = [$tag, trim((string)($data['name'] ?? '')) ?: null, $sex, $breed, $birthDate, $estimated ? 1 : 0, trim((string)($data['source'] ?? '')) ?: null, $acquiredDate, $damId, $sireId, $litterId, $herdGroupId, $status, $notes];
        if ($method === 'POST') {
            $statement = $pdo->prepare('INSERT INTO pigs (tag_id, name, sex, breed, birth_date, birth_date_estimated, source, acquired_date, dam_id, sire_id, litter_id, herd_group_id, lifecycle_status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute([...$values, $actor['id']]);
            $pigId = (int)$pdo->lastInsertId();
        } else {
            $statement = $pdo->prepare('UPDATE pigs SET tag_id=?, name=?, sex=?, breed=?, birth_date=?, birth_date_estimated=?, source=?, acquired_date=?, dam_id=?, sire_id=?, litter_id=?, herd_group_id=?, lifecycle_status=?, notes=? WHERE id=? AND archived_at IS NULL');
            $statement->execute([...$values, (int)$id]);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT id FROM pigs WHERE id = ? AND archived_at IS NULL');
                $exists->execute([(int)$id]);
                if (!$exists->fetch()) { $pdo->rollBack(); respond(['error' => 'Pig record not found'], 404); }
            }
            $pigId = (int)$id;
        }
        $pdo->commit();
        auditEvent($pdo, $actor['id'], $method === 'POST' ? 'pig.created' : 'pig.updated', 'pig', (string)$pigId);
            $statement = $pdo->prepare('SELECT id, tag_id, name, sex, breed, birth_date, birth_date_estimated, source, acquired_date, dam_id, sire_id, litter_id, herd_group_id, pen_id, lifecycle_status, notes, ' . $photoExpression . ', created_at, updated_at FROM pigs WHERE id = ?');
        $statement->execute([$pigId]);
        respond($statement->fetch(), $method === 'POST' ? 201 : 200);
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Pig save failed: ' . $exception->getMessage());
        if ($exception->getCode() === '23000') respond(['error' => 'Tag ID already exists or a related record is invalid'], 409);
        respond(['error' => 'Unable to save pig record'], 500);
    }
}

if ($method === 'DELETE') {
    requireCsrf();
    $data = readJsonBody();
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$id) respond(['error' => 'A valid pig ID is required'], 422);
    $statement = $pdo->prepare("UPDATE pigs SET archived_at = CURRENT_TIMESTAMP WHERE id = ? AND archived_at IS NULL AND lifecycle_status IN ('sold','deceased')");
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) respond(['error' => 'Only sold or deceased pigs can be archived'], 409);
    auditEvent($pdo, $actor['id'], 'pig.archived', 'pig', (string)$id);
    http_response_code(204);
    exit;
}
respond(['error' => 'Method not allowed'], 405);
