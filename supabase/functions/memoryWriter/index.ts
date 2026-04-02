// memoryWriter — Extracts memory items from conversation text via OpenAI
// Called by mentorChat and smartMentorEngine after each conversation

import { supabaseAdmin, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabaseAdmin.ts';
import OpenAI from 'npm:openai';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { customer_id, conversation_text, conversation_id } = await req.json();

    if (!customer_id || !conversation_text) {
      return errorResponse('customer_id and conversation_text are required', 400);
    }

    // Ask OpenAI to extract memory items from the conversation
    const extractionPrompt = `אתה מנתח שיחות מנטורינג עסקי.
קיבלת שיחה בין מנטור ללקוח. חלץ ממנה פריטי זיכרון חשובים.

כללים:
1. layer: short_term (רלוונטי לשבוע הקרוב), mid_term (רלוונטי לחודש-שלושה), long_term (עובדות קבועות)
2. category: goal (מטרה), blocker (חסם), win (הצלחה), preference (העדפה), fact (עובדה עסקית)
3. חלץ רק מידע חשוב ומעשי, לא שיחת חולין
4. מקסימום 5 פריטים

החזר JSON:
{
  "memory_items": [
    {
      "layer": "short_term|mid_term|long_term",
      "category": "goal|blocker|win|preference|fact",
      "memory_type": "profile_fact|goal_fact|blocker|preference|decision|commitment|progress_update|business_context",
      "title": "כותרת קצרה",
      "content": "תיאור מפורט",
      "importance_score": 1-10,
      "expires_days": null
    }
  ]
}

אם אין מידע חשוב לשמור, החזר: {"memory_items": []}

השיחה:
${conversation_text}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0].message.content!);
    const items = parsed.memory_items || [];

    if (items.length === 0) {
      return jsonResponse({ saved: 0, message: 'No memory items extracted' });
    }

    // Save each memory item to the database
    let savedCount = 0;
    for (const item of items) {
      const expiresAt = item.expires_days
        ? new Date(Date.now() + item.expires_days * 86400000).toISOString()
        : null;

      const { error } = await supabaseAdmin.from('memory_items').insert({
        customer_id,
        layer: item.layer || 'long_term',
        category: item.category || 'fact',
        memory_type: item.memory_type || 'business_context',
        title: item.title,
        content: item.content,
        importance_score: item.importance_score || 5,
        relevance_score: item.importance_score || 5,
        expires_at: expiresAt,
        is_active: true,
        source_conversation_id: conversation_id || null,
        source: 'main',
      });

      if (error) {
        console.warn('memoryWriter insert failed:', error.message);
      } else {
        savedCount++;
      }
    }

    return jsonResponse({ saved: savedCount, items: items.length });
  } catch (error) {
    console.error('memoryWriter error:', (error as Error).message);
    return errorResponse((error as Error).message, 500);
  }
});
