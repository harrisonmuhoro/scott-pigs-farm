<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST', 'DELETE'], true)) respond(['error' => 'Method not allowed'], 405);
$actor = requireRole(['owner']);

if ($method === 'GET') {
    try {
        $statement = $pdo->query('SELECT id, month, revenue, feed_cost, labour_cost, other_cost FROM monthly_finances WHERE archived_at IS NULL ORDER BY month ASC');
        respond($statement->fetchAll());
    } catch (Throwable $exception) {
        error_log('Finance read failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
        respond(['error' => 'Unable to load financial records'], 500);
    }
}

requireCsrf();
$data = readJsonBody();
if ($method === 'POST') {
    if (isset($data['month']) && !is_string($data['month'])) respond(['error' => 'Month must be text'], 422);
    $month = (string)($data['month'] ?? '');
    if (preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month) !== 1) respond(['error' => 'Month must use YYYY-MM'], 422);
    $amounts = [];
    foreach (['revenue', 'feed_cost', 'labour_cost', 'other_cost'] as $field) {
        if (!array_key_exists($field, $data)) respond(['error' => ucfirst(str_replace('_', ' ', $field)) . ' is required'], 422);
        $value = $data[$field];
        if (!is_numeric($value) || preg_match('/^\d{1,8}(\.\d{1,2})?$/', (string)$value) !== 1) respond(['error' => ucfirst(str_replace('_', ' ', $field)) . ' must be a non-negative amount with up to two decimals'], 422);
        $amounts[] = (string)$value;
    }
    try {
        $statement = $pdo->prepare('INSERT INTO monthly_finances (month, revenue, feed_cost, labour_cost, other_cost) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE revenue=VALUES(revenue), feed_cost=VALUES(feed_cost), labour_cost=VALUES(labour_cost), other_cost=VALUES(other_cost), archived_at=NULL');
        $statement->execute([$month, ...$amounts]);
        $result = $pdo->prepare('SELECT id, month, revenue, feed_cost, labour_cost, other_cost FROM monthly_finances WHERE month=?');
        $result->execute([$month]);
        $record = $result->fetch();
        auditEvent($pdo, $actor['id'], 'finance.monthly_summary_saved', 'monthly_finance', (string)$record['id'], ['month' => $month]);
        respond($record);
    } catch (PDOException $exception) {
        error_log('Finance write failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
        respond(['error' => 'Unable to save financial record'], 500);
    }
}

$id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (!$id) respond(['error' => 'A valid finance record ID is required'], 422);
$statement = $pdo->prepare('UPDATE monthly_finances SET archived_at=CURRENT_TIMESTAMP WHERE id=? AND archived_at IS NULL');
$statement->execute([$id]);
if ($statement->rowCount() === 0) respond(['error' => 'Financial record not found'], 404);
auditEvent($pdo, $actor['id'], 'finance.monthly_summary_archived', 'monthly_finance', (string)$id);
http_response_code(204);
exit;
