<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

// Optional local-only configuration. The real file is git-ignored and denied by Apache.
$localConfigPath = __DIR__ . '/config.local.php';
$localConfig = [];
if (getenv('SCOTT_APP_ENV') !== 'production' && is_file($localConfigPath)) {
    $loadedConfig = require $localConfigPath;
    if (is_array($loadedConfig)) $localConfig = $loadedConfig;
}
$localValue = static function (string $name, mixed $fallback = null) use ($localConfig): mixed {
    $environmentValue = getenv($name);
    return $environmentValue !== false ? $environmentValue : ($localConfig[$name] ?? $fallback);
};

$host = $localValue('SCOTT_DB_HOST', getenv('MYSQLHOST') ?: '127.0.0.1') ?: '127.0.0.1';
$port = $localValue('SCOTT_DB_PORT', getenv('MYSQLPORT') ?: '3306') ?: '3306';
$database = $localValue('SCOTT_DB_NAME', getenv('MYSQLDATABASE') ?: 'scott_pigs') ?: 'scott_pigs';
$username = $localValue('SCOTT_DB_USER', getenv('MYSQLUSER'));
$password = $localValue('SCOTT_DB_PASSWORD', getenv('MYSQLPASSWORD'));

if ($username === false || $username === '' || $password === false) {
    error_log('Scott Pigs Farm database credentials are not configured.');
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Service configuration error']);
    exit;
}

try {
    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $exception) {
    error_log('Scott Pigs Farm database connection failed: ' . $exception->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Service unavailable']);
    exit;
}
