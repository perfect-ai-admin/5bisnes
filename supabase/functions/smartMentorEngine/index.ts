// smartMentorEngine v18
// Full-stack mentor engine with Memory, Conversation State, JSON Output Contract
// Uses vault RPC for OpenAI key (env var not available in Edge Functions)

let _cachedOpenAIKey: string | null = null;
async function getOpenAIKey(): Promise<string> {
  if (_cachedOpenAIKey) return _cachedOpenAIKey;
  const envKey = Deno.env.get('OPENAI_API_KEY');
  if (envKey) { _cachedOpenAIKey = envKey; return envKey; }
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${url}/rest/v1/rpc/get_openai_key`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (res.ok) {
    const result = await res.json();
    if (result) { _cachedOpenAIKey = result; return result; }
  }
  throw new Error('OPENAI_API_KEY not found in env or vault');
}

const GREENAPI_INSTANCE_ID = '7103857301';
const GREENAPI_TOKEN = '72f2949724084044a99d6cdaab4976e1d1a00029bf7d467f84';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

// ─── Supabase client (inline, no _shared import) ───────────────────────────

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  async function from(table: string) {
    return {
      async select(columns = '*', opts: { single?: boolean; maybeSingle?: boolean } = {}) {
        return { table, columns, opts, _url: `${url}/rest/v1/${table}`, headers };
      },
    };
  }

  // Direct fetch helpers
  async function query(
    table: string,
    params: Record<string, string>,
    columns = '*'
  ): Promise<any[]> {
    // Build query string manually — URLSearchParams encodes commas which breaks PostgREST
    const parts = [`select=${columns}`];
    for (const [k, v] of Object.entries(params)) {
      parts.push(`${k}=${v}`);
    }
    const qs = parts.join('&');
    const res = await fetch(`${url}/rest/v1/${table}?${qs}`, { headers });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`query ${table} failed (${res.status}):`, errText);
      return [];
    }
    return res.json();
  }

  async function insert(table: string, row: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`insert ${table} failed: ${err}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  }

  async function upsert(table: string, row: Record<string, unknown>, onConflict: string): Promise<any> {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`upsert ${table} failed: ${err}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  }

  async function update(table: string, filter: Record<string, string>, row: Record<string, unknown>): Promise<void> {
    const qs = new URLSearchParams(filter);
    const res = await fetch(`${url}/rest/v1/${table}?${qs}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`update ${table} failed: ${err}`);
    }
  }

  return { query, insert, upsert, update };
}

// ─── GreenAPI WhatsApp ───────────────────────────────────────────────────────

async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const chatId = phone.replace('+', '') + '@c.us';
  const url = `https://api.green-api.com/waInstance${GREENAPI_INSTANCE_ID}/sendMessage/${GREENAPI_TOKEN}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GreenAPI send failed: ${res.status} — ${body}`);
  }
}

// ─── Find customer ───────────────────────────────────────────────────────────

const CUSTOMER_COLUMNS = 'id,full_name,phone_e164,email,business_type,experience_level,business_state,business_journey_answers,business_plan,client_tasks';

async function findCustomer(db: ReturnType<typeof getSupabase>, customerId: string): Promise<any | null> {
  // Try by UUID
  const byId = await db.query('customers', { id: `eq.${customerId}` }, CUSTOMER_COLUMNS);
  if (byId.length > 0) return byId[0];

  // Try by phone — exact match
  const byPhone = await db.query('customers', { phone_e164: `eq.${customerId}` }, CUSTOMER_COLUMNS);
  if (byPhone.length > 0) return byPhone[0];

  // Try by phone — with/without + prefix
  if (customerId.startsWith('+')) {
    const without = customerId.slice(1);
    const r = await db.query('customers', { phone_e164: `eq.${without}` }, CUSTOMER_COLUMNS);
    if (r.length > 0) return r[0];
  } else if (/^\d{10,15}$/.test(customerId)) {
    const withPlus = '+' + customerId;
    const r = await db.query('customers', { phone_e164: `eq.${withPlus}` }, CUSTOMER_COLUMNS);
    if (r.length > 0) return r[0];
  }

  // Try by email
  const byEmail = await db.query('customers', { email: `eq.${customerId}` }, CUSTOMER_COLUMNS);
  if (byEmail.length > 0) return byEmail[0];

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatMemoryItems(items: any[]): string {
  if (!items || items.length === 0) return 'אין זיכרון שמור.';
  return items
    .map((m) => `[${m.memory_type || 'כללי'}] ${m.title}: ${m.content}`)
    .join('\n');
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────

function buildFallbackResponse(message: string, conversationState: string): MentorJsonOutput {
  const state = conversationState || 'discovery';
  const fallbacks: Record<string, string> = {
    discovery: 'שמעתי אותך. ספר לי יותר — מה הצעד הכי חשוב שאתה רוצה לעשות עכשיו?',
    planning: 'בואו נתכנן יחד. מה לדעתך הצעד הראשון שצריך לקחת?',
    execution: 'מצוין שאתה בפעולה. מה הצלחת לעשות מאז הפעם האחרונה?',
    stuck: 'אני רואה שיש חסם. מה לדעתך הדבר הכי קטן שאפשר לעשות כדי להתקדם?',
    review: 'בואו נסכם. מה עבד הכי טוב לאחרונה?',
    completed: 'כל הכבוד על ההשגה! מה המטרה הבאה שאתה רוצה לעבוד עליה?',
  };

  return {
    response_text: fallbacks[state] || fallbacks['discovery'],
    conversation_state: state as MentorJsonOutput['conversation_state'],
    memory_updates: [],
    tasks_to_create: [],
    decisions_to_save: [],
    goal_updates: { progress_percent: null, progress_narrative: null },
    follow_up_needed: false,
    follow_up_delay_hours: 24,
    next_expected_user_input: '',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MentorJsonOutput {
  response_text: string;
  conversation_state: 'discovery' | 'planning' | 'execution' | 'stuck' | 'review' | 'completed';
  memory_updates: Array<{
    action: 'create' | 'update';
    id?: string;
    memory_type: string;
    title: string;
    content: string;
    importance_score: number;
  }>;
  tasks_to_create: Array<{
    title: string;
    description?: string;
    due_date?: string;
  }>;
  decisions_to_save: Array<{
    title: string;
    decision_text: string;
    reason?: string;
    impact_level?: 'low' | 'medium' | 'high';
  }>;
  goal_updates: {
    progress_percent: number | null;
    progress_narrative: string | null;
  };
  follow_up_needed: boolean;
  follow_up_delay_hours: number;
  next_expected_user_input: string;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const db = getSupabase();

  try {
    const body = await req.json();
    const { customer_id, message, channel, goal_id } = body;

    if (!customer_id || !message) {
      return errorResponse('customer_id and message are required', 400);
    }

    console.log('smartMentorEngine v18: received customer_id =', customer_id, 'channel =', channel);

    // ── Step 1: Resolve customer ──────────────────────────────────────────────
    const customer = await findCustomer(db, customer_id);
    if (!customer) {
      console.error('smartMentorEngine: Customer NOT FOUND for id:', customer_id);
      return errorResponse('Customer not found', 404);
    }
    console.log('smartMentorEngine: found customer', customer.id, customer.full_name);

    const customerId: string = customer.id;

    // ── Step 2: Load business context from customer record + customer_profiles ─
    // business_state is a JSON column on customers table, not a separate table
    const businessState = customer.business_state || null;
    const journeyAnswers = customer.business_journey_answers || null;

    // Load rich profile from customer_profiles table
    let customerProfile: any = null;
    const profileRows = await db.query(
      'customer_profiles',
      { customer_id: `eq.${customerId}`, limit: '1' },
      'niche,services_or_products,current_marketing_channels,main_blockers,strengths,weaknesses,available_hours_per_week,urgency_level,decision_style,consistency_level,communication_style,motivation_style'
    );
    customerProfile = profileRows[0] || null;

    // ── Step 3: Load active goal + mentor_plan ────────────────────────────────
    let activeGoal: any = null;
    let mentorPlan: any = null;

    const goalIdToUse = goal_id || null;

    if (goalIdToUse) {
      const goalRows = await db.query(
        'customer_goals',
        { id: `eq.${goalIdToUse}`, customer_id: `eq.${customerId}` },
        'id,goal_id,status,progress,progress_narrative,goal_type,complexity_level,estimated_duration_days,tasks'
      );
      activeGoal = goalRows[0] || null;
    } else {
      const goalRows = await db.query(
        'customer_goals',
        { customer_id: `eq.${customerId}`, status: 'in.(active,selected)', order: 'created_at.desc', limit: '1' },
        'id,goal_id,status,progress,progress_narrative,goal_type,complexity_level,estimated_duration_days,tasks'
      );
      activeGoal = goalRows[0] || null;
    }

    // Load goal title from goals table if we have a goal
    let goalTitle = '';
    if (activeGoal?.goal_id) {
      const goalDefRows = await db.query(
        'goals',
        { id: `eq.${activeGoal.goal_id}` },
        'title,description'
      );
      if (goalDefRows[0]) {
        goalTitle = goalDefRows[0].title || '';
      }
    }

    // Load mentor_plan for this customer_goal
    if (activeGoal?.id) {
      const planRows = await db.query(
        'mentor_plans',
        { customer_id: `eq.${customerId}`, status: 'in.(active,draft)', order: 'created_at.desc', limit: '1' },
        'id,plan_title,current_phase,status'
      );
      mentorPlan = planRows[0] || null;
    }

    // ── Step 4: Load memory_items ─────────────────────────────────────────────
    const memoryItems = await db.query(
      'memory_items',
      {
        customer_id: `eq.${customerId}`,
        is_active: 'eq.true',
        order: 'importance_score.desc',
        limit: '20',
      },
      'id,memory_type,title,content,importance_score'
    );

    // ── Step 5: Load or create mentor_conversation ────────────────────────────
    const convRows = await db.query(
      'mentor_conversations',
      {
        customer_id: `eq.${customerId}`,
        order: 'started_at.desc',
        limit: '1',
      },
      'id,conversation_state,active_goal_id,summary_short,channel'
    );

    let conversation = convRows[0] || null;

    if (!conversation) {
      try {
        conversation = await db.insert('mentor_conversations', {
          customer_id: customerId,
          channel: channel || 'web',
          conversation_state: 'discovery',
          active_goal_id: activeGoal?.id || null,
          started_at: new Date().toISOString(),
          source: 'main',
        });
      } catch (e) {
        console.warn('smartMentorEngine: failed to create conversation:', (e as Error).message);
        conversation = { id: null, conversation_state: 'discovery' };
      }
    }

    const currentConversationState = conversation?.conversation_state || 'discovery';

    // ── Step 5b: Load conversation history ───────────────────────────────────
    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (conversation?.id) {
      const historyRows = await db.query(
        'mentor_messages',
        {
          conversation_id: `eq.${conversation.id}`,
          order: 'created_at.asc',
          limit: '20',
        },
        'sender_type,message_text'
      );
      conversationHistory = historyRows
        .filter((m: any) => m.message_text)
        .map((m: any) => ({
          role: m.sender_type === 'user' ? 'user' : 'assistant',
          content: m.message_text,
        }));
    }

    // ── Step 6: Save user message ─────────────────────────────────────────────
    if (conversation?.id) {
      try {
        await db.insert('mentor_messages', {
          conversation_id: conversation.id,
          customer_id: customerId,
          sender_type: 'user',
          message_text: message,
          message_type: 'text',
          source: 'main',
        });
      } catch (e) {
        console.warn('mentor_messages user insert failed:', (e as Error).message);
      }
    }

    // ── Step 7: Build System Prompt ───────────────────────────────────────────
    const customerName = customer.full_name || 'לקוח';
    const businessType = businessState?.business_type || customer.business_type || 'לא ידוע';
    const businessStage = businessState?.stage || 'לא ידוע';
    const experienceLevel = businessState?.experience_level || customer.experience_level || 'לא ידוע';
    const mainChallenge = businessState?.main_challenge || '';
    const recommendedFocus = businessState?.recommended_focus || '';
    const businessSummary = businessState?.summary || '';

    // Format questionnaire answers if available
    let journeySection = '';
    if (journeyAnswers && typeof journeyAnswers === 'object') {
      const answers = Array.isArray(journeyAnswers) ? journeyAnswers : Object.entries(journeyAnswers).map(([k, v]) => `${k}: ${v}`);
      if (answers.length > 0) {
        journeySection = `\n## תשובות השאלון העסקי\n${Array.isArray(journeyAnswers) ? journeyAnswers.map((a: any) => `- ${a.question || a.q}: ${a.answer || a.a}`).join('\n') : Object.entries(journeyAnswers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
      }
    }

    // Format customer profile if available
    let profileSection = '';
    if (customerProfile) {
      const fields: string[] = [];
      if (customerProfile.niche) fields.push(`- נישה: ${customerProfile.niche}`);
      if (customerProfile.services_or_products) fields.push(`- שירותים/מוצרים: ${customerProfile.services_or_products}`);
      if (customerProfile.current_marketing_channels) fields.push(`- ערוצי שיווק: ${customerProfile.current_marketing_channels}`);
      if (customerProfile.main_blockers) fields.push(`- חסמים עיקריים: ${customerProfile.main_blockers}`);
      if (customerProfile.strengths) fields.push(`- חוזקות: ${customerProfile.strengths}`);
      if (customerProfile.weaknesses) fields.push(`- חולשות: ${customerProfile.weaknesses}`);
      if (customerProfile.available_hours_per_week) fields.push(`- שעות זמינות בשבוע: ${customerProfile.available_hours_per_week}`);
      if (customerProfile.urgency_level) fields.push(`- רמת דחיפות: ${customerProfile.urgency_level}`);
      if (customerProfile.communication_style) fields.push(`- סגנון תקשורת: ${customerProfile.communication_style}`);
      if (customerProfile.motivation_style) fields.push(`- סגנון מוטיבציה: ${customerProfile.motivation_style}`);
      if (fields.length > 0) profileSection = `\n## פרופיל עסקי מורחב\n${fields.join('\n')}`;
    }

    // Business plan section
    let planSection = '';
    if (customer.business_plan) {
      const bp = typeof customer.business_plan === 'string' ? customer.business_plan : JSON.stringify(customer.business_plan);
      if (bp.length < 500) planSection = `\n## תוכנית עסקית\n${bp}`;
    }

    const systemPrompt = `אתה מנטור עסקי אישי בפרפקט וואן. שמך: המנטור.

## פרטי הלקוח
- שם: ${customerName}
- סוג עסק: ${businessType}
- שלב עסקי: ${businessStage}
- ניסיון: ${experienceLevel}
${mainChallenge ? `- אתגר מרכזי: ${mainChallenge}` : ''}
${recommendedFocus ? `- פוקוס מומלץ: ${recommendedFocus}` : ''}
${businessSummary ? `- סיכום מצב: ${businessSummary}` : ''}
${journeySection}${profileSection}${planSection}

## המטרה הפעילה
- שם: ${goalTitle || 'לא הוגדרה מטרה'}
- סוג: ${activeGoal?.goal_type || 'לא ידוע'} (quick/medium/long)
- מורכבות: ${activeGoal?.complexity_level || 'לא ידוע'}
- סטטוס: ${activeGoal?.status || 'לא ידוע'}
- התקדמות: ${activeGoal?.progress || 0}%

## תוכנית מנטור
${mentorPlan?.plan_title || 'אין תוכנית פעילה'}
שלב נוכחי: ${mentorPlan?.current_phase || 'לא ידוע'}

## זיכרון רלוונטי
${formatMemoryItems(memoryItems)}

## מצב השיחה הנוכחי: ${currentConversationState}

## כללי שיחה:
1. שאל שאלה אחת בכל פעם
2. אל תשלח הודעות ארוכות — מקסימום 3-4 שורות
3. תמיד סיים עם שאלה או משימה קטנה
4. דבר בגוף שני יחיד, בעברית פשוטה
5. אל תשתמש באימוג'ים יותר מדי — מקסימום 1-2
6. אל תדבר כמו מערכת — דבר כמו מנטור אנושי
7. תמיד התייחס למה שהלקוח אמר לפני שאתה ממשיך

## לפי מצב השיחה:
- discovery: תברר מה הלקוח רוצה, למה עכשיו, מה תקוע
- planning: תבנה תוכנית, תציע צעדים, תוודא שהלקוח מסכים
- execution: תעקוב אחרי משימות, תדחוף בעדינות, תחגוג הצלחות
- stuck: תזהה את החסם, תציע פתרון פשוט, תוריד לחץ
- review: תסכם מה עבד, מה לא, תציע התאמות
- completed: תחגוג, תסכם learning, תציע מטרה הבאה

## פורמט תגובה:
החזר JSON בפורמט הבא בלבד:
{
  "response_text": "ההודעה ללקוח",
  "conversation_state": "discovery|planning|execution|stuck|review|completed",
  "memory_updates": [{"action":"create","memory_type":"...","title":"...","content":"...","importance_score":5}],
  "tasks_to_create": [],
  "decisions_to_save": [],
  "goal_updates": {"progress_percent":null,"progress_narrative":null},
  "follow_up_needed": true,
  "follow_up_delay_hours": 24,
  "next_expected_user_input": "..."
}`;

    // ── Step 8: Call OpenAI with JSON mode ────────────────────────────────────
    let parsed: MentorJsonOutput;
    let rawResponse = '';

    try {
      // Build messages array with conversation history
      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: message },
      ];

      const OPENAI_API_KEY = await getOpenAIKey();
      console.log('smartMentorEngine: calling OpenAI with', openaiMessages.length, 'messages, key prefix:', OPENAI_API_KEY?.substring(0, 8));

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: openaiMessages,
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        throw new Error(`OpenAI API ${openaiRes.status}: ${errText}`);
      }

      const completion = await openaiRes.json();
      rawResponse = completion.choices?.[0]?.message?.content || '{}';
      parsed = JSON.parse(rawResponse) as MentorJsonOutput;

      // Validate required field
      if (!parsed.response_text) {
        throw new Error('response_text missing in OpenAI output');
      }
    } catch (openaiError) {
      const errMsg = (openaiError as Error).message;
      console.error('smartMentorEngine: OpenAI failed:', errMsg);
      // Fallback to rule-based response
      console.error('smartMentorEngine: falling back to rule-based response');
      parsed = buildFallbackResponse(message, currentConversationState);
    }

    const responseText = parsed.response_text;
    const newConversationState = parsed.conversation_state || currentConversationState;

    // ── Step 9: Save mentor message ───────────────────────────────────────────
    if (conversation?.id) {
      db.insert('mentor_messages', {
        conversation_id: conversation.id,
        customer_id: customerId,
        sender_type: 'mentor',
        message_text: responseText,
        message_type: 'text',
        source: 'main',
      }).catch((e: Error) => console.warn('mentor_messages mentor insert failed:', e.message));
    }

    // ── Step 10: Apply JSON contract updates (all NON-BLOCKING) ──────────────

    // 10a. memory_updates
    if (Array.isArray(parsed.memory_updates) && parsed.memory_updates.length > 0) {
      for (const mu of parsed.memory_updates) {
        if (!mu.title || !mu.content) continue;

        if (mu.action === 'update' && mu.id) {
          db.update('memory_items', { id: `eq.${mu.id}` }, {
            title: mu.title,
            content: mu.content,
            importance_score: mu.importance_score ?? 5,
            updated_at: new Date().toISOString(),
          }).catch((e: Error) => console.warn('memory_items update failed:', e.message));
        } else {
          db.insert('memory_items', {
            customer_id: customerId,
            memory_type: mu.memory_type || 'general',
            title: mu.title,
            content: mu.content,
            importance_score: mu.importance_score ?? 5,
            is_active: true,
            source_conversation_id: conversation?.id || null,
            source: 'main',
          }).catch((e: Error) => console.warn('memory_items insert failed:', e.message));
        }
      }
    }

    // 10b. decisions_to_save
    if (Array.isArray(parsed.decisions_to_save) && parsed.decisions_to_save.length > 0) {
      for (const dec of parsed.decisions_to_save) {
        if (!dec.title || !dec.decision_text) continue;
        db.insert('mentor_decisions', {
          customer_id: customerId,
          goal_id: activeGoal?.goal_id || null,
          title: dec.title,
          decision_text: dec.decision_text,
          reason: dec.reason || null,
          impact_level: dec.impact_level || 'medium',
          source: 'main',
        }).catch((e: Error) => console.warn('mentor_decisions insert failed:', e.message));
      }
    }

    // 10c. goal_updates
    if (activeGoal?.id && parsed.goal_updates) {
      const { progress_percent, progress_narrative } = parsed.goal_updates;
      const goalPatch: Record<string, unknown> = {};
      if (progress_percent !== null && progress_percent !== undefined) {
        goalPatch.progress = progress_percent;
      }
      if (progress_narrative) {
        goalPatch.progress_narrative = progress_narrative;
      }
      if (Object.keys(goalPatch).length > 0) {
        db.update('customer_goals', { id: `eq.${activeGoal.id}` }, goalPatch)
          .catch((e: Error) => console.warn('customer_goals update failed:', e.message));
      }
    }

    // 10d. conversation_state update
    if (conversation?.id) {
      db.update('mentor_conversations', { id: `eq.${conversation.id}` }, {
        conversation_state: newConversationState,
        active_goal_id: activeGoal?.id || conversation.active_goal_id || null,
      }).catch((e: Error) => console.warn('mentor_conversations update failed:', e.message));
    }

    // ── Step 11: Send WhatsApp if channel=whatsapp ────────────────────────────
    if (channel === 'whatsapp') {
      if (!customer.phone_e164) {
        return errorResponse('Customer has no phone_e164 for WhatsApp', 400);
      }
      await sendWhatsApp(customer.phone_e164, responseText);
    }

    // ── Step 12: Log activity ─────────────────────────────────────────────────
    db.insert('activity_log', {
      customer_id: customerId,
      action: 'smart_mentor_response_v18',
      entity_type: 'mentor_conversation',
      entity_id: conversation?.id || null,
      metadata: {
        channel: channel || 'web',
        goal_id: goal_id || null,
        message,
        response: responseText,
        conversation_state: newConversationState,
        memory_updates_count: (parsed.memory_updates || []).length,
        decisions_count: (parsed.decisions_to_save || []).length,
        follow_up_needed: parsed.follow_up_needed,
        follow_up_delay_hours: parsed.follow_up_delay_hours,
      },
      source: 'main',
    }).catch((e: Error) => console.warn('activity_log insert failed:', e.message));

    // ── Return ────────────────────────────────────────────────────────────────
    return jsonResponse({
      response: responseText,
      sent_via: channel || 'web',
      conversation_state: newConversationState,
      follow_up_needed: parsed.follow_up_needed ?? false,
      follow_up_delay_hours: parsed.follow_up_delay_hours ?? 24,
      next_expected_user_input: parsed.next_expected_user_input ?? '',
      memory_updates_applied: (parsed.memory_updates || []).length,
      decisions_saved: (parsed.decisions_to_save || []).length,
    });
  } catch (error) {
    console.error('smartMentorEngine v18 error:', (error as Error).message);
    return errorResponse((error as Error).message);
  }
});
