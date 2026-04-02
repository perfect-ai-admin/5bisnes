// activateGoal — self-contained (no _shared imports)

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function createUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
}

async function getUser(req: Request) {
  const userClient = createUserClient(req);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

const ALLOWED_ORIGINS = [
  'https://perfect1.co.il',
  'https://www.perfect1.co.il',
  'https://perfect-dashboard.com',
  'https://www.perfect-dashboard.com',
  'https://one-pai.com',
  'https://www.one-pai.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.startsWith('https://') && origin.endsWith('.vercel.app')) return true;
  return false;
}

function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200, req?: Request) {
  const headers = req ? getCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500, req?: Request) {
  return jsonResponse({ error: message }, status, req);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) return errorResponse('Unauthorized', 401);

    const { user_goal_id } = await req.json();
    if (!user_goal_id) return errorResponse('Missing user_goal_id', 400);

    // Get user goal - check ownership via customer_id
    const { data: customerGoals } = await supabaseAdmin
      .from('customer_goals')
      .select('*')
      .eq('id', user_goal_id);

    if (!customerGoals || customerGoals.length === 0) {
      return errorResponse('UserGoal not found', 404);
    }
    const userGoal = customerGoals[0];

    // Check max active goals (default: 3)
    const maxActiveGoals = 3;
    const { data: activeGoals } = await supabaseAdmin
      .from('customer_goals')
      .select('*')
      .eq('customer_id', userGoal.customer_id)
      .eq('status', 'active');

    if (activeGoals && activeGoals.length >= maxActiveGoals) {
      // Deactivate oldest active goal
      const oldest = activeGoals.sort((a: any, b: any) =>
        new Date(a.activated_at || a.created_at).getTime() - new Date(b.activated_at || b.created_at).getTime()
      )[0];

      await supabaseAdmin
        .from('customer_goals')
        .update({ status: 'selected' })
        .eq('id', oldest.id);
    }

    // Activate goal
    const { error: updateErr } = await supabaseAdmin
      .from('customer_goals')
      .update({
        status: 'active',
        activated_at: new Date().toISOString()
      })
      .eq('id', user_goal_id);

    if (updateErr) return errorResponse(updateErr.message);

    // Activate customer if paused
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, status, phone')
      .eq('id', userGoal.customer_id)
      .single();

    if (customer?.status === 'paused' && customer?.phone) {
      await supabaseAdmin
        .from('customers')
        .update({ status: 'active' })
        .eq('id', customer.id);
    }

    // Trigger Mentor AI — fire-and-forget
    if (supabaseUrl && supabaseAnonKey) {
      fetch(`${supabaseUrl}/functions/v1/webhookGoalMentor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({
          event_type: 'goal_started',
          customer_id: userGoal.customer_id,
          goal_id: user_goal_id,
        }),
      }).catch((e: Error) => console.warn('webhookGoalMentor trigger failed:', e.message));
    }

    return jsonResponse({ success: true, message: 'המטרה הופעלה בהצלחה' });
  } catch (error) {
    console.error('Error activating goal:', error);
    return errorResponse((error as Error).message);
  }
});
