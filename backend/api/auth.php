<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function loginRateLimit(string $key, bool $success): bool
{
    $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'scott-farm-login-' . hash('sha256', $key) . '.json';
    umask(0077);
    $handle = fopen($path, 'c+');
    if ($handle === false) return false;
    flock($handle, LOCK_EX);
    $raw = stream_get_contents($handle);
    $state = json_decode($raw ?: '{}', true) ?: [];
    $window = (int)($state['window'] ?? time());
    $attempts = (int)($state['attempts'] ?? 0);
    if (time() - $window >= 900) { $window = time(); $attempts = 0; }
    if ($success) { $attempts = 0; $window = time(); }
    else { $attempts++; }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode(['window' => $window, 'attempts' => $attempts]));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $success || $attempts <= 10;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    if (empty($_SESSION['user_id'])) respond(['user' => null]);
    $lastActivity = (int)($_SESSION['last_activity'] ?? 0);
    $createdAt = (int)($_SESSION['created_at'] ?? 0);
    if (($lastActivity > 0 && time() - $lastActivity > 1800) || ($createdAt > 0 && time() - $createdAt > 43200)) {
        $_SESSION = [];
        session_destroy();
        respond(['user' => null]);
    }
    $stmt = $pdo->prepare('SELECT id, username, role, active, force_password_change FROM users WHERE id = ?');
    $stmt->execute([(int)$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user || !(bool)$user['active']) { $_SESSION = []; session_destroy(); respond(['user' => null]); }
    $_SESSION['username'] = (string)$user['username'];
    $_SESSION['role'] = (string)$user['role'];
    $_SESSION['last_activity'] = time();
    respond(['user' => $user, 'csrfToken' => $_SESSION['csrf_token'] ?? null]);
}
if ($method !== 'POST') respond(['error' => 'Method not allowed'], 405);
$data = readJsonBody();
$action = (string)($data['action'] ?? 'login');

if ($action === 'login') {
    if (isset($data['username']) && !is_string($data['username'])) respond(['error' => 'Invalid username or password'], 401);
    if (isset($data['password']) && !is_string($data['password'])) respond(['error' => 'Invalid username or password'], 401);
    $username = trim((string)($data['username'] ?? ''));
    $password = (string)($data['password'] ?? '');
    if ($username === '' || $password === '' || strlen($username) > 50 || strlen($password) > 1024) {
        respond(['error' => 'Invalid username or password'], 401);
    }
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $rateKey = strtolower($username) . '|' . $ip;
    if (!loginRateLimit($rateKey, false)) respond(['error' => 'Invalid username or password'], 429);
    try {
        $stmt = $pdo->prepare('SELECT id, username, password_hash, role, force_password_change FROM users WHERE username = ? AND active = 1 LIMIT 1');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($password, $row['password_hash'])) {
            auditEvent($pdo, null, 'auth.login_failed', 'user');
            respond(['error' => 'Invalid username or password'], 401);
        }
        loginRateLimit($rateKey, true);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$row['id'];
        $_SESSION['username'] = (string)$row['username'];
        $_SESSION['role'] = (string)$row['role'];
        $_SESSION['force_password_change'] = (bool)$row['force_password_change'];
        $_SESSION['created_at'] = time();
        $_SESSION['last_activity'] = time();
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        auditEvent($pdo, (int)$row['id'], 'auth.login_succeeded', 'user', (string)$row['id']);
        respond(['user' => ['id' => (int)$row['id'], 'username' => $row['username'], 'role' => $row['role'], 'force_password_change' => (bool)$row['force_password_change']], 'csrfToken' => $_SESSION['csrf_token']]);
    } catch (Throwable $exception) {
        error_log('Authentication failure: ' . $exception->getMessage());
        respond(['error' => 'Service unavailable'], 500);
    }
}

$current = requireAuthentication();
requireCsrf();
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 42000, 'path' => $params['path'], 'domain' => $params['domain'], 'secure' => $params['secure'], 'httponly' => true, 'samesite' => 'Lax']);
    }
    session_destroy();
    auditEvent($pdo, $current['id'], 'auth.logout', 'user', (string)$current['id']);
    respond(['status' => 'success']);
}
if ($action === 'update_profile') {
    $currentPassword = (string)($data['current_password'] ?? '');
    $newUsername = trim((string)($data['new_username'] ?? ''));
    $newPassword = (string)($data['new_password'] ?? '');
    if ($currentPassword === '' || ($newUsername === '' && $newPassword === '')) respond(['error' => 'Current password and at least one change are required'], 422);
    if ($newUsername !== '' && !preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $newUsername)) respond(['error' => 'Username must be 3–50 letters, numbers, dots, underscores, or hyphens'], 422);
    if ($newPassword !== '' && strlen($newPassword) < 12) respond(['error' => 'New password must be at least 12 characters'], 422);
    if (!empty($current['force_password_change']) && $newPassword === '') respond(['error' => 'A new password is required before continuing'], 422);
    try {
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$current['id']]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($currentPassword, $row['password_hash'])) respond(['error' => 'Current password is incorrect'], 401);
        $fields = [];
        $values = [];
        if ($newUsername !== '') { $fields[] = 'username = ?'; $values[] = $newUsername; }
        if ($newPassword !== '') { $fields[] = 'password_hash = ?'; $values[] = password_hash($newPassword, PASSWORD_DEFAULT); $fields[] = 'force_password_change = 0'; }
        $values[] = $current['id'];
        $statement = $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?');
        $statement->execute($values);
        auditEvent($pdo, $current['id'], 'user.profile_updated', 'user', (string)$current['id'], ['username_changed' => $newUsername !== '', 'password_changed' => $newPassword !== '']);
        if ($newUsername !== '') $_SESSION['username'] = $newUsername;
        $_SESSION['force_password_change'] = false;
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        respond(['status' => 'success', 'message' => 'Profile updated', 'csrfToken' => $_SESSION['csrf_token'], 'user' => ['id' => $current['id'], 'username' => $_SESSION['username'], 'role' => $_SESSION['role'], 'force_password_change' => false]]);
    } catch (PDOException $exception) {
        error_log('Profile update failed: ' . $exception->getMessage());
        if ($exception->getCode() === '23000') respond(['error' => 'Username is already in use'], 409);
        respond(['error' => 'Unable to update profile'], 500);
    }
}
respond(['error' => 'Invalid action'], 400);
