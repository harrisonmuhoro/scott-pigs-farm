-- Safe to run before the one-time ALTER migrations. Existing tables/records remain untouched.
CREATE TABLE IF NOT EXISTS monthly_finances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month VARCHAR(7) NOT NULL UNIQUE,
    revenue DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    feed_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    labour_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    other_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
