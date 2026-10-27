-- Merge the former Manager and Staff roles into Owner and introduce Developer.
-- Existing password hashes and account activity states are preserved.
UPDATE users SET role = 'owner' WHERE role IN ('manager', 'staff');
ALTER TABLE users
    MODIFY role ENUM('developer', 'owner') NOT NULL DEFAULT 'owner';
