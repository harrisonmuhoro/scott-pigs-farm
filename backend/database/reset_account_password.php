<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$username = trim((string)($argv[1] ?? ''));
if (!preg_match('/^[A-Za-z0-9_.-]{3,50}$/', $username)) {
    fwrite(STDERR, "Usage: php database/reset_account_password.php <username>\n");
    exit(2);
}

require_once dirname(__DIR__) . '/db.php';
$temporaryPassword = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

try {
    $pdo->beginTransaction();
    $find = $pdo->prepare('SELECT id, active FROM users WHERE username=? FOR UPDATE');
    $find->execute([$username]);
    $account = $find->fetch();
    if (!$account || !(bool)$account['active']) {
        $pdo->rollBack();
        fwrite(STDERR, "Active account not found. No changes made.\n");
        exit(3);
    }
    $update = $pdo->prepare('UPDATE users SET password_hash=?, force_password_change=1 WHERE id=?');
    $update->execute([password_hash($temporaryPassword, PASSWORD_DEFAULT), $account['id']]);
    $audit = $pdo->prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (NULL, ?, ?, ?, ?)');
    $audit->execute([
        'user.password_reset_cli',
        'user',
        (string)$account['id'],
        json_encode(['source' => 'local_cli', 'temporary_password_issued' => true], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
    ]);
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, "Password reset failed. Check protected server logs.\n");
    error_log('CLI account password reset failed: ' . $exception->getMessage());
    exit(1);
}

fwrite(STDOUT, "Temporary password for {$username}: {$temporaryPassword}\n");
fwrite(STDOUT, "It is shown once. The account must change it at next sign-in.\n");
