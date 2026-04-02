-- =============================================================
-- Add profile fields to customers table
-- Date: 2026-04-02
-- =============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS business_type      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS business_stage     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS experience_level   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS communication_style VARCHAR(20);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_customers_business_type    ON customers(business_type);
CREATE INDEX IF NOT EXISTS idx_customers_business_stage   ON customers(business_stage);
CREATE INDEX IF NOT EXISTS idx_customers_experience_level ON customers(experience_level);
