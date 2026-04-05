import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fnsnnezhikgqajdbtwoa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for CRM write operations — bypasses RLS
// persistSession: false ensures it always uses the service key, not the user's session
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Invoke a Supabase Edge Function by name
export async function invokeFunction(name, payload = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body: payload });
  if (error) {
    // Extract meaningful error message from edge function response
    let msg = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        msg = body?.error || body?.message || msg;
      } catch {}
    }
    console.error(`[invokeFunction] ${name} failed:`, msg, error);
    const enriched = new Error(msg);
    enriched.originalError = error;
    throw enriched;
  }
  return data;
}

// --- Multi-tenancy: project source identifier ---
const PROJECT_SOURCE = 'main';

// Tables that are shared reference data — no source filtering needed
const SHARED_TABLES = new Set([
  'plans',
  'services',
  'professions',
]);

// --- Entity name → Supabase table mapping ---
const entityTableMap = {
  Payment: 'payments', Plan: 'plans', Goal: 'goals', UserGoal: 'customer_goals',
  Lead: 'leads', CartItem: 'cart_items', BillingDocument: 'billing_documents',
  ActivityLog: 'activity_log', SystemComponent: 'system_components',
  AccountingDocument: 'accounting_documents', AccountingExpense: 'accounting_expenses',
  AccountingCustomer: 'accounting_customers', AccountingConnection: 'accounting_connections',
  FinbotDocument: 'accounting_documents', FinbotExpense: 'accounting_expenses',
  FinbotCustomer: 'accounting_customers', DailyFocus: 'daily_focus',
  Profession: 'professions', LandingPage: 'landing_pages', BlogPost: 'blog_posts',
  Customer: 'customers', DigitalCard: 'digital_cards', CardClick: 'card_clicks',
  LogoProject: 'logo_projects', LogoGeneration: 'logo_generations',
  CreditLedger: 'credit_ledger', UserAccount: 'user_accounts',
  Conversation: 'conversations', ConversationMessage: 'conversation_messages',
  GoalStep: 'goal_steps', BusinessJourney: 'business_state',
  GoalInteraction: 'goal_interactions', AiAgent: 'ai_agents',
  AgentPromptTemplate: 'agent_prompt_templates', EscalationAlert: 'escalation_alerts',
  WeeklyReport: 'weekly_reports', FollowupLead: 'followup_leads',
  FollowupSequence: 'followup_sequences', PageSnapshot: 'page_snapshots',
  BusinessJourneyRecord: 'business_journeys', PurchasedProduct: 'purchased_products',
  CRMLead: 'crm_leads', Agent: 'ai_agents', Campaign: 'campaigns',
  Client: 'clients', Communication: 'communications', Task: 'tasks',
  Document: 'documents', StatusHistory: 'status_history',
  ServiceCatalog: 'service_catalog', LostReason: 'lost_reasons',
  Notification: 'notifications',
  CloseOsekPaturCRM: 'close_osek_patur_crm', CompetitorData: 'competitor_data',
  ContentSuggestion: 'content_suggestions', FinbotAuditLog: 'finbot_audit_log',
  LinkReport: 'link_reports', MentorMessage: 'conversation_messages',
  PageQualityAnalysis: 'page_quality_analyses', Partnership: 'partnerships',
  SEOConfig: 'seo_config', SEOLog: 'seo_logs', SalesInsight: 'sales_insights',
  SalesInteraction: 'sales_interactions', SalesMetric: 'sales_metrics',
  SalesScript: 'sales_scripts', SavedWork: 'saved_works', Service: 'services',
  SitemapURL: 'sitemap_urls', Presentation: 'presentations', Sticker: 'stickers',
  OAuthToken: 'oauth_tokens',
};

function parseOrderBy(orderBy) {
  if (!orderBy) return null;
  const ascending = !orderBy.startsWith('-');
  const column = orderBy.replace(/^-/, '');
  return { column, ascending };
}

function createEntityHelper(tableName) {
  const needsSourceFilter = !SHARED_TABLES.has(tableName);

  return {
    async list(orderBy, limit) {
      let query = supabase.from(tableName).select('*');
      if (needsSourceFilter) query = query.eq('source', PROJECT_SOURCE);
      const order = parseOrderBy(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(filters = {}, orderBy, limit) {
      let query = supabase.from(tableName).select('*');
      if (needsSourceFilter) query = query.eq('source', PROJECT_SOURCE);
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      const order = parseOrderBy(orderBy);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      let query = supabase.from(tableName).select('*').eq('id', id);
      if (needsSourceFilter) query = query.eq('source', PROJECT_SOURCE);
      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },

    async create(record) {
      const recordWithSource = needsSourceFilter
        ? { ...record, source: PROJECT_SOURCE }
        : record;
      const { data, error } = await supabase.from(tableName).insert(recordWithSource).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      let query = supabase
        .from(tableName)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (needsSourceFilter) query = query.eq('source', PROJECT_SOURCE);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      let query = supabase.from(tableName).delete().eq('id', id);
      if (needsSourceFilter) query = query.eq('source', PROJECT_SOURCE);
      const { error } = await query;
      if (error) throw error;
      return { success: true };
    },

    subscribe(callback) {
      const channel = supabase
        .channel(`${tableName}_changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
          callback();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    },
  };
}

// Lazy-created entity helpers cache
const _entityCache = {};
function getEntity(name) {
  if (_entityCache[name]) return _entityCache[name];
  const tableName = entityTableMap[name] || name.toLowerCase() + 's';
  _entityCache[name] = createEntityHelper(tableName);
  return _entityCache[name];
}

// --- Exported entity helpers (direct Supabase, no proxy) ---
export const entities = {
  Payment: getEntity('Payment'), Plan: getEntity('Plan'),
  Goal: getEntity('Goal'), UserGoal: getEntity('UserGoal'),
  Lead: getEntity('Lead'), CartItem: getEntity('CartItem'),
  BillingDocument: getEntity('BillingDocument'), ActivityLog: getEntity('ActivityLog'),
  SystemComponent: getEntity('SystemComponent'),
  AccountingDocument: getEntity('AccountingDocument'),
  AccountingExpense: getEntity('AccountingExpense'),
  AccountingCustomer: getEntity('AccountingCustomer'),
  AccountingConnection: getEntity('AccountingConnection'),
  FinbotDocument: getEntity('FinbotDocument'),
  FinbotExpense: getEntity('FinbotExpense'),
  FinbotCustomer: getEntity('FinbotCustomer'),
  DailyFocus: getEntity('DailyFocus'), Profession: getEntity('Profession'),
  LandingPage: getEntity('LandingPage'), BlogPost: getEntity('BlogPost'),
  Customer: getEntity('Customer'), DigitalCard: getEntity('DigitalCard'),
  CardClick: getEntity('CardClick'), LogoProject: getEntity('LogoProject'),
  LogoGeneration: getEntity('LogoGeneration'), CreditLedger: getEntity('CreditLedger'),
  UserAccount: getEntity('UserAccount'), Conversation: getEntity('Conversation'),
  ConversationMessage: getEntity('ConversationMessage'),
  GoalStep: getEntity('GoalStep'), BusinessJourney: getEntity('BusinessJourney'),
  GoalInteraction: getEntity('GoalInteraction'), AiAgent: getEntity('AiAgent'),
  AgentPromptTemplate: getEntity('AgentPromptTemplate'),
  EscalationAlert: getEntity('EscalationAlert'), WeeklyReport: getEntity('WeeklyReport'),
  FollowupLead: getEntity('FollowupLead'), FollowupSequence: getEntity('FollowupSequence'),
  PageSnapshot: getEntity('PageSnapshot'),
  BusinessJourneyRecord: getEntity('BusinessJourneyRecord'),
  PurchasedProduct: getEntity('PurchasedProduct'), CRMLead: getEntity('CRMLead'),
  Agent: getEntity('Agent'), Campaign: getEntity('Campaign'),
  CloseOsekPaturCRM: getEntity('CloseOsekPaturCRM'),
  CompetitorData: getEntity('CompetitorData'),
  ContentSuggestion: getEntity('ContentSuggestion'),
  FinbotAuditLog: getEntity('FinbotAuditLog'), LinkReport: getEntity('LinkReport'),
  MentorMessage: getEntity('MentorMessage'),
  PageQualityAnalysis: getEntity('PageQualityAnalysis'),
  Partnership: getEntity('Partnership'), SEOConfig: getEntity('SEOConfig'),
  SEOLog: getEntity('SEOLog'), SalesInsight: getEntity('SalesInsight'),
  SalesInteraction: getEntity('SalesInteraction'),
  SalesMetric: getEntity('SalesMetric'), SalesScript: getEntity('SalesScript'),
  SavedWork: getEntity('SavedWork'), Service: getEntity('Service'),
  SitemapURL: getEntity('SitemapURL'), Presentation: getEntity('Presentation'),
  Sticker: getEntity('Sticker'), OAuthToken: getEntity('OAuthToken'),
  Client: getEntity('Client'), Communication: getEntity('Communication'),
  Task: getEntity('Task'), Document: getEntity('Document'),
  StatusHistory: getEntity('StatusHistory'), ServiceCatalog: getEntity('ServiceCatalog'),
  LostReason: getEntity('LostReason'), Notification: getEntity('Notification'),
};

// --- Auth helpers (direct Supabase, no proxy) ---
export const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { id: user.id, email: user.email, ...user.user_metadata };
  },

  async isAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },

  redirectToLogin(returnUrl) {
    const url = returnUrl ? `/login?returnTo=${encodeURIComponent(returnUrl)}` : '/login?returnTo=%2FAPP';
    window.location.href = url;
  },

  logout(returnUrl) {
    supabase.auth.signOut().then(() => {
      window.location.href = returnUrl || '/';
    });
  },

  async updateMe(updates) {
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (error) throw error;
    return data.user;
  },
};

// --- Integration helpers (direct Supabase Edge Functions) ---
export async function invokeLLM(params) {
  return invokeFunction('invokeLLM', params);
}

export async function sendEmail(params) {
  return invokeFunction('sendEmail', params);
}

export async function uploadFile({ file }) {
  const fileName = `${crypto.randomUUID()}_${file.name || 'file'}`;
  const { data, error } = await supabase.storage.from('uploads').upload(fileName, file, {
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
  return { file_url: urlData.publicUrl };
}