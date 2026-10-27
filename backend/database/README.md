# Database and deployment procedure

## Current status

The local `scott_pigs` database was inspected on MySQL 8.4.7. A pre-migration dump was restored and verified in a separate database, migrations 000–008 were exercised there, and the original values/counts for `users` (1), `products` (9), `metrics` (4), and `monthly_finances` (0) were preserved. Migrations 000–008 were applied locally. Before migration 009, a current backup was saved at `D:\\wamp64\\private-backups\\scott-pigs\\scott_pigs_pre_roles_20261024.sql`; SHA-256: `8FE560ECC25C83D978A8F3AE46DCF1E5B7227840E5FC3B62A4D0DC01ECD07549`. Migration 009 is applied; the existing `admin` account is now Owner with its password hash preserved. Before migration 010, a backup was saved at `D:\\wamp64\\private-backups\\scott-pigs\\scott_pigs_pre_password_reset_20261024.sql`; SHA-256: `90C540D96B35E0EC34156FA504684E54C23E45692D69A622FBA4DB0CC6A06DDB`. Migration 010 is applied; both generated accounts require password rotation. Read-only verification on 2026-10-25 confirmed migrations 011–014 are applied: `pig_photos`, `litter_weight_records`, `herd_groups`, and `herd_group_events` exist; migration 014 pen columns are present. Migration 015 is new and must be applied once after a verified backup.

The scripts in `setup_finance_db.php` and `update_auth_db.php` are intentionally disabled and return 404 when requested over HTTP. `database/create_first_owner.php` is CLI-only.

Migration 015 verification: `pigs.herd_group_id`, its index, and `fk_pigs_herd_group` exist in MySQL; the `pigs` table currently contains zero rows.

## Required runtime configuration

Configure these variables in the PHP/Apache service environment. For local development only, you may copy the tracked `config.local.php.example` to `backend/config.local.php` and fill in the database user/password. `db.php` loads that file only when `SCOTT_APP_ENV` is not `production`; environment variables override file values. The actual `config.local.php` is git-ignored and `.htaccess` denies direct HTTP requests to it. Do not create or use this file in production. The frontend `.env` file is not read by PHP and must not contain database secrets.

- `SCOTT_DB_HOST`, `SCOTT_DB_NAME`, `SCOTT_DB_USER`, `SCOTT_DB_PASSWORD`
- `SCOTT_APP_ENV=development` locally; use `production` in deployment.
- `SCOTT_ALLOWED_ORIGINS`: exact comma-separated browser origins, including scheme and port (for example the deployed site origin). Production has no default allowlist and fails closed.
- `SCOTT_TIMEZONE`: farm timezone. The current default is `Africa/Nairobi` based on the repository's Nyeri, Kenya setting; confirm with the farm owner.

The local `config.local.php` now uses `scott_farm_app@localhost`, granted only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `scott_pigs`; a privilege probe confirmed it cannot create tables. Schema migrations were run using the administrator connection. Use an administrator account only for maintenance, secure it with a strong unique password, and avoid using it for routine application connections. The application fails closed if database credentials are not configured. In production, use HTTPS, `display_errors=Off`, protected PHP error logs, a private session storage path, and the current supported PHP security patch. On 2026-10-24, the web-served WAMP runtime reported PHP 8.3.28 and the CLI reported PHP 8.4.15. PHP's official 2026-10-21 advisory identifies critical unauthenticated RCE vulnerabilities and directs upgrades to PHP 8.3.36, 8.4.27, or 8.5.12 (depending on the branch). Both observed runtimes are behind fixed builds. Upgrade the WAMP Apache runtime and CLI runtime, then verify versions, extensions, and application workflows before production use. See the [official PHP security notice](https://www.php.net/archive/2026.php#2026-10-21-5).

## Migration order

1. Inspect the target schema and row counts; capture a database backup and restore it to a separate test database to verify it is usable.
2. For a new installation, apply `database/schema.sql`. Do not import `database/seed.sql` into an existing farm database. Its remaining rows are initial public catalog entries and will duplicate if imported repeatedly.
3. For an existing installation, inspect `monthly_finances`. Run `000_monthly_finances.sql` only if no table exists; `CREATE TABLE IF NOT EXISTS` leaves existing records unchanged. For a new installation, this table is supplied by `schema.sql` only if that file is expanded; check for it and apply migration 000 if absent.
4. Run `001_core_livestock.sql` once. It adds the legacy `users.role` column and creates the pig profile table. It is not a repeatable ALTER script.
5. Run `002_audit_and_finance_archive.sql` once after confirming `monthly_finances` exists and has the expected columns. It adds `archived_at` and creates `audit_logs`.
6. Run `003_pens_and_transfers.sql` through `008_transactional_legacy_tables.sql` once each, in order. These create the operational records and transaction-level finance tables, add reversible public-product archival, and convert legacy tables to InnoDB. Confirm every referenced table/column and inspect each migration output before proceeding.
7. Run `009_two_role_model.sql` once. It maps legacy Manager/Staff users to Owner and changes the available roles to Developer and Owner, preserving password hashes and active states.
8. Run `010_forced_password_change.sql` once to add the temporary-password rotation flag. Existing users keep `force_password_change=0`.
9. Provision the Developer and Owner accounts using the CLI-only `database/provision_initial_accounts.php` script. It creates the `farm.developer` and `farm.owner` accounts with generated one-time passwords and requires a password change at first sign-in.
10. Run `011_pig_photos.sql` once to enable authenticated pig photo storage. Keep photos in the database so the API can serve them only to authenticated Owners.
11. Run `012_litter_group_weights.sql` once to enable group sample-count and average-weight records linked to a litter.
12. Run `013_herd_groups.sql` once to enable independent cohort records and append-only head-count/lifecycle events.
13. Run `014_herd_group_pens.sql` once to add pen assignments, group-transfer history, and combined pig/group capacity enforcement.
14. Run `015_pig_herd_group_membership.sql` once to link individual pigs to active independent herd groups.
15. Configure the PHP and frontend origins, verify login/logout and read-only catalog behavior, then run application build checks. Do not expose the farm portal until the owner account and HTTPS/CORS settings are confirmed.

Keep a copy of the backup and migration output. For recovery, restore the verified backup to a separate database first, inspect it, and only then choose a forward-fix or restore strategy. The one-time ALTER migrations have no automatic rollback because dropping the new column/tables would discard newly created farm records.

## Initial access and roles

The former seeded `admin/admin123` and `123456` recovery defaults have been removed from setup guidance and seed data. For a fresh installation, apply migrations through 010, then run the CLI-only `database/provision_initial_accounts.php` command. It creates the initial `farm.developer` and `farm.owner` users and prints generated temporary passwords once. Change both passwords at first sign-in.

Developer accounts manage users, roles, system status, and website catalog entries. Owner accounts manage farm records, sales, finance, reports, and the public catalog. The Developer can create and deactivate either role; the API prevents changing the last active account for either role. Avoid storing generated passwords in source control.

The initial local accounts are `farm.developer` (Developer) and `farm.owner` (Owner); their generated passwords were provided directly to the project owner. The existing `admin` account was retained as another Owner and its password was not changed. Initial/generated credentials are marked temporary and the portal requires a password change before allowing other API actions. A Developer can issue an audited temporary password for another account; the new password is shown once in the Developer dashboard and must be shared directly with the account holder. The Developer cannot reset their own account from the UI; use the documented local operator recovery process if Developer access is lost.

For local lost-Developer access, run `php database/reset_account_password.php farm.developer` from a protected terminal on the app host. The script uses the configured least-privilege DB connection, updates only the named active account, writes an audit event without the password, and prints a generated temporary password once. Keep terminal access and output private. Do not run the script through a browser. The account is required to change the temporary password before accessing any other private API. If the Developer account is inactive, restore access through a verified database administrator procedure instead of silently reactivating it.

## Data rules and current limitations

- Pig profiles are individually identified by a unique tag ID. A sale or death is a lifecycle state; only a sold/deceased record can be archived, and archiving retains the row.
- The former dashboard pig/litter cards were hardcoded demo data, not persisted records. They are intentionally not imported as real pigs.
- Existing monthly finance values remain separate monthly summaries. They are not converted into underlying transactions and are not combined into transaction-level reports. Transaction-level income/expenses, inventory purchases, and sales are recorded separately; purchase receipts and sales post linked finance records atomically. Avoid adding those linked purchases/sales a second time as manual transactions.
- Inventory stock is movement-derived; purchase receipts and movement entries are transactional, negative stock is prohibited, batch expiry and low-stock alerts are recorded. Valuation is a current weighted-average estimate for untracked stock and remaining lot cost for batch-tracked stock; confirm the method with the farm owner before relying on reports.
- Pig/litter records, breeding and health events, vaccination schedules/reminders, individual weights, pens/transfers, two-role account management, transaction-level finance, inventory, sales, date-filtered CSV and native XLSX exports, and owner payment reconciliation are implemented in the dashboard/API. XLSX generation requires PHP ZipArchive. Filtered reports can also be printed or saved to PDF from the browser. Migration 011 adds authenticated profile photos; the image endpoint returns a clear migration-required response until it is applied.
- The Owner dashboard overview aggregates active herd, births/weaning, farrowing, health/vaccination tasks, low/expiring stock, sales and cash flow from stored records. Verify the returned totals against source records after the dashboard endpoint is deployed.
- Litter-group weight records store a measurement date, sample count, average kilogram weight, and notes. They do not imply that every animal in the litter was measured.
- Independent herd groups have dated count, lifecycle, and pen-transfer events. Pen capacity includes individual pigs and assigned group head counts. Individual pigs can optionally be linked to an active group; this does not replace a litter link.
- Password reset is available to Developers for other accounts and local operators can recover a lost Developer account through the CLI script above. Verify both mutation paths on an isolated database before release. External reminder delivery remains unconfigured; reminders are in-app only.
- Reminders are in-app only. Follow-up reminders can be marked complete; vaccination schedule reminders can be dismissed by deactivating the schedule. Record vaccine administration separately in the health record before dismissing a schedule. No external notification provider or scheduler is configured. Health records store doses as entered and do not provide clinical guidance.
- The audit log migration is required for successful use of the new API audit hooks.
- `recovery_code` may remain as a legacy column in an already migrated database, but no current endpoint reads or uses it. It should be removed only after inspecting the target schema and verifying no legitimate workflow depends on it.

## Backup and restore outline

Use the same database account policy and protected password prompt/environment provider for both commands. Store backups outside the public web root, restrict access, encrypt off-host copies, and periodically restore into an isolated staging database.

```text
mysqldump -u FARM_DB_USER -p --single-transaction scott_pigs > BACKUP_PATH
mysql -u RESTORE_DB_USER -p scott_pigs_restore < BACKUP_PATH
```

Replace placeholders locally; never commit a backup, credentials, or production data. Verify restored table counts and representative records before treating the backup as restorable.
