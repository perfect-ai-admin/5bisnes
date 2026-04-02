# Mentor AI Engines — מפרט טכני מלא

**גרסה:** 1.0
**תאריך:** 2026-03-30
**פרויקט:** 5bisnes — פורטל עסקי ישראלי
**מחבר:** Backend Architect Agent

---

## תוכן עניינים

1. [Goal Engine — מנוע סיווג מטרות](#1-goal-engine)
2. [Conversation Engine — מנוע מצבי שיחה](#2-conversation-engine)
3. [JSON Output Contract — חוזה תגובה](#3-json-output-contract)
4. [System Prompt Template](#4-system-prompt-template)
5. [דוגמאות לכל מצב](#5-examples)
6. [הערות ארכיטקטוניות](#6-architecture-notes)

---

## 1. Goal Engine

### 1.1 תיאור כללי

`Goal Engine` אחראי לסיווג אוטומטי של מטרות חדשות ברגע יצירתן.
הוא מנתח את שם המטרה, התיאור ופרופיל הלקוח — ומחזיר פרמטרים שמכוונים את
כל השיחות הבאות עם המנטור: קצב ליווי, מספר milestones, סגנון תקשורת ושאלה ראשונה.

### 1.2 Input Schema

```typescript
interface GoalClassificationInput {
  goal_title: string;                    // שם המטרה (חובה)
  goal_description?: string;             // תיאור מפורט (אופציונלי)
  customer_profile: {
    business_type?: string;              // "freelancer" | "small_business" | "startup"
    experience_level?: string;           // "beginner" | "intermediate" | "advanced"
    monthly_revenue?: number;            // הכנסה חודשית נוכחית בשקלים
    industry?: string;                   // תחום עיסוק
    active_goals_count?: number;         // מספר מטרות פעילות כרגע
  };
}
```

### 1.3 Output Schema

```typescript
interface GoalClassificationOutput {
  goal_type: "quick" | "medium" | "long";
  complexity_level: "low" | "medium" | "high";
  estimated_duration_days: number;
  recommended_cadence: "daily" | "every_2_days" | "weekly" | "milestone_based";
  recommended_milestones: number;
  recommended_tasks: number;
  mentor_style: "directive" | "collaborative" | "supportive";
  first_question: string;
}
```

### 1.4 לוגיקת סיווג — `classifyGoal`

```typescript
/**
 * classifyGoal
 * מסווג מטרה חדשה לפי מילות מפתח + פרופיל לקוח
 */
function classifyGoal(
  title: string,
  description: string = "",
  profile: CustomerProfile
): GoalClassificationOutput {

  const text = (title + " " + description).toLowerCase();

  // ===== שלב 1: זיהוי goal_type =====

  const QUICK_KEYWORDS = [
    "לפתוח", "לפתח", "להירשם", "להעלות", "לבחור", "ליצור חשבון",
    "לצלם", "לשלוח", "למלא טופס", "לקבל אישור", "להגדיר",
    "עוסק פטור", "עמוד אינסטגרם", "שם למותג", "כרטיס ביקור",
    "פרופיל לינקדאין", "לוגו", "ביו", "אתר ויקס"
  ];

  const LONG_KEYWORDS = [
    "להגיע ל", "לבנות מנגנון", "צמיחה", "יציב", "קבוע", "חודשי",
    "מותג", "הכנסה פסיבית", "קהל", "לקוחות קבועים", "סקייל",
    "להכפיל", "להגדיל ל", "בחצי שנה", "בשנה", "ארוך טווח",
    "20,000", "30,000", "50,000", "100,000", "מיליון"
  ];

  let goal_type: "quick" | "medium" | "long" = "medium"; // ברירת מחדל

  const isQuick = QUICK_KEYWORDS.some(kw => text.includes(kw));
  const isLong  = LONG_KEYWORDS.some(kw => text.includes(kw));

  if (isQuick && !isLong) goal_type = "quick";
  else if (isLong)        goal_type = "long";
  else                    goal_type = "medium";

  // ===== שלב 2: זיהוי complexity_level =====

  let complexity_level: "low" | "medium" | "high" = "medium";

  const COMPLEXITY_HIGH_KEYWORDS = [
    "ליד", "לידים", "משפך", "פאנל", "מכירות", "הכנסה", "לקוחות",
    "מותג", "שיווק", "אוטומציה", "מערכת", "סקייל"
  ];
  const COMPLEXITY_LOW_KEYWORDS = [
    "לפתוח", "להירשם", "לבחור", "לצלם", "לשלוח", "להעלות",
    "כרטיס ביקור", "לוגו", "שם"
  ];

  if (COMPLEXITY_HIGH_KEYWORDS.some(kw => text.includes(kw))) {
    complexity_level = "high";
  } else if (COMPLEXITY_LOW_KEYWORDS.some(kw => text.includes(kw))) {
    complexity_level = "low";
  }

  // ===== שלב 3: estimated_duration_days =====

  const DURATION_MAP: Record<string, Record<string, number>> = {
    quick:  { low: 3,  medium: 5,  high: 7  },
    medium: { low: 14, medium: 21, high: 30 },
    long:   { low: 60, medium: 90, high: 150 }
  };
  const estimated_duration_days = DURATION_MAP[goal_type][complexity_level];

  // ===== שלב 4: recommended_cadence =====

  const CADENCE_MAP: Record<string, "daily" | "every_2_days" | "weekly" | "milestone_based"> = {
    quick:  "daily",
    medium: complexity_level === "high" ? "every_2_days" : "every_2_days",
    long:   "weekly"
  };
  const recommended_cadence = CADENCE_MAP[goal_type];

  // ===== שלב 5: recommended_milestones + recommended_tasks =====

  const MILESTONES_MAP: Record<string, Record<string, number>> = {
    quick:  { low: 1, medium: 2, high: 3 },
    medium: { low: 3, medium: 4, high: 5 },
    long:   { low: 4, medium: 6, high: 8 }
  };
  const TASKS_MAP: Record<string, Record<string, number>> = {
    quick:  { low: 2, medium: 4, high: 6 },
    medium: { low: 6, medium: 10, high: 15 },
    long:   { low: 12, medium: 20, high: 30 }
  };
  const recommended_milestones = MILESTONES_MAP[goal_type][complexity_level];
  const recommended_tasks      = TASKS_MAP[goal_type][complexity_level];

  // ===== שלב 6: mentor_style =====
  // תלוי בפרופיל הלקוח + סוג המטרה

  let mentor_style: "directive" | "collaborative" | "supportive" = "collaborative";

  if (profile.experience_level === "beginner" || !profile.experience_level) {
    mentor_style = goal_type === "quick" ? "directive" : "supportive";
  } else if (profile.experience_level === "advanced") {
    mentor_style = "collaborative";
  } else {
    mentor_style = goal_type === "long" ? "supportive" : "directive";
  }

  // ===== שלב 7: first_question =====

  const first_question = generateFirstQuestion(title, goal_type, complexity_level, profile);

  return {
    goal_type,
    complexity_level,
    estimated_duration_days,
    recommended_cadence,
    recommended_milestones,
    recommended_tasks,
    mentor_style,
    first_question
  };
}

/**
 * generateFirstQuestion
 * מייצר שאלת פתיחה מותאמת לסוג המטרה
 */
function generateFirstQuestion(
  title: string,
  goal_type: string,
  complexity: string,
  profile: CustomerProfile
): string {

  const name = profile.first_name || "היי";

  if (goal_type === "quick") {
    return `${name}, בשביל "${title}" — מה עצר אותך עד עכשיו?`;
  }

  if (goal_type === "medium") {
    if (complexity === "high") {
      return `בוא נתכנן ביחד. מה הצעד הכי קטן שאתה יכול לעשות כבר מחר לקראת "${title}"?`;
    }
    return `לגבי "${title}" — מה כבר עשית בכיוון הזה, ואיפה אתה עומד היום?`;
  }

  // long
  return `מטרה כמו "${title}" מצריכה תכנון נכון. ספר לי — למה זה חשוב לך עכשיו, ומה נראה לך שהאתגר הכי גדול בדרך?`;
}
```

### 1.5 טבלת מיפוי מטרות לדוגמה

| כותרת המטרה | `goal_type` | `complexity_level` | `estimated_duration_days` | `recommended_cadence` | `mentor_style` |
|---|---|---|---|---|---|
| לפתוח עוסק פטור | `quick` | `low` | 3 | `daily` | `directive` |
| לפתוח עמוד אינסטגרם | `quick` | `low` | 3 | `daily` | `directive` |
| לבחור שם למותג | `quick` | `medium` | 5 | `daily` | `directive` |
| לבנות הצעת ערך | `medium` | `medium` | 21 | `every_2_days` | `supportive` |
| להביא 10 לידים ראשונים | `medium` | `high` | 30 | `every_2_days` | `supportive` |
| להקים משפך שיווקי | `medium` | `high` | 30 | `every_2_days` | `supportive` |
| להגיע ל-20,000 ₪ בחודש | `long` | `high` | 150 | `weekly` | `supportive` |
| לבנות מותג עסקי | `long` | `high` | 150 | `weekly` | `collaborative` |

### 1.6 הגדרת `mentor_style`

| סגנון | תיאור | מתאים מתי |
|---|---|---|
| `directive` | המנטור מוביל, נותן הנחיות ברורות | מתחיל + מטרה קצרה — צריך כיוון מיידי |
| `collaborative` | שותפות — מנטור ולקוח בונים יחד | מנוסה + מטרה מורכבת |
| `supportive` | המנטור תומך ומעצים, לקוח מוביל | מטרה ארוכה שדורשת מוטיבציה לאורך זמן |

---

## 2. Conversation Engine

### 2.1 תיאור כללי

`Conversation Engine` מנהל את מצב השיחה לכל `customer_goal`.
כל מטרה פעילה מחזיקה `conversation_state` עצמאי — לקוח יכול להיות ב-`execution`
על מטרה אחת ו-`planning` על מטרה אחרת בו-זמנית.

### 2.2 מצבי שיחה

```
discovery   → בירור: מה המשתמש רוצה להשיג
planning    → בניית תוכנית עבודה ו-milestones
execution   → ביצוע שוטף: מעקב משימות, עדכוני התקדמות
stuck       → המשתמש תקוע — אבחון וחילוץ
review      → בדיקת milestone שהסתיים
completed   → המטרה הושלמה — חגיגה + המלצה לצעד הבא
```

### 2.3 State Machine — כללי מעבר

```
┌─────────────┐
│  discovery  │ ◄─── נקודת כניסה לכל מטרה חדשה
└──────┬──────┘
       │ המטרה ברורה + יש commitment
       ▼
┌─────────────┐
│  planning   │ ◄─── מגיעים גם מ-review (אם צריך תכנון מחדש)
└──────┬──────┘
       │ יש תוכנית + משימה ראשונה נוצרה
       ▼
┌─────────────┐     אין פעילות 3+ ימים     ┌─────────┐
│  execution  │ ──────────────────────────► │  stuck  │
│             │ ◄────────────────────────── │         │
└──────┬──────┘   המשתמש חזר לפעולה         └─────────┘
       │ milestone הושלם
       ▼
┌─────────────┐
│   review    │
└──────┬──────┘
       │ יש עוד milestones          │ כל ה-milestones הושלמו
       ▼                            ▼
  execution                  ┌─────────────┐
                              │  completed  │ ──► discovery (מטרה חדשה)
                              └─────────────┘
```

### 2.4 כללי מעבר מפורטים

```typescript
type ConversationState =
  | "discovery"
  | "planning"
  | "execution"
  | "stuck"
  | "review"
  | "completed";

interface TransitionRule {
  from: ConversationState;
  to: ConversationState;
  trigger: string;            // תיאור הטריגר
  condition: string;          // תנאי נדרש
  action?: string;            // פעולה שצריך לבצע במעבר
}

const TRANSITION_RULES: TransitionRule[] = [
  {
    from: "discovery",
    to: "planning",
    trigger: "goal_clarified",
    condition: "המטרה מנוסחת בבירור + המשתמש אישר שזה מה שהוא רוצה",
    action: "צור milestone_plan ראשוני + שמור goal_fact"
  },
  {
    from: "planning",
    to: "execution",
    trigger: "plan_approved",
    condition: "יש לפחות milestone אחד + נוצרה משימה ראשונה",
    action: "הגדר due_date למשימה ראשונה + שלח follow_up_delay_hours=24"
  },
  {
    from: "execution",
    to: "stuck",
    trigger: "inactivity_detected",
    condition: "אין הודעות 3+ ימים | משימה עברה due_date | המשתמש הצהיר שהוא תקוע",
    action: "שלח הודעת בדיקה + זהה את הבלוקר"
  },
  {
    from: "stuck",
    to: "execution",
    trigger: "user_resumed",
    condition: "המשתמש שלח הודעה + ביצע לפחות פעולה אחת",
    action: "עדכן blocker כ-resolved + שמור personal_pattern"
  },
  {
    from: "execution",
    to: "review",
    trigger: "milestone_completed",
    condition: "כל המשימות תחת milestone הנוכחי הושלמו",
    action: "חשב progress_percent + שמור progress_update"
  },
  {
    from: "review",
    to: "execution",
    trigger: "next_milestone_started",
    condition: "יש milestone נוסף + המשתמש מוכן להמשיך",
    action: "advance_to_next=true + צור משימות ל-milestone הבא"
  },
  {
    from: "review",
    to: "completed",
    trigger: "all_milestones_done",
    condition: "כל ה-milestones הושלמו + progress_percent=100",
    action: "שמור goal כ-completed + הצג סיכום הישגים"
  },
  {
    from: "completed",
    to: "discovery",
    trigger: "new_goal_started",
    condition: "המשתמש אמר שהוא רוצה להתחיל מטרה חדשה",
    action: "ש אל next_expected_user_input על מטרה הבאה"
  }
];
```

### 2.5 Stuck Detection — זיהוי עצירה

```typescript
interface StuckDetectionConfig {
  inactivity_days: 3;                       // ימי שתיקה שמפעילים stuck
  overdue_task_hours: 48;                    // שעות אחרי due_date לפני stuck
  explicit_stuck_phrases: [                  // ביטויים שמשתמש אומר
    "אני תקוע",
    "לא מתקדם",
    "לא יודע מה לעשות",
    "זה לא עובד",
    "ויתרתי",
    "קשה לי",
    "לא הצלחתי"
  ];
}

// פעולה בעת זיהוי stuck:
// 1. שנה conversation_state ל-"stuck"
// 2. שמור blocker ב-memory_updates עם importance_score=8
// 3. שלח שאלת אבחון — "מה עצר אותך?"
// 4. הגדר follow_up_delay_hours=12 (מעקב מהיר יותר)
```

### 2.6 מאפייני מצב לפי `goal_type`

| `goal_type` | זמן בין הודעות | follow_up_delay_hours | stuck אחרי כמה ימים |
|---|---|---|---|
| `quick` | יומי | 24 | 2 |
| `medium` | יומיים | 48 | 3 |
| `long` | שבועי | 72 | 5 |

---

## 3. JSON Output Contract

כל קריאה ל-`smartMentorEngine` מחזירה את המבנה הבא במלואו.
שדות עם ערך `null` — לא רלוונטיים להודעה הנוכחית.

### 3.1 Schema מלא

```typescript
interface MentorResponse {

  // ===== תגובה למשתמש =====
  response_text: string;                     // ההודעה עצמה — עברית, קצרה, מעשית
  conversation_state: ConversationState;     // המצב הנוכחי (אחרי עיבוד)
  state_transition: string | null;           // "discovery→planning" | null אם לא השתנה

  // ===== עדכוני זיכרון =====
  memory_updates: MemoryUpdate[];

  // ===== משימות חדשות =====
  tasks_to_create: TaskToCreate[];

  // ===== החלטות לשמירה =====
  decisions_to_save: DecisionToSave[];

  // ===== עדכון מטרה =====
  goal_updates: {
    status: string | null;                   // "active" | "completed" | "paused"
    progress_percent: number | null;         // 0-100
    progress_narrative: string | null;       // "הושלמו 2 מתוך 5 milestones"
  };

  // ===== עדכון milestone =====
  milestone_updates: {
    current_milestone_status: string | null; // "in_progress" | "completed"
    advance_to_next: boolean;                // true = עבור ל-milestone הבא
  };

  // ===== follow-up =====
  follow_up_needed: boolean;                 // האם לשלוח follow-up אוטומטי
  follow_up_delay_hours: number;             // כמה שעות לחכות
  next_expected_user_input: string;          // מה אנחנו מצפים שיגיד
}
```

### 3.2 MemoryUpdate Schema

```typescript
interface MemoryUpdate {
  action: "create" | "update" | "deactivate";
  memory_type:
    | "profile_fact"      // עובדה על הלקוח (שם, עסק, ניסיון)
    | "goal_fact"         // עובדה על המטרה הספציפית
    | "blocker"           // מה עוצר את הלקוח
    | "preference"        // העדפה (שעת שיחה, ערוץ תקשורת)
    | "decision"          // החלטה שהתקבלה
    | "commitment"        // התחייבות שנתן הלקוח
    | "risk"              // סיכון שזוהה
    | "progress_update"   // עדכון התקדמות
    | "personal_pattern"  // דפוס התנהגות שזוהה
    | "business_context"; // הקשר עסקי (הכנסות, לקוחות, ענף)
  title: string;
  content: string;
  importance_score: number; // 1-10 (10 = חיוני לשיחה הבאה)
}
```

### 3.3 TaskToCreate Schema

```typescript
interface TaskToCreate {
  title: string;
  description: string;
  task_type:
    | "research"     // מחקר / למידה
    | "decision"     // החלטה שצריך לקבל
    | "setup"        // הגדרה / תצורה
    | "execution"    // פעולה מעשית
    | "follow_up"    // מעקב
    | "reflection"   // חשיבה / תכנון
    | "review";      // בדיקת תוצאות
  priority: "low" | "medium" | "high";
  estimated_effort: string;   // "30 דקות" | "2 שעות" | "יום עבודה"
  due_days: number;           // כמה ימים מהיום יש לסיים
}
```

### 3.4 DecisionToSave Schema

```typescript
interface DecisionToSave {
  title: string;
  decision_text: string;  // הניסוח המדויק של ההחלטה
  reason: string;         // הסיבה שהלקוח נתן
  impact_level: "low" | "medium" | "high";
}
```

### 3.5 דוגמת תגובה מלאה — מעבר `discovery` ל-`planning`

```json
{
  "response_text": "מעולה! אז המטרה שלך היא להביא 10 לידים ראשונים תוך 30 יום. בשביל זה נחלק את הדרך ל-3 שלבים: הגדרת קהל יעד, בניית הצעה, ותהליך פנייה. מה נתחיל ממנו?",
  "conversation_state": "planning",
  "state_transition": "discovery→planning",

  "memory_updates": [
    {
      "action": "create",
      "memory_type": "goal_fact",
      "title": "מטרה: 10 לידים ב-30 יום",
      "content": "הלקוח רוצה 10 לידים ראשונים בתוך 30 יום. עדיין לא הגדיר קהל יעד ספציפי.",
      "importance_score": 9
    },
    {
      "action": "create",
      "memory_type": "commitment",
      "title": "מחויבות: תכנון לידים",
      "content": "הלקוח הסכים לחלק את התהליך ל-3 שלבים.",
      "importance_score": 7
    }
  ],

  "tasks_to_create": [
    {
      "title": "הגדר קהל יעד ל-3 פרסונות",
      "description": "כתוב 3 תיאורים קצרים של הלקוח האידיאלי — מי הוא, מה הבעיה שלו, למה הוא יבחר בך",
      "task_type": "reflection",
      "priority": "high",
      "estimated_effort": "1 שעה",
      "due_days": 2
    }
  ],

  "decisions_to_save": [
    {
      "title": "בחירת גישה: 3 שלבים ללידים",
      "decision_text": "נחלק את תהליך גיוס הלידים ל-3 שלבים: קהל, הצעה, פנייה",
      "reason": "מבנה ברור עוזר להתמקד ולא להתאבד בהתחלה",
      "impact_level": "medium"
    }
  ],

  "goal_updates": {
    "status": "active",
    "progress_percent": 5,
    "progress_narrative": "התחלנו לתכנן — הגדרנו 3 שלבי עבודה"
  },

  "milestone_updates": {
    "current_milestone_status": "in_progress",
    "advance_to_next": false
  },

  "follow_up_needed": true,
  "follow_up_delay_hours": 48,
  "next_expected_user_input": "הלקוח יגיד מאיזה שלב מהשלושה הוא רוצה להתחיל"
}
```

---

## 4. System Prompt Template

הפרומפט הבא ישמר ב-`agent_prompt_templates` עם `template_code = 'mentor_system_prompt'`.
הוא כולל `{{placeholders}}` שמוחלפים בזמן ריצה עם נתוני הלקוח.

```
אתה {{MENTOR_NAME}} — מנטור עסקי אישי של {{CUSTOMER_NAME}}.

== תפקידך ==
אתה לא בוט. אתה שותף עסקי שמכיר את {{CUSTOMER_NAME}} לעומק.
אתה עוזר לו לקחת צעד אחד קדימה בכל שיחה — לא יותר.
אתה לא מרצה, לא מעמיס, לא מדבר בתיאוריות.
אתה שואל שאלה אחת, מקשיב, ואז נותן כיוון מעשי.

== הקשר לקוח ==
שם: {{CUSTOMER_NAME}}
עסק: {{BUSINESS_NAME}} ({{BUSINESS_TYPE}})
ניסיון: {{EXPERIENCE_LEVEL}}
מטרה נוכחית: {{CURRENT_GOAL_TITLE}}
שלב מטרה: {{CURRENT_GOAL_TYPE}} ({{GOAL_COMPLEXITY}})
התקדמות: {{PROGRESS_PERCENT}}%
Milestone נוכחי: {{CURRENT_MILESTONE}}
מצב שיחה: {{CONVERSATION_STATE}}

== זיכרון רלוונטי ==
{{MEMORY_CONTEXT}}

== כללי שיחה ==
1. שאלה אחת בכל הודעה — לא יותר
2. תשובות קצרות — עד 4 שורות
3. עברית פשוטה — לא מילים גדולות
4. תמיד סיים בצעד קטן ומעשי או שאלה אחת
5. אל תחזור על מה שהמשתמש אמר — תקדם קדימה
6. אם המשתמש תקוע — אל תלחץ, תשאל "מה עוצר?"
7. הישג קטן = חגיגה קטנה

== הנחיות לפי conversation_state ==

STATE: discovery
- אתה מנסה להבין מה המשתמש באמת רוצה
- שאל שאלה אחת שתעזור לחדד את המטרה
- בסוף discovery — וודא שיש לך מטרה ברורה וניתנת לביצוע
- דוגמה: "בשביל מה אתה רוצה את הלידים — למה עכשיו?"

STATE: planning
- אתה בונה תוכנית יחד עם המשתמש
- חלק את המטרה ל-{{RECOMMENDED_MILESTONES}} milestones
- הצע את המשימה הראשונה ובקש אישור
- שמור פשוט — אל תציע יותר מ-3 משימות בבת אחת

STATE: execution
- אתה עוקב אחרי ביצוע
- בדוק מה נעשה מהפעם הקודמת
- שאל על משימה ספציפית אחת
- אם הכל בסדר — קדם ל-milestone הבא
- אם יש בעיה — זהה ועזור לפתור

STATE: stuck
- המשתמש תקוע — זה נורמלי, זה קורה לכולם
- אל תלחץ ואל תאשים
- שאל: "מה בדיוק עוצר אותך?" (שאלה אחת)
- אחרי שהבנת — הצע פתרון אחד קטן, לא חמש עצות
- אם הבלוקר הוא פחד — תן הרשאה: "מותר לנסות ולטעות"

STATE: review
- milestone הושלם — חגוג קודם!
- "{{CUSTOMER_NAME}}, עשית {{COMPLETED_MILESTONE_TITLE}} — זה לא פשוט"
- עשה סיכום קצר של מה שנלמד
- שאל: "מה היה הכי קשה?"
- הצג את ה-milestone הבא ושאל אם מוכן

STATE: completed
- המטרה הושלמה — זה גדול!
- כתוב סיכום הישג: מה עשה, כמה זמן לקח, מה למד
- שאל: "מה המטרה הבאה שנתקוף?"
- המלץ על מטרה הגיונית לשלב הבא

== הנחיות לפי goal_type ==

goal_type: quick (מטרה קצרה, 1-7 ימים)
- מהיר, מכוון, ישיר
- אל תבזבז זמן על "בואו נבין" — ישר לפעולה
- כל הודעה = צעד קדימה

goal_type: medium (מטרה בינונית, 14-30 ימים)
- שמור על קצב עקבי — כל יומיים-שלושה
- בדוק momentum — "מה עשית מאז הפעם הקודמת?"
- עזור לשמור מוטיבציה בשבועיים השניים (שם נוטים לאבד קצב)

goal_type: long (מטרה ארוכה, 60+ ימים)
- ה-milestones הם הנשמה של התהליך — חגוג כל אחד
- כל שבוע: עדכון קצר + שאלה אחת
- בחודש השני — בדוק האם המטרה עדיין רלוונטית
- הזכר את ה"למה" כשיש ירידה במוטיבציה

== מבנה תגובה ==
תגובתך תהיה JSON בלבד, לפי ה-contract הבא.
אל תוסיף טקסט מחוץ ל-JSON.
אל תוסיף markdown.
תגיב בעברית ב-response_text בלבד.

{
  "response_text": "...",
  "conversation_state": "...",
  "state_transition": null,
  "memory_updates": [],
  "tasks_to_create": [],
  "decisions_to_save": [],
  "goal_updates": { "status": null, "progress_percent": null, "progress_narrative": null },
  "milestone_updates": { "current_milestone_status": null, "advance_to_next": false },
  "follow_up_needed": false,
  "follow_up_delay_hours": 48,
  "next_expected_user_input": "..."
}
```

---

## 5. דוגמאות לכל מצב

### 5.1 מצב: `discovery`

**הקשר:** לקוח חדש, פרילנסר מעצב גרפי, רוצה "לצמוח"
**הודעת משתמש:** "אני רוצה להגדיל את ההכנסות שלי"

```json
{
  "response_text": "כיף שהגעת. לפני שנתכנן — ספר לי: כמה אתה מרוויח היום בחודש ממה שאתה עושה?",
  "conversation_state": "discovery",
  "state_transition": null,
  "memory_updates": [
    {
      "action": "create",
      "memory_type": "goal_fact",
      "title": "כוונה ראשונית: הגדלת הכנסות",
      "content": "הלקוח הביע רצון להגדיל הכנסות — עדיין לא ידוע כמה מרוויח היום ומה היעד",
      "importance_score": 8
    }
  ],
  "tasks_to_create": [],
  "decisions_to_save": [],
  "goal_updates": { "status": null, "progress_percent": null, "progress_narrative": null },
  "milestone_updates": { "current_milestone_status": null, "advance_to_next": false },
  "follow_up_needed": false,
  "follow_up_delay_hours": 48,
  "next_expected_user_input": "הלקוח יגיד את ההכנסה החודשית הנוכחית שלו"
}
```

---

### 5.2 מצב: `planning`

**הקשר:** מטרה: "להביא 10 לידים ב-30 יום", עם `goal_type=medium`
**הודעת משתמש:** "אוקיי, אני מוכן לתכנן"

```json
{
  "response_text": "נחלק את הדרך ל-3 שלבים: קודם מגדירים מי הלקוח האידיאלי, אחר כך בונים הצעה, ואז יוצאים לפנות. השלב הראשון — כתוב 3 שורות על הלקוח שהכי רוצה לעבוד איתו. יש לך שעה לזה?",
  "conversation_state": "planning",
  "state_transition": "discovery→planning",
  "memory_updates": [
    {
      "action": "create",
      "memory_type": "commitment",
      "title": "מחויבות לתוכנית 3 שלבים",
      "content": "הלקוח הסכים לתוכנית 3 שלבים לגיוס לידים",
      "importance_score": 7
    }
  ],
  "tasks_to_create": [
    {
      "title": "הגדר 3 פרסונות לקוח אידיאלי",
      "description": "כתוב 3 שורות על כל פרסונה: מי הוא, מה הבעיה שלו, למה יבחר בך",
      "task_type": "reflection",
      "priority": "high",
      "estimated_effort": "1 שעה",
      "due_days": 2
    }
  ],
  "decisions_to_save": [
    {
      "title": "תוכנית גיוס לידים — 3 שלבים",
      "decision_text": "קהל יעד → הצעת ערך → פנייה",
      "reason": "מבנה שמחלק את הבלבול לצעדים ברורים",
      "impact_level": "medium"
    }
  ],
  "goal_updates": {
    "status": "active",
    "progress_percent": 5,
    "progress_narrative": "התחלנו לתכנן — אושרה תוכנית 3 שלבים"
  },
  "milestone_updates": { "current_milestone_status": "in_progress", "advance_to_next": false },
  "follow_up_needed": true,
  "follow_up_delay_hours": 48,
  "next_expected_user_input": "הלקוח ישלח 3 פרסונות לקוח שכתב"
}
```

---

### 5.3 מצב: `execution`

**הקשר:** לקוח בשבוע השני, milestone 1 כמעט הושלם
**הודעת משתמש:** "סיימתי לכתוב את הפרסונות, יצא ממש טוב"

```json
{
  "response_text": "כן! זה הבסיס של כל מה שיבוא אחרי. עכשיו השלב הבא — הצעת ערך. משפט אחד שאומר: אני עוזר ל[מי] לעשות [מה] בלי [בעיה]. תנסה לכתוב אותו?",
  "conversation_state": "execution",
  "state_transition": null,
  "memory_updates": [
    {
      "action": "create",
      "memory_type": "progress_update",
      "title": "הושלם: הגדרת פרסונות לקוח",
      "content": "הלקוח כתב 3 פרסונות לקוח אידיאלי. דיווח שיצא טוב.",
      "importance_score": 6
    }
  ],
  "tasks_to_create": [
    {
      "title": "כתוב משפט הצעת ערך אחד",
      "description": "פורמט: אני עוזר ל[קהל] לעשות [תוצאה] בלי [כאב]",
      "task_type": "execution",
      "priority": "high",
      "estimated_effort": "30 דקות",
      "due_days": 1
    }
  ],
  "decisions_to_save": [],
  "goal_updates": {
    "status": "active",
    "progress_percent": 25,
    "progress_narrative": "הושלם milestone 1 — הגדרת קהל יעד"
  },
  "milestone_updates": { "current_milestone_status": "completed", "advance_to_next": true },
  "follow_up_needed": true,
  "follow_up_delay_hours": 24,
  "next_expected_user_input": "הלקוח ישלח את משפט הצעת הערך שכתב"
}
```

---

### 5.4 מצב: `stuck`

**הקשר:** לא שלח הודעה 4 ימים, יש משימה פתוחה פגת תאריך
**הודעת משתמש (follow-up אוטומטי):** "היי, מה קורה?"

```json
{
  "response_text": "היי! שמתי לב שלא דיברנו כמה ימים. בסדר גמור — קורה. מה עצר אותך?",
  "conversation_state": "stuck",
  "state_transition": "execution→stuck",
  "memory_updates": [
    {
      "action": "create",
      "memory_type": "blocker",
      "title": "עצירה לאחר 4 ימים",
      "content": "הלקוח לא היה פעיל 4 ימים. משימה פתוחה: כתיבת הצעת ערך. הסיבה לא ידועה עדיין.",
      "importance_score": 8
    }
  ],
  "tasks_to_create": [],
  "decisions_to_save": [],
  "goal_updates": { "status": "active", "progress_percent": null, "progress_narrative": null },
  "milestone_updates": { "current_milestone_status": "in_progress", "advance_to_next": false },
  "follow_up_needed": true,
  "follow_up_delay_hours": 12,
  "next_expected_user_input": "הלקוח יסביר מה עצר אותו"
}
```

---

### 5.5 מצב: `review`

**הקשר:** milestone 2 הושלם — בניית הצעת ערך
**הודעת משתמש:** "גמרתי את ההצעה, שלחתי ל-5 אנשים וקיבלתי תגובות"

```json
{
  "response_text": "וואו — שלחת ל-5 אנשים וקיבלת תגובות?! זה milestone משמעותי. מה הייתה התגובה הכי מפתיעה שקיבלת?",
  "conversation_state": "review",
  "state_transition": "execution→review",
  "memory_updates": [
    {
      "action": "create",
      "memory_type": "progress_update",
      "title": "הושלם milestone 2: הצעת ערך + ולידציה ראשונית",
      "content": "הלקוח שלח הצעת ערך ל-5 אנשים וקיבל תגובות — ולידציה בשטח הושלמה.",
      "importance_score": 9
    }
  ],
  "tasks_to_create": [],
  "decisions_to_save": [],
  "goal_updates": {
    "status": "active",
    "progress_percent": 60,
    "progress_narrative": "הושלמו 2 מתוך 3 milestones — קהל + הצעת ערך"
  },
  "milestone_updates": { "current_milestone_status": "completed", "advance_to_next": false },
  "follow_up_needed": false,
  "follow_up_delay_hours": 48,
  "next_expected_user_input": "הלקוח יספר על התגובה המפתיעה ביותר שקיבל"
}
```

---

### 5.6 מצב: `completed`

**הקשר:** כל ה-milestones הושלמו, 10 לידים נאספו
**הודעת משתמש:** "קיבלתי 12 לידים! עברתי את המטרה"

```json
{
  "response_text": "12 לידים — עברת את המטרה שהצבת לעצמך. לפני 30 יום לא ידעת מי הלקוח שלך, היום יש לך 12 שיחות ממתינות. זה לא מקרה — זה עבודה. מה השלב הבא שנתקוף?",
  "conversation_state": "completed",
  "state_transition": "review→completed",
  "memory_updates": [
    {
      "action": "create",
      "memory_type": "progress_update",
      "title": "מטרה הושלמה: 12 לידים ב-30 יום",
      "content": "הלקוח השיג 12 לידים — חרג מהמטרה של 10. לקח 30 יום. תהליך: קהל יעד → הצעת ערך → פנייה.",
      "importance_score": 10
    },
    {
      "action": "create",
      "memory_type": "personal_pattern",
      "title": "דפוס: מצליח כשיש מבנה ברור",
      "content": "הלקוח השיג תוצאות טובות כשהתהליך חולק ל-3 שלבים ברורים עם בדיקות ביניים.",
      "importance_score": 8
    }
  ],
  "tasks_to_create": [],
  "decisions_to_save": [
    {
      "title": "הצלחה: תהליך גיוס לידים מוכח",
      "decision_text": "תהליך קהל → הצעה → פנייה עובד עבור הלקוח הזה",
      "reason": "הביא 12 לידים ב-30 יום בפנייה ראשונה",
      "impact_level": "high"
    }
  ],
  "goal_updates": {
    "status": "completed",
    "progress_percent": 100,
    "progress_narrative": "הושלמה המטרה — 12 לידים ב-30 יום"
  },
  "milestone_updates": { "current_milestone_status": "completed", "advance_to_next": false },
  "follow_up_needed": true,
  "follow_up_delay_hours": 24,
  "next_expected_user_input": "הלקוח יציין את המטרה הבאה שרוצה לתקוף"
}
```

---

## 6. הערות ארכיטקטוניות

### 6.1 שמירת `conversation_state` ב-DB

`conversation_state` ישמר בטבלת `customer_goals` בשדה `flow_data` (JSONB קיים)
או בשדה ייעודי `conversation_state VARCHAR(20)`.

**המלצה:** להוסיף שדה ייעודי — לא להסתיר מצב בתוך JSONB.
יש לתאם עם `@database-agent` על מיגרציה.

```sql
-- מיגרציה מומלצת
ALTER TABLE customer_goals
  ADD COLUMN IF NOT EXISTS conversation_state VARCHAR(20) DEFAULT 'discovery',
  ADD COLUMN IF NOT EXISTS state_changed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_customer_goals_state
  ON customer_goals(conversation_state);
```

### 6.2 `classifyGoal` — מיקום הרצה

הפונקציה `classifyGoal` תרוץ ב-`selectGoal` edge function — ברגע שהלקוח
בוחר מטרה. התוצר יישמר ב-`customer_goals.goal_metadata` (JSONB).

### 6.3 Stuck Detection — cron job

הגילוי האוטומטי של `stuck` (אחרי 3 ימי שתיקה) ידרוש cron job נפרד
שרץ כל 6 שעות וסורק `customer_goals` עם `conversation_state='execution'`
ו-`last_activity_at < NOW() - INTERVAL '3 days'`.

זה מחוץ לתחום `smartMentorEngine` — יש לתאם עם `@automation-agent`.

### 6.4 `memory_updates` — טבלה קיימת?

ה-`memory_updates` מתבסס על `conversation_summaries` הקיים בפרויקט.
יש לבדוק אם לרחב את הטבלה הקיימת או ליצור טבלת `mentor_memories` ייעודית
עם `memory_type`, `importance_score` ו-`is_active`.

### 6.5 `first_question` — שפה ותרגום

ה-`first_question` שמייצרת `classifyGoal` היא template טקסטואלי בעברית.
אם בעתיד יתמכו שפות נוספות — יש לעטוף את הפונקציה ב-i18n layer.

### 6.6 Trade-off: JSON-only vs Hybrid Response

ה-contract מגדיר שהמנטור מחזיר JSON בלבד.
**יתרון:** parsing פשוט, ניתן לעדכן DB ישירות מה-edge function.
**חסרון:** מגביל את גמישות המודל לייצר תגובה טבעית.

**המלצה:** להשאיר JSON-only ולהגדיר `response_text` כשדה חופשי — כך המודל
יכול לכתוב בצורה טבעית, אבל שאר השדות מובנים לעיבוד אוטומטי.

---

*מסמך זה מהווה את הבסיס לפיתוח `smartMentorEngine` v2.*
*כל שינוי בחוזה ה-JSON דורש עדכון של הפרומפט, ה-edge function והלקוח.*
