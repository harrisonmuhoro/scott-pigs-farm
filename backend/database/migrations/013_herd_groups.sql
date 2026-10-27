-- Independent herd cohorts. Additive: litter records and existing pig history are unchanged.
CREATE TABLE herd_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    group_type ENUM('cohort','quarantine','breeding','other') NOT NULL DEFAULT 'cohort',
    started_on DATE NOT NULL,
    lifecycle_status ENUM('active','closed') NOT NULL DEFAULT 'active',
    head_count SMALLINT UNSIGNED NOT NULL,
    notes VARCHAR(3000) NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    archived_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_herd_groups_status (lifecycle_status, archived_at),
    CONSTRAINT chk_herd_group_head_count CHECK (head_count >= 0),
    CONSTRAINT fk_herd_group_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE herd_group_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_id BIGINT UNSIGNED NOT NULL,
    event_type ENUM('count_adjustment','status_change') NOT NULL,
    occurred_on DATE NOT NULL,
    previous_count SMALLINT UNSIGNED NOT NULL,
    new_count SMALLINT UNSIGNED NOT NULL,
    previous_status ENUM('active','closed') NOT NULL,
    new_status ENUM('active','closed') NOT NULL,
    reason VARCHAR(255) NOT NULL,
    notes VARCHAR(3000) NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_herd_group_events_date (group_id, occurred_on, id),
    CONSTRAINT fk_herd_group_event_group FOREIGN KEY (group_id) REFERENCES herd_groups(id) ON DELETE RESTRICT,
    CONSTRAINT fk_herd_group_event_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
