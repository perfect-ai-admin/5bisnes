-- =============================================================
-- Add Business Journey fields to customers table
-- Date: 2026-04-05
-- Description: Adds columns required by analyzeBusinessJourney edge function
-- =============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS business_journey_answers       JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS business_journey_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_state                 JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_tasks                   JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS business_plan                  JSONB DEFAULT '{}';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_customers_business_journey_completed ON customers(business_journey_completed_at);
CREATE INDEX IF NOT EXISTS idx_customers_business_state ON customers(CAST(business_state->>'stage' AS VARCHAR));
