import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { supabase } from '@/api/supabaseClient';

// Profession Question (Free Text)
const PROFESSION_QUESTION = {
  id: 'profession_description',
  question: "מה העסק שלך?",
  subtext: "ספר לנו מה אתה עושה (לדוגמה: זמר, עורך דין, מאמן כושר, חנות איקומרס...)",
  type: 'text',
  placeholder: "רשום כאן את תחום העיסוק..."
};

// Base Question
const BASE_QUESTION = {
  id: 'current_status',
  question: "איפה אתה נמצא היום ביחס לעסק?",
  subtext: "בחר את מה שהכי קרוב למצב שלך",
  options: [
    { id: 'idea', label: "אני עדיין בשלב הרעיון / חושב לפתוח עסק" },
    { id: 'new', label: "פתחתי עסק לאחרונה" },
    { id: 'active', label: "העסק כבר פעיל ויש הכנסות" },
    { id: 'stable', label: "העסק עובד באופן יציב" },
    { id: 'scaling', label: "העסק רץ הרבה זמן ואני מחפש לייעל / לגדול" }
  ]
};

// Flows Configuration
const FLOWS = {
  // Path 1: Idea
  idea: [
    {
      id: 'field',
      question: "באיזה תחום אתה חושב לפתוח את העסק?",
      subtext: "מה הכיוון הכללי?",
      options: [
        { id: 'service', label: "מתן שירות (ייעוץ, טיפול, עיצוב וכו')" },
        { id: 'product', label: "מכירת מוצרים פיזיים" },
        { id: 'digital', label: "מוצרים דיגיטליים / קורסים" },
        { id: 'tech', label: "סטארטאפ / טכנולוגיה" },
        { id: 'unsure', label: "עדיין לא סגור על זה" }
      ]
    },
    {
      id: 'blocker',
      question: "מה מונע ממך להתחיל כרגע?",
      subtext: "מה החסם העיקרי?",
      options: [
        { id: 'fear', label: "חשש מכישלון / חוסר ביטחון" },
        { id: 'money', label: "חוסר בתקציב להקמה" },
        { id: 'knowledge', label: "לא יודע איך מתחילים (בירוקרטיה/שיווק)" },
        { id: 'time', label: "אין לי מספיק זמן פנוי" },
        { id: 'other', label: "משהו אחר...", hasTextInput: true }
      ]
    },
    {
      id: 'commitment',
      question: "כמה זמן אתה מוכן להשקיע בזה?",
      options: [
        { id: 'full_time', label: "מוכן להתאבד על זה (משרה מלאה)" },
        { id: 'side_hustle', label: "במקביל לעבודה אחרת (שעות ערב/בוקר)" },
        { id: 'weekends', label: "רק בסופ״שים כרגע" },
        { id: 'low', label: "רוצה הכנסה פסיבית במינימום מאמץ" }
      ]
    },
    {
      id: 'skill_level',
      question: "האם יש לך כבר ידע מקצועי בתחום?",
      options: [
        { id: 'pro', label: "כן, אני מקצוען בתחום" },
        { id: 'student', label: "למדתי את זה אבל אין לי ניסיון" },
        { id: 'beginner', label: "רק התחלתי ללמוד" },
        { id: 'none', label: "לא, אני בונה על ללמוד תוך כדי תנועה" }
      ]
    }
  ],

  // Path 2: New Business
  new: [
    {
      id: 'bureaucracy_status',
      question: "האם כבר נרשמת ברשויות?",
      subtext: "מס הכנסה, מע״מ, ביטוח לאומי",
      options: [
        { id: 'fully', label: "כן, הכל מסודר ורשום" },
        { id: 'partially', label: "פתחתי חלקית / בתהליך" },
        { id: 'not_yet', label: "עדיין לא, אני בדיוק שם" },
        { id: 'exempt', label: "אני עוסק פטור" }
      ]
    },
    {
      id: 'first_clients',
      question: "האם כבר היו לך לקוחות ראשונים?",
      options: [
        { id: 'paying', label: "כן, כבר קיבלתי תשלום מלקוחות" },
        { id: 'free', label: "נתתי שירות בחינם/לחברים בלבד" },
        { id: 'prospects', label: "יש מתעניינים אבל עוד לא סגרו" },
        { id: 'none', label: "עדיין לא" }
      ]
    },
    {
      id: 'marketing_method',
      question: "איך אנשים שומעים עליך כרגע?",
      options: [
        { id: 'word_mouth', label: "פה לאוזן / חברים" },
        { id: 'social', label: "רשתות חברתיות (אורגני)" },
        { id: 'ads', label: "קמפיינים ממומנים" },
        { id: 'cold_outreach', label: "פניות יזומות שלי" },
        { id: 'none', label: "עדיין לא התחלתי לשווק" }
      ]
    },
    {
      id: 'biggest_challenge_new',
      question: "מה האתגר הכי גדול שלך כרגע?",
      options: [
        { id: 'leads', label: "להשיג לידים (פניות)" },
        { id: 'sales', label: "לסגור עסקאות (מכירות)" },
        { id: 'price', label: "לתמחר נכון את השירות" },
        { id: 'confidence', label: "ביטחון עצמי מול לקוח" }
      ]
    }
  ],

  // Path 3: Active & Revenue
  active: [
    {
      id: 'revenue_range',
      question: "מה מחזור ההכנסות החודשי הממוצע?",
      options: [
        { id: 'micro', label: "עד 5,000 ₪" },
        { id: 'small', label: "בין 5,000 ל-15,000 ₪" },
        { id: 'medium', label: "בין 15,000 ל-30,000 ₪" },
        { id: 'high', label: "מעל 30,000 ₪" }
      ]
    },
    {
      id: 'lead_source_active',
      question: "מאיפה מגיעים רוב הלקוחות שלך?",
      options: [
        { id: 'referrals', label: "המלצות ופה לאוזן (עיקרי)" },
        { id: 'social_content', label: "תוכן ברשתות חברתיות" },
        { id: 'paid_ads', label: "פרסום ממומן" },
        { id: 'partners', label: "שיתופי פעולה" }
      ]
    },
    {
      id: 'process_status',
      question: "האם יש לך תהליך עבודה מסודר?",
      subtext: "מרגע הליד ועד סיום השירות",
      options: [
        { id: 'organized', label: "כן, הכל ברור וכתוב" },
        { id: 'semi', label: "בערך, יש תבנית קבועה בראש" },
        { id: 'chaos', label: "לא ממש, כל לקוח זה משהו אחר" },
        { id: 'messy', label: "בלאגן שלם" }
      ]
    },
    {
      id: 'missing_piece',
      question: "מה חסר לך כדי להגיע לשלב הבא?",
      options: [
        { id: 'more_leads', label: "יותר פניות של לקוחות רלוונטיים" },
        { id: 'better_sales', label: "אחוזי סגירה גבוהים יותר" },
        { id: 'time_mgmt', label: "ניהול זמן טוב יותר (אני קורס)" },
        { id: 'team', label: "עזרה / עובדים" },
        { id: 'other', label: "משהו אחר...", hasTextInput: true }
      ]
    }
  ],

  // Path 4: Stable
  stable: [
    {
      id: 'team_structure',
      question: "איך בנוי הצוות שלך?",
      options: [
        { id: 'solo', label: "אני עובד/ת לבד (One Man Show)" },
        { id: 'freelancers', label: "נעזר בפרילנסרים לפי צורך" },
        { id: 'employees', label: "יש לי עובדים שכירים" },
        { id: 'partner', label: "יש לי שותף/ה" }
      ]
    },
    {
      id: 'ceiling',
      question: "האם אתה מרגיש שאתה בתקרת זכוכית?",
      options: [
        { id: 'time_cap', label: "כן, אין לי יותר זמן לקבל לקוחות" },
        { id: 'income_cap', label: "כן, ההכנסה תקועה על סכום קבוע" },
        { id: 'energy_cap', label: "כן, אני שחוק/ה" },
        { id: 'no', label: "לא, אני מרגיש בצמיחה מתמדת" }
      ]
    },
    {
      id: 'finance_mgmt',
      question: "איך נראה הניהול הפיננסי שלך?",
      options: [
        { id: 'tight', label: "שליטה מלאה, תזרים, צפי" },
        { id: 'accountant', label: "סומך בעיקר על רואה החשבון" },
        { id: 'basic', label: "בודק פעם בחודש מה נכנס/יצא" },
        { id: 'loose', label: "לא ממש עוקב" }
      ]
    },
    {
      id: 'next_year_goal',
      question: "מה המטרה העיקרית לשנה הקרובה?",
      options: [
        { id: 'profit', label: "להגדיל את הרווח הנקי" },
        { id: 'less_work', label: "להוריד שעות עבודה (לשמור על הכנסה)" },
        { id: 'new_products', label: "לפתח מוצרים/שירותים חדשים" },
        { id: 'exit', label: "להכין את העסק למכירה/פרישה" }
      ]
    }
  ],

  // Path 5: Scaling
  scaling: [
    {
      id: 'bottleneck',
      question: "מה צוואר הבקבוק העיקרי בצמיחה?",
      options: [
        { id: 'me', label: "אני (הכל עובר דרכי)" },
        { id: 'ops', label: "התפעול לא עומד בעומס" },
        { id: 'marketing', label: "השיווק לא מביא מספיק לידים" },
        { id: 'cashflow', label: "תזרים מזומנים להשקעה" },
        { id: 'other', label: "משהו אחר...", hasTextInput: true }
      ]
    },
    {
      id: 'sops',
      question: "האם יש לך נהלי עבודה כתובים (SOPs)?",
      options: [
        { id: 'yes_all', label: "כן, לכל תפקיד ומשימה" },
        { id: 'some', label: "לחלק מהדברים המרכזיים" },
        { id: 'mental', label: "הכל בראש שלי / של העובדים" },
        { id: 'none', label: "אין נהלים, כל אחד מאלתר" }
      ]
    },
    {
      id: 'involvement',
      question: "כמה אתה מעורב ביום-יום של התפעול?",
      options: [
        { id: 'micromanage', label: "מעורב בכל פרט קטן" },
        { id: 'high_level', label: "מנהל מלמעלה, מתערב בבעיות" },
        { id: 'strategy', label: "מתעסק רק בפיתוח עסקי ואסטרטגיה" },
        { id: 'passive', label: "כמעט ולא נמצא בעסק" }
      ]
    },
    {
      id: 'vision',
      question: "לאן אתה רוצה לקחת את העסק?",
      options: [
        { id: 'franchise', label: "רשת / סניפים / זכיינות" },
        { id: 'market_leader', label: "להיות אוטוריטה מספר 1 בתחום" },
        { id: 'sell', label: "אקזיט (מכירה)" },
        { id: 'cash_machine', label: "מכונת מזומנים אוטומטית" }
      ]
    }
  ]
};

export default function BusinessJourneyQuestionnaire({ onComplete, userId }) {
  const [questionsList, setQuestionsList] = useState([BASE_QUESTION]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textInput, setTextInput] = useState("");

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    
    const currentQ = questionsList[currentStep];
    const currentAnswer = answers[currentQ.id];
    
    // If answer is "other", append the text input to it
    const finalAnswer = currentAnswer === 'other' ? `other: ${textInput}` : textInput;
    const newAnswers = { ...answers, [currentQ.id]: finalAnswer };
    setAnswers(newAnswers);
    
    if (currentStep < questionsList.length - 1) {
      setCurrentStep(prev => prev + 1);
      setTextInput("");
    } else {
      handleSubmit(newAnswers);
    }
  };

  const handleSelect = (optionId) => {
    const currentQ = questionsList[currentStep];
    const selectedOption = currentQ.options?.find(opt => opt.id === optionId);

    // If option has text input, show input field instead of advancing
    if (selectedOption?.hasTextInput) {
      setAnswers({ ...answers, [currentQ.id]: optionId });
      return;
    }

    const newAnswers = { ...answers, [currentQ.id]: optionId };
    setAnswers(newAnswers);

    // If this is the first question, determine the flow
    if (currentStep === 0 && currentQ.id === 'current_status') {
      const selectedFlow = FLOWS[optionId];
      if (selectedFlow) {
        // Add the profession question at the end of every flow
        setQuestionsList([BASE_QUESTION, ...selectedFlow, PROFESSION_QUESTION]);
      }
    }

    // Auto advance after short delay for better UX
    if (currentStep < questionsList.length - 1 || (currentStep === 0 && FLOWS[optionId])) {
       setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 250);
    } else {
      // Last question - submit
      handleSubmit(newAnswers);
    }
  };

  const handleSubmit = async (finalAnswers) => {
    setIsSubmitting(true);
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('No auth session');
      }

      // Direct fetch to edge function (bypass supabase.functions.invoke)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase configuration missing');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/analyzeBusinessJourney`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ answers: finalAnswers }),
      });

      const responseData = await response.json().catch(() => null);
      console.log('analyzeBusinessJourney response:', response.status, responseData);

      if (!response.ok) {
        throw new Error(responseData?.error || `Server error ${response.status}`);
      }

      onComplete();
    } catch (error) {
      console.error("Error saving answers:", error);
      setIsSubmitting(false);
      toast.error("אירעה שגיאה בשמירת הנתונים. אנא נסה שוב.");
    }
  };

  const currentQuestion = questionsList[currentStep];
  // Calculate progress based on the *potential* total length
  // If we are at step 0, total is unknown roughly, but we can assume generic length or just show 1/X
  // Let's assume standard flow length is about 5 questions (1 base + 4 flow)
  const totalSteps = questionsList.length > 1 ? questionsList.length : 5; 
  const progress = ((currentStep + 1) / totalSteps) * 100;



  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[500px]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-blue-600 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">בונה לך את התיק העסקי...</h2>
          <p className="text-gray-500">אנחנו מנתחים את התשובות שלך ומתאימים את המערכת</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6" dir="rtl">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>שאלה {currentStep + 1} מתוך {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
              {currentQuestion.question}
            </h2>
            {currentQuestion.subtext && (
              <p className="text-gray-500">{currentQuestion.subtext}</p>
            )}
          </div>

          <div className="space-y-3">
            {currentQuestion.type === 'text' ? (
              <div className="space-y-4">
                <Input
                  autoFocus
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={currentQuestion.placeholder}
                  className="text-lg p-6 h-14"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTextSubmit();
                    }
                  }}
                />
                <Button 
                  onClick={handleTextSubmit} 
                  disabled={!textInput.trim()}
                  className="w-full h-12 text-lg"
                >
                  המשך
                  <ArrowLeft className="w-4 h-4 mr-2" />
                </Button>
              </div>
            ) : (
              <>
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 text-right transition-all duration-200 flex items-center justify-between group",
                      answers[currentQuestion.id] === option.id
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-gray-100 bg-white hover:border-blue-200 hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <span className="font-medium text-lg">{option.label}</span>
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                      answers[currentQuestion.id] === option.id
                        ? "border-blue-600 bg-blue-600"
                        : "border-gray-300 group-hover:border-blue-300"
                    )}>
                      {answers[currentQuestion.id] === option.id && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                  </button>
                ))}

                {/* Text Input for "Other" Option */}
                {answers[currentQuestion.id] === 'other' && 
                 currentQuestion.options.some(opt => opt.id === 'other' && opt.hasTextInput) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 space-y-4 pt-4 border-t border-gray-200"
                  >
                    <p className="text-sm text-gray-600 font-medium">ספר לנו קצת יותר:</p>
                    <Input
                      autoFocus
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="כתוב כאן..."
                      className="text-lg p-6 h-14"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTextSubmit();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleTextSubmit} 
                      disabled={!textInput.trim()}
                      className="w-full h-12 text-lg"
                    >
                      המשך
                      <ArrowLeft className="w-4 h-4 mr-2" />
                    </Button>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="mt-8 flex justify-between">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(prev => prev - 1)}
          disabled={currentStep === 0 || isSubmitting}
          className={cn("text-gray-400 hover:text-gray-600", (currentStep === 0 || isSubmitting) && "opacity-0 pointer-events-none")}
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          חזור
        </Button>
      </div>
    </div>
  );
}