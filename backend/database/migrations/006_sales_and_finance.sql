-- Apply once after inventory migration. Values are decimal; totals are computed by SQL.
CREATE TABLE financial_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_key CHAR(36) NOT NULL UNIQUE,
    transaction_type ENUM('income','expense') NOT NULL,
    accounting_class ENUM('sale_revenue','other_income','operating_expense','inventory_purchase') NOT NULL,
    transaction_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'KES',
    payment_status ENUM('paid','partial','unpaid') NOT NULL DEFAULT 'unpaid',
    payment_method ENUM('cash','mobile_money','bank','credit','other') NULL,
    counterparty VARCHAR(180) NULL,
    reference VARCHAR(120) NULL,
    notes VARCHAR(5000) NULL,
    source_type ENUM('manual','purchase','sale') NOT NULL DEFAULT 'manual',
    source_id BIGINT UNSIGNED NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_finance_date_type (transaction_date, transaction_type, accounting_class),
    UNIQUE KEY uq_finance_source (source_type, source_id),
    CONSTRAINT chk_finance_amount CHECK (amount >= 0 AND amount_paid >= 0 AND amount_paid <= amount),
    CONSTRAINT fk_finance_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE financial_payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_key CHAR(36) NOT NULL UNIQUE,
    transaction_id BIGINT UNSIGNED NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    payment_method ENUM('cash','mobile_money','bank','credit','other') NOT NULL,
    reference VARCHAR(120) NULL,
    notes VARCHAR(1000) NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_payment_transaction_date (transaction_id, payment_date),
    CONSTRAINT chk_payment_amount CHECK (amount > 0),
    CONSTRAINT fk_payment_transaction FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sales (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_key CHAR(36) NOT NULL UNIQUE,
    sale_date DATE NOT NULL,
    customer VARCHAR(180) NULL,
    reference VARCHAR(120) NULL,
    total DECIMAL(14,2) NOT NULL,
    amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
    payment_status ENUM('paid','partial','unpaid') NOT NULL DEFAULT 'unpaid',
    payment_method ENUM('cash','mobile_money','bank','credit','other') NULL,
    notes VARCHAR(5000) NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sales_date (sale_date),
    CONSTRAINT chk_sale_amounts CHECK (total >= 0 AND amount_paid >= 0 AND amount_paid <= total),
    CONSTRAINT fk_sales_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sale_lines (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT UNSIGNED NOT NULL,
    pig_id BIGINT UNSIGNED NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(14,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sale_lines_sale (sale_id),
    UNIQUE KEY uq_sale_line_pig (pig_id),
    CONSTRAINT chk_sale_line_amount CHECK (quantity > 0 AND unit_price >= 0 AND line_total >= 0),
    CONSTRAINT fk_sale_lines_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sale_lines_pig FOREIGN KEY (pig_id) REFERENCES pigs(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
