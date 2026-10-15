<?php
require_once '../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

$action = $data->action ?? 'login';

if ($action === 'login') {
    if (!isset($data->username) || !isset($data->password)) {
        http_response_code(400);
        echo json_encode(["message" => "Username and password required"]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT id, username, password_hash FROM users WHERE username = ?");
        $stmt->execute([$data->username]);
        $user = $stmt->fetch();

        if ($user && password_verify($data->password, $user['password_hash'])) {
            echo json_encode([
                "status" => "success",
                "message" => "Login successful",
                "user" => [
                    "id" => $user['id'],
                    "username" => $user['username']
                ]
            ]);
        } else {
            http_response_code(401);
            echo json_encode(["message" => "Invalid credentials"]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }

} elseif ($action === 'update_profile') {
    // Requires: current_password, new_username (optional), new_password (optional), user_id
    if (!isset($data->user_id) || !isset($data->current_password)) {
        http_response_code(400);
        echo json_encode(["message" => "User ID and current password required"]);
        exit;
    }

    try {
        // Verify current password first
        $stmt = $pdo->prepare("SELECT id, password_hash FROM users WHERE id = ?");
        $stmt->execute([$data->user_id]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($data->current_password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(["message" => "Incorrect current password"]);
            exit;
        }

        // Build update query
        $updates = [];
        $params = [];

        if (!empty($data->new_username)) {
            $updates[] = "username = ?";
            $params[] = $data->new_username;
        }

        if (!empty($data->new_password)) {
            $updates[] = "password_hash = ?";
            $params[] = password_hash($data->new_password, PASSWORD_DEFAULT);
        }

        if (empty($updates)) {
            echo json_encode(["status" => "success", "message" => "No changes made"]);
            exit;
        }

        $params[] = $data->user_id;
        $sql = "UPDATE users SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(["status" => "success", "message" => "Profile updated successfully"]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }

} elseif ($action === 'reset_password') {
    // Requires: username, recovery_code, new_password
    if (!isset($data->username) || !isset($data->recovery_code) || !isset($data->new_password)) {
        http_response_code(400);
        echo json_encode(["message" => "All fields are required"]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? AND recovery_code = ?");
        $stmt->execute([$data->username, $data->recovery_code]);
        $user = $stmt->fetch();

        if ($user) {
            $new_hash = password_hash($data->new_password, PASSWORD_DEFAULT);
            $update = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $update->execute([$new_hash, $user['id']]);
            
            echo json_encode(["status" => "success", "message" => "Password reset successfully"]);
        } else {
            http_response_code(400);
            echo json_encode(["message" => "Invalid username or recovery code"]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }

} else {
    http_response_code(400);
    echo json_encode(["message" => "Invalid action"]);
}
?>
