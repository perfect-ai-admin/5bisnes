# ניתוח פערים — Mentor AI מצב קיים מול אפיון מלא

**תאריך:** מרץ 2026
**גרסה:** 1.0
**קהל יעד:** צוות פיתוח (`backend-architect`, `database-agent`)

---

## תקציר מנהלים

המערכת הקיימת מכילה תשתית עובדת לשיחות מנטור, ניהול מטרות ושליחת WhatsApp. יחד עם זאת, האפיון המלא דורש מעבר ממענה תגובתי למערכת זיכרון וליווי פרואקטיבי מבוסס הקשר. הפער המרכזי הוא: **אין זיכרון מובנה, אין תוכנית מנטור אישית, ואין מנוע מדידת התקדמות**.

---

## חלק א — מה קיים כיום: מיפוי מדויק

### טבלאות DB קיימות ותפקידן

| טבלה | מה יש | מה חסר |
|------|--------|---------|
| `customers` | id, full_name, email, phone_e164, business_state | business_type, business_stage, experience_level, communication_style |
| `customer_goals` | id, customer_id, goal_id, status, title, description, progress, tasks (JSONB), flow_data (JSONB) | goal_type, complexity_level, priority_level, urgency_level, target_date, estimated_duration_days, success_definition, completed_at |
| `activity_log` | customer_id, event_type, data (JSONB) | אין מבנה זיכרון שכבתי — רק log גולמי |
| `agent_prompt_templates` | template_code, template_content, available_variables | אין גרסאות, אין A/B testing |
| `ai_agents` | הגדרות agents בסיסיות | max_leads, specialties, team, daily_target, availability_status (נוספו ב-migration) |
| `agent_routing_rules` | כללי ניתוב בסיסיים | אין ניתוב לפי מצב שיחה (discovery/planning/stuck) |

**טבלאות שקיימות במקור ורלוונטיות:**
- `conversation_summaries` — key_facts, ai_memory, completed_tasks (נקראת ב-`smartMentorEngine` ו-`mentorChat`)
- `conversation_messages` — conversation_id, direction, content (נכתב ב-`mentorChat`)
- `conversations` — customer_id, status (נקרא ב-`mentorChat`)
- `business_state` — stage, ai_analysis, tasks, recommended_goal (מוזן לכל ה-Edge Functions)
- `goal_steps` — title, status, completed_at (נקרא ב-`mentorChat`)
- `goal_interactions` — type, content (נקרא ב-`mentorChat`)
- `goals` — title, description, status, progress (קטלוג המטרות)

### Edge Functions קיימות ותפקידן

| Function | גרסה | מה עושה | מגבלות |
|----------|-------|---------|---------|
| `webhookGoalMentor` | v10 | שולח WhatsApp סטטי ב-4 סוגי אירועים (goal_started, task_completed, goal_completed, check_in) | הודעות קבועות, ללא הקשר אישי, ללא זיכרון |
| `smartMentorEngine` | v9 | מקבל הודעה, שולח ל-OpenAI עם הקשר עסקי, מחזיר תשובה ושולח WhatsApp | לא שומר שיחה, לא מעדכן זיכרון |
| `mentorChat` | קיים | שיחת מנטור עם context מלא מה-DB — שומר ב-`conversation_messages` | תלוי ב-`conversations` פעיל, אין מנגנון summary אוטומטי |
| `generateGoalPlan` | קיים | בונה תוכנית משימות מותאמת ל-OpenAI + מאמת + מתקן JSON שבור | שומר ב-`customer_goals.tasks` כ-JSONB, לא בטבלה נפרדת |
| `firstGoalMentorFlow` | קיים | שיחת onboarding להגדרת מטרה ראשונה | אין continuity בין sessions |

### n8n Workflows פעילים

| Workflow | תפקיד | מגבלות |
|---------|--------|---------|
| `Perfect-one-bot-v5-FIXED` | בוט WhatsApp ראשי — מקבל הודעות נכנסות | ניתוב בסיסי בלבד |
| `Perfect-one-proactive-mentor` | מנטור פרואקטיבי — שולח הודעות יזומות | אין לוגיקת timing חכמה |
| `Perfect-1-Followup-Router-v2` | ניתוב follow-ups | ללא סיווג לפי מצב משתמש |
| `Perfect-1-Followup-Sender` | שליחת follow-ups | תוכן סטטי |

---

## חלק ב — מפת פערים: מה חסר לאפיון המלא

### פער 1: זיכרון מובנה (Memory Engine) — חסר לחלוטין

**מה האפיון דורש:**
- `memory_items` — טבלה עם 3 שכבות: `short_term` (7 ימים), `mid_term` (30 ימים), `long_term` (קבוע)
- מנגנון אוטומטי: short term מתכנס ל-mid term, mid term מתכנס ל-long term

**מה קיים כיום:**
- `conversation_summaries` — טבלה לא מובנית עם key_facts, ai_memory כ-JSONB
- `activity_log` — log גולמי ללא ריכוז זיכרון
- אין מנגנון decay/consolidation

**השפעה:** המנטור "שוכח" בין שיחות. כל שיחה מתחילה מאפס בפועל.

---

### פער 2: תוכנית מנטור אישית (Mentor Plan Engine) — חסר לחלוטין

**מה האפיון דורש:**
- `mentor_plans` — תוכנית פעולה מובנית לכל לקוח
- `mentor_plan_steps` — שלבים עם תאריך יעד, סדר עדיפויות, סטטוס
- מנגנון עדכון תוכנית בהתאם להתקדמות בפועל

**מה קיים כיום:**
- `generateGoalPlan` — מייצר תוכנית משימות, אך שומר אותה כ-JSONB ב-`customer_goals.tasks`
- אין טבלה נפרדת לשלבי תוכנית
- אין קשר בין שלבים שונים

**השפעה:** אי אפשר לעקוב אחרי התקדמות בשלבים, לעדכן תוכנית בחלקים, או להציג לוח זמנים.

---

### פער 3: פרופיל עסקי עמוק (User Profiles) — חסר חלקית

**מה האפיון דורש:**
- `user_profiles` — income_range, niche, blockers, strengths, weaknesses
- פרדיגמת "ידיעה מצטברת" — הפרופיל מתעשר עם כל שיחה

**מה קיים כיום:**
- `customers.business_state` — שדה טקסט כללי
- `business_state` — טבלה נפרדת עם stage, ai_analysis
- שדות חסרים ב-`customers`: business_type, business_stage, experience_level, communication_style

**השפעה:** המנטור לא מכיר את הפרופיל האישי של הלקוח לעומק. הלוגיקה נשענת על מה שהלקוח אמר בשיחה האחרונה.

---

### פער 4: מצבי שיחה (Conversation States) — חסר לחלוטין

**מה האפיון דורש:**
- מצבי שיחה: `discovery` / `planning` / `execution` / `stuck` / `review` / `completed`
- ניתוב שונה לכל מצב
- זיהוי אוטומטי של מצב "תקוע"

**מה קיים כיום:**
- `conversations.status` — active/inactive בלבד
- ב-`agent_routing_rules` — כללי ניתוב בסיסיים
- אין מנגנון זיהוי "stuck"

**השפעה:** כל שיחה מטופלת אחיד. אין התאמה של סגנון וכלים לפי שלב המשתמש.

---

### פער 5: מדידת התקדמות מספרית — חסר חלקית

**מה האפיון דורש:**
- מדידה מספרית: 0-100% עם נקודות ציון
- מדידה מילולית: "הגדרתי בעיה" / "ביצעתי ניסיון ראשון" / "הכנסות ראשונות"
- `goal_milestones` — אבני דרך עם סטטוס

**מה קיים כיום:**
- `customer_goals.progress` — שדה מספרי (0-100), אך מעודכן ידנית
- `goal_steps` — טבלה עם title/status, אך ללא תאריך יעד, ללא קשר ל-progress
- אין `goal_milestones` נפרד

**השפעה:** "אחוז התקדמות" לא אוטומטי ולא מחובר לפעולות ספציפיות.

---

### פער 6: מנוע תובנות והחלטות — חסר לחלוטין

**מה האפיון דורש:**
- `decisions` — החלטות שהלקוח לקח עם הנימוקים
- `insights` — תובנות שהמערכת מחלצת אוטומטית מהשיחות

**מה קיים כיום:**
- `activity_log` — לוג אירועים, ללא חילוץ תובנות
- אין מנגנון פרואקטיבי של learning

**השפעה:** המערכת לא לומדת לאורך זמן ולא מחלצת patterns.

---

### פער 7: סיווג מטרות אוטומטי (Goal Engine) — חסר חלקית

**מה האפיון דורש:**
- סיווג לפי: `quick` (עד 7 ימים) / `medium` (7-30 ימים) / `long` (30+ ימים)
- שדות: goal_type, complexity_level, priority_level, urgency_level, target_date

**מה קיים כיום:**
- `generateGoalPlan` — מסווג ל-`goal_complexity`: simple/medium/complex
- אין שמירה בשדות נפרדים ב-`customer_goals`
- אין target_date, אין urgency_level

**השפעה:** לא ניתן לסנן, לתעדף, או לנתח מטרות לפי סוג וזמן.

---

## חלק ג — MVP: מה הכרחי לגרסה ראשונה שעובדת

### הגדרת MVP

MVP הוא המינימום שמאפשר למנטור **לזכור, לתכנן ולעקוב** — שלוש היכולות הבסיסיות שחסרות כיום.

### תכולת MVP (לפי תעדוף MoSCoW)

#### Must Have — חייב ל-MVP

**1. שדרוג `customer_goals` (ללא טבלה חדשה)**
```sql
goal_type VARCHAR(20)             -- quick / medium / long
complexity_level VARCHAR(20)      -- simple / medium / complex
priority_level INTEGER DEFAULT 3  -- 1-5
target_date DATE
success_definition TEXT
completed_at TIMESTAMPTZ
```
**מה זה נותן:** סיווג אוטומטי בכל יצירת מטרה. תואם לגרסת `generateGoalPlan` הקיימת — רק שמירה בשדות נפרדים במקום JSONB.

**2. שדרוג `customers` (ללא טבלה חדשה)**
```sql
business_type VARCHAR(50)         -- freelancer / retail / service / etc
business_stage VARCHAR(50)        -- idea / starting / growing / stable
experience_level VARCHAR(20)      -- beginner / intermediate / advanced
communication_style VARCHAR(20)   -- formal / casual / brief / detailed
```
**מה זה נותן:** הפרומפט ל-OpenAI מקבל context אישי מובנה, לא רק טקסט חופשי.

**3. טבלת `memory_items` (חדשה, פשוטה)**
```sql
id UUID PRIMARY KEY
customer_id UUID REFERENCES customers(id)
layer VARCHAR(20)   -- short_term / mid_term / long_term
category VARCHAR(50) -- goal / blocker / win / preference / fact
content TEXT
expires_at TIMESTAMPTZ  -- NULL = long_term
created_at TIMESTAMPTZ
```
**מה זה נותן:** כל שיחה בודקת memory_items לפני הפרומפט. `smartMentorEngine` ו-`mentorChat` מוסיפים פריטים אוטומטית.

**4. Edge Function: `memoryWriter` (חדשה, קטנה)**
- מקבלת: customer_id + שיחה
- שולחת ל-OpenAI: "מה כדאי לשמור מהשיחה הזו?"
- כותבת ל-`memory_items` בשכבה הנכונה
- נקראת ב-`mentorChat` ו-`smartMentorEngine` אחרי כל שיחה

#### Should Have — חשוב, לא חוסם

**5. טבלת `goal_milestones` (חדשה, פשוטה)**
```sql
id UUID PRIMARY KEY
customer_goal_id UUID REFERENCES customer_goals(id)
title TEXT
target_date DATE
completed_at TIMESTAMPTZ
sort_order INTEGER DEFAULT 0
```
**מה זה נותן:** `generateGoalPlan` יכול ליצור אבני דרך אוטומטיות. מאפשר progress% מחושב.

**6. שדה `conversation_state` ב-`conversations`**
```sql
state VARCHAR(30) DEFAULT 'discovery'
-- discovery / planning / execution / stuck / review / completed
last_state_change TIMESTAMPTZ
stuck_since TIMESTAMPTZ
```
**מה זה נותן:** n8n Workflow `Perfect-one-proactive-mentor` יכול לשלוח הודעות שונות לפי state.

#### Could Have — רצוי, לשלב 2

**7. טבלת `mentor_plans` ו-`mentor_plan_steps`**
- תוכנית מנטור מלאה ומובנית
- תלויה בזיכרון שפעיל (פריט 3)

**8. טבלת `insights`**
- דרוש מנגנון חילוץ תובנות אוטומטי
- תלוי ב-`memoryWriter` שפעיל

**9. טבלת `decisions`**
- תלויה בזיהוי החלטות בשיחות
- מורכבות גבוהה יחסית לערך ב-MVP

#### Won't Have Now — לא בגרסה הנוכחית

- `user_profiles` טבלה נפרדת — מיותר כי `customers` + שדרוג מספיק
- ניתוח מתחרים / benchmarks
- אינטגרציות חיצוניות נוספות מעבר ל-GreenAPI + OpenAI

---

## חלק ד — תעדוף ביצוע: 3 שלבים

### שלב 1 — זיכרון ופרופיל (שבועיים)

| משימה | סוג | תלות | מורכבות |
|-------|-----|-------|---------|
| Migration: הוספת שדות ל-`customers` | DB | אין | S |
| Migration: הוספת שדות ל-`customer_goals` | DB | אין | S |
| יצירת טבלת `memory_items` | DB | אין | S |
| Edge Function: `memoryWriter` | Backend | `memory_items` | M |
| עדכון `mentorChat` — קריאת זיכרון לפרומפט | Backend | `memory_items` | M |
| עדכון `smartMentorEngine` — קריאת זיכרון | Backend | `memory_items` | M |
| עדכון `generateGoalPlan` — שמירה לשדות חדשים | Backend | migration customers_goals | S |

**תוצאה:** מנטור שזוכר עובדות בין שיחות + מטרות עם סיווג מלא.

---

### שלב 2 — מדידת התקדמות ומצבי שיחה (שבועיים)

| משימה | סוג | תלות | מורכבות |
|-------|-----|-------|---------|
| Migration: טבלת `goal_milestones` | DB | שדות customer_goals מעודכנים | S |
| עדכון `generateGoalPlan` — יצירת milestones | Backend | `goal_milestones` | M |
| Migration: שדה `state` ב-`conversations` | DB | אין | S |
| Edge Function: `conversationStateUpdater` | Backend | conversations.state | M |
| עדכון n8n `Perfect-one-proactive-mentor` — שליחה לפי state | n8n | conversations.state | M |
| לוגיקת זיהוי "stuck" ב-n8n | n8n | stuck_since | L |

**תוצאה:** progress% מחושב אוטומטי + מנטור שמגיב אחרת למשתמש תקוע.

---

### שלב 3 — תוכנית מנטור ותובנות (חודש)

| משימה | סוג | תלות | מורכבות |
|-------|-----|-------|---------|
| יצירת טבלאות `mentor_plans` + `mentor_plan_steps` | DB | memory_items פעיל | M |
| Edge Function: `mentorPlanBuilder` | Backend | mentor_plans | L |
| יצירת טבלת `insights` | DB | memoryWriter פעיל | S |
| עדכון `memoryWriter` — חילוץ insights | Backend | insights | M |
| יצירת טבלת `decisions` | DB | insights | S |

**תוצאה:** תוכנית מנטור אישית + מערכת לומדת.

---

## חלק ה — סיכום פערים לפי קריטיות

| # | פער | קריטיות | שלב |
|---|-----|---------|-----|
| 1 | שדות חסרים ב-`customer_goals` | גבוהה | 1 |
| 2 | שדות חסרים ב-`customers` | גבוהה | 1 |
| 3 | אין `memory_items` | גבוהה | 1 |
| 4 | אין `memoryWriter` Edge Function | גבוהה | 1 |
| 5 | `mentorChat` לא קורא זיכרון מובנה | גבוהה | 1 |
| 6 | אין `goal_milestones` | בינונית | 2 |
| 7 | אין מצבי שיחה (conversation state) | בינונית | 2 |
| 8 | אין זיהוי "stuck" | בינונית | 2 |
| 9 | אין `mentor_plans` | נמוכה | 3 |
| 10 | אין `insights` / `decisions` | נמוכה | 3 |

---

## חלק ו — סיכוני ביצוע

### סיכון 1: כפילות טבלאות — גבוה

**הבעיה:** קיימות `conversation_summaries`, `conversation_messages`, `conversations` — ועכשיו רוצים להוסיף `memory_items`. יש סיכון לנתונים כפולים.

**המלצה:** לפני שמוסיפים `memory_items`, לבדוק אם `conversation_summaries.ai_memory` יכול לשמש כ-short_term memory. לא לבנות טבלה חדשה אם אפשר לשדרג קיימת.

---

### סיכון 2: תאימות עם n8n Workflows — בינוני

**הבעיה:** Workflows מניחים מבנה נתונים ספציפי. שינוי ב-`conversations` או `customer_goals` עלול לשבור workflows קיימים.

**המלצה:** כל שינוי schema — לוודא אחורי-תאימות (`ADD COLUMN` בלבד, לא `ALTER` או `DROP`). לעדכן n8n רק אחרי שה-Edge Function החדשה עובדת.

---

### סיכון 3: עלויות OpenAI — בינוני

**הבעיה:** הוספת `memoryWriter` אחרי כל שיחה = קריאה נוספת ל-OpenAI.

**המלצה:** להפעיל `memoryWriter` רק כש-`message` גרמה ל-response משמעותי (לא "תודה", "אוקי"). לדחות לסוף שיחה ולא אחרי כל הודעה.

---

### סיכון 4: migration על DB פרודקשן — בינוני

**הבעיה:** `customers` ו-`customer_goals` הן טבלאות מרכזיות עם נתונים קיימים.

**המלצה:** שדות חדשים תמיד עם `DEFAULT NULL` או ערך ברירת מחדל. לא `NOT NULL` ללא ברירת מחדל. לבדוק על staging לפני פרודקשן.

---

### סיכון 5: `mentorChat` vs `smartMentorEngine` — נמוך

**הבעיה:** שתי Functions עושות דברים דומים (שיחת מנטור) עם לוגיקה שונה. `mentorChat` שומר שיחות, `smartMentorEngine` לא.

**המלצה:** לאחד ל-`mentorChat` כ-source of truth. `smartMentorEngine` ישמש רק לשיחות WhatsApp שמגיעות מ-n8n (ללא auth). לתעד את ההבדל בצורה ברורה.

---

## הנחיות ל-Handoff לצוות הפיתוח

### ל-`database-agent`

1. לבצע תחילה migration לשדות חסרים ב-`customers` ו-`customer_goals` — ללא `NOT NULL`
2. ליצור טבלת `memory_items` עם index על `customer_id` + `layer` + `expires_at`
3. לבדוק אם `conversation_summaries` יכולה לשמש כ-short_term — לפני יצירת טבלה חדשה
4. לא לגעת ב-`conversations`, `conversation_messages`, `goal_steps` — פעילות ועשויות להישבר

### ל-`backend-architect`

1. להתחיל מ-`memoryWriter` Edge Function — הכי פשוטה וכי כל השאר תלוי בה
2. לעדכן `mentorChat` כך שיקרא מ-`memory_items` לפני בניית system prompt
3. `generateGoalPlan` — להוסיף שמירה לשדות החדשים בנוסף ל-JSONB (לא במקום)
4. לא לשנות את ה-API הקיים של שום Function — רק להוסיף שדות תשובה

### ל-n8n

1. לא לשנות workflows קיימים עד שה-DB migrations ו-Edge Functions עברו בדיקה
2. עדכון `Perfect-one-proactive-mentor` — רק לאחר שמצב שיחה (`conversation.state`) פעיל
3. לוגיקת "stuck" — לנסות ב-workflow נפרד לפני שמשלבים ב-main workflow

---

*מסמך זה נכתב על ידי Product Agent ומיועד להנחות את שלבי הפיתוח הבאים.*
