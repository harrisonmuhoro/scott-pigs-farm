<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$schema = $pdo->query("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='herd_groups' AND column_name='current_pen_id') OR (table_name='herd_group_events' AND column_name='from_pen_id'))");
if ((int)$schema->fetchColumn() < 2) respond(['error' => 'Apply migrations 013_herd_groups.sql and 014_herd_group_pens.sql before using herd groups'], 503);

function penOccupancy(PDO $pdo, int $penId, ?int $exceptGroup = null): int
{
    $groupFilter = $exceptGroup === null ? '' : ' AND id<>?';
    $statement = $pdo->prepare("SELECT (SELECT COUNT(*) FROM pigs WHERE pen_id=? AND archived_at IS NULL AND lifecycle_status NOT IN ('sold','deceased')) + (SELECT COALESCE(SUM(head_count),0) FROM herd_groups WHERE current_pen_id=? AND archived_at IS NULL$groupFilter)");
    $values = [$penId, $penId];
    if ($exceptGroup !== null) $values[] = $exceptGroup;
    $statement->execute($values);
    return (int)$statement->fetchColumn();
}

function groupDate(mixed $value, string $field): string
{
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || !checkdate((int)substr($value, 5, 2), (int)substr($value, 8, 2), (int)substr($value, 0, 4))) respond(['error' => "$field must use YYYY-MM-DD"], 422);
    return $value;
}

if ($method === 'GET') {
    $id = isset($_GET['id']) ? filter_var($_GET['id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
    if (isset($_GET['id']) && !$id) respond(['error' => 'Invalid group ID'], 422);
    if ($id) {
        $group = $pdo->prepare('SELECT g.*, p.code AS current_pen_code, (SELECT COUNT(*) FROM pigs pig WHERE pig.herd_group_id=g.id AND pig.archived_at IS NULL) AS member_count FROM herd_groups g LEFT JOIN pens p ON p.id=g.current_pen_id WHERE g.id=? AND g.archived_at IS NULL');
        $group->execute([$id]);
        $record = $group->fetch();
        if (!$record) respond(['error' => 'Group not found'], 404);
        $events = $pdo->prepare('SELECT e.*, u.username AS recorded_by, fp.code AS from_pen_code, tp.code AS to_pen_code FROM herd_group_events e LEFT JOIN users u ON u.id=e.created_by LEFT JOIN pens fp ON fp.id=e.from_pen_id LEFT JOIN pens tp ON tp.id=e.to_pen_id WHERE e.group_id=? ORDER BY e.occurred_on DESC,e.id DESC LIMIT 500');
        $events->execute([$id]);
        respond(['group' => $record, 'events' => $events->fetchAll()]);
    }
    $rows = $pdo->query('SELECT g.*, p.code AS current_pen_code, (SELECT COUNT(*) FROM pigs pig WHERE pig.herd_group_id=g.id AND pig.archived_at IS NULL) AS member_count FROM herd_groups g LEFT JOIN pens p ON p.id=g.current_pen_id WHERE g.archived_at IS NULL ORDER BY g.lifecycle_status, g.started_on DESC, g.id DESC LIMIT 500')->fetchAll();
    respond($rows);
}

if ($method !== 'POST') respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();
$action = $data['action'] ?? 'create';
if (!is_string($action) || !in_array($action, ['create', 'event'], true)) respond(['error' => 'Choose create or event'], 422);

try {
    $pdo->beginTransaction();
    if ($action === 'create') {
        $code = $data['group_code'] ?? null;
        $name = $data['name'] ?? null;
        $type = $data['group_type'] ?? 'cohort';
        $count = filter_var($data['head_count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 32767]]);
        $started = groupDate($data['started_on'] ?? null, 'Start date');
        $notes = $data['notes'] ?? null;
        $penValue = $data['current_pen_id'] ?? null;
        $penId = $penValue === null || $penValue === '' ? null : filter_var($penValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!is_string($code) || trim($code) === '' || mb_strlen(trim($code)) > 64) respond(['error' => 'Group code is required and must be at most 64 characters'], 422);
        if (!is_string($name) || trim($name) === '' || mb_strlen(trim($name)) > 120) respond(['error' => 'Group name is required and must be at most 120 characters'], 422);
        if (!in_array($type, ['cohort','quarantine','breeding','other'], true)) respond(['error' => 'Choose a valid group type'], 422);
        if ($count === false) respond(['error' => 'Head count must be a non-negative whole number'], 422);
        if ($started > date('Y-m-d')) respond(['error' => 'Start date cannot be in the future'], 422);
        if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 3000)) respond(['error' => 'Notes must be 3000 characters or fewer'], 422);
        if ($penValue !== null && $penValue !== '' && !$penId) respond(['error' => 'Choose a valid pen'], 422);
        if ($penId) {
            $penLock = $pdo->prepare('SELECT id,capacity,active FROM pens WHERE id=? FOR UPDATE');
            $penLock->execute([$penId]);
            $pen = $penLock->fetch();
            if (!$pen || !(bool)$pen['active']) respond(['error' => 'Destination pen is unavailable'], 422);
            if (penOccupancy($pdo, $penId) + $count > (int)$pen['capacity']) respond(['error' => 'Group head count would exceed destination pen capacity'], 409);
        }
        $insert = $pdo->prepare('INSERT INTO herd_groups (group_code,name,group_type,started_on,head_count,current_pen_id,notes,created_by) VALUES (?,?,?,?,?,?,?,?)');
        $insert->execute([trim($code), trim($name), $type, $started, $count, $penId, $notes ? trim($notes) : null, $actor['id']]);
        $id = (int)$pdo->lastInsertId();
        $event = $pdo->prepare("INSERT INTO herd_group_events (group_id,event_type,occurred_on,previous_count,new_count,previous_status,new_status,reason,notes,created_by) VALUES (?,'count_adjustment',?,?,?,'active','active',?,?,?)");
        $event->execute([$id, $started, 0, $count, 'Initial group count', $notes ? trim($notes) : null, $actor['id']]);
        if ($penId !== null) {
            $penEvent = $pdo->prepare("INSERT INTO herd_group_events (group_id,event_type,occurred_on,previous_count,new_count,previous_status,new_status,from_pen_id,to_pen_id,reason,created_by) VALUES (?,'pen_transfer',?,?,?,'active','active',NULL,?,'Initial pen assignment',?)");
            $penEvent->execute([$id, $started, $count, $count, $penId, $actor['id']]);
        }
        auditEvent($pdo, $actor['id'], 'herd_group.created', 'herd_group', (string)$id);
        $pdo->commit();
        $result = $pdo->prepare('SELECT * FROM herd_groups WHERE id=?');
        $result->execute([$id]);
        respond($result->fetch(), 201);
    }

    $id = filter_var($data['group_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $type = $data['event_type'] ?? null;
    $date = groupDate($data['occurred_on'] ?? null, 'Event date');
    $reason = $data['reason'] ?? null;
    $notes = $data['notes'] ?? null;
    if (!$id) respond(['error' => 'A valid group ID is required'], 422);
    if (!in_array($type, ['count_adjustment','status_change','pen_transfer'], true)) respond(['error' => 'Choose a valid group event type'], 422);
    if (!is_string($reason) || trim($reason) === '' || mb_strlen(trim($reason)) > 255) respond(['error' => 'A reason of 255 characters or fewer is required'], 422);
    if ($date > date('Y-m-d')) respond(['error' => 'Event date cannot be in the future'], 422);
    if ($notes !== null && (!is_string($notes) || mb_strlen($notes) > 3000)) respond(['error' => 'Notes must be 3000 characters or fewer'], 422);
    $lock = $pdo->prepare('SELECT head_count,lifecycle_status,current_pen_id FROM herd_groups WHERE id=? AND archived_at IS NULL FOR UPDATE');
    $lock->execute([$id]);
    $current = $lock->fetch();
    if (!$current) { $pdo->rollBack(); respond(['error' => 'Group not found'], 404); }
    $previousCount = (int)$current['head_count'];
    $nextCount = $previousCount;
    $previousStatus = $current['lifecycle_status'];
    $nextStatus = $previousStatus;
    $fromPenId = null;
    $toPenId = null;
    $currentPenId = $current['current_pen_id'] ?? null;
    $previousCountForEvent = $previousCount;
    $nextCountForEvent = $previousCount;
    $previousStatusForEvent = $previousStatus;
    $nextStatusForEvent = $previousStatus;
    if ($type === 'count_adjustment') {
        $nextCount = filter_var($data['new_count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 32767]]);
        if ($nextCount === false) respond(['error' => 'New head count must be a non-negative whole number'], 422);
        if ($previousStatus !== 'active') respond(['error' => 'Reopen the group before changing its head count'], 409);
        if ($nextCount === $previousCount) respond(['error' => 'New head count must differ from the current count'], 422);
        if ($nextCount > $previousCount && $currentPenId !== null) {
            $penId = (int)$currentPenId;
            $penLock = $pdo->prepare('SELECT capacity,active FROM pens WHERE id=? FOR UPDATE');
            $penLock->execute([$penId]);
            $pen = $penLock->fetch();
            if (!$pen || !(bool)$pen['active']) respond(['error' => 'Current group pen is unavailable'], 409);
            if (penOccupancy($pdo, $penId, (int)$id) + $nextCount > (int)$pen['capacity']) respond(['error' => 'New head count would exceed current pen capacity'], 409);
        }
    } else {
        if ($type === 'status_change') {
            $nextStatus = $data['new_status'] ?? null;
            if (!in_array($nextStatus, ['active','closed'], true) || $nextStatus === $previousStatus) respond(['error' => 'Choose a different valid lifecycle status'], 422);
            if ($nextStatus === 'closed' && ($previousCount > 0 || $currentPenId !== null)) respond(['error' => 'Set the head count to zero and unassign the group from its pen before closing it'], 409);
        } else {
            if ($previousStatus !== 'active') respond(['error' => 'Reopen the group before moving it'], 409);
            $target = $data['new_pen_id'] ?? null;
            $toPenId = $target === null || $target === '' ? null : filter_var($target, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($target !== null && $target !== '' && !$toPenId) respond(['error' => 'Choose a valid destination pen'], 422);
            $fromPenId = $currentPenId === null ? null : (int)$currentPenId;
            $toPenId = $toPenId === false ? null : ($toPenId === null ? null : (int)$toPenId);
            if ($fromPenId === $toPenId) respond(['error' => 'Choose a different destination pen'], 422);
            $penIdsToLock = array_values(array_unique(array_filter([$fromPenId, $toPenId], static fn($penId) => $penId !== null)));
            sort($penIdsToLock, SORT_NUMERIC);
            $lockedPens = [];
            foreach ($penIdsToLock as $penIdToLock) {
                $penLock = $pdo->prepare('SELECT id,capacity,active FROM pens WHERE id=? FOR UPDATE');
                $penLock->execute([$penIdToLock]);
                $lockedPens[(int)$penIdToLock] = $penLock->fetch();
            }
            if ($toPenId !== null) {
                $pen = $lockedPens[$toPenId] ?? null;
                if (!$pen || !(bool)$pen['active']) respond(['error' => 'Destination pen is unavailable'], 422);
                if (penOccupancy($pdo, $toPenId, (int)$id) + $previousCount > (int)$pen['capacity']) respond(['error' => 'Group head count would exceed destination pen capacity'], 409);
            }
        }
    }
    $update = $pdo->prepare('UPDATE herd_groups SET head_count=?,lifecycle_status=?,current_pen_id=? WHERE id=?');
    $update->execute([$nextCount, $nextStatus, $type === 'pen_transfer' ? $toPenId : $currentPenId, $id]);
    $event = $pdo->prepare('INSERT INTO herd_group_events (group_id,event_type,occurred_on,previous_count,new_count,previous_status,new_status,from_pen_id,to_pen_id,reason,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    $event->execute([$id, $type, $date, $previousCountForEvent, $nextCountForEvent, $previousStatusForEvent, $nextStatusForEvent, $fromPenId, $toPenId, trim($reason), $notes ? trim($notes) : null, $actor['id']]);
    auditEvent($pdo, $actor['id'], 'herd_group.event_recorded', 'herd_group', (string)$id, ['event_type' => $type]);
    $pdo->commit();
    $result = $pdo->prepare('SELECT * FROM herd_groups WHERE id=?');
    $result->execute([$id]);
    respond($result->fetch(), 201);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Herd group write failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    if ($exception->getCode() === '23000') respond(['error' => 'Group code already exists or a referenced record is invalid'], 409);
    respond(['error' => 'Unable to save herd group'], 500);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $exception;
}
