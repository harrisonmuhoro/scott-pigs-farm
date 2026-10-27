<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$groupPenCheck = $pdo->query("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='herd_groups' AND column_name='current_pen_id'");
$hasGroupPens = (int)$groupPenCheck->fetchColumn() === 1;
if ($method === 'GET') {
    requireRole(['owner']);
    $groupCount = $hasGroupPens ? " + COALESCE((SELECT SUM(g.head_count) FROM herd_groups g WHERE g.current_pen_id=p.id AND g.archived_at IS NULL),0)" : '';
    $statement = $pdo->query("SELECT p.id, p.code, p.name, p.capacity, p.notes, p.active, (SELECT COUNT(*) FROM pigs a WHERE a.pen_id=p.id AND a.archived_at IS NULL AND a.lifecycle_status NOT IN ('sold','deceased'))$groupCount AS occupancy FROM pens p ORDER BY p.code");
    respond($statement->fetchAll());
}
$actor = requireRole(['owner']);
if (!in_array($method, ['POST', 'PATCH'], true)) respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
$id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (($method === 'PATCH' && !$id) || ($method === 'POST' && isset($data['id']))) respond(['error' => 'Invalid pen ID'], 422);
$code = $data['code'] ?? null;
$name = $data['name'] ?? null;
$capacity = filter_var($data['capacity'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 32767]]);
$notes = $data['notes'] ?? null;
if (!is_string($code) || trim($code) === '' || mb_strlen(trim($code)) > 64) respond(['error' => 'Pen code is required and must be at most 64 characters'], 422);
if (!is_string($name) || trim($name) === '' || mb_strlen(trim($name)) > 120) respond(['error' => 'Pen name is required and must be at most 120 characters'], 422);
if ($capacity === false) respond(['error' => 'Capacity must be a positive whole number'], 422);
if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 2000)) respond(['error' => 'Notes must be text with at most 2000 characters'], 422);
try {
    if ($method === 'POST') {
        $statement = $pdo->prepare('INSERT INTO pens (code, name, capacity, notes) VALUES (?, ?, ?, ?)');
        $statement->execute([trim($code), trim($name), $capacity, $notes]);
        $id = (int)$pdo->lastInsertId();
        auditEvent($pdo, $actor['id'], 'pen.created', 'pen', (string)$id);
    } else {
        if (isset($data['active']) && !is_bool($data['active'])) respond(['error' => 'Active must be true or false'], 422);
        $pdo->beginTransaction();
        $lock = $pdo->prepare('SELECT id FROM pens WHERE id=? FOR UPDATE');
        $lock->execute([$id]);
        if (!$lock->fetch()) { $pdo->rollBack(); respond(['error' => 'Pen not found'], 404); }
        $count = $pdo->prepare("SELECT COUNT(*) FROM pigs WHERE pen_id=? AND archived_at IS NULL AND lifecycle_status NOT IN ('sold','deceased')");
        $count->execute([$id]);
        $occupancy = (int)$count->fetchColumn();
        if ($hasGroupPens) {
            $groups = $pdo->prepare('SELECT COALESCE(SUM(head_count),0) FROM herd_groups WHERE current_pen_id=? AND archived_at IS NULL');
            $groups->execute([$id]);
            $occupancy += (int)$groups->fetchColumn();
        }
        $active = array_key_exists('active', $data) ? (bool)$data['active'] : true;
        if ($capacity < $occupancy) { $pdo->rollBack(); respond(['error' => 'Capacity cannot be lower than current animal occupancy'], 409); }
        if (!$active && $occupancy > 0) { $pdo->rollBack(); respond(['error' => 'Move pigs and groups out before deactivating this pen'], 409); }
        $statement = $pdo->prepare('UPDATE pens SET code=?, name=?, capacity=?, notes=?, active=? WHERE id=?');
        $statement->execute([trim($code), trim($name), $capacity, $notes, $active ? 1 : 0, $id]);
        auditEvent($pdo, $actor['id'], 'pen.updated', 'pen', (string)$id);
        $pdo->commit();
    }
    $groupCount = $hasGroupPens ? ' + COALESCE((SELECT SUM(g.head_count) FROM herd_groups g WHERE g.current_pen_id=p.id AND g.archived_at IS NULL),0)' : '';
    $statement = $pdo->prepare("SELECT p.id, p.code, p.name, p.capacity, p.notes, p.active, ((SELECT COUNT(*) FROM pigs a WHERE a.pen_id=p.id AND a.archived_at IS NULL AND a.lifecycle_status NOT IN ('sold','deceased'))$groupCount) AS occupancy FROM pens p WHERE p.id=?");
    $statement->execute([$id]);
    respond($statement->fetch(), $method === 'POST' ? 201 : 200);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Pen save failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    if ($exception->getCode() === '23000') respond(['error' => 'Pen code already exists'], 409);
    respond(['error' => 'Unable to save pen'], 500);
}
