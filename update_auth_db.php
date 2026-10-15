<?php
require_once 'db.php';

try {
    // Add recovery_code column to users table
    $sql = "ALTER TABLE users ADD COLUMN recovery_code VARCHAR(10) DEFAULT '123456'";
    $pdo->exec($sql);
    echo "Column recovery_code added successfully.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), "Duplicate column name") !== false) {
        echo "Column recovery_code already exists.\n";
    } else {
        echo "Error adding column: " . $e->getMessage() . "\n";
    }
}

// Update existing mock user logic if needed (optional since default is set)
?>
