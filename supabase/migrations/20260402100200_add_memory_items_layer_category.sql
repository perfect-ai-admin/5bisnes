-- =============================================================
-- Add layer + category to memory_items for memoryWriter support
-- Date: 2026-04-02
-- memory_items table already exists from 20260330 migration.
-- Adding layer/category for the 3-layer memory model.
-- =============================================================

ALTER TABLE memory_items
  ADD COLUMN IF NOT EXISTS layer    VARCHAR(20),  -- short_term / mid_term / long_term
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),  -- goal / blocker / win / preference / fact
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ; -- NULL = long_term

-- Index for layer-based queries
CREATE INDEX IF NOT EXISTS idx_memory_items_layer    ON memory_items(layer);
CREATE INDEX IF NOT EXISTS idx_memory_items_category ON memory_items(category);
CREATE INDEX IF NOT EXISTS idx_memory_items_expires  ON memory_items(expires_at)
  WHERE expires_at IS NOT NULL;
