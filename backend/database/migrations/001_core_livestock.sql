-- Apply once to the verified target database after a tested backup.
-- Existing users are assigned staff by default; explicitly provision/promote an owner
-- through the documented CLI procedure before exposing the management portal.
-- The legacy users table was MyISAM in the inspected installation; convert it so
-- user foreign keys and audit records are enforced by MySQL.
ALTER TABLE users ENGINE=InnoDB;

ALTER TABLE users
    ADD COLUMN role ENUM('owner', 'manager', 'staff') NOT NULL DEFAULT 'staff',
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE pigs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tag_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(100) NULL,
    sex ENUM('female', 'male', 'unknown') NOT NULL DEFAULT 'unknown',
    breed VARCHAR(100) NOT NULL,
    birth_date DATE NULL,
    birth_date_estimated BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(255) NULL,
    acquired_date DATE NULL,
    dam_id BIGINT UNSIGNED NULL,
    sire_id BIGINT UNSIGNED NULL,
    lifecycle_status ENUM('piglet','weaner','grower','finisher','breeding_gilt','sow','boar','sold','deceased','transferred') NOT NULL DEFAULT 'piglet',
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    archived_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_pigs_status (lifecycle_status),
    INDEX idx_pigs_birth_date (birth_date),
    CONSTRAINT fk_pigs_dam FOREIGN KEY (dam_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pigs_sire FOREIGN KEY (sire_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pigs_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE litters (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    litter_code VARCHAR(64) NOT NULL UNIQUE,
    dam_id BIGINT UNSIGNED NOT NULL,
    sire_id BIGINT UNSIGNED NULL,
    mating_date DATE NULL,
    expected_farrowing_date DATE NOT NULL,
    expected_date_estimated BOOLEAN NOT NULL DEFAULT TRUE,
    farrowing_date DATE NULL,
    total_born SMALLINT UNSIGNED NULL,
    born_alive SMALLINT UNSIGNED NULL,
    stillborn SMALLINT UNSIGNED NULL,
    fostered SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    weaned_count SMALLINT UNSIGNED NULL,
    weaned_date DATE NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    archived_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_litters_expected (expected_farrowing_date),
    INDEX idx_litters_dam (dam_id),
    CONSTRAINT fk_litters_dam FOREIGN KEY (dam_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_litters_sire FOREIGN KEY (sire_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_litters_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE pigs
    ADD COLUMN litter_id BIGINT UNSIGNED NULL,
    ADD INDEX idx_pigs_litter (litter_id),
    ADD CONSTRAINT fk_pigs_litter FOREIGN KEY (litter_id) REFERENCES litters(id) ON DELETE RESTRICT;

CREATE TABLE weight_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pig_id BIGINT UNSIGNED NOT NULL,
    measured_at DATE NOT NULL,
    weight_kg DECIMAL(8, 3) NOT NULL,
    notes VARCHAR(1000) NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_weights_pig_date (pig_id, measured_at),
    CONSTRAINT chk_weights_positive CHECK (weight_kg > 0),
    CONSTRAINT fk_weights_pig FOREIGN KEY (pig_id) REFERENCES pigs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_weights_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
