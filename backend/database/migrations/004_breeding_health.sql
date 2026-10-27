-- Apply once after the livestock and audit migrations; all records are historical.
CREATE TABLE breeding_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pig_id BIGINT UNSIGNED NOT NULL,
    related_pig_id BIGINT UNSIGNED NULL,
    litter_id BIGINT UNSIGNED NULL,
    event_type ENUM('mating','insemination','pregnancy_check','farrowing','weaning','other') NOT NULL,
    event_date DATE NOT NULL,
    method VARCHAR(120) NULL,
    result VARCHAR(255) NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_breeding_pig_date (pig_id, event_date),
    CONSTRAINT fk_breeding_pig FOREIGN KEY (pig_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_related FOREIGN KEY (related_pig_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_litter FOREIGN KEY (litter_id) REFERENCES litters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE health_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pig_id BIGINT UNSIGNED NULL,
    litter_id BIGINT UNSIGNED NULL,
    record_type ENUM('observation','treatment','vaccination') NOT NULL,
    occurred_on DATE NOT NULL,
    symptoms TEXT NULL,
    product_name VARCHAR(255) NULL,
    dose_as_entered VARCHAR(80) NULL,
    dose_unit VARCHAR(40) NULL,
    route VARCHAR(80) NULL,
    withdrawal_days SMALLINT UNSIGNED NULL,
    responsible_person VARCHAR(120) NULL,
    follow_up_due DATE NULL,
    follow_up_status ENUM('open','completed','cancelled') NOT NULL DEFAULT 'open',
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_health_pig_date (pig_id, occurred_on),
    INDEX idx_health_followup (follow_up_status, follow_up_due),
    CONSTRAINT chk_health_exactly_one_target CHECK ((pig_id IS NOT NULL AND litter_id IS NULL) OR (pig_id IS NULL AND litter_id IS NOT NULL)),
    CONSTRAINT fk_health_pig FOREIGN KEY (pig_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_health_litter FOREIGN KEY (litter_id) REFERENCES litters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_health_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vaccination_schedules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pig_id BIGINT UNSIGNED NULL,
    litter_id BIGINT UNSIGNED NULL,
    vaccine_name VARCHAR(255) NOT NULL,
    due_date DATE NOT NULL,
    interval_days SMALLINT UNSIGNED NULL,
    notes VARCHAR(2000) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vax_due (active, due_date),
    CONSTRAINT chk_vax_exactly_one_target CHECK ((pig_id IS NOT NULL AND litter_id IS NULL) OR (pig_id IS NULL AND litter_id IS NOT NULL)),
    CONSTRAINT fk_vax_pig FOREIGN KEY (pig_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_vax_litter FOREIGN KEY (litter_id) REFERENCES litters(id) ON DELETE RESTRICT,
    CONSTRAINT fk_vax_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
