<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['developer']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $statement = $pdo->query('SELECT id, username, role, active, force_password_change, created_at FROM users ORDER BY id');
    respond($statement->fetchAll());
}
if (!in_array($method, ['POST', 'PATCH'], true)) respond(['error' => 'Method not allowed'], 405);
requireCsrf();
$data = readJsonBody();

if ($method === 'POST') {
    $username = trim((string)($data['username'] ?? ''));
    $password = $data['password'] ?? null;
    $role = (string)($data['role'] ?? 'owner');
    if (!preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $username)) respond(['error' => 'Username must be 3–50 letters, numbers, dots, underscores, or hyphens'], 422);
    if (!is_string($password) || strlen($password) < 12) respond(['error' => 'Password must be at least 12 characters'], 422);
    if (!in_array($role, ['developer', 'owner'], true)) respond(['error' => 'Choose developer or owner'], 422);
    try {
        $statement = $pdo->prepare('INSERT INTO users (username, password_hash, role, active, force_password_change) VALUES (?, ?, ?, 1, 1)');
        $statement->execute([$username, password_hash($password, PASSWORD_DEFAULT), $role]);
        $id = (int)$pdo->lastInsertId();
        auditEvent($pdo, $actor['id'], 'user.created', 'user', (string)$id, ['role' => $role]);
        respond(['id' => $id, 'username' => $username, 'role' => $role, 'active' => 1, 'force_password_change' => 1], 201);
    } catch (PDOException $exception) {
        error_log('User creation failed for developer ' . $actor['id'] . ': ' . $exception->getMessage());
        if ($exception->getCode() === '23000') respond(['error' => 'Username is already in use'], 409);
        respond(['error' => 'Unable to create user'], 500);
    }
}

$id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$action = (string)($data['action'] ?? '');
if (!$id || !in_array($action, ['set_role', 'set_active', 'reset_password'], true)) respond(['error' => 'Invalid user update'], 422);
if ((int)$id === $actor['id'] && $action === 'set_active' && empty($data['active'])) respond(['error' => 'You cannot deactivate your own account'], 409);
if ($action === 'set_role') {
    $role = (string)($data['role'] ?? '');
    if (!in_array($role, ['developer', 'owner'], true)) respond(['error' => 'Choose a valid role'], 422);
    if ((int)$id === $actor['id']) respond(['error' => 'You cannot change your own role'], 409);
}
if ($action === 'set_active' && !is_bool($data['active'] ?? null)) respond(['error' => 'Active must be true or false'], 422);

try {
    $pdo->beginTransaction();
    if ($action === 'set_role') {
        $pdo->query('SELECT id FROM users FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN);
        $target = $pdo->prepare('SELECT role, active FROM users WHERE id=? FOR UPDATE');
        $target->execute([$id]);
        $targetRow = $target->fetch();
        if (!$targetRow) { $pdo->rollBack(); respond(['error' => 'User not found'], 404); }
        if ((bool)$targetRow['active'] && in_array($targetRow['role'], ['owner', 'developer'], true) && $targetRow['role'] !== $role) {
            $count = $pdo->prepare('SELECT COUNT(*) FROM users WHERE role=? AND active=1');
            $count->execute([$targetRow['role']]);
            if ((int)$count->fetchColumn() <= 1) { $pdo->rollBack(); respond(['error' => 'At least one active account for each role must remain'], 409); }
        }
        $statement = $pdo->prepare('UPDATE users SET role=? WHERE id=?');
        $statement->execute([$role, $id]);
        auditEvent($pdo, $actor['id'], 'user.role_changed', 'user', (string)$id, ['role' => $role]);
    } elseif ($action === 'set_active') {
        $pdo->query('SELECT id FROM users FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN);
        $target = $pdo->prepare('SELECT role, active FROM users WHERE id=? FOR UPDATE');
        $target->execute([$id]);
        $targetRow = $target->fetch();
        if (!$targetRow) { $pdo->rollBack(); respond(['error' => 'User not found'], 404); }
        if (in_array($targetRow['role'], ['owner', 'developer'], true) && (bool)$targetRow['active'] && !$data['active']) {
            $count = $pdo->prepare('SELECT COUNT(*) FROM users WHERE role=? AND active=1');
            $count->execute([$targetRow['role']]);
            if ((int)$count->fetchColumn() <= 1) { $pdo->rollBack(); respond(['error' => 'At least one active account for each role must remain'], 409); }
        }
        $statement = $pdo->prepare('UPDATE users SET active=? WHERE id=?');
        $statement->execute([$data['active'] ? 1 : 0, $id]);
        auditEvent($pdo, $actor['id'], $data['active'] ? 'user.activated' : 'user.deactivated', 'user', (string)$id);
    } elseif ($action === 'reset_password') {
        if ((int)$id === $actor['id']) { $pdo->rollBack(); respond(['error' => 'Use your own account settings to change your password'], 409); }
        $target = $pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');
        $target->execute([$id]);
        if (!$target->fetch()) { $pdo->rollBack(); respond(['error' => 'User not found'], 404); }
        $temporaryPassword = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $statement = $pdo->prepare('UPDATE users SET password_hash=?, force_password_change=1 WHERE id=?');
        $statement->execute([password_hash($temporaryPassword, PASSWORD_DEFAULT), $id]);
        $audit = $pdo->prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)');
        $audit->execute([$actor['id'], 'user.password_reset', 'user', (string)$id, json_encode(['temporary_password_issued' => true], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)]);
    }
    $pdo->commit();
    if ($action === 'reset_password') respond(['status' => 'success', 'temporary_password' => $temporaryPassword]);
    respond(['status' => 'success']);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('User update failed for developer ' . $actor['id'] . ': ' . $exception->getMessage());
    respond(['error' => 'Unable to update user'], 500);
}
