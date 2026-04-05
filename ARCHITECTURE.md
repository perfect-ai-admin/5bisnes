# ארכיטקטורה של AI Mentor Bot

## סקירה כללית
**AI Mentor Bot** (`hTCffm_JgBcirJkv4FzYc`) הוא בוט AI דינמי המנוהל דרך N8N. הוא מעבד הודעות משתמשים, מתחזק שיחות עם מטרות, וממחיש עדכונים בהתקדמות בזמן אמת.

---

## זרימת העבודה (Workflow Flow)

### 1️⃣ **קבלת הודעה**
```
Webhook Trigger (קבלת POST)
    ↓
Normalize Input (קוד JS - ניקוי קלט)
```
- הבוט קיבל הודעה דרך webhook
- ממיר את הפורמט לנתונים מתוקנים

### 2️⃣ **אחסון ביקורת ותיעוד**
```
Start Audit Run (Postgres)
    ↓
Merge Audit Data (Set)
    ↓
Upsert Customer (Postgres) + Upsert Conversation (Postgres)
```
- יוצר סשן ביקורת - מעקב אחרי כל ריצה
- שומר/מעדכן נתוני לקוח (customer)
- שומר/מעדכן שיחה קיימת או יוצר חדשה

### 3️⃣ **הוספת הודעה הנכנסת**
```
Insert Inbound Message (Postgres)
    ↓
Merge Message Data (Set)
    ↓
Load Context (Postgres query)
```
- שומר את הודעת המשתמש בטבלת `goal_interactions`
- טוען את ההקשר הנדרש:
  - **Customer data** - מי המשתמש
  - **Conversation history** - שיחות קודמות
  - **Current goal** - המטרה הנוכחית
  - **Goal progress** - התקדמות

### 4️⃣ **הכנת AI Context**
```
Prepare AI Context (קוד JS)
    ↓
Load Agent Config (Postgres query)
    ↓
Merge Agent Config (Set)
```
- בונה `system_prompt` דינמי בעברית עם:
  - שם הלקוח
  - המטרה הנוכחית
  - התקדמות (%)
  - היסטוריית שיחה
  - הנחיות מנטוריות מהדאטאבייס
- טוען קונפיגורציה של ה-agent (tools, guidelines, וכו')

### 5️⃣ **בוט AI דינמי**
```
Dynamic AI Agent (@n8n/n8n-nodes-langchain.agent)
    ↓
OpenAI Dynamic (@n8n/n8n-nodes-langchain.lmChatOpenAi)
```
- **Dynamic AI Agent** - בוט לנגצ'יין עם:
  - `system_prompt` - הנחיות מנטוריות מ-DB
  - `text` - הודעת המשתמש
  - `maxIterations: 3` - מספר איטרציות מקסימום

- **OpenAI GPT** - מחובר כ-language model:
  - `model: gpt-4o-mini` או אחר
  - יוצר תשובה בעברית
  - יכול להוציא JSON עם metadata (advance_step, goal_completed וכו')

### 6️⃣ **עיבוד תשובת AI**
```
Parse AI Response (קוד JS)
    ↓
Update Customer (Postgres) - עדכון customer state
    ↓
Forward Data (Set)
    ↓
Update Goal Progress (Postgres) - עדכון מטרה + התקדמות
    ↓
Update Summary (Postgres) - עדכון סיכום שיחה
    ↓
Insert Outbound (Postgres) - שמירת תשובת AI
```

**המנתח עדכן:**
- סטטוס לקוח (customer status)
- השלב הנוכחי של המטרה
- אחוז התקדמות
- סיכום השיחה

### 7️⃣ **ניתוב לאחר השיחה**
```
Stage Changed? (If condition)
    ↓ [כן]
Insert Journey Event (Postgres)
    ↓
Is WhatsApp? (If condition)
    ↓ [כן]
Send WhatsApp (@green-api/n8n-nodes-whatsapp-greenapi)
```
- אם השלב השתנה: יוצר `journey_event` בדאטאבייס
- אם זה WhatsApp: משדר את התשובה ל-WhatsApp

### 8️⃣ **סגירת Audit**
```
Complete Audit (Postgres)
    ↓
Respond Webhook (JSON response)
```
- סיום רישום הביקורת
- מחזיר תשובה JSON ללקוח

---

## טבלאות דאטאבייס שמושכות

### `customers`
```sql
SELECT * FROM customers WHERE phone = $1
```
- `id`, `phone`, `name`, `email`
- `current_goal_code`, `current_stage`
- `metadata` (JSON)

### `conversation_summaries` / `conversations`
```sql
SELECT * FROM conversations
WHERE customer_id = $1
ORDER BY created_at DESC LIMIT 1
```
- `id`, `customer_id`, `status`
- `current_goal_code`
- `summary_text`

### `goal_interactions`
```sql
-- INSERT הודעה נכנסת
INSERT INTO goal_interactions (customer_id, role, message_text, step_number)
VALUES ($1, 'user', $2, $3)

-- SELECT היסטוריה
SELECT role, message_text, step_number FROM goal_interactions
WHERE customer_id = $1
ORDER BY created_at DESC LIMIT 20
```

### `goal_progress` / `customer_goals`
```sql
-- SELECT מטרה נוכחית
SELECT * FROM customer_goals
WHERE customer_id = $1
ORDER BY updated_at DESC LIMIT 1

-- UPDATE התקדמות
PATCH customer_goals
SET current_step = $1, progress_percent = $2
WHERE id = $3
```

### `agent_configs`
```sql
SELECT * FROM agent_configs
WHERE goal_code = $1
```
- `system_prompt` - הנחיות מנטוריות
- `tools` - tools שהוא יכול להשתמש
- `guidelines` - כללים נוספים

### `journey_events`
```sql
INSERT INTO journey_events (customer_id, event_type, metadata)
VALUES ($1, 'stage_advanced', ...)
```
- מעקב אחרי התקדמות הלקוח

### `audit_events`
```sql
INSERT INTO audit_events (workflow_id, input, output, timestamp)
VALUES (...)
```
- רישום מלא של כל ריצה

---

## משתנים וסביבה

### N8N Variables (Environment)
```
SUPABASE_URL=https://fnsnnezhikgqajdbtwoa.supabase.co
SUPABASE_API_KEY=[service-role-key]
OPENAI_API_KEY=[openai-api-key]
```

### Node Parameters
- `postgres` nodes - מחובר לדאטאבייס
- `OpenAI Dynamic` - מחובר ל-OpenAI API

---

## דוגמה לזרימה מלאה

### Input
```json
{
  "customer": {
    "phone": "0501234567",
    "name": "דוד",
    "email": "david@example.com"
  },
  "message": {
    "text": "איך מתחילים עם פלטפורמה?"
  },
  "context": {
    "current_goal_code": "MARKETING_101"
  }
}
```

### Process
1. **Normalize Input** → קלט תקני
2. **DB Queries**:
   - טוען customer (דוד)
   - טוען goal_progress של MARKETING_101 (שלב 2, 40%)
   - טוען 20 הודעות קודמות
   - טוען agent_config של MARKETING_101
3. **AI Preparation**:
   ```
   system_prompt: "אתה מנטור שיווק. דוד נמצא בשלב 2 מתוך 8 (40%). היסטוריה: [...]"
   text: "איך מתחילים עם פלטפורמה?"
   ```
4. **OpenAI Response**:
   ```json
   {
     "text": "בשלב זה אנחנו מתחילים עם...",
     "advance_step": false,
     "quick_replies": ["הבא", "עזרה"]
   }
   ```
5. **DB Updates**:
   - Insert goal_interaction (user message)
   - Insert goal_interaction (AI response)
   - Update customer status
   - Update summary
6. **WhatsApp Send** (אם WhatsApp):
   - משדר: "בשלב זה אנחנו מתחילים עם..."
7. **Response Webhook**:
   ```json
   {
     "success": true,
     "response_text": "בשלב זה אנחנו מתחילים עם...",
     "goal_update": {
       "current_step": 2,
       "progress_percent": 40
     }
   }
   ```

---

## ממשק החיצוני

### Webhook Input
```
POST https://n8n.perfect-1.one/webhook/[webhook-id]
Content-Type: application/json

{
  "customer": { "phone": "...", "name": "...", "email": "..." },
  "message": { "text": "..." },
  "context": { "current_goal_code": "..." }
}
```

### Webhook Output
```json
{
  "success": true,
  "response_text": "...",
  "goal_update": {
    "goal_code": "...",
    "current_step": 2,
    "progress_percent": 40
  },
  "ui_hints": {
    "quick_replies": [...]
  }
}
```

---

## ריאל-טיים אפדייטס

- ✅ **Conversation history** - עדכן מיד בדאטאבייס
- ✅ **Goal progress** - עדכן אחוז התקדמות בזמן אמת
- ✅ **Customer status** - עדכן סטטוס הלקוח
- ✅ **WhatsApp messaging** - שדר מיד

---

## סיכום
בוט מנטור AI שפועל בעברית, מעקב אחר מטרות, משדר תשובות דינמיות דרך OpenAI, וממחיש עדכונים בזמן אמת בדאטאבייס Supabase.
