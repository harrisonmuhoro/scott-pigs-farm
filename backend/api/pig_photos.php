<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$actor = requireRole(['owner']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$schemaCheck = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='pig_photos'");
$schemaCheck->execute();
if ((int)$schemaCheck->fetchColumn() === 0) respond(['error' => 'Pig photos are not enabled until migration 011 is applied'], 503);

if ($method === 'GET') {
    $pigId = filter_var($_GET['pig_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$pigId) respond(['error' => 'A valid pig ID is required'], 422);
    $statement = $pdo->prepare('SELECT mime_type, photo_data FROM pig_photos WHERE pig_id=?');
    $statement->execute([$pigId]);
    $photo = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$photo) respond(['error' => 'Pig photo not found'], 404);
    header('Content-Type: ' . $photo['mime_type']);
    header('Content-Disposition: inline; filename="pig-' . $pigId . '-photo"');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    echo $photo['photo_data'];
    exit;
}

if (!in_array($method, ['POST', 'DELETE'], true)) respond(['error' => 'Method not allowed'], 405);
requireCsrf();

if ($method === 'DELETE') {
    $data = readJsonBody();
    $pigId = filter_var($data['pig_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$pigId) respond(['error' => 'A valid pig ID is required'], 422);
    $statement = $pdo->prepare('DELETE FROM pig_photos WHERE pig_id=?');
    $statement->execute([$pigId]);
    if ($statement->rowCount() === 0) respond(['error' => 'Pig photo not found'], 404);
    auditEvent($pdo, $actor['id'], 'pig.photo_deleted', 'pig', (string)$pigId);
    respond(['status' => 'deleted']);
}

$pigId = filter_var($_POST['pig_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (!$pigId) respond(['error' => 'A valid pig ID is required'], 422);
$pigCheck = $pdo->prepare('SELECT id FROM pigs WHERE id=? AND archived_at IS NULL');
$pigCheck->execute([$pigId]);
if (!$pigCheck->fetch()) respond(['error' => 'Pig record not found'], 404);
if (!isset($_FILES['photo']) || !is_array($_FILES['photo'])) respond(['error' => 'Choose a pig photo'], 422);
$upload = $_FILES['photo'];
if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string)($upload['tmp_name'] ?? ''))) respond(['error' => 'Photo upload failed'], 422);
$size = (int)($upload['size'] ?? 0);
if ($size < 1 || $size > 2097152) respond(['error' => 'Photo must be no larger than 2 MB'], 413);

$fileInfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $fileInfo->file((string)$upload['tmp_name']);
$allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
if (!is_string($mime) || !in_array($mime, $allowedMimes, true)) respond(['error' => 'Use a JPEG, PNG, or WebP image'], 415);
$dimensions = @getimagesize((string)$upload['tmp_name']);
if (!is_array($dimensions) || (int)$dimensions[0] < 1 || (int)$dimensions[1] < 1 || (int)$dimensions[0] > 4096 || (int)$dimensions[1] > 4096) respond(['error' => 'Image dimensions must be between 1 and 4096 pixels'], 422);
$photoData = file_get_contents((string)$upload['tmp_name']);
if ($photoData === false || strlen($photoData) > 2097152) respond(['error' => 'Photo could not be read or exceeds 2 MB'], 422);

try {
    $statement = $pdo->prepare('INSERT INTO pig_photos (pig_id, mime_type, photo_data, created_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE mime_type=VALUES(mime_type), photo_data=VALUES(photo_data), created_by=VALUES(created_by), updated_at=CURRENT_TIMESTAMP');
    $statement->bindValue(1, $pigId, PDO::PARAM_INT);
    $statement->bindValue(2, $mime, PDO::PARAM_STR);
    $statement->bindValue(3, $photoData, PDO::PARAM_LOB);
    $statement->bindValue(4, $actor['id'], PDO::PARAM_INT);
    $statement->execute();
    auditEvent($pdo, $actor['id'], 'pig.photo_saved', 'pig', (string)$pigId, ['mime_type' => $mime, 'bytes' => strlen($photoData)]);
    respond(['status' => 'saved', 'pig_id' => $pigId, 'mime_type' => $mime]);
} catch (PDOException $exception) {
    error_log('Pig photo save failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    respond(['error' => 'Unable to save pig photo'], 500);
}
