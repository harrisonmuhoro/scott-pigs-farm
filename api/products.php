<?php
require_once '../db.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        try {
            $stmt = $pdo->query("SELECT * FROM products");
            $products = $stmt->fetchAll();
            echo json_encode($products);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'POST':
        // Basic auth check placeholder - in production use JWT or session
        // $headers = getallheaders();
        // if (!isset($headers['Authorization'])) {
        //     http_response_code(401);
        //     echo json_encode(["message" => "Unauthorized"]);
        //     exit;
        // }

        $data = json_decode(file_get_contents("php://input"));

        if (!isset($data->name) || !isset($data->price)) {
            http_response_code(400);
            echo json_encode(["message" => "Name and Price are required"]);
            exit;
        }

        try {
            if (isset($data->id)) {
                // Update existing product
                $sql = "UPDATE products SET name=?, price=?, image=?, category=?, description=?, inquire=? WHERE id=?";
                $stmt = $pdo->prepare($sql);
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $data->name, 
                    $data->price, 
                    $data->image ?? null, 
                    $data->category ?? null, 
                    $data->description ?? null, 
                    $data->inquire ?? null, 
                    $data->id
                ]);
                echo json_encode(["message" => "Product updated successfully"]);
            } else {
                // Create new product
                $sql = "INSERT INTO products (name, price, image, category, description, inquire) VALUES (?, ?, ?, ?, ?, ?)";
                $stmt = $pdo->prepare($sql);
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $data->name, 
                    $data->price, 
                    $data->image ?? null, 
                    $data->category ?? null, 
                    $data->description ?? null, 
                    $data->inquire ?? null
                ]);
                echo json_encode(["message" => "Product created successfully", "id" => $pdo->lastInsertId()]);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
    
    case 'DELETE':
        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->id)) {
             http_response_code(400);
             echo json_encode(["message" => "ID is required"]);
             exit;
        }
        try {
            $stmt = $pdo->prepare("DELETE FROM products WHERE id=?");
            $stmt->execute([$data->id]);
            echo json_encode(["message" => "Product deleted successfully"]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed"]);
        break;
}

