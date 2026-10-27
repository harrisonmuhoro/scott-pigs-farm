-- Apply once after migrations 000–011 on a verified backup.
-- A litter is the system's group unit; group measurements store the sampled count and mean.
CREATE TABLE litter_weight_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    litter_id BIGINT UNSIGNED NOT NULL,
    measured_at DATE NOT NULL,
    sample_count SMALLINT UNSIGNED NOT NULL,
    average_weight_kg DECIMAL(8,3) NOT NULL,
    notes VARCHAR(1000) NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_litter_weights_date (litter_id, measured_at),
    CONSTRAINT chk_litter_weight_sample CHECK (sample_count > 0),
    CONSTRAINT chk_litter_weight_average CHECK (average_weight_kg > 0),
    CONSTRAINT fk_litter_weight_litter FOREIGN KEY (litter_id) REFERENCES litters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_litter_weight_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
