<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    try {
        $stmt = $pdo->query('SELECT id, name, price, image, category, description, inquire FROM products WHERE active = 1 ORDER BY id');
        respond($stmt->fetchAll());
    } catch (Throwable $exception) {
        error_log('Public product catalog read failed: ' . $exception->getMessage());
        respond(['error' => 'Unable to load product catalog'], 500);
    }
}

if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) respond(['error' => 'Method not allowed'], 405);
$actor = requireRole(['developer', 'owner']);
requireCsrf();
$data = readJsonBody();

if ($method === 'DELETE') {
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$id) respond(['error' => 'A valid product ID is required'], 422);
    $statement = $pdo->prepare('UPDATE products SET active = 0 WHERE id = ? AND active = 1');
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) respond(['error' => 'Product not found'], 404);
    auditEvent($pdo, $actor['id'], 'product.archived', 'product', (string)$id);
    http_response_code(204);
    exit;
}

$id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (($method === 'PUT' && !$id) || ($method === 'POST' && isset($data['id']))) respond(['error' => 'Invalid product identifier'], 422);
if (isset($data['name']) && !is_string($data['name'])) respond(['error' => 'Product name must be text'], 422);
$name = trim((string)($data['name'] ?? ''));
$price = $data['price'] ?? null;
if ($name === '' || mb_strlen($name) > 255) respond(['error' => 'Product name is required and must be 255 characters or fewer'], 422);
if (!is_numeric($price) || (float)$price < 0 || (float)$price > 99999999.99 || preg_match('/^\d+(\.\d{1,2})?$/', (string)$price) !== 1) respond(['error' => 'Price must be a non-negative amount with up to two decimal places'], 422);
$fields = ['image' => 255, 'category' => 50, 'description' => 5000, 'inquire' => 2000];
$normalized = [];
foreach ($fields as $field => $maxLength) {
    if (isset($data[$field]) && !is_string($data[$field])) respond(['error' => ucfirst($field) . ' must be text'], 422);
    $value = isset($data[$field]) ? trim((string)$data[$field]) : null;
    if ($value !== null && mb_strlen($value) > $maxLength) respond(['error' => ucfirst($field) . " must be $maxLength characters or fewer"], 422);
    $normalized[$field] = $value ?: null;
}

try {
    if ($method === 'POST') {
        $statement = $pdo->prepare('INSERT INTO products (name, price, image, category, description, inquire) VALUES (?, ?, ?, ?, ?, ?)');
        $statement->execute([$name, (string)$price, ...array_values($normalized)]);
        $id = (int)$pdo->lastInsertId();
        $status = 201;
        $action = 'product.created';
    } else {
        $statement = $pdo->prepare('UPDATE products SET name=?, price=?, image=?, category=?, description=?, inquire=? WHERE id=? AND active=1');
        $statement->execute([$name, (string)$price, ...array_values($normalized), $id]);
        if ($statement->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM products WHERE id=?');
            $exists->execute([$id]);
            if (!$exists->fetch()) respond(['error' => 'Product not found'], 404);
        }
        $status = 200;
        $action = 'product.updated';
    }
    auditEvent($pdo, $actor['id'], $action, 'product', (string)$id);
    $statement = $pdo->prepare('SELECT id, name, price, image, category, description, inquire FROM products WHERE id=?');
    $statement->execute([$id]);
    respond($statement->fetch(), $status);
} catch (PDOException $exception) {
    error_log('Product write failed for user ' . $actor['id'] . ': ' . $exception->getMessage());
    respond(['error' => 'Unable to save product'], 500);
}

