-- Apply once after 002_audit_and_finance_archive.sql. Stock is derived from signed movements.
CREATE TABLE suppliers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    contact_name VARCHAR(120) NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(254) NULL,
    notes VARCHAR(3000) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    category ENUM('feed','medicine_vaccine','supplement','equipment','consumable','other') NOT NULL,
    unit VARCHAR(32) NOT NULL,
    brand VARCHAR(120) NULL,
    description VARCHAR(3000) NULL,
    reorder_threshold DECIMAL(12,3) NOT NULL DEFAULT 0,
    preferred_supplier_id BIGINT UNSIGNED NULL,
    track_batches BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inventory_category_active (category, active),
    CONSTRAINT chk_inventory_reorder CHECK (reorder_threshold >= 0),
    CONSTRAINT fk_inventory_supplier FOREIGN KEY (preferred_supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchases (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_key CHAR(36) NOT NULL UNIQUE,
    supplier_id BIGINT UNSIGNED NULL,
    invoice_reference VARCHAR(120) NULL,
    purchase_date DATE NOT NULL,
    received_date DATE NOT NULL,
    amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
    payment_status ENUM('paid','partial','unpaid') NOT NULL DEFAULT 'unpaid',
    payment_method ENUM('cash','mobile_money','bank','credit','other') NULL,
    notes VARCHAR(3000) NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_lines (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit_cost DECIMAL(12,2) NOT NULL,
    batch_lot VARCHAR(80) NULL,
    expiry_date DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_purchase_lines_item (item_id),
    CONSTRAINT chk_purchase_quantity CHECK (quantity > 0),
    CONSTRAINT chk_purchase_cost CHECK (unit_cost >= 0),
    CONSTRAINT fk_purchase_lines_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchase_lines_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_movements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_key CHAR(36) NOT NULL UNIQUE,
    item_id BIGINT UNSIGNED NOT NULL,
    purchase_line_id BIGINT UNSIGNED NULL,
    movement_type ENUM('receipt','usage','wastage','return','adjustment') NOT NULL,
    quantity_delta DECIMAL(12,3) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    unit_cost DECIMAL(12,2) NULL,
    batch_lot VARCHAR(80) NULL,
    expiry_date DATE NULL,
    movement_date DATE NOT NULL,
    reason VARCHAR(1000) NULL,
    notes VARCHAR(3000) NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stock_item_date (item_id, movement_date, id),
    INDEX idx_stock_lot (item_id, batch_lot, expiry_date),
    CONSTRAINT chk_stock_nonzero CHECK (quantity_delta <> 0),
    CONSTRAINT fk_stock_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    CONSTRAINT fk_stock_purchase_line FOREIGN KEY (purchase_line_id) REFERENCES purchase_lines(id) ON DELETE RESTRICT,
    CONSTRAINT fk_stock_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
