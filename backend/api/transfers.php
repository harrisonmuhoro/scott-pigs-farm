<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$groupPenCheck = $pdo->query("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='herd_groups' AND column_name='current_pen_id'");
$hasGroupPens = (int)$groupPenCheck->fetchColumn() === 1;
if ($method === 'GET') {
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    $statement = $pdo->prepare('SELECT t.id, t.pig_id, p.tag_id, t.from_pen_id, f.code AS from_pen, t.to_pen_id, d.code AS to_pen, t.transferred_on, t.reason FROM pig_transfers t JOIN pigs p ON p.id=t.pig_id LEFT JOIN pens f ON f.id=t.from_pen_id LEFT JOIN pens d ON d.id=t.to_pen_id ORDER BY t.transferred_on DESC, t.id DESC LIMIT ?');
    $statement->bindValue(1, $limit, PDO::PARAM_INT);
    $statement->execute();
    respond($statement->fetchAll());
}
if ($method !== 'POST') respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
$pigId = filter_var($data['pig_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$toValue = $data['to_pen_id'] ?? null;
$toPenId = $toValue === null || $toValue === '' ? null : filter_var($toValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$date = $data['transferred_on'] ?? null;
$reason = $data['reason'] ?? null;
if (!$pigId || ($toValue !== null && $toValue !== '' && $toPenId === false)) respond(['error' => 'Choose a valid pig and destination pen'], 422);
if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4)) || $date > date('Y-m-d')) respond(['error' => 'Transfer date must be a valid date no later than today'], 422);
if (!is_string($reason) || trim($reason) === '' || mb_strlen($reason) > 1000) respond(['error' => 'Transfer reason is required and must be at most 1000 characters'], 422);
try {
    $pdo->beginTransaction();
    $pigStmt = $pdo->prepare('SELECT id, pen_id, lifecycle_status FROM pigs WHERE id=? AND archived_at IS NULL FOR UPDATE');
    $pigStmt->execute([$pigId]);
    $pig = $pigStmt->fetch();
    if (!$pig || in_array($pig['lifecycle_status'], ['sold','deceased'], true)) { $pdo->rollBack(); respond(['error' => 'Pig is unavailable for transfer'], 409); }
    $fromPenId = $pig['pen_id'] === null ? null : (int)$pig['pen_id'];
    if ($fromPenId === $toPenId) { $pdo->rollBack(); respond(['error' => 'Choose a different destination'], 422); }
    if ($toPenId !== null) {
        $penStmt = $pdo->prepare('SELECT id, capacity, active FROM pens WHERE id=? FOR UPDATE');
        $penStmt->execute([$toPenId]);
        $pen = $penStmt->fetch();
        if (!$pen || !(bool)$pen['active']) { $pdo->rollBack(); respond(['error' => 'Destination pen is unavailable'], 422); }
        $occupancyStmt = $pdo->prepare("SELECT COUNT(*) FROM pigs WHERE pen_id=? AND archived_at IS NULL AND lifecycle_status NOT IN ('sold','deceased')");
        $occupancyStmt->execute([$toPenId]);
        $occupancy = (int)$occupancyStmt->fetchColumn();
        if ($hasGroupPens) {
            $groupStmt = $pdo->prepare('SELECT COALESCE(SUM(head_count),0) FROM herd_groups WHERE current_pen_id=? AND archived_at IS NULL');
            $groupStmt->execute([$toPenId]);
            $occupancy += (int)$groupStmt->fetchColumn();
        }
        if ($occupancy >= (int)$pen['capacity']) { $pdo->rollBack(); respond(['error' => 'Destination pen is at capacity'], 409); }
    }
    $insert = $pdo->prepare('INSERT INTO pig_transfers (pig_id, from_pen_id, to_pen_id, transferred_on, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)');
    $insert->execute([$pigId, $fromPenId, $toPenId, $date, trim($reason), $actor['id']]);
    $transferId = (int)$pdo->lastInsertId();
    $update = $pdo->prepare('UPDATE pigs SET pen_id=? WHERE id=?');
    $update->execute([$toPenId, $pigId]);
    auditEvent($pdo, $actor['id'], 'pig.transferred', 'pig_transfer', (string)$transferId, ['pig_id' => $pigId, 'from_pen_id' => $fromPenId, 'to_pen_id' => $toPenId]);
    $pdo->commit();
    respond(['id' => $transferId, 'pig_id' => $pigId, 'from_pen_id' => $fromPenId, 'to_pen_id' => $toPenId, 'transferred_on' => $date, 'reason' => trim($reason)], 201);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Pig transfer failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    respond(['error' => 'Unable to record transfer'], 500);
}
