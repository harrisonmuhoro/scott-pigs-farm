-- Add a one-time password rotation gate for accounts reset by a Developer.
-- Existing users are not forced to change their current passwords.
ALTER TABLE users
    ADD COLUMN force_password_change BOOLEAN NOT NULL DEFAULT FALSE AFTER active;
