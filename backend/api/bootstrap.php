<?php
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$environment = getenv('SCOTT_APP_ENV') ?: 'development';
$timezone = getenv('SCOTT_TIMEZONE') ?: 'Africa/Nairobi';
$sameSite = getenv('SCOTT_SESSION_SAMESITE') ?: ($environment === 'production' ? 'None' : 'Lax');
if (!in_array($sameSite, ['Lax', 'Strict', 'None'], true)) $sameSite = 'Lax';
try {
    date_default_timezone_set($timezone);
} catch (Throwable $exception) {
    date_default_timezone_set('UTC');
    error_log('Invalid SCOTT_TIMEZONE configured; using UTC.');
}
$configuredOrigins = getenv('SCOTT_ALLOWED_ORIGINS');
if ($configuredOrigins === false || trim($configuredOrigins) === '') {
    $localConfigPath = dirname(__DIR__) . '/config.local.php';
    if (is_file($localConfigPath)) {
        $localConfig = require $localConfigPath;
        if (is_array($localConfig) && isset($localConfig['SCOTT_ALLOWED_ORIGINS'])) {
            $configuredOrigins = (string)$localConfig['SCOTT_ALLOWED_ORIGINS'];
        }
    }
}
$allowedOrigins = $configuredOrigins !== false && trim($configuredOrigins) !== ''
    ? array_values(array_filter(array_map('trim', explode(',', $configuredOrigins))))
    : ($environment === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']);

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Content-Security-Policy: frame-ancestors \'none\'');
header('Cache-Control: no-store');
header('Vary: Origin');

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
}

if ($requestMethod === 'OPTIONS') {
    if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
        respond(['error' => 'Origin not allowed'], 403);
    }
    http_response_code(204);
    exit;
}

if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    respond(['error' => 'Origin not allowed'], 403);
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    session_name('scott_farm_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $environment === 'production' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => $sameSite,
    ]);
    session_start();
}

function requireAuthentication(): array
{
    if (empty($_SESSION['user_id']) || empty($_SESSION['role'])) {
        respond(['error' => 'Authentication required'], 401);
    }
    $lastActivity = (int)($_SESSION['last_activity'] ?? 0);
    $createdAt = (int)($_SESSION['created_at'] ?? 0);
    if (($lastActivity > 0 && time() - $lastActivity > 1800) || ($createdAt > 0 && time() - $createdAt > 43200)) {
        $_SESSION = [];
        session_destroy();
        respond(['error' => 'Session expired'], 401);
    }
    global $pdo;
    try {
        $statement = $pdo->prepare('SELECT username, role, active, force_password_change FROM users WHERE id = ? LIMIT 1');
        $statement->execute([(int)$_SESSION['user_id']]);
        $account = $statement->fetch();
    } catch (Throwable $exception) {
        error_log('Authentication state check failed: ' . $exception->getMessage());
        respond(['error' => 'Service unavailable'], 500);
    }
    if (!$account || !(bool)$account['active']) {
        $_SESSION = [];
        session_destroy();
        respond(['error' => 'Authentication required'], 401);
    }
    $_SESSION['username'] = (string)$account['username'];
    $_SESSION['role'] = (string)$account['role'];
    $_SESSION['force_password_change'] = (bool)$account['force_password_change'];
    $_SESSION['last_activity'] = time();
    return ['id' => (int)$_SESSION['user_id'], 'username' => (string)$_SESSION['username'], 'role' => (string)$_SESSION['role'], 'force_password_change' => (bool)$account['force_password_change']];
}

function requireRole(array $roles): array
{
    $user = requireAuthentication();
    if ($user['force_password_change']) respond(['error' => 'Change your temporary password before using the portal', 'code' => 'PASSWORD_CHANGE_REQUIRED'], 428);
    if (!in_array($user['role'], $roles, true)) {
        respond(['error' => 'Permission denied'], 403);
    }
    return $user;
}

function requireCsrf(): void
{
    $expected = (string)($_SESSION['csrf_token'] ?? '');
    $provided = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        respond(['error' => 'Invalid request token'], 403);
    }
}

function readJsonBody(): array
{
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
        respond(['error' => 'Content-Type must be application/json'], 415);
    }
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw === false || strlen($raw) > 65536) {
        respond(['error' => 'Request body too large'], 413);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        respond(['error' => 'Invalid JSON body'], 400);
    }
    return $data;
}

require_once dirname(__DIR__) . '/db.php';

function auditEvent(PDO $pdo, ?int $userId, string $action, string $entityType, ?string $entityId = null, array $details = []): void
{
    try {
        $statement = $pdo->prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)');
        $statement->execute([$userId, $action, $entityType, $entityId, json_encode($details, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)]);
    } catch (Throwable $exception) {
        error_log('Audit event could not be recorded: ' . $exception->getMessage());
    }
}
