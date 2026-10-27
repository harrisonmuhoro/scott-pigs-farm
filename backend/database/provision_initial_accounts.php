<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/db.php';
$accounts = [
    ['username' => 'farm.developer', 'role' => 'developer'],
    ['username' => 'farm.owner', 'role' => 'owner'],
];
$passwords = [];
foreach ($accounts as $account) {
    $passwords[$account['username']] = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

try {
    $pdo->beginTransaction();
    $check = $pdo->prepare('SELECT id FROM users WHERE username=? FOR UPDATE');
    $insert = $pdo->prepare('INSERT INTO users (username, password_hash, role, active, force_password_change) VALUES (?, ?, ?, 1, 1)');
    $audit = $pdo->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'user.provisioned', 'user', ?, JSON_OBJECT('source', 'initial_cli', 'role', ?))");
    foreach ($accounts as $account) {
        $check->execute([$account['username']]);
        if ($check->fetchColumn()) {
            throw new RuntimeException('Initial account username is already in use: ' . $account['username']);
        }
    }
    foreach ($accounts as $account) {
        $insert->execute([$account['username'], password_hash($passwords[$account['username']], PASSWORD_DEFAULT), $account['role']]);
        $id = (int)$pdo->lastInsertId();
        $audit->execute([$id, (string)$id, $account['role']]);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, 'Initial account provisioning failed: ' . $exception->getMessage() . "\n");
    exit(1);
}

fwrite(STDOUT, "Initial accounts created. Save these passwords now; they are not stored in plaintext.\n");
foreach ($accounts as $account) {
    fwrite(STDOUT, $account['username'] . ' (' . $account['role'] . '): ' . $passwords[$account['username']] . "\n");
}
