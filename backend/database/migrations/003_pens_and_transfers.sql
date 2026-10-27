-- Apply once after 001_core_livestock.sql; do not repeat the ALTER on a live schema.
CREATE TABLE pens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    capacity SMALLINT UNSIGNED NOT NULL,
    notes VARCHAR(2000) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_pens_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE pigs
    ADD COLUMN pen_id BIGINT UNSIGNED NULL,
    ADD INDEX idx_pigs_pen_status (pen_id, lifecycle_status),
    ADD CONSTRAINT fk_pigs_pen FOREIGN KEY (pen_id) REFERENCES pens(id) ON DELETE RESTRICT;

CREATE TABLE pig_transfers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pig_id BIGINT UNSIGNED NOT NULL,
    from_pen_id BIGINT UNSIGNED NULL,
    to_pen_id BIGINT UNSIGNED NULL,
    transferred_on DATE NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_transfers_pig_date (pig_id, transferred_on),
    CONSTRAINT chk_transfer_location_changed CHECK (from_pen_id IS NULL OR to_pen_id IS NULL OR from_pen_id <> to_pen_id),
    CONSTRAINT fk_transfers_pig FOREIGN KEY (pig_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_transfers_from FOREIGN KEY (from_pen_id) REFERENCES pens(id) ON DELETE RESTRICT,
    CONSTRAINT fk_transfers_to FOREIGN KEY (to_pen_id) REFERENCES pens(id) ON DELETE RESTRICT,
    CONSTRAINT fk_transfers_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
