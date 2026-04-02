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

    // Get personalized context from mentor_conversations
    let personalizedContext = null;
    if (effectiveUserId) {
      const { data: convData } = await supabaseAdmin
        .from('mentor_conversations')
        .select('conversation_state, summary_short, summary_long, sentiment')
        .eq('customer_id', effectiveUserId)
        .order('started_at', { ascending: false })
        .limit(1);

      if (convData && convData.length > 0) {
        personalizedContext = convData[0];
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

      // 4. Recent conversation messages (New Schema: mentor_messages)
      const { data: messagesData } = await supabaseAdmin
        .from('mentor_messages')
        .select('sender_type, message_text, created_at')
        .eq('customer_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(20);
      recentMessages = (messagesData || []).map((m: any) => ({
        role: m.sender_type === 'user' ? 'user' : 'assistant',
        content: m.message_text,
        created_at: m.created_at,
      }));

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
- מצב שיחה: ${personalizedContext.conversation_state || 'לא ידוע'}
- סיכום קצר: ${personalizedContext.summary_short || ''}
- סנטימנט: ${personalizedContext.sentiment || ''}
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

    // Save conversation to New Schema (mentor_conversations + mentor_messages)
    try {
      if (effectiveUserId) {
        // Find or create mentor_conversation
        let { data: conv } = await supabaseAdmin
          .from('mentor_conversations')
          .select('id')
          .eq('customer_id', effectiveUserId)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!conv) {
          const { data: newConv } = await supabaseAdmin
            .from('mentor_conversations')
            .insert({
              customer_id: effectiveUserId,
              channel: 'web',
              conversation_state: 'discovery',
              started_at: new Date().toISOString(),
              source: 'main',
            })
            .select('id')
            .single();
          conv = newConv;
        }

        if (conv) {
          // Save user message
          await supabaseAdmin.from('mentor_messages').insert({
            conversation_id: conv.id,
            customer_id: effectiveUserId,
            sender_type: 'user',
            message_text: message,
            message_type: 'text',
            source: 'main',
          });
          // Save mentor response
          await supabaseAdmin.from('mentor_messages').insert({
            conversation_id: conv.id,
            customer_id: effectiveUserId,
            sender_type: 'mentor',
            message_text: result.response,
            message_type: 'text',
            source: 'main',
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
