<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') respond(['error' => 'Method not allowed'], 405);
requireRole(['owner']);
$month = date('Y-m');
$statement = $pdo->prepare('SELECT COALESCE(SUM(revenue), 0) AS revenue, COALESCE(SUM(feed_cost + labour_cost + other_cost), 0) AS expenses, COALESCE(SUM(revenue - (feed_cost + labour_cost + other_cost)), 0) AS net FROM monthly_finances WHERE month = ? AND archived_at IS NULL');
$statement->execute([$month]);
$totals = $statement->fetch();
respond([
    ['label' => 'Revenue (monthly summary)', 'value' => $totals['revenue'], 'type' => 'income'],
    ['label' => 'Expenses (monthly summary)', 'value' => $totals['expenses'], 'type' => 'expense'],
    ['label' => 'Net (monthly summary)', 'value' => $totals['net'], 'type' => 'neutral'],
]);
?>
