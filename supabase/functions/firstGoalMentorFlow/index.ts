// Migrated from Base44: firstGoalMentorFlow
// First goal mentor chat flow for onboarding — guides users to choose their first goal

import { supabaseAdmin, getUser, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabaseAdmin.ts';
import OpenAI from 'npm:openai';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user_id, message, step, goal_data } = await req.json();

    if (!message) return errorResponse('message is required', 400);

    // Auth: flexible — supports authenticated users and unauthenticated WhatsApp flows
    const user = await getUser(req);
    const effectiveUserId = user?.id || user_id || null;

    // Build step-aware system prompt in Hebrew
    const stepContext = step ? `שלב נוכחי בתהליך: ${step}` : 'תחילת תהליך';
    const goalContext = goal_data ? `נתוני מטרה שנאספו עד כה: ${JSON.stringify(goal_data)}` : '';

    const systemPrompt = `אתה מנטור אישי ידידותי לבעלי עסקים קטנים בישראל.
המשימה שלך היא לעזור לבעל העסק לבחור ולהגדיר את המטרה הראשונה שלו בצורה ממוקדת ומעשית.

${stepContext}
${goalContext}

הנחיות:
1. שאל שאלות פשוטות אחת בכל פעם — אל תציף את המשתמש
2. עזור לו לזהות את האתגר הכי דחוף בעסק שלו (גיוס לקוחות, ניהול כספים, שיווק, וכו')
3. הצע מטרה ספציפית, מדידה וברת-ביצוע ב-30 יום
4. אם המשתמש מהסס — תן לו 2-3 אפשרויות לבחירה
5. תמיד דבר בעברית חמה ומעודדת
6. כשיש מספיק מידע — המלץ על מטרה קונקרטית
7. תמיד נסה ללמוד על העסק: מה העיסוק, באיזה שלב העסק (starting/growing/stable), רמת הניסיון (beginner/intermediate/advanced), וסגנון תקשורת מועדף (formal/casual/brief/detailed)

החזר JSON בפורמט הבא:
{
  "response": "התשובה שלך בעברית...",
  "next_step": "שלב הבא בתהליך (onboarding/select_category/define_goal/confirm/done)",
  "suggested_goal": { "title": "...", "description": "...", "category": "..." },
  "customer_profile": { "business_type": "...", "business_stage": "starting|growing|stable", "experience_level": "beginner|intermediate|advanced", "communication_style": "formal|casual|brief|detailed" }
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0].message.content!);

    // Save interaction if user is identified
    if (effectiveUserId) {
      await supabaseAdmin.from('activity_log').insert({
        customer_id: effectiveUserId,
        event_type: 'first_goal_mentor_flow',
        data: { step, message, result }
      }).catch((e: Error) => console.warn('activity_log insert failed:', e.message));

      // Save flow_data progress to customer_goals if we have goal context or suggested_goal
      const flowDataUpdate = {
        step,
        last_message: message,
        last_response: result.response,
        suggested_goal: result.suggested_goal || null,
        goal_data: goal_data || null,
        updated_at: new Date().toISOString()
      };

      // Update customer profile fields if AI extracted them
      if (result.customer_profile) {
        const profileUpdate: Record<string, string> = {};
        if (result.customer_profile.business_type) profileUpdate.business_type = result.customer_profile.business_type;
        if (result.customer_profile.business_stage) profileUpdate.business_stage = result.customer_profile.business_stage;
        if (result.customer_profile.experience_level) profileUpdate.experience_level = result.customer_profile.experience_level;
        if (result.customer_profile.communication_style) profileUpdate.communication_style = result.customer_profile.communication_style;

        if (Object.keys(profileUpdate).length > 0) {
          await supabaseAdmin.from('customers')
            .update(profileUpdate)
            .eq('id', effectiveUserId)
            .catch((e: Error) => console.warn('customers profile update failed:', e.message));
        }
      }

      if (result.next_step === 'done' && result.suggested_goal) {
        // Goal confirmed — upsert customer_goals with flow_data
        await supabaseAdmin.from('customer_goals').upsert({
          customer_id: effectiveUserId,
          goal_id: result.suggested_goal.id || null,
          status: 'selected',
          flow_data: flowDataUpdate,
          created_at: new Date().toISOString()
        }, { onConflict: 'customer_id,goal_id' })
          .catch((e: Error) => console.warn('customer_goals upsert failed:', e.message));
      } else {
        // Ongoing flow — update flow_data on any existing active/selected goal for this user
        const { data: existingGoal } = await supabaseAdmin
          .from('customer_goals')
          .select('id')
          .eq('customer_id', effectiveUserId)
          .in('status', ['active', 'selected'])
          .limit(1)
          .maybeSingle();

        if (existingGoal) {
          await supabaseAdmin
            .from('customer_goals')
            .update({ flow_data: flowDataUpdate })
            .eq('id', existingGoal.id)
            .catch((e: Error) => console.warn('customer_goals flow_data update failed:', e.message));
        }
      }
    }

    return jsonResponse({
      response: result.response,
      next_step: result.next_step || null,
      suggested_goal: result.suggested_goal || null
    });
  } catch (error) {
    console.error('firstGoalMentorFlow error:', (error as Error).message);
    return errorResponse((error as Error).message);
  }
});
