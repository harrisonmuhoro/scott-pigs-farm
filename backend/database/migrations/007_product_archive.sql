-- Apply once after 006_sales_and_finance.sql. Preserve the existing catalog and
-- replace hard deletion with reversible archival.
ALTER TABLE products
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD INDEX idx_products_active (active);
