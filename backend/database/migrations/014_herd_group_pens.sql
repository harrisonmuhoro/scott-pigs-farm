-- Adds pen assignment and auditable group pen transfers; requires migration 013.
ALTER TABLE herd_groups
    ADD COLUMN current_pen_id BIGINT UNSIGNED NULL AFTER head_count,
    ADD INDEX idx_herd_groups_pen (current_pen_id, lifecycle_status, archived_at),
    ADD CONSTRAINT fk_herd_groups_pen FOREIGN KEY (current_pen_id) REFERENCES pens(id) ON DELETE RESTRICT;

ALTER TABLE herd_group_events
    MODIFY event_type ENUM('count_adjustment','status_change','pen_transfer') NOT NULL,
    ADD COLUMN from_pen_id BIGINT UNSIGNED NULL AFTER new_status,
    ADD COLUMN to_pen_id BIGINT UNSIGNED NULL AFTER from_pen_id,
    ADD INDEX idx_herd_group_events_pen (from_pen_id, to_pen_id),
    ADD CONSTRAINT fk_herd_group_event_from_pen FOREIGN KEY (from_pen_id) REFERENCES pens(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_herd_group_event_to_pen FOREIGN KEY (to_pen_id) REFERENCES pens(id) ON DELETE RESTRICT;
