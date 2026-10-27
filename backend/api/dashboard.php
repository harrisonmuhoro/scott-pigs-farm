<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
requireRole(['owner']);

$today = (new DateTimeImmutable('today'))->format('Y-m-d');
$monthStart = (new DateTimeImmutable('first day of this month'))->format('Y-m-d');
$farrowingWindowEnd = (new DateTimeImmutable('today'))->modify('+30 days')->format('Y-m-d');
$taskWindowEnd = $farrowingWindowEnd;

try {
    $activeHerd = (int)$pdo->query("SELECT COUNT(*) FROM pigs WHERE archived_at IS NULL AND lifecycle_status NOT IN ('sold','deceased','transferred')")->fetchColumn();

    $litterStatement = $pdo->prepare("SELECT
        COALESCE(SUM(CASE WHEN farrowing_date BETWEEN ? AND ? THEN born_alive ELSE 0 END), 0) AS births_this_year,
        COALESCE(SUM(CASE WHEN weaned_date BETWEEN ? AND ? THEN weaned_count ELSE 0 END), 0) AS weaned_this_year,
        COALESCE(SUM(CASE WHEN farrowing_date IS NULL AND expected_farrowing_date BETWEEN ? AND ? THEN 1 ELSE 0 END), 0) AS farrowing_next_30_days,
        COALESCE(SUM(CASE WHEN farrowing_date IS NULL AND expected_farrowing_date < ? THEN 1 ELSE 0 END), 0) AS farrowing_overdue
        FROM litters WHERE archived_at IS NULL");
    $yearStart = (new DateTimeImmutable('first day of January'))->format('Y-m-d');
    $litterStatement->execute([$yearStart, $today, $yearStart, $today, $today, $farrowingWindowEnd, $today]);
    $litterMetrics = $litterStatement->fetch() ?: [];

    $healthStatement = $pdo->prepare("SELECT COUNT(*) FROM health_records WHERE follow_up_status='open' AND follow_up_due IS NOT NULL AND follow_up_due <= ?");
    $healthStatement->execute([$taskWindowEnd]);
    $openHealthTasks = (int)$healthStatement->fetchColumn();
    $scheduleStatement = $pdo->prepare('SELECT COUNT(*) FROM vaccination_schedules WHERE active=1 AND due_date <= ?');
    $scheduleStatement->execute([$taskWindowEnd]);
    $dueVaccinations = (int)$scheduleStatement->fetchColumn();

    $lowStock = (int)$pdo->query("SELECT COUNT(*) FROM (SELECT i.id FROM inventory_items i LEFT JOIN stock_movements m ON m.item_id=i.id WHERE i.active=1 GROUP BY i.id, i.reorder_threshold HAVING COALESCE(SUM(m.quantity_delta),0) <= i.reorder_threshold) low_items")->fetchColumn();
    $expiringStock = (int)$pdo->query("SELECT COUNT(*) FROM (SELECT i.id, m.batch_lot, m.expiry_date FROM inventory_items i JOIN stock_movements m ON m.item_id=i.id WHERE i.active=1 AND m.expiry_date IS NOT NULL AND m.expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) GROUP BY i.id, m.batch_lot, m.expiry_date HAVING SUM(m.quantity_delta) > 0) expiring_lots")->fetchColumn();

    $salesStatement = $pdo->prepare('SELECT COALESCE(SUM(total), 0) FROM sales WHERE sale_date BETWEEN ? AND ?');
    $salesStatement->execute([$monthStart, $today]);
    $salesThisMonth = (string)$salesStatement->fetchColumn();

    $financeStatement = $pdo->prepare("SELECT
        COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount_paid ELSE 0 END), 0) AS cash_in,
        COALESCE(SUM(CASE WHEN transaction_type='expense' THEN amount_paid ELSE 0 END), 0) AS cash_out,
        COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount_paid WHEN transaction_type='expense' THEN -amount_paid ELSE 0 END), 0) AS net_cash_flow
        FROM financial_transactions WHERE transaction_date BETWEEN ? AND ?");
    $financeStatement->execute([$monthStart, $today]);
    $cashFlow = $financeStatement->fetch() ?: ['cash_in' => '0.00', 'cash_out' => '0.00'];

    respond([
        'as_of' => $today,
        'period_from' => $monthStart,
        'period_to' => $today,
        'active_herd' => $activeHerd,
        'births_this_year' => (int)($litterMetrics['births_this_year'] ?? 0),
        'weaned_this_year' => (int)($litterMetrics['weaned_this_year'] ?? 0),
        'farrowing_next_30_days' => (int)($litterMetrics['farrowing_next_30_days'] ?? 0),
        'farrowing_overdue' => (int)($litterMetrics['farrowing_overdue'] ?? 0),
        'open_health_tasks' => $openHealthTasks,
        'due_vaccinations' => $dueVaccinations,
        'low_stock_items' => $lowStock,
        'expiring_lots' => $expiringStock,
        'sales_this_month' => $salesThisMonth,
        'cash_in_this_month' => (string)$cashFlow['cash_in'],
        'cash_out_this_month' => (string)$cashFlow['cash_out'],
        'net_cash_flow_this_month' => (string)$cashFlow['net_cash_flow'],
    ]);
} catch (Throwable $exception) {
    error_log('Dashboard summary query failed: ' . $exception->getMessage());
    respond(['error' => 'Dashboard summary is temporarily unavailable'], 500);
}
