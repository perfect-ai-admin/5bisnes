-- =============================================================
-- Mentor AI Schema Migration
-- Date: 2026-03-30
-- Description: Full schema for the Mentor AI system —
--   customer profiles, goals, conversations, memory, plans,
--   decisions, and insights.
-- =============================================================


-- =============================================================
-- HELPER: updated_at auto-update trigger function
-- (create once, reuse for all tables)
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================
-- 1. customer_profiles
-- Extended business profile — no duplication of customers cols
-- =============================================================
CREATE TABLE IF NOT EXISTS customer_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                 UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- financial
  current_income_range        TEXT,
  target_income_range         TEXT,

  -- business
  niche                       TEXT,
  services_or_products        TEXT,
  current_marketing_channels  TEXT[],

  -- self-assessment
  main_blockers               TEXT[],
  strengths                   TEXT[],
  weaknesses                  TEXT[],

  -- availability & pace
  available_hours_per_week    INTEGER,
  urgency_level               TEXT CHECK (urgency_level IN ('low','medium','high','critical')),

  -- behavioral style
  decision_style              TEXT,
  consistency_level           TEXT CHECK (consistency_level IN ('low','medium','high')),
  communication_style         TEXT,
  motivation_style            TEXT,

  -- free-form
  notes_json                  JSONB DEFAULT '{}',

  -- multi-tenancy
  source                      VARCHAR(50) NOT NULL DEFAULT 'main',

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_customer_profiles_customer UNIQUE (customer_id)
);

CREATE TRIGGER trg_customer_profiles_updated_at
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_customer_profiles_customer_id ON customer_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_source      ON customer_profiles(source);

-- RLS
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_customer_profiles"
  ON customer_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_customer_profiles"
  ON customer_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 2. goal_milestones
-- Milestones (checkpoints) for each customer goal
-- =============================================================
CREATE TABLE IF NOT EXISTS goal_milestones (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id              UUID NOT NULL REFERENCES customer_goals(id) ON DELETE CASCADE,

  title                TEXT NOT NULL,
  description          TEXT,
  order_index          INTEGER NOT NULL DEFAULT 0,
  estimated_days       INTEGER,

  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','in_progress','completed','skipped')),
  completion_criteria  TEXT,
  completed_at         TIMESTAMPTZ,

  source               VARCHAR(50) NOT NULL DEFAULT 'main',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_goal_milestones_updated_at
  BEFORE UPDATE ON goal_milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_status  ON goal_milestones(status);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_source  ON goal_milestones(source);

-- RLS
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_goal_milestones"
  ON goal_milestones FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_goal_milestones"
  ON goal_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 3. mentor_conversations
-- A single conversation session between customer and mentor
-- =============================================================
CREATE TABLE IF NOT EXISTS mentor_conversations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id               UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  channel                   TEXT NOT NULL DEFAULT 'web'
                              CHECK (channel IN ('whatsapp','web','app')),
  conversation_state        TEXT NOT NULL DEFAULT 'discovery'
                              CHECK (conversation_state IN (
                                'discovery','planning','execution',
                                'stuck','review','completed'
                              )),

  active_goal_id            UUID REFERENCES customer_goals(id) ON DELETE SET NULL,

  summary_short             TEXT,
  summary_long              TEXT,
  sentiment                 TEXT,
  mentor_mode               TEXT,
  next_recommended_action   TEXT,

  started_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at                  TIMESTAMPTZ,

  source                    VARCHAR(50) NOT NULL DEFAULT 'main',

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mentor_conversations_updated_at
  BEFORE UPDATE ON mentor_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_mentor_conversations_customer_id     ON mentor_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_mentor_conversations_active_goal_id  ON mentor_conversations(active_goal_id);
CREATE INDEX IF NOT EXISTS idx_mentor_conversations_state           ON mentor_conversations(conversation_state);
CREATE INDEX IF NOT EXISTS idx_mentor_conversations_channel         ON mentor_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_mentor_conversations_source          ON mentor_conversations(source);

-- RLS
ALTER TABLE mentor_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_mentor_conversations"
  ON mentor_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_mentor_conversations"
  ON mentor_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 4. mentor_messages
-- Individual messages within a conversation
-- =============================================================
CREATE TABLE IF NOT EXISTS mentor_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id         UUID NOT NULL REFERENCES mentor_conversations(id) ON DELETE CASCADE,
  customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  sender_type             TEXT NOT NULL
                            CHECK (sender_type IN ('user','mentor','system')),
  message_text            TEXT NOT NULL,
  message_type            TEXT NOT NULL DEFAULT 'text'
                            CHECK (message_type IN ('text','action','question','task','checkpoint')),

  intent                  TEXT,
  emotional_tone          TEXT,
  extracted_entities_json JSONB DEFAULT '{}',

  source                  VARCHAR(50) NOT NULL DEFAULT 'main',

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- no updated_at: messages are immutable once written
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_mentor_messages_conversation_id ON mentor_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_customer_id     ON mentor_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_sender_type     ON mentor_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_created_at      ON mentor_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_source          ON mentor_messages(source);

-- RLS
ALTER TABLE mentor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_mentor_messages"
  ON mentor_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_mentor_messages"
  ON mentor_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 5. memory_items
-- Long-term memory facts extracted from conversations
-- =============================================================
CREATE TABLE IF NOT EXISTS memory_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  memory_type             TEXT NOT NULL
                            CHECK (memory_type IN (
                              'profile_fact','goal_fact','blocker','preference',
                              'decision','commitment','risk','progress_update',
                              'personal_pattern','business_context'
                            )),

  title                   TEXT NOT NULL,
  content                 TEXT NOT NULL,

  importance_score        SMALLINT NOT NULL DEFAULT 5
                            CHECK (importance_score BETWEEN 1 AND 10),
  relevance_score         SMALLINT NOT NULL DEFAULT 5
                            CHECK (relevance_score BETWEEN 1 AND 10),

  source_message_id       UUID REFERENCES mentor_messages(id) ON DELETE SET NULL,
  source_conversation_id  UUID REFERENCES mentor_conversations(id) ON DELETE SET NULL,

  valid_from              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until             TIMESTAMPTZ,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,

  tags_json               JSONB DEFAULT '[]',

  source                  VARCHAR(50) NOT NULL DEFAULT 'main',

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_memory_items_updated_at
  BEFORE UPDATE ON memory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_memory_items_customer_id            ON memory_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_memory_type            ON memory_items(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_items_is_active              ON memory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_memory_items_importance_score       ON memory_items(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_items_source_conversation_id ON memory_items(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_source                 ON memory_items(source);
-- composite: typical query — active memories for a customer, sorted by importance
CREATE INDEX IF NOT EXISTS idx_memory_items_customer_active
  ON memory_items(customer_id, is_active, importance_score DESC);

-- RLS
ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_memory_items"
  ON memory_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_memory_items"
  ON memory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 6. mentor_plans
-- An actionable plan assigned to a customer for one goal
-- =============================================================
CREATE TABLE IF NOT EXISTS mentor_plans (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  active_goal_id          UUID NOT NULL REFERENCES customer_goals(id) ON DELETE CASCADE,

  plan_title              TEXT NOT NULL,
  plan_summary            TEXT,

  plan_duration_type      TEXT NOT NULL DEFAULT 'medium_plan'
                            CHECK (plan_duration_type IN ('short_sprint','medium_plan','long_journey')),
  estimated_total_days    INTEGER,

  cadence_type            TEXT NOT NULL DEFAULT 'weekly'
                            CHECK (cadence_type IN ('daily','every_2_days','weekly','milestone_based')),

  current_phase           TEXT,

  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','paused','completed','cancelled')),

  source                  VARCHAR(50) NOT NULL DEFAULT 'main',

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mentor_plans_updated_at
  BEFORE UPDATE ON mentor_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_mentor_plans_customer_id    ON mentor_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_mentor_plans_active_goal_id ON mentor_plans(active_goal_id);
CREATE INDEX IF NOT EXISTS idx_mentor_plans_status         ON mentor_plans(status);
CREATE INDEX IF NOT EXISTS idx_mentor_plans_source         ON mentor_plans(source);

-- RLS
ALTER TABLE mentor_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_mentor_plans"
  ON mentor_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_mentor_plans"
  ON mentor_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 7. mentor_plan_steps
-- Individual steps within a mentor plan
-- =============================================================
CREATE TABLE IF NOT EXISTS mentor_plan_steps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_plan_id   UUID NOT NULL REFERENCES mentor_plans(id) ON DELETE CASCADE,
  goal_id          UUID NOT NULL REFERENCES customer_goals(id) ON DELETE CASCADE,
  milestone_id     UUID REFERENCES goal_milestones(id) ON DELETE SET NULL,

  title            TEXT NOT NULL,
  description      TEXT,
  order_index      INTEGER NOT NULL DEFAULT 0,
  expected_outcome TEXT,

  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','in_progress','completed','skipped')),
  completed_at     TIMESTAMPTZ,

  source           VARCHAR(50) NOT NULL DEFAULT 'main',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mentor_plan_steps_updated_at
  BEFORE UPDATE ON mentor_plan_steps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_mentor_plan_steps_mentor_plan_id ON mentor_plan_steps(mentor_plan_id);
CREATE INDEX IF NOT EXISTS idx_mentor_plan_steps_goal_id        ON mentor_plan_steps(goal_id);
CREATE INDEX IF NOT EXISTS idx_mentor_plan_steps_milestone_id   ON mentor_plan_steps(milestone_id);
CREATE INDEX IF NOT EXISTS idx_mentor_plan_steps_status         ON mentor_plan_steps(status);
CREATE INDEX IF NOT EXISTS idx_mentor_plan_steps_source         ON mentor_plan_steps(source);

-- RLS
ALTER TABLE mentor_plan_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_mentor_plan_steps"
  ON mentor_plan_steps FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_mentor_plan_steps"
  ON mentor_plan_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 8. mentor_decisions
-- Key decisions made by the customer during mentoring
-- =============================================================
CREATE TABLE IF NOT EXISTS mentor_decisions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id            UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  goal_id                UUID REFERENCES customer_goals(id) ON DELETE SET NULL,

  title                  TEXT NOT NULL,
  decision_text          TEXT NOT NULL,
  reason                 TEXT,
  decided_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  source_conversation_id UUID REFERENCES mentor_conversations(id) ON DELETE SET NULL,

  impact_level           TEXT NOT NULL DEFAULT 'medium'
                           CHECK (impact_level IN ('low','medium','high')),

  source                 VARCHAR(50) NOT NULL DEFAULT 'main',

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mentor_decisions_updated_at
  BEFORE UPDATE ON mentor_decisions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_mentor_decisions_customer_id            ON mentor_decisions(customer_id);
CREATE INDEX IF NOT EXISTS idx_mentor_decisions_goal_id                ON mentor_decisions(goal_id);
CREATE INDEX IF NOT EXISTS idx_mentor_decisions_source_conversation_id ON mentor_decisions(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_mentor_decisions_impact_level           ON mentor_decisions(impact_level);
CREATE INDEX IF NOT EXISTS idx_mentor_decisions_source                 ON mentor_decisions(source);

-- RLS
ALTER TABLE mentor_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_mentor_decisions"
  ON mentor_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_mentor_decisions"
  ON mentor_decisions FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 9. mentor_insights
-- AI-generated insights about the customer
-- =============================================================
CREATE TABLE IF NOT EXISTS mentor_insights (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  insight_type     TEXT NOT NULL
                     CHECK (insight_type IN ('behavioral','strategic','emotional','operational')),

  title            TEXT NOT NULL,
  description      TEXT NOT NULL,

  confidence_score SMALLINT NOT NULL DEFAULT 50
                     CHECK (confidence_score BETWEEN 0 AND 100),

  source           VARCHAR(50) NOT NULL DEFAULT 'main',

  -- note: 'source' above is the multi-tenancy column.
  -- the insight origin (conversation/pattern/system) is stored separately:
  insight_origin   TEXT NOT NULL DEFAULT 'system'
                     CHECK (insight_origin IN ('conversation','pattern','system')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mentor_insights_updated_at
  BEFORE UPDATE ON mentor_insights
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_mentor_insights_customer_id   ON mentor_insights(customer_id);
CREATE INDEX IF NOT EXISTS idx_mentor_insights_insight_type  ON mentor_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_mentor_insights_confidence    ON mentor_insights(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_insights_source        ON mentor_insights(source);

-- RLS
ALTER TABLE mentor_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_mentor_insights"
  ON mentor_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_mentor_insights"
  ON mentor_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 10. ALTER customer_goals — add new columns
-- =============================================================
ALTER TABLE customer_goals
  ADD COLUMN IF NOT EXISTS goal_type              TEXT    NOT NULL DEFAULT 'medium'
    CHECK (goal_type IN ('quick','medium','long')),
  ADD COLUMN IF NOT EXISTS complexity_level       TEXT    NOT NULL DEFAULT 'medium'
    CHECK (complexity_level IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS priority_level         INTEGER NOT NULL DEFAULT 3
    CHECK (priority_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS urgency_level          TEXT    NOT NULL DEFAULT 'medium'
    CHECK (urgency_level IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS target_date            DATE,
  ADD COLUMN IF NOT EXISTS estimated_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS success_definition     TEXT,
  ADD COLUMN IF NOT EXISTS completed_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category               TEXT,
  ADD COLUMN IF NOT EXISTS created_from           TEXT    DEFAULT 'manual'
    CHECK (created_from IN ('manual','ai','template'));

-- indexes for the new customer_goals columns
CREATE INDEX IF NOT EXISTS idx_customer_goals_goal_type      ON customer_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_customer_goals_urgency_level  ON customer_goals(urgency_level);
CREATE INDEX IF NOT EXISTS idx_customer_goals_priority_level ON customer_goals(priority_level);
CREATE INDEX IF NOT EXISTS idx_customer_goals_target_date    ON customer_goals(target_date);


-- =============================================================
-- END OF MIGRATION
-- =============================================================
