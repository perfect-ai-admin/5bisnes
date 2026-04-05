// analyzeBusinessJourney v14
// Uses direct fetch to OpenAI (no npm:openai dependency)
// Fixed: activity_log column names, robust error handling

import { supabaseAdmin, getCustomer, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabaseAdmin.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// Generate UUID v4
function generateUUID(): string {
  return self.crypto.getRandomValues(new Uint8Array(16)).reduce((a, b) => {
    if (b < 16) a += '0';
    a += b.toString(16);
    return a;
  }, '').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

// Direct OpenAI call via fetch (avoids npm:openai import issues in Deno)
async function callOpenAI(messages: { role: string; content: string }[], maxTokens = 500): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '{}';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Step 0: Get customer
    console.log('[analyzeBusinessJourney] Starting...');

    const customer = await getCustomer(req);
    if (!customer) {
      console.log('[analyzeBusinessJourney] No customer found for auth token');
      return errorResponse('Unauthorized', 401);
    }
    console.log('[analyzeBusinessJourney] Customer:', customer.id);

    const body = await req.json();
    const { answers } = body;

    if (!answers || typeof answers !== 'object') {
      return errorResponse('answers object is required', 400);
    }

    // Build a readable summary for OpenAI
    const answersText = Object.entries(answers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    console.log('[analyzeBusinessJourney] Calling OpenAI for analysis...');

    // -- Step 1: Analyze business state --
    const analysisPrompt = `You are a business coach AI. Analyze the user's business journey questionnaire answers and return a JSON object with the following fields:
- stage: one of "idea" | "new" | "active" | "stable" | "scaling"
- summary: a short Hebrew description (2-3 sentences) of the business state
- main_challenge: the primary challenge the business owner faces (in Hebrew)
- recommended_focus: what they should focus on next (in Hebrew)
- business_type: best guess at the type of business (e.g. service, product, digital, tech)

Return ONLY valid JSON, no markdown or explanation.`;

    const analysisContent = await callOpenAI([
      { role: 'system', content: analysisPrompt },
      { role: 'user', content: `Business journey answers:\n${answersText}` }
    ], 500);

    let businessState: Record<string, unknown> = {};
    try {
      businessState = JSON.parse(analysisContent);
      if (!businessState.stage) {
        throw new Error('Missing "stage" in analysis response');
      }
    } catch (e) {
      console.error('[analyzeBusinessJourney] Failed to parse analysis JSON:', analysisContent, (e as Error).message);
      throw new Error('Failed to analyze business state');
    }

    console.log('[analyzeBusinessJourney] Analysis done. Stage:', businessState.stage);

    // -- Step 2: Generate personalized business plan with tasks --
    const planPrompt = `You are a world-class Israeli business mentor AI.
Based on a user's business questionnaire answers and their analyzed state, generate a personalized business plan.

**ALL OUTPUT MUST BE IN HEBREW.**

## User Info
- Questionnaire Answers: ${answersText}
- Analyzed State: ${JSON.stringify(businessState)}

## Rules
1. Generate 4-6 concrete, actionable tasks tailored to the user's stage and challenges.
2. Each task must be specific and achievable within 1-2 weeks.
3. Tasks should be ordered logically - each builds on the previous.
4. The FIRST task must be a quick-win achievable in 48 hours (mark as momentum: true).
5. Tasks should directly address the user's main_challenge and recommended_focus.
6. Each task needs: title, description, task_type, estimated_days.
7. task_type options: SETUP | STRATEGY | CUSTOMER_ACQUISITION | MARKETING | FINANCE | OPERATIONS | MOMENTUM

## Output Format (JSON only)
{
  "plan_name": "name in Hebrew",
  "plan_summary": "2-3 sentence summary in Hebrew",
  "tasks": [
    {
      "id": "task_1",
      "title": "task title in Hebrew",
      "description": "short explanation in Hebrew",
      "task_type": "MOMENTUM",
      "estimated_days": 2,
      "is_completed": false,
      "momentum": true
    }
  ]
}`;

    console.log('[analyzeBusinessJourney] Calling OpenAI for plan...');

    const planContent = await callOpenAI([
      { role: 'system', content: 'You are a world-class Israeli business mentor AI that always responds with valid JSON.' },
      { role: 'user', content: planPrompt }
    ], 1500);

    let businessPlan: Record<string, unknown> = { tasks: [], plan_name: '', plan_summary: '' };
    try {
      businessPlan = JSON.parse(planContent);
      if (!businessPlan.tasks || !Array.isArray(businessPlan.tasks) || businessPlan.tasks.length === 0) {
        throw new Error('Missing or empty "tasks" in plan response');
      }
    } catch (e) {
      console.error('[analyzeBusinessJourney] Failed to parse plan JSON:', planContent, (e as Error).message);
      throw new Error('Failed to generate business plan');
    }

    console.log('[analyzeBusinessJourney] Plan done. Tasks:', (businessPlan.tasks as any[])?.length || 0);

    // Ensure tasks have proper IDs
    const tasks = ((businessPlan.tasks as any[]) || []).map((t: any, i: number) => ({
      id: t.id || `task_${i + 1}`,
      title: t.title || `task ${i + 1}`,
      description: t.description || '',
      task_type: t.task_type || 'ACT',
      estimated_days: t.estimated_days || 7,
      is_completed: false,
      momentum: !!t.momentum,
      status: 'todo',
      order: i + 1,
    }));

    // -- Step 3: Update customer with everything --
    console.log('[analyzeBusinessJourney] Updating customer...');

    const { error: updateErr } = await supabaseAdmin
      .from('customers')
      .update({
        business_journey_answers: answers,
        business_journey_completed_at: new Date().toISOString(),
        business_state: businessState,
        client_tasks: tasks,
        business_plan: {
          name: businessPlan.plan_name || 'your business plan',
          summary: businessPlan.plan_summary || '',
          created_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer.id);

    if (updateErr) {
      console.error('[analyzeBusinessJourney] Customer update error:', updateErr.message);
      return errorResponse('Failed to update customer: ' + updateErr.message);
    }

    console.log('[analyzeBusinessJourney] Customer updated successfully');

    // -- Step 4: Create the first goal in customer_goals --
    const firstTask = tasks[0];
    if (firstTask) {
      const { data: baseGoal } = await supabaseAdmin
        .from('goals')
        .select('id')
        .eq('goal_code', 'business_status')
        .limit(1)
        .single();

      if (baseGoal?.id) {
        const { error: goalErr } = await supabaseAdmin
          .from('customer_goals')
          .insert({
            customer_id: customer.id,
            goal_id: baseGoal.id,
            title: firstTask.title,
            description: firstTask.description,
            status: 'active',
            progress_percent: 0,
            current_step: 1,
            tasks: tasks.slice(0, 3).map((t: any) => ({
              id: generateUUID(),
              title: t.title,
              type: t.task_type?.toLowerCase() || 'action',
              why: t.description,
              definition_of_done: t.title,
              effort: t.estimated_days <= 2 ? 'easy' : t.estimated_days <= 7 ? 'medium' : 'hard',
              momentum: !!t.momentum,
              status: 'todo',
              isCompleted: false,
              createdAt: new Date().toISOString(),
            })),
            plan_summary: String(businessPlan.plan_summary || ''),
            is_first_goal: true,
            source: 'main',
          });

        if (goalErr) {
          console.warn('[analyzeBusinessJourney] Goal insert warning:', goalErr.message);
          // Non-fatal: continue
        } else {
          console.log('[analyzeBusinessJourney] Goal created successfully');
        }
      } else {
        console.warn('[analyzeBusinessJourney] No base goal found with goal_code=business_status');
      }
    }

    // -- Step 5: Log activity (non-fatal) --
    // FIXED: use correct column names: action (not event_type), metadata (not data)
    try {
      await supabaseAdmin.from('activity_log').insert({
        customer_id: customer.id,
        action: 'business_journey_completed',
        entity_type: 'customer',
        entity_id: customer.id,
        metadata: {
          stage: businessState.stage,
          tasks_count: tasks.length,
          plan_name: businessPlan.plan_name,
          completed_at: new Date().toISOString(),
        },
        source: 'main',
      });
    } catch (e) {
      console.warn('[analyzeBusinessJourney] activity_log insert failed:', (e as Error).message);
    }

    console.log('[analyzeBusinessJourney] Done! Returning success');

    return jsonResponse({
      success: true,
      business_state: businessState,
      business_plan: {
        name: businessPlan.plan_name,
        summary: businessPlan.plan_summary,
        tasks_count: tasks.length,
      },
      first_goal_created: !!firstTask,
    });
  } catch (error) {
    console.error('[analyzeBusinessJourney] FATAL ERROR:', (error as Error).message, (error as Error).stack);
    return errorResponse((error as Error).message);
  }
});
