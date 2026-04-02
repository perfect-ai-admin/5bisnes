// webhookGoalMentor v11 — Goal Engine: classify + plan + milestone + conversation + adaptive WhatsApp

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

// --- Supabase Admin Client (self-contained) ---
function createSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  async function query(path: string, options: RequestInit = {}) {
    const res = await fetch(`${url}/rest/v1${path}`, {
      ...options,
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) return { data: null, error: { message: JSON.stringify(json) } };
    return { data: json, error: null };
  }

  return {
    from: (table: string) => ({
      select: (columns = '*') => ({
        eq: (col: string, val: unknown) => ({
          maybeSingle: () => query(`/${table}?select=${columns}&${col}=eq.${val}&limit=1`).then(r => ({
            data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data,
            error: r.error
          })),
          in: (col2: string, vals: unknown[]) => ({
            then: (cb: Function) => query(`/${table}?select=${columns}&${col}=eq.${val}&${col2}=in.(${vals.join(',')})`).then(r => cb({ data: r.data || [], error: r.error }))
          }),
          order: (orderCol: string, opts: { ascending: boolean }) => ({
            limit: (n: number) => ({
              maybeSingle: () => query(`/${table}?select=${columns}&${col}=eq.${val}&order=${orderCol}.${opts.ascending ? 'asc' : 'desc'}&limit=${n}`).then(r => ({
                data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data,
                error: r.error
              }))
            })
          })
        }),
        in: (col: string, vals: unknown[]) => ({
          eq: (col2: string, val2: unknown) => ({
            then: (cb: Function) => query(`/${table}?select=${columns}&${col}=in.(${vals.join(',')})&${col2}=eq.${val2}`).then(r => cb({ data: r.data || [], error: r.error }))
          }),
          then: (cb: Function) => query(`/${table}?select=${columns}&${col}=in.(${vals.join(',')})`).then(r => cb({ data: r.data || [], error: r.error }))
        })
      }),
      insert: (row: Record<string, unknown>) => query(`/${table}`, {
        method: 'POST',
        body: JSON.stringify(row),
      }),
      update: (row: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => query(`/${table}?${col}=eq.${val}`, {
          method: 'PATCH',
          body: JSON.stringify(row),
        })
      }),
    }),
  };
}

const supabaseAdmin = createSupabaseAdmin();

// --- GreenAPI: send WhatsApp ---
async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const chatId = phone.replace('+', '') + '@c.us';
  const url = `https://api.green-api.com/waInstance${GREENAPI_INSTANCE_ID}/sendMessage/${GREENAPI_TOKEN}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('webhookGoalMentor: GreenAPI error:', body);
      return false;
    }
    console.log('webhookGoalMentor: WhatsApp sent successfully to', phone);
    return true;
  } catch (err) {
    console.error('webhookGoalMentor: GreenAPI fetch failed:', (err as Error).message);
    return false;
  }
}

// --- Types ---
type EventType = 'goal_started' | 'task_completed' | 'goal_completed' | 'check_in';
type GoalType = 'quick' | 'medium' | 'long';
type ComplexityLevel = 'low' | 'medium' | 'high';

interface GoalClassification {
  goal_type: GoalType;
  complexity_level: ComplexityLevel;
  estimated_duration_days: number;
  cadence_type: string;
  milestones_count: number;
  plan_duration_type: string;
}

// --- Goal Engine: classify goal ---
function classifyGoal(title: string, description?: string): GoalClassification {
  const text = `${title} ${description || ''}`.toLowerCase();

  const quickKeywords = ['לפתוח', 'להירשם', 'לבחור', 'להעלות', 'להגדיר', 'לרשום', 'ליצור חשבון', 'להקים עמוד', 'לפרסם'];
  const longKeywords = ['להגיע ל', 'לבנות מנגנון', 'יציב', 'קבוע', 'צמיחה', 'להכפיל', 'מותג', 'אוטומטי', 'סקייל'];
  const complexKeywords = ['אסטרטגיה', 'מערכת', 'צוות', 'מנגנון', 'פאנל', 'משפך', 'גיוס הון', 'שיווק'];
  const simpleKeywords = ['לפתוח', 'לרשום', 'לבחור', 'להעלות', 'להגדיר'];

  let goal_type: GoalType = 'medium';
  if (quickKeywords.some(kw => text.includes(kw))) goal_type = 'quick';
  if (longKeywords.some(kw => text.includes(kw))) goal_type = 'long';

  let complexity_level: ComplexityLevel = 'medium';
  if (simpleKeywords.some(kw => text.includes(kw))) complexity_level = 'low';
  if (complexKeywords.some(kw => text.includes(kw))) complexity_level = 'high';

  const config: Record<GoalType, { estimated_duration_days: number; cadence_type: string; milestones_count: number; plan_duration_type: string }> = {
    quick:  { estimated_duration_days: 5,  cadence_type: 'daily',       milestones_count: 2, plan_duration_type: 'short_sprint' },
    medium: { estimated_duration_days: 21, cadence_type: 'every_2_days', milestones_count: 4, plan_duration_type: 'medium_plan' },
    long:   { estimated_duration_days: 90, cadence_type: 'weekly',      milestones_count: 6, plan_duration_type: 'long_journey' },
  };

  return { goal_type, complexity_level, ...config[goal_type] };
}

// --- WhatsApp message templates ---
function getAdaptiveWhatsAppMessage(goalType: GoalType, goalTitle: string, customerName: string): string {
  const name = customerName || 'שם';
  return `היי ${name} 👋\nאני המנטור העסקי שלך בפרפקט וואן.\nראיתי שפתחת מטרה חדשה: *${goalTitle}*\n\nאני כאן ללוות אותך צעד אחר צעד עד שתשיג את המטרה.\nמוכן שנתחיל? 🚀`;
}

function getLegacyWhatsAppMessage(eventType: EventType, data: Record<string, unknown>, customerName: string): string {
  const name = customerName || 'שם';
  const goalTitle = (data?.goal_title as string) || 'המטרה שלך';

  switch (eventType) {
    case 'task_completed':
      return `כל הכבוד ${name}! 🎉\n\nסיימת משימה: *${(data?.task_title as string) || 'משימה'}*\n\nהתקדמות מצוינת! ממשיכים קדימה 💪`;
    case 'goal_completed':
      return `${name}, איזה הישג! 🏆\n\nהשגת את המטרה: *${goalTitle}*\n\nעכשיו הזמן לבחור את המטרה הבאה שלך. מוכן?`;
    case 'check_in':
      return `היי ${name} 👋\n\nנקודת בקרה שבועית — איך ההתקדמות שלך?\n\nאם יש משהו שאתה צריך עזרה בו, אני כאן.`;
    default:
      return `היי ${name}, יש לי עדכון בנוגע למטרות שלך. בוא נדבר!`;
  }
}

// --- Non-blocking insert helper ---
async function safeInsert(table: string, row: Record<string, unknown>, label: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.from(table).insert({ ...row, source: 'main' });
    if (error) {
      console.warn(`webhookGoalMentor: ${label} insert failed:`, error.message);
      return null;
    }
    const inserted = Array.isArray(data) ? data[0] : data;
    return inserted?.id ?? null;
  } catch (err) {
    console.warn(`webhookGoalMentor: ${label} insert exception:`, (err as Error).message);
    return null;
  }
}

// --- Handle goal_started: full Goal Engine flow ---
async function handleGoalStarted(params: {
  customer_id: string;
  goal_id: string | null;
  customerName: string;
  customerPhone: string | null;
  data: Record<string, unknown>;
}): Promise<{ whatsapp_sent: boolean; classification: GoalClassification | null; plan_id: string | null; milestone_id: string | null; conversation_id: string | null }> {
  const { customer_id, goal_id, customerName, customerPhone, data } = params;

  // 1. Fetch goal details from customer_goals
  let goalTitle = (data?.goal_title as string) || 'מטרה חדשה';
  let goalDescription = (data?.goal_description as string) || '';
  let customerGoalId: string | null = goal_id;

  if (goal_id) {
    const { data: cgRow } = await supabaseAdmin
      .from('customer_goals')
      .select('id, title, description, status')
      .eq('id', goal_id)
      .maybeSingle();

    if (cgRow) {
      goalTitle = (cgRow as any).title || goalTitle;
      goalDescription = (cgRow as any).description || goalDescription;
      customerGoalId = (cgRow as any).id;
    } else {
      // fallback: try goals table
      const { data: goalRow } = await supabaseAdmin
        .from('goals')
        .select('title, description')
        .eq('id', goal_id)
        .maybeSingle();
      if (goalRow) {
        goalTitle = (goalRow as any).title || goalTitle;
        goalDescription = (goalRow as any).description || goalDescription;
      }
    }
  }

  // 2. Classify goal
  const classification = classifyGoal(goalTitle, goalDescription);
  console.log('webhookGoalMentor: Goal classified as', classification.goal_type, '| complexity:', classification.complexity_level);

  // 3. Update customer_goals with classification (non-blocking)
  if (customerGoalId) {
    try {
      await supabaseAdmin.from('customer_goals').update({
        goal_type: classification.goal_type,
        complexity_level: classification.complexity_level,
        estimated_duration_days: classification.estimated_duration_days,
      }).eq('id', customerGoalId);
    } catch (err) {
      console.warn('webhookGoalMentor: customer_goals update failed:', (err as Error).message);
    }
  }

  // 4. Create mentor_conversation (non-blocking)
  const conversationId = await safeInsert('mentor_conversations', {
    customer_id,
    channel: 'whatsapp',
    conversation_state: 'discovery',
    active_goal_id: customerGoalId,
    summary_short: `שיחה על מטרה: ${goalTitle}`,
    started_at: new Date().toISOString(),
  }, 'mentor_conversation');

  // 5. Create mentor_plan (non-blocking)
  const planId = await safeInsert('mentor_plans', {
    customer_id,
    active_goal_id: customerGoalId,
    plan_title: `תוכנית עבור: ${goalTitle}`,
    plan_summary: `תוכנית ${classification.plan_duration_type} להשגת המטרה "${goalTitle}"`,
    plan_duration_type: classification.plan_duration_type,
    estimated_total_days: classification.estimated_duration_days,
    cadence_type: classification.cadence_type,
    status: 'active',
  }, 'mentor_plan');

  // 6. Create first milestone (non-blocking)
  const milestoneId = await safeInsert('goal_milestones', {
    goal_id: customerGoalId,
    title: 'שלב 1: בירור ראשוני',
    description: 'הגדרת נקודת המוצא, הבנת הצרכים והכנת תוכנית פעולה ראשונית',
    order_index: 1,
    estimated_days: Math.ceil(classification.estimated_duration_days / classification.milestones_count),
    status: 'in_progress',
    completion_criteria: 'הלקוח הגדיר מטרה ברורה ויש תוכנית ראשונית',
  }, 'goal_milestone');

  // 7. Create memory_item (non-blocking)
  await safeInsert('memory_items', {
    customer_id,
    memory_type: 'goal_fact',
    title: `מטרה חדשה: ${goalTitle}`,
    content: `המשתמש פתח מטרה חדשה: ${goalTitle}. סוג מטרה: ${classification.goal_type}, מורכבות: ${classification.complexity_level}, משך משוער: ${classification.estimated_duration_days} ימים.`,
    importance_score: 8,
    relevance_score: 10,
    is_active: true,
    tags_json: JSON.stringify(['goal', classification.goal_type, classification.complexity_level]),
  }, 'memory_item');

  // 8. Send adaptive WhatsApp
  let whatsapp_sent = false;
  if (customerPhone) {
    const message = getAdaptiveWhatsAppMessage(classification.goal_type, goalTitle, customerName);
    whatsapp_sent = await sendWhatsApp(customerPhone, message);
  } else {
    console.warn('webhookGoalMentor: Customer has no phone_e164, skipping WhatsApp');
  }

  return { whatsapp_sent, classification, plan_id: planId, milestone_id: milestoneId, conversation_id: conversationId };
}

// --- Main Handler ---
const VALID_EVENT_TYPES: EventType[] = ['goal_started', 'task_completed', 'goal_completed', 'check_in'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { event_type, customer_id, goal_id, data } = await req.json();

    if (!event_type || !customer_id) {
      return errorResponse('event_type and customer_id are required', 400);
    }

    if (!VALID_EVENT_TYPES.includes(event_type as EventType)) {
      return errorResponse(`Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`, 400);
    }

    // Fetch customer profile
    const { data: customerRow } = await supabaseAdmin
      .from('customers')
      .select('id, full_name, email, phone_e164')
      .eq('id', customer_id)
      .maybeSingle();

    const customerProfile = customerRow as Record<string, unknown> | null;
    const customerName = (customerProfile?.full_name as string) || '';
    const customerPhone = (customerProfile?.phone_e164 as string) || null;

    // Fetch business journey state
    const { data: journeyRow } = await supabaseAdmin
      .from('business_state')
      .select('*')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const journeyData = journeyRow as Record<string, unknown> | null;

    // Fetch active goals
    const activeGoalsResult = await new Promise<{ data: unknown[] }>((resolve) => {
      supabaseAdmin
        .from('customer_goals')
        .select('*, goals(*)')
        .in('status', ['active', 'selected'])
        .eq('customer_id', customer_id)
        .then((r: { data: unknown[] | null; error: unknown }) => resolve({ data: r.data || [] }));
    });
    const activeGoals = activeGoalsResult.data;

    // --- Route by event type ---

    if (event_type === 'goal_started') {
      const result = await handleGoalStarted({
        customer_id,
        goal_id: goal_id || null,
        customerName,
        customerPhone,
        data: data || {},
      });

      // Log to activity_log (non-blocking)
      try {
        await supabaseAdmin.from('activity_log').insert({
          customer_id,
          action: 'goal_mentor_goal_started',
          entity_type: 'customer_goal',
          entity_id: goal_id || null,
          source: 'main',
          metadata: {
            goal_id,
            classification: result.classification,
            plan_id: result.plan_id,
            milestone_id: result.milestone_id,
            conversation_id: result.conversation_id,
            whatsapp_sent: result.whatsapp_sent,
            has_journey: !!journeyData,
            active_goals_count: activeGoals.length,
          },
        });
      } catch (logErr) {
        console.warn('webhookGoalMentor: activity_log insert failed:', (logErr as Error).message);
      }

      return jsonResponse({
        success: true,
        version: 'v11',
        event_type: 'goal_started',
        whatsapp_sent: result.whatsapp_sent,
        goal_engine: {
          goal_type: result.classification?.goal_type,
          complexity_level: result.classification?.complexity_level,
          estimated_duration_days: result.classification?.estimated_duration_days,
          cadence_type: result.classification?.cadence_type,
          plan_duration_type: result.classification?.plan_duration_type,
        },
        created: {
          plan_id: result.plan_id,
          milestone_id: result.milestone_id,
          conversation_id: result.conversation_id,
        },
      });
    }

    // --- Legacy event types: task_completed, goal_completed, check_in ---

    let goalDetails: Record<string, unknown> | null = null;
    if (goal_id) {
      const { data: goalRow } = await supabaseAdmin
        .from('goals')
        .select('title, description, status, progress')
        .eq('id', goal_id)
        .maybeSingle();
      goalDetails = goalRow as Record<string, unknown> | null;
    }

    const enrichedData = {
      ...(data || {}),
      customer: customerProfile,
      journey: journeyData,
      active_goals: activeGoals,
      goal_details: goalDetails,
    };

    // Log to activity_log (non-blocking)
    try {
      await supabaseAdmin.from('activity_log').insert({
        customer_id,
        action: `goal_mentor_${event_type}`,
        entity_type: 'customer_goal',
        entity_id: goal_id || null,
        source: 'main',
        metadata: { goal_id, ...enrichedData },
      });
    } catch (logErr) {
      console.warn('webhookGoalMentor: activity_log insert failed:', (logErr as Error).message);
    }

    // Send WhatsApp for legacy events
    let whatsappSent = false;
    if (customerPhone) {
      const msg = getLegacyWhatsAppMessage(event_type as EventType, {
        ...(data || {}),
        goal_title: goalDetails?.title || (data as Record<string, unknown>)?.goal_title,
      }, customerName);
      whatsappSent = await sendWhatsApp(customerPhone, msg);
    } else {
      console.warn('webhookGoalMentor: Customer has no phone_e164, skipping WhatsApp');
    }

    return jsonResponse({
      success: true,
      version: 'v11',
      event_type,
      whatsapp_sent: whatsappSent,
      enriched_context: {
        has_journey: !!journeyData,
        active_goals_count: activeGoals.length,
        goal_title: goalDetails?.title || null,
      },
    });

  } catch (error) {
    console.error('webhookGoalMentor error:', (error as Error).message);
    return errorResponse((error as Error).message);
  }
});
