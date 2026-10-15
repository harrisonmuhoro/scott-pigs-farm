<?php
require_once 'db.php';

try {
    $sql = "CREATE TABLE IF NOT EXISTS monthly_finances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        month VARCHAR(7) NOT NULL UNIQUE, -- Format: YYYY-MM
        revenue DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        feed_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        labour_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        other_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";

    $pdo->exec($sql);
    echo "Table 'monthly_finances' created successfully.";
} catch (PDOException $e) {
    die("DB ERROR: " . $e->getMessage());
}
?>
