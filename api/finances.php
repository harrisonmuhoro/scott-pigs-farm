<?php
// Define CORS headers specifically for this endpoint
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight OPTIONS request immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Include database
require_once '../db.php';

// ... Rest of the script
// Restoring logic from previous version manually to ensure cleanliness

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM monthly_finances ORDER BY month ASC");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!isset($data['month'])) {
        http_response_code(400); echo json_encode(["error" => "Month is required"]); exit;
    }
    try {
        $stmt = $pdo->prepare("SELECT id FROM monthly_finances WHERE month = ?");
        $stmt->execute([$data['month']]);
        if ($stmt->fetch()) {
            $sql = "UPDATE monthly_finances SET revenue = ?, feed_cost = ?, labour_cost = ?, other_cost = ? WHERE month = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['revenue']??0, $data['feed_cost']??0, $data['labour_cost']??0, $data['other_cost']??0, $data['month']]);
            echo json_encode(["message" => "Updated successfully"]);
        } else {
            $sql = "INSERT INTO monthly_finances (month, revenue, feed_cost, labour_cost, other_cost) VALUES (?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['month'], $data['revenue']??0, $data['feed_cost']??0, $data['labour_cost']??0, $data['other_cost']??0]);
            echo json_encode(["message" => "Created successfully"]);
        }
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(["error" => $e->getMessage()]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!isset($data['id'])) {
        http_response_code(400); echo json_encode(["error" => "ID is required"]); exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM monthly_finances WHERE id = ?");
        $stmt->execute([$data['id']]);
        echo json_encode(["message" => "Deleted successfully"]);
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(["error" => $e->getMessage()]);
    }
}
?>
