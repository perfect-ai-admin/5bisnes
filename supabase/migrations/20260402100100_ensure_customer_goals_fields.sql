-- =============================================================
-- Ensure customer_goals has all required fields for Mentor AI
-- Date: 2026-04-02
-- Note: Most fields already exist from 20260330 migration.
--       This migration ensures completeness (idempotent).
-- =============================================================

-- These should already exist, but ADD COLUMN IF NOT EXISTS is safe:
ALTER TABLE customer_goals
  ADD COLUMN IF NOT EXISTS goal_type          VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS complexity_level   VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS priority_level     INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS target_date        DATE,
  ADD COLUMN IF NOT EXISTS success_definition TEXT,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ;

-- Indexes (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_customer_goals_goal_type      ON customer_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_customer_goals_priority_level ON customer_goals(priority_level);
CREATE INDEX IF NOT EXISTS idx_customer_goals_target_date    ON customer_goals(target_date);
CREATE INDEX IF NOT EXISTS idx_customer_goals_completed_at   ON customer_goals(completed_at);
