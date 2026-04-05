// Shared Supabase client for Edge Functions
// Replaces: createClientFromRequest from @base44/sdk

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Admin client (service role) — bypasses RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Create user-scoped client from request Authorization header
export function createUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
}

// Get authenticated user from request (auth.users)
export async function getUser(req: Request) {
  const userClient = createUserClient(req);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Get customer record for an authenticated user (by email)
export async function getCustomer(req: Request) {
  const user = await getUser(req);
  if (!user) return null;
  const { data } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('email', user.email)
    .limit(1)
    .single();
  return data;
}

// Find customer by ID or phone (for service role / webhook contexts)
export async function findCustomer(identifier: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    const { data } = await supabaseAdmin.from('customers').select('*').eq('id', identifier).single();
    return data;
  }
  const { data } = await supabaseAdmin.from('customers').select('*').eq('phone_e164', identifier).single();
  return data;
}

// Require admin customer — returns customer or throws Response
export async function requireAdmin(req: Request) {
  const customer = await getCustomer(req);
  if (!customer || customer.role !== 'admin') {
    throw errorResponse('Forbidden: Admin access required', 403, req);
  }
  return customer;
}

// --- HTML escaping helper (prevents XSS / HTML injection) ---
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- CORS ---
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

// בדוק האם origin מותר — כולל Vercel preview domains
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true; // מותר אם אין origin
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // אפשר את כל דומיינים של Vercel
  if (origin.startsWith('https://') && origin.endsWith('.vercel.app')) return true;
  // אפשר את כל HTTPS origins בפיתוח
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  return true; // לבדיקה זמנית - אפשר את כולם
}

// החזר CORS headers מותאמים ל-origin של הבקשה
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// corsHeaders — ברירת מחדל (backwards compatibility, ל-OPTIONS בלי req)
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
};

// Standard response helpers
export function jsonResponse(data: unknown, status = 200, req?: Request) {
  const headers = req ? getCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 500, req?: Request) {
  return jsonResponse({ error: message }, status, req);
}
