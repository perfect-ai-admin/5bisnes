# דוח סכמת Database - Supabase (fnsnnezhikgqajdbtwoa)

## סיכום ביצוע
✅ בדיקה שלמה של סכמת ה-Database
✅ זיהוי 3 טבלאות ליבה עיקריות
✅ 5 טבלאות נוספות קשורות מחוברות
✅ מיפוי יחסים בין טבלאות

---

## טבלאות ליבה עיקריות

### 1. `customers` (4 שורות)
**תפקיד**: טבלת הלקוח הראשית המרכזית
**RLS**: מופעל | **Primary Key**: `id` (UUID)

#### עמודות משמעותיות:
- **זיהוי ומידע בסיסי**
  - `id` (UUID) - מפתח ראשי
  - `phone_e164` (TEXT) - ייחודי, אחד ללקוח
  - `full_name`, `email` - אופציונליים
  - `created_at`, `updated_at` - timestamps אוטומטיים

- **מצב הרחק (journey)**
  - `current_stage` (ENUM: journey_stage) - 15 ערכים (lead_router, qualification, onboarding, active_service, closed_won, etc.)
  - `current_status` (TEXT) - ברירת מחדל: "new"
  - `human_required` (BOOLEAN) - ברירת מחדל: false

- **ערבוב עם נתוני העסק** ⚠️
  - `business_journey_answers` (JSONB) - תשובות לשאלות הניסיון
  - `business_journey_completed_at` (TIMESTAMP) - מתי הסתיימה הטפטוף
  - `business_state` (JSONB) - מצב כללי של העסק
  - `business_metrics` (JSONB) - מטריקות ביצוע
  - `business_plan` (JSONB) - תוכנית עסקית
  - `client_tasks` (JSONB) - משימות של הלקוח (מערך)
  - `business_stage` (TEXT) - שלב העסק (ברירת מחדל: "התחלה")
  - `business_type` (TEXT) - סוג העסק

- **ניהול יעדים**
  - `active_goal_id` (UUID) - מפתח זר לטבלת goals
  - `onboarding_completed` (BOOLEAN)

- **העדפות תקשורת**
  - `response_speed` (TEXT) - ברירת מחדל: "medium"
  - `message_length_pref` (TEXT)
  - `engagement_level` (TEXT)
  - `preferred_time` (TEXT)
  - `personality_notes` (TEXT)

- **ניהול Follow-ups**
  - `last_followup_at` (TIMESTAMP)
  - `followup_count` (INT)
  - `last_message_at` (TIMESTAMP)
  - `message_burst_count` (INT)
  - `is_rate_limited` (BOOLEAN)

- **מידע נוסף**
  - `profession`, `category`, `source_page`, `source_channel`
  - `plan_id` (UUID) - לקישור לתוכנית תמחור
  - `credits_balance` (INT)
  - `is_paused`, `do_not_contact` (BOOLEAN)
  - `role` (TEXT) - ברירת מחדל: "user"
  - `client_password`, `last_login_at`

---

### 2. `business_journeys` (0 שורות)
**תפקיד**: ניסיון עסקי מיוחד (טפטוף/questionnaire)
**RLS**: מופעל | **Primary Key**: `id` (UUID)

#### עמודות:
- `id` (UUID) - מפתח ראשי
- `customer_id` (UUID) - אין Foreign Key מוגדר ישירות! ⚠️
- `status` (TEXT) - ברירת מחדל: "active"
- `goals_completed` (JSONB) - מערך יעדים שהושלמו
- `current_goal` (TEXT) - היעד הנוכחי
- `metadata` (JSONB) - מידע נוסף
- `created_at`, `updated_at` (TIMESTAMP)
- `source` (VARCHAR) - ברירת מחדל: "main"

⚠️ **בעיה**: אין הגדרת Foreign Key בין business_journeys.customer_id ל-customers.id

---

### 3. `client_tasks` (0 שורות)
**תפקיד**: משימות ספציפיות של לקוח (טבלה נפרדת, לא JSONB)
**RLS**: מופעל | **Primary Key**: `id` (UUID)

#### עמודות:
- `id` (UUID) - מפתח ראשי
- `customer_id` (UUID) - יש Foreign Key! ✅
- `lead_id` (UUID) - מפתח זר אופציונלי ללידים
- `title` (TEXT) - שם המשימה
- `description`, `why`, `impact` (TEXT) - הגדרה והצדקה
- `status` (TEXT) - ברירת מחדל: "pending"
- `priority` (TEXT) - ברירת מחדל: "medium"
- `due_date`, `completed_at` (TIMESTAMP)
- `help_link`, `help_content` (TEXT) - עזרה
- `created_at`, `updated_at` (TIMESTAMP)

✅ **יתרון**: יש Foreign Key על customer_id

---

## טבלאות קשורות נוספות

### 4. `goals` (23 שורות)
**תפקיד**: ספריית יעדים מוגדרים מראש
**RLS**: מופעל | **Primary Key**: `id` (UUID)

#### עמודות חשובות:
- `id` (UUID)
- `goal_code` (TEXT) - UNIQUE - קוד זהה
- `goal_name_he`, `goal_name_en` (TEXT) - שמות דו-לשוניים
- `category` (TEXT) - ברירת מחדל: "journey"
- `description_he`, `description_en` (TEXT)
- `sort_order` (INT) - סדר הצגה
- `depends_on` (UUID) - יעד קודם
- `estimated_duration_days` (INT) - ברירת מחדל: 7 ימים
- `points_value` (INT) - נקודות גמול
- `agent_code` (TEXT) - קוד Agent שמטפל
- `mentor_intro_message` (TEXT)
- `is_active` (BOOLEAN) - ברירת מחדל: true

---

### 5. `customer_goals` (0 שורות)
**תפקיד**: קשר בין לקוח ויעדים (assignment tracking)
**RLS**: מופעל | **Primary Key**: `id` (UUID)
**⚠️ בעיה**: 57 עמודות - מאוד denormalized

#### עמודות ליבה:
- `customer_id` (UUID)
- `goal_id` (UUID)
- `status` (TEXT) - "not_started", "in_progress", "completed"
- `progress_percent` (INT) - אחוז התקדמות
- `assigned_at`, `started_at`, `target_date`, `completed_at` (TIMESTAMP)
- `interaction_count` (INT) - כמה פעמים נוגע בו
- `current_step`, `total_steps_planned` (INT)
- `user_blockers`, `user_frustrations` (TEXT)
- `ai_notes` (JSONB)
- `goal_state` (TEXT) - "discover", ...
- `phase_name` (TEXT) - שלב הניסיון
- `journey_length` (TEXT) - "2w", ...
- `days_elapsed` (INT)
- `momentum` (TEXT) - "stable", ...
- `active_task_id`, `active_task_title` (TEXT)
- `is_primary` (BOOLEAN) וגם `isPrimary` (אותה עמודה בשתי צורות!)
- `tasks` (JSONB) - מערך משימות
- `customAnswers` (JSONB)
- `goal_type` (TEXT) - "medium" וכו'
- `complexity_level`, `priority_level`, `urgency_level` (TEXT/INT)
- `estimated_duration_days` (INT)
- `success_definition` (TEXT)
- `created_date` (TIMESTAMP)

---

### 6. `plans` (0 שורות)
**תפקיד**: תוכניות תמחור וחתימות
**RLS**: מופעל | **Primary Key**: `id` (UUID)

#### עמודות:
- `id` (UUID)
- `name` (TEXT)
- `description` (TEXT)
- `price` (NUMERIC)
- `currency` (TEXT) - ברירת מחדל: "ILS"
- `features` (JSONB) - מערך תכונות
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (TIMESTAMP)

---

### 7. `leads` (6 שורות)
**תפקיד**: לידים לפני הפיכה ללקוח
**RLS**: מופעל | **Primary Key**: `id` (UUID)
**⚠️ בעיה**: 64 עמודות מאוד

#### עמודות משמעותיות:
- `customer_id` (UUID) - אופציונלי (לאחר המרה)
- `name`, `phone`, `email` (TEXT)
- `profession`, `category` (TEXT)
- `status`, `priority` (TEXT)
- `source`, `source_page` (TEXT)
- `pipeline_stage` (VARCHAR) - "new_lead", ...
- `client_id` (UUID)
- `tags` (ARRAY) - מערך תגים
- `is_spam`, `consent` (BOOLEAN)
- **Bot metadata**: `bot_started_at`, `bot_completed_at`, `bot_messages_count`, `bot_outcome_state` וכו'
- N8N sync: `n8n_synced`, `n8n_last_sync`, `n8n_error`

---

### 8. `business_state` (0 שורות)
**תפקיד**: מצב כללי של העסק של לקוח (עמוד אחד בטבלה)
**RLS**: מופעל | **Primary Key**: `id` (UUID)

#### עמודות:
- `customer_id` (UUID) - UNIQUE ✅ (יחס 1-to-1)
- `stage` (TEXT) - שלב עסקי
- `primary_challenge` (TEXT)
- `marketing_state` (JSONB)
- `sales_state` (JSONB)
- `operations_state` (JSONB)
- `performance_state` (JSONB)
- `focus_state` (JSONB)
- `unified_recommendation` (JSONB)
- `decision_log` (JSONB) - היסטוריה של החלטות
- `created_at`, `updated_at` (TIMESTAMP)

---

## יחסים בין טבלאות (Relationships)

### אבחנה מבנית

```
customers (ליבה)
├─ 1:1 ──> business_state (מצב העסק)
├─ 1:M ──> customer_goals (יעדים)
│         ├─ M:M (דרך customer_goals)
│         └─> goals (ספריית יעדים)
├─ 1:M ──> client_tasks (משימות כטבלה)
├─ 1:1 ──> business_journeys (טפטוף)
├─ 1:M ──> leads (לידים חלקיים)
└─ 1:1 ──> plans (תוכנית תמחור)
```

### יחסים מסוימים חסרים Foreign Keys:
- `customers.active_goal_id` → `goals.id` (אין FK)
- `customers.plan_id` → `plans.id` (אין FK)
- `business_journeys.customer_id` → `customers.id` (אין FK) ⚠️

---

## ⚠️ בעיות וסוגיות מצויות

### 1. Mixed Storage Pattern - ערבוב JSONB בטבלת customers
טבלת `customers` מכילה:
- **`business_journey_answers` (JSONB)** - תשובות לשאלון
- **`business_state` (JSONB)** - מצב עסק
- **`business_plan` (JSONB)** - תוכנית עסק
- **`client_tasks` (JSONB)** - מערך משימות

**בעיה**: יש טבלה `client_tasks` נפרדת **וגם** JSONB בטבלה customers!

---

### 2. Missing Foreign Keys
- `business_journeys.customer_id` - אין FK! ⚠️
- `customers.active_goal_id` - אין FK לטבלת goals
- `customers.plan_id` - אין FK לטבלת plans
- `leads.customer_id` - אין FK (אופציונלי)

**השלכה**: אין database-level constraints להבטיח התאמה.

---

### 3. JSONB Overuse
- `customer_goals.tasks` (JSONB) - משימות כ-JSON
- `customer_goals.customAnswers` (JSONB)
- `customer_goals.ai_notes` (JSONB)
- `business_state` - כל המצבים כ-JSONB fields

**סוגיה**: קשה לאינדקס, לשאול בSQL, ולספוג שינויים.

---

### 4. Duplicate Goal Tracking
- `customers.active_goal_id` - יעד אחד בטבלה customers
- `customer_goals` - כל יעדי הלקוח (M:M)
- `customer_goals.is_primary` - סימון יעד ראשי

**סוגיה**: איזו טבלה היא מקור האמת?

---

### 5. Normalization Issues
- `customer_goals` - 57 עמודות! (מאוד denormalized)
- `leads` - 64 עמודות!
- חוזרות על מידע: `active_task_id`, `active_task_title`, `active_task_status`
- שתי גרסאות לאותה עמודה: `is_primary` ו-`isPrimary`

---

## ✅ מה טוב

1. **RLS מופעל בכל הטבלאות** - אבטחה
2. **Timestamps אוטומטיים** - created_at, updated_at
3. **UUID אינמנטי** - id ראשי בכל מקום
4. **Enum types** - journey_stage מוגדר בצורה מחמירה
5. **UNIQUE constraints** - phone_e164, goal_code, customer_id ב-business_state

---

## 📊 סיכום סטטיסטי

| טבלה | שורות | עמודות | RLS | Primary Key | Foreign Keys | Notes |
|------|-------|--------|-----|-------------|-------------|-------|
| customers | 4 | 42 | ✅ | id (UUID) | 0 מוגדרים | ליבה, מכיל JSONB עודף |
| business_journeys | 0 | 9 | ✅ | id (UUID) | 0 | FK חסר! ⚠️ |
| client_tasks | 0 | 15 | ✅ | id (UUID) | 1 (customer_id) | יש Foreign Key ✅ |
| goals | 23 | 17 | ✅ | id (UUID) | 1 (depends_on) | ספריית יעדים |
| customer_goals | 0 | 57 | ✅ | id (UUID) | 0 מוגדרים | denormalized ⚠️ |
| plans | 0 | 9 | ✅ | id (UUID) | 0 | תמחור |
| leads | 6 | 64 | ✅ | id (UUID) | 0 מוגדרים | bot-heavy, denormalized ⚠️ |
| business_state | 0 | 14 | ✅ | id (UUID) | 1 (customer_id) | 1:1 עם customers ✅ |

---

## המלצות

1. **הוסף Foreign Keys** לטבלאות חסרות בעיקר ב-business_journeys
2. **נתח את ה-JSONB** - שקול אם להפריד לטבלאות נפרדות
3. **נתח customer_goals** - 57 עמודות זה יותר מדי, הפריד לטבלאות עזר
4. **תקן naming** - `is_primary` / `isPrimary` (בחר אחד)
5. **אינדקסים** - בטוח שיש אינדקסים על customer_id בכל מקום שצריך
