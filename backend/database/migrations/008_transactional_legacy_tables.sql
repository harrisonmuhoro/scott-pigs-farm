-- Apply once after 007_product_archive.sql. Preserve rows while enabling atomic
-- updates and audit writes for the existing catalog and monthly finance records.
ALTER TABLE products ENGINE=InnoDB;
ALTER TABLE monthly_finances ENGINE=InnoDB;
