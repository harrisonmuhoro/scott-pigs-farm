-- Apply once after migrations 000–010 on a verified backup.
-- Photos are served only through the authenticated pig_photos.php endpoint.
CREATE TABLE pig_photos (
    pig_id BIGINT UNSIGNED PRIMARY KEY,
    mime_type ENUM('image/jpeg','image/png','image/webp') NOT NULL,
    photo_data MEDIUMBLOB NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_pig_photo_size CHECK (OCTET_LENGTH(photo_data) <= 2097152),
    CONSTRAINT fk_pig_photo_pig FOREIGN KEY (pig_id) REFERENCES pigs(id) ON DELETE CASCADE,
    CONSTRAINT fk_pig_photo_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
