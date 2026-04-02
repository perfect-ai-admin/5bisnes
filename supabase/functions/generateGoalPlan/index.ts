// Migrated from Base44: generateGoalPlan
// Generates an AI-powered task plan for a customer goal using OpenAI

import { supabaseAdmin, getCustomer, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabaseAdmin.ts';
import OpenAI from 'npm:openai';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

/**
 * Validates the AI response structure
 */
function validatePlan(plan: any): { valid: boolean; reason?: string } {
  if (!plan) return { valid: false, reason: 'Empty plan' };
  if (!plan.tasks || !Array.isArray(plan.tasks)) return { valid: false, reason: 'Missing tasks array' };
  if (plan.tasks.length === 0) return { valid: false, reason: 'Empty tasks array' };

  const missingFields = plan.tasks.some((t: any) => !t.task_title || !t.why_it_matters || !t.definition_of_done);
  if (missingFields) return { valid: false, reason: 'Tasks missing required fields (title, why, DoD)' };

  const hasMomentum = plan.tasks.some((t: any) => t.momentum === true);
  if (!hasMomentum) return { valid: false, reason: "Missing 'momentum' task (48h rule)" };

  return { valid: true };
}

/**
 * Attempts to repair broken JSON via LLM
 */
async function repairJSON(brokenJsonString: string, errorReason: string): Promise<any> {
  console.log(`Attempting to repair JSON. Reason: ${errorReason}`);
  try {
    const repairPrompt = `
    You are a JSON Repair Agent.
    The following JSON string is invalid or missing required fields based on the business logic.

    Error/Reason: ${errorReason}

    Broken JSON:
    ${brokenJsonString}

    Your Task:
    1. Fix the syntax errors.
    2. Ensure all fields exist.
    3. IF "momentum" is missing, mark the first actionable task as "momentum": true.
    4. Return ONLY the valid JSON object.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: repairPrompt }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(completion.choices[0].message.content!);
  } catch (e) {
    console.error('Repair failed:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const customer = await getCustomer(req);
    if (!customer) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    let goalData = body.goalData || {};

    if (body.title && !goalData.title) goalData.title = body.title;
    if (!goalData.title) return errorResponse('Goal title is required', 400);

    // Extract context for smarter planning
    const context = goalData._context || {};
    const activeGoalsCount = context.activeGoalsCount || 0;
    const goalPosition = context.goalPosition || 1;
    const businessState = context.businessState || {};
    const businessJourneyAnswers = context.businessJourneyAnswers || {};

    const customAnswersStr = goalData.customAnswers ? JSON.stringify(goalData.customAnswers) : 'אין מידע נוסף';
    const businessStateStr = businessState.stage
      ? `שלב עסקי: ${businessState.stage}, אתגר עיקרי: ${businessState.primary_challenge || 'לא ידוע'}`
      : 'לא ידוע';
    const journeyContext = businessJourneyAnswers
      ? `מידע מהשאלון: ${JSON.stringify(businessJourneyAnswers).substring(0, 300)}`
      : 'אין';

    const prompt = `
### ROLE DEFINITION (CRITICAL)
      You are **Task Builder + Task Critic** — a world-class business mentor AI specialized in Israeli small businesses.
      **IMPORTANT: You must output everything in Hebrew (עברית) ONLY.**

      ## GOAL INPUT
      * **Goal**: "${goalData.title}"
      * **Context from user**: ${customAnswersStr}
      * **Business State**: ${businessStateStr}
      * **Journey Context**: ${journeyContext}

      ## USER CONTEXT (CRITICAL FOR TASK PLANNING)
      * **Active Goals Count**: ${activeGoalsCount} מטרות פעילות כרגע
      * **Goal Position**: זו המטרה ה-${goalPosition} של המשתמש
      * **Implication**: ${goalPosition === 1 ? 'משתמש חדש - יצור משימות פשוטות וממוקדות (3-4 משימות)' : goalPosition === 2 ? 'משתמש עם ניסיון - אפשר להוסיף עומק (5-7 משימות)' : 'משתמש מתקדם - אפשר משימות מורכבות יותר (6-10 משימות)'}

      ## SUPER RULES (STRICT)
      1. **Language**: ALL OUTPUT MUST BE IN HEBREW.
      2. **Dynamic Task Count (CRITICAL)**:
         * מטרה ראשונה (position=1): 3-4 משימות פשוטות, ברורות, ברות ביצוע.
         * מטרה שנייה (position=2): 5-7 משימות עם יותר עומק.
         * מטרה שלישית+ (position≥3): 6-10 משימות מפורטות.
      3. **Business Impact Priority**: תעדף משימות שמשפיעות ישירות על הכנסות/לקוחות/צמיחה.
      4. **Single Task Rule**: כל משימה = פעולה אחת ברורה ומדידה.
      5. **No Fluff**: רק פעולות קונקרטיות. אין "לחשוב על אסטרטגיה". רק ACT.
      6. **48h Momentum Rule (MANDATORY)**:
         * תסמן בדיוק משימה אחת כ-\`momentum: true\`
         * המשימה חייבת להיות ניתנת לביצוע תוך 48 שעות
         * זו חייבת להיות המשימה הראשונה ברשימה
      7. **Quality Standards**:
         * כל משימה חייבת להכיל: \`task_title\`, \`why_it_matters\`, \`definition_of_done\`, \`effort_level\`
      8. **Actionable Task Sequence**:
         * סדר המשימות חייב להיות הגיוני - כל משימה מובילה לבאה

## OUTPUT FORMAT (JSON ONLY)
{
  "goal_title": "כותרת מדויקת ומשודרגת",
  "goal_complexity": "simple | medium | complex",
  "plan_summary": "הסבר ההיגיון של התוכנית בעברית...",
  "clarifying_questions": [],
  "tasks": [
    {
      "task_title": "כותרת ברורה",
      "why_it_matters": "הסבר משכנע למה זה חשוב",
      "definition_of_done": "קריטריון מדיד להצלחה",
      "effort_level": "קל | בינוני | קשה",
      "task_type": "THINK | CHECK | DECIDE | PLAN | ACT",
      "momentum": true,
      "status": "todo"
    }
  ],
  "next_step": "מה לעשות אחרי השלמת כל המשימות"
}
`;

    let plan: any = null;
    let rawResponse = '';

    // First attempt
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      plan = JSON.parse(completion.choices[0].message.content!);
      rawResponse = completion.choices[0].message.content!;
    } catch (err) {
      console.error('LLM Generation Error:', err);
      plan = null;
    }

    // Validation and repair
    const validation = validatePlan(plan);

    if (!validation.valid) {
      console.warn(`Plan validation failed: ${validation.reason}. Attempting repair...`);
      const repairedPlan = await repairJSON(rawResponse || '{}', validation.reason!);

      if (repairedPlan && validatePlan(repairedPlan).valid) {
        plan = repairedPlan;
        console.log('Plan repaired successfully.');
      } else {
        console.error('Repair failed or produced invalid plan.');
        // Fallback MVP plan
        plan = {
          goal_title: goalData.title,
          goal_complexity: 'simple',
          plan_summary: 'תוכנית חירום בסיסית עקב תקלה ביצירת התוכנית המלאה.',
          tasks: [
            {
              task_title: 'הגדרת צעד ראשון',
              why_it_matters: 'להתחיל תנועה',
              definition_of_done: 'יש משימה אחת',
              effort_level: 'קל',
              task_type: 'THINK',
              momentum: true,
              status: 'todo'
            }
          ],
          next_step: 'הגדרת צעד ראשון',
          clarifying_questions: []
        };
      }
    }

    // Map tasks to entity format
    const tasksWithIds = (plan.tasks || []).map((t: any) => ({
      id: crypto.randomUUID(),
      title: t.task_title,
      type: t.task_type?.toLowerCase() || 'action',
      why: t.why_it_matters,
      definition_of_done: t.definition_of_done,
      effort: t.effort_level,
      momentum: !!t.momentum,
      status: 'todo',
      isCompleted: false,
      createdAt: new Date().toISOString()
    }));

    const complexityMap: Record<string, string> = { simple: 'פשוטה', medium: 'בינונית', complex: 'מורכבת' };
    const complexityLabel = complexityMap[plan.goal_complexity] || 'רגילה';

    // Map goal_complexity to goal_type
    const complexityToGoalType: Record<string, string> = {
      simple: 'quick',
      medium: 'medium',
      complex: 'long',
    };

    // Estimate target_date based on complexity
    const daysEstimate = plan.goal_complexity === 'simple' ? 14
      : plan.goal_complexity === 'complex' ? 90 : 30;
    const targetDate = new Date(Date.now() + daysEstimate * 86400000)
      .toISOString().split('T')[0];

    const commonData = {
      title: plan.goal_title || goalData.title,
      description: goalData.description || 'תוכנית עבודה ממוקדת',
      status: goalData.status || 'active',
      tasks: tasksWithIds,
      plan_summary: plan.plan_summary || 'לא התקבל תקציר.',
      clarifying_questions: plan.clarifying_questions || [],
      ai_insight: `המנטור בנה תוכנית ${complexityLabel} עם ${tasksWithIds.length} צעדים.`,
      // New structured fields
      goal_type: complexityToGoalType[plan.goal_complexity] || 'medium',
      complexity_level: plan.goal_complexity || 'medium',
      priority_level: goalData.priority_level || 3,
      target_date: goalData.target_date || targetDate,
      success_definition: plan.next_step
        ? `השלמת כל ${tasksWithIds.length} המשימות. ${plan.next_step}`
        : `השלמת כל ${tasksWithIds.length} המשימות בתוכנית.`,
    };

    let resultGoal: any;

    if (body.goalId) {
      // Update existing customer_goal
      const { data, error } = await supabaseAdmin
        .from('customer_goals')
        .update(commonData)
        .eq('id', body.goalId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      resultGoal = data;
    } else {
      // Create new customer_goal
      const { data, error } = await supabaseAdmin
        .from('customer_goals')
        .insert({
          ...goalData,
          ...commonData,
          customer_id: customer.id,
          progress: 0
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      resultGoal = data;
    }

    return jsonResponse(resultGoal);

  } catch (error) {
    console.error('Critical Error:', error);
    return errorResponse((error as Error).message);
  }
});
