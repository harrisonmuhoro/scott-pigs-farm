<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
requireRole(['developer']);

try {
    $version = (string)$pdo->query('SELECT VERSION()')->fetchColumn();
    respond([
        'php_version' => PHP_VERSION,
        'database_connected' => true,
        'database_version' => $version,
    ]);
} catch (Throwable $exception) {
    error_log('Developer system status database probe failed: ' . $exception->getMessage());
    respond(['php_version' => PHP_VERSION, 'database_connected' => false, 'database_version' => ''], 503);
}
