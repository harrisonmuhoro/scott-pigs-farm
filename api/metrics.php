<?php
require_once '../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

try {
    $stmt = $pdo->query("SELECT * FROM metrics");
    $metrics = $stmt->fetchAll();
    echo json_encode($metrics);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
