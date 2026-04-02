// Migrated from Base44: mentorChat
// AI mentor chat with personalized context

import { supabaseAdmin, getUser, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabaseAdmin.ts';
import OpenAI from 'npm:openai';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, message, chat_history, goal_id } = await req.json();

    if (!user_id || !message) {
      return errorResponse('Missing required parameters', 400);
    }

    // Auth: support both user-scoped and service role (WhatsApp)
    let effectiveUserId = user_id;
    const user = await getUser(req);
    if (user) {
      effectiveUserId = user.id;
    }

    // Get user profile from customers or leads
    let userProfile = null;
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('*')
      .or(`id.eq.${effectiveUserId},phone_e164.eq.${user_id}`)
      .limit(1);

    if (customers && customers.length > 0) {
      userProfile = customers[0];
    } else {
      // Fallback to leads table
      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('*')
        .or(`id.eq.${effectiveUserId},phone_e164.eq.${user_id}`)
        .limit(1);
      if (leads && leads.length > 0) {
        userProfile = leads[0];
      }
    }

    // Get personalized context from conversation summaries
    let personalizedContext = null;
    if (effectiveUserId) {
      const { data: summaries } = await supabaseAdmin
        .from('conversation_summaries')
        .select('key_facts, ai_memory, completed_tasks')
        .eq('customer_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (summaries && summaries.length > 0) {
        personalizedContext = summaries[0];
      }
    }

    // Load memory_items for the customer (all layers)
    let memoryItemsText = '';
    if (effectiveUserId) {
      const { data: memoryItems } = await supabaseAdmin
        .from('memory_items')
        .select('layer, category, memory_type, title, content, importance_score')
        .eq('customer_id', effectiveUserId)
        .eq('is_active', true)
        .order('importance_score', { ascending: false })
        .limit(20);

      if (memoryItems && memoryItems.length > 0) {
        memoryItemsText = memoryItems
          .map((m: any) => `[${m.layer || m.memory_type}/${m.category || ''}] ${m.title}: ${m.content}`)
          .join('\n');
      }
    }

    // Fetch full business context from DB
    let journey = null;
    let activeGoals: any[] = [];
    let goalSteps: any[] = [];
    let recentMessages: any[] = [];
    let interactions: any[] = [];

    if (effectiveUserId) {
      // 1. Business Journey
      const { data: journeyData } = await supabaseAdmin
        .from('business_state')
        .select('*')
        .eq('customer_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      journey = journeyData;

      // 2. Active goals with goal details
      const { data: goalsData } = await supabaseAdmin
        .from('customer_goals')
        .select('*, goals(*)')
        .eq('customer_id', effectiveUserId)
        .in('status', ['active', 'selected']);
      activeGoals = goalsData || [];

      // 3. Goal steps for active goals
      const goalIds = activeGoals.map((g: any) => g.goal_id).filter(Boolean);
      if (goalIds.length > 0) {
        const { data: stepsData } = await supabaseAdmin
          .from('goal_steps')
          .select('*')
          .in('goal_id', goalIds)
          .eq('customer_id', effectiveUserId);
        goalSteps = stepsData || [];
      }

      // 4. Recent conversation messages
      const { data: messagesData } = await supabaseAdmin
        .from('conversation_messages')
        .select('role, content, created_at')
        .eq('customer_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(20);
      recentMessages = messagesData || [];

      // 5. Recent goal interactions
      const { data: interactionsData } = await supabaseAdmin
        .from('goal_interactions')
        .select('*')
        .eq('customer_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(10);
      interactions = interactionsData || [];
    }

    // Build business context string for system prompt
    const businessContext = `
## מידע על העסק של הלקוח:
${journey ? `
- שלב עסקי: ${journey.stage || 'לא ידוע'}
- ניתוח AI: ${journey.ai_analysis || ''}
- משימות בתוכנית: ${JSON.stringify(journey.tasks || [])}
- מטרה מומלצת: ${JSON.stringify(journey.recommended_goal || {})}
` : 'לא מילא שאלון מסע עסקי עדיין'}

## מטרות פעילות:
${activeGoals.length > 0 ? activeGoals.map((g: any) => `
- מטרה: ${g.goals?.title || g.goal_id} (סטטוס: ${g.status})
  התקדמות: ${g.progress || 0}%
  ${g.flow_data ? `תשובות FirstGoal: ${JSON.stringify(g.flow_data)}` : ''}
`).join('\n') : 'אין מטרות פעילות'}

## שלבי מטרות:
${goalSteps.length > 0 ? goalSteps.map((s: any) => `- ${s.title}: ${s.status}${s.completed_at ? ' (הושלם)' : ''}`).join('\n') : 'אין שלבים'}

## אינטראקציות אחרונות:
${interactions.length > 0 ? interactions.map((i: any) => `- ${i.type}: ${i.content || ''} (${i.created_at})`).join('\n') : 'אין'}
`;

    // Build conversation history
    const conversationHistory = chat_history || [];
    const historyMessages = conversationHistory.slice(-10).map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    // Build mentor system prompt
    const systemPrompt = `אתה מנטור עסקי חכם ואמפתי לעוסקים עצמאיים.
אתה מדבר עברית בצורה חמה ואותנטית.
אתה כאן כדי לעזור לעוסקים להתקדם, לפתור בעיות, ולהשיג מטרות.

${userProfile ? `שם הלקוח: ${userProfile.name || userProfile.full_name || ''}` : ''}

${personalizedContext ? `
הקשר מותאם אישית על המשתמש:
- עובדות מפתח: ${JSON.stringify(personalizedContext.key_facts || {})}
- זיכרון AI: ${JSON.stringify(personalizedContext.ai_memory || {})}
` : ''}

${memoryItemsText ? `
## זיכרונות קודמים:
${memoryItemsText}
` : ''}

${businessContext}

המשימה שלך:
1. תן תשובה מועילה, מעשית ומעודדת
2. זהה אם הלקוח זקוק לעזרה מיוחדת
3. השתמש בהקשר המותאם כדי לדבר אליו בצורה הנכונה
4. תמיד סיים עם שאלה או המלצה לצעד הבא

תשובתך צריכה להיות ב-JSON:
{
  "response": "התשובה שלך בעברית..."
}`;

    // Call OpenAI with retry
    let result = null;
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: message }
          ],
          response_format: { type: 'json_object' }
        });

        result = JSON.parse(completion.choices[0].message.content!);
        break;
      } catch (llmErr) {
        console.error(`OpenAI attempt ${attempt + 1} failed:`, (llmErr as Error).message);
        if (attempt === MAX_RETRIES - 1) {
          result = {
            response: 'קיבלתי את שאלתך. אני זקוק לרגע כדי לחשוב על התשובה הטובה ביותר עבורך. אחזור אליך בהקדם.'
          };
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Save conversation to messages table
    try {
      if (effectiveUserId) {
        // Find or create conversation
        let { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .eq('customer_id', effectiveUserId)
          .eq('status', 'active')
          .limit(1)
          .single();

        if (conv) {
          // Save user message
          await supabaseAdmin.from('conversation_messages').insert({
            conversation_id: conv.id,
            direction: 'inbound',
            content: message,
            agent_code: 'mentorChat'
          });
          // Save bot response
          await supabaseAdmin.from('conversation_messages').insert({
            conversation_id: conv.id,
            direction: 'outbound',
            content: result.response,
            agent_code: 'mentorChat'
          });
        }
      }
    } catch (memErr) {
      console.warn('Failed to save conversation:', (memErr as Error).message);
    }

    // Call memoryWriter to extract and save memory items (non-blocking)
    if (effectiveUserId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const conversationText = `User: ${message}\nMentor: ${result.response}`;

      fetch(`${supabaseUrl}/functions/v1/memoryWriter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          customer_id: effectiveUserId,
          conversation_text: conversationText,
        }),
      }).catch((err: Error) => {
        console.warn('memoryWriter call failed:', err.message);
      });
    }

    return jsonResponse(result);
  } catch (error) {
    return errorResponse((error as Error).message, 500);
  }
});
