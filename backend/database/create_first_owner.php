<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$localConfigPath = dirname(__DIR__) . '/config.local.php';
$localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
if (!is_array($localConfig)) $localConfig = [];
$configuredUsername = getenv('SCOTT_OWNER_USERNAME');
$configuredPassword = getenv('SCOTT_OWNER_PASSWORD');
$username = trim((string)($configuredUsername !== false ? $configuredUsername : ($localConfig['SCOTT_OWNER_USERNAME'] ?? '')));
$password = (string)($configuredPassword !== false ? $configuredPassword : ($localConfig['SCOTT_OWNER_PASSWORD'] ?? ''));
if (!preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $username) || strlen($password) < 12) {
    fwrite(STDERR, "Set SCOTT_OWNER_USERNAME and SCOTT_OWNER_PASSWORD (at least 12 characters) in the protected CLI environment.\n");
    exit(2);
}

require_once dirname(__DIR__) . '/db.php';
$ownerCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='owner'")->fetchColumn();
if ($ownerCount > 0) {
    fwrite(STDERR, "An owner account already exists. This command only creates the first owner.\n");
    exit(3);
}

$pdo->beginTransaction();
$statement = $pdo->prepare('INSERT INTO users (username, password_hash, role, force_password_change) VALUES (?, ?, \'owner\', 1)');
$statement->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
$ownerId = (int)$pdo->lastInsertId();
$audit = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'owner.provisioned', 'user', ?, JSON_OBJECT('source', 'cli'))");
$audit->execute([$ownerId, (string)$ownerId]);
$pdo->commit();
if (is_file($localConfigPath) && (array_key_exists('SCOTT_OWNER_USERNAME', $localConfig) || array_key_exists('SCOTT_OWNER_PASSWORD', $localConfig))) {
    unset($localConfig['SCOTT_OWNER_USERNAME'], $localConfig['SCOTT_OWNER_PASSWORD']);
    $temporaryConfigPath = $localConfigPath . '.tmp';
    $written = file_put_contents($temporaryConfigPath, "<?php\n// Local-only MySQL connection settings. Never commit this file.\nreturn " . var_export($localConfig, true) . ";\n", LOCK_EX);
    if ($written !== false && rename($temporaryConfigPath, $localConfigPath)) {
        @chmod($localConfigPath, 0600);
        fwrite(STDOUT, "Temporary owner credentials were removed from config.local.php.\n");
    } else {
        @unlink($temporaryConfigPath);
        fwrite(STDERR, "Remove SCOTT_OWNER_USERNAME and SCOTT_OWNER_PASSWORD from config.local.php now.\n");
    }
}
fwrite(STDOUT, "First owner account created. Remove SCOTT_OWNER_PASSWORD from the process environment.\n");
