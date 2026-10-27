-- Link individual pigs to an independent herd group without changing litter history.
ALTER TABLE pigs
    ADD COLUMN herd_group_id BIGINT UNSIGNED NULL AFTER litter_id,
    ADD INDEX idx_pigs_herd_group (herd_group_id),
    ADD CONSTRAINT fk_pigs_herd_group FOREIGN KEY (herd_group_id) REFERENCES herd_groups(id) ON DELETE RESTRICT;
