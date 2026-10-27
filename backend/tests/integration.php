<?php
declare(strict_types=1);

/**
 * Isolated database integration checks. Run only with SCOTT_DB_NAME pointing
 * at a disposable restored database, never the live farm database.
 */
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(2); }
$database = getenv('SCOTT_DB_NAME') ?: '';
if ($database === '' || !preg_match('/^scott_pigs_restore_[A-Za-z0-9_]+$/', $database)) {
    fwrite(STDERR, "Refusing to run: set SCOTT_DB_NAME to a disposable scott_pigs_restore_* database.\n");
    exit(2);
}
$host = getenv('SCOTT_DB_HOST') ?: '127.0.0.1';
$testUser = getenv('SCOTT_TEST_DB_USER') ?: 'root';
$testPassword = getenv('SCOTT_TEST_DB_PASSWORD') ?: '';
$pdo = new PDO("mysql:host={$host};dbname={$database};charset=utf8mb4", $testUser, $testPassword, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);
$failures = 0;
$assert = static function (bool $condition, string $message) use (&$failures): void {
    if ($condition) { echo "PASS $message\n"; return; }
    $failures++;
    echo "FAIL $message\n";
};
$requiredTables = ['users','pigs','litters','pens','herd_groups','herd_group_events','pig_photos','litter_weight_records'];
foreach ($requiredTables as $table) {
    $check = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');
    $check->execute([$table]);
    $assert((int)$check->fetchColumn() === 1, "schema table $table exists");
}
$pdo->beginTransaction();
try {
    $user = $pdo->query("SELECT id FROM users WHERE active=1 LIMIT 1")->fetchColumn();
    $assert((bool)$user, 'an active test user exists');
    $penInsert = $pdo->prepare("INSERT INTO pens (code,name,capacity,notes) VALUES (?,?,?,?)");
    $penInsert->execute(['TEST-PEN-' . bin2hex(random_bytes(3)), 'Integration test pen', 20, 'Disposable integration record']);
    $penId = (int)$pdo->lastInsertId();
    $groupInsert = $pdo->prepare("INSERT INTO herd_groups (group_code,name,group_type,started_on,head_count,current_pen_id,notes,created_by) VALUES (?,?,?,?,?,?,?,?)");
    $groupInsert->execute(['TEST-GROUP-' . bin2hex(random_bytes(3)), 'Integration test group', 'cohort', date('Y-m-d'), 1, $penId, 'Disposable integration record', $user ?: null]);
    $groupId = (int)$pdo->lastInsertId();
    $pigInsert = $pdo->prepare("INSERT INTO pigs (tag_id,name,sex,breed,birth_date,source,lifecycle_status,herd_group_id,created_by) VALUES (?,?,?,?,?,?,?,?,?)");
    $pigInsert->execute(['TEST-PIG-' . bin2hex(random_bytes(3)), 'Integration test pig', 'unknown', 'Test', date('Y-m-d', strtotime('-30 days')), 'integration', 'piglet', $groupId, $user ?: null]);
    $pigId = (int)$pdo->lastInsertId();
    $membership = $pdo->prepare('SELECT COUNT(*) FROM pigs WHERE id=? AND herd_group_id=?');
    $membership->execute([$pigId, $groupId]);
    $assert((int)$membership->fetchColumn() === 1, 'pig membership persists through foreign key');
    $memberCount = $pdo->prepare('SELECT COUNT(*) FROM pigs WHERE herd_group_id=? AND archived_at IS NULL');
    $memberCount->execute([$groupId]);
    $assert((int)$memberCount->fetchColumn() === 1, 'group member count matches linked pig');
    $close = $pdo->prepare("UPDATE herd_groups SET head_count=0,current_pen_id=NULL,lifecycle_status='closed' WHERE id=?");
    $close->execute([$groupId]);
    $assert($close->rowCount() === 1, 'group lifecycle update can close a zero-count unassigned group');
    $pdo->rollBack();
    echo $failures ? "FAILURES=$failures\n" : "ALL CHECKS PASSED (transaction rolled back)\n";
    exit($failures ? 1 : 0);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, 'ERROR ' . $exception->getMessage() . "\n");
    exit(1);
}
