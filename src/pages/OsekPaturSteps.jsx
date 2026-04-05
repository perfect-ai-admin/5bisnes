import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { HelmetProvider } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, CheckCircle2, Phone, Clock,
  Shield, FileCheck, Headphones, Zap,
  Users, AlertTriangle, ChevronDown, ChevronUp,
  Star, BadgeCheck, HandCoins, ClipboardCheck,
  CreditCard, Building2, FileText, UserCheck,
  BookOpen, AlertCircle
} from 'lucide-react';
import { submitPortalLead } from '@/api/portalSupabaseClient';
import { PORTAL_CTA } from '@/portal/config/navigation';

// ============================
// Lead Form Component
// ============================
function StepsLeadForm({
  id,
  variant = 'default',
  title,
  subtitle,
  ctaText = 'קבלו ליווי לפתיחת עוסק פטור',
  className = '',
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const trackEvent = (eventName, data = {}) => {
    if (window.dataLayer) {
      window.dataLayer.push({ event: eventName, ...data });
    }
    if (window.fbq) {
      window.fbq('track', eventName === 'lead_submitted' ? 'Lead' : 'CustomEvent', {
        content_name: 'osek_patur_steps',
        ...data,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('נא למלא שם וטלפון');
      return;
    }

    const phoneClean = form.phone.replace(/[-\s]/g, '');
    if (!/^0\d{8,9}$/.test(phoneClean)) {
      setError('מספר טלפון לא תקין');
      return;
    }

    setLoading(true);
    setError('');
    trackEvent('form_start', { form_location: variant });

    try {
      const params = new URLSearchParams(window.location.search);

      await submitPortalLead({
        name: form.name,
        phone: form.phone,
        profession: 'osek_patur',
        source: 'sales_portal',
        source_page: `steps-osek-patur-${variant}`,
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_term: params.get('utm_term') || '',
        utm_content: params.get('utm_content') || '',
        referrer: document.referrer || '',
      });

      // Redirect to ThankYou — conversion tracking fires there
      navigate('/ThankYou', { state: { source: `steps-osek-patur-${variant}`, name: form.name } });
    } catch (err) {
      setError('שגיאה בשליחה, נסו שוב או התקשרו אלינו');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id={id} className={className}>
      {title && (
        <h3 className="font-bold text-center mb-1 text-xl text-portal-navy">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-center mb-4 text-sm text-gray-500">
          {subtitle}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="שם מלא"
          required
          className="h-[52px] rounded-xl text-base border-gray-200 bg-white focus:border-portal-teal focus:ring-portal-teal text-right"
        />
        <Input
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="טלפון נייד"
          type="tel"
          required
          dir="ltr"
          className="h-[52px] rounded-xl text-base border-gray-200 bg-white focus:border-portal-teal focus:ring-portal-teal text-right"
        />

        {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl text-lg font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          style={{ height: '56px', backgroundColor: '#F59E0B', color: '#1E3A5F', fontSize: '18px' }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Phone className="ml-2 h-5 w-5" />
              {ctaText}
            </>
          )}
        </Button>
      </form>

      <p className="text-xs text-center mt-2 text-gray-400">
        ללא התחייבות · המידע שלך מאובטח · נחזור אליך בהקדם
      </p>
    </div>
  );
}

// ============================
// Inline CTA (mini)
// ============================
function InlineCTA({ text, buttonText = 'השאירו פרטים', targetId = 'hero-lead-form' }) {
  const scroll = () => {
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-portal-teal/5 border border-portal-teal/20 rounded-2xl p-5 sm:p-6 text-center my-8">
      <p className="text-lg font-semibold text-portal-navy mb-3">{text}</p>
      <button
        onClick={scroll}
        className="inline-flex items-center gap-2 font-bold text-white px-6 py-3 rounded-xl transition-all hover:scale-[1.02]"
        style={{ backgroundColor: '#0F766E' }}
      >
        <Phone className="w-4 h-4" />
        {buttonText}
      </button>
    </div>
  );
}

// ============================
// FAQ Accordion
// ============================
function FAQItem({ question, answer, isOpen, onClick }) {
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between py-5 px-1 text-right hover:bg-gray-50/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-lg font-semibold text-portal-navy pr-0 pl-4">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-portal-teal flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pb-5 px-1 text-gray-600 leading-relaxed text-base">
          {answer}
        </div>
      )}
    </div>
  );
}

// ============================
// Sticky Mobile CTA
// ============================
function StickyMobileCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 600);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToForm = () => {
    const form = document.getElementById('hero-lead-form');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-white/95 backdrop-blur-lg border-t border-gray-200 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <a
            href={`tel:${PORTAL_CTA.phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 h-12 bg-portal-teal hover:bg-portal-teal-dark text-white rounded-xl font-bold text-sm transition-colors"
          >
            <Phone className="w-4 h-4" />
            התקשרו עכשיו
          </a>
          <button
            onClick={scrollToForm}
            className="flex-[1.3] flex items-center justify-center gap-1.5 h-12 font-bold text-sm transition-all rounded-xl"
            style={{ backgroundColor: '#F59E0B', color: '#1E3A5F' }}
          >
            <ClipboardCheck className="w-4 h-4" />
            השאירו פרטים
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================
// Schema Markup
// ============================
function StepsSchemaMarkup({ faqItems }) {
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'איך פותחים עוסק פטור – המדריך המלא לפתיחת עוסק פטור בישראל',
    description: 'רוצים לפתוח עוסק פטור? במדריך הזה תגלו איך פותחים עוסק פטור בישראל, מהם השלבים ומה צריך להכין.',
    datePublished: '2026-03-28',
    dateModified: '2026-03-28',
    author: { '@type': 'Organization', name: 'פרפקט וואן', url: 'https://perfect1.co.il' },
    publisher: { '@type': 'Organization', name: 'פרפקט וואן', url: 'https://perfect1.co.il' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://perfect1.co.il/OsekPaturSteps' },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'פרפקט וואן', item: 'https://perfect1.co.il' },
      { '@type': 'ListItem', position: 2, name: 'עוסק פטור', item: 'https://perfect1.co.il/osek-patur' },
      { '@type': 'ListItem', position: 3, name: 'איך פותחים עוסק פטור', item: 'https://perfect1.co.il/OsekPaturSteps' },
    ],
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'איך פותחים עוסק פטור בישראל',
    description: 'שלבים לפתיחת עוסק פטור בישראל — פתיחת תיק במע"מ, מס הכנסה וביטוח לאומי.',
    step: [
      { '@type': 'HowToStep', position: 1, name: 'פתיחת תיק במע"מ', text: 'פונים למשרד מע"מ האזורי או באתר רשות המסים, ממלאים טופס 821 ומגישים עם תעודת זהות ואסמכתא על כתובת.' },
      { '@type': 'HowToStep', position: 2, name: 'פתיחת תיק במס הכנסה', text: 'פונים לפקיד שומה באזור המגורים, ממלאים טופס 5329 ומצרפים אישור פתיחת תיק מע"מ.' },
      { '@type': 'HowToStep', position: 3, name: 'פתיחת תיק בביטוח לאומי', text: 'נרשמים כעצמאי באתר ביטוח לאומי או בסניף, ומתחילים לשלם דמי ביטוח לאומי ודמי בריאות.' },
    ],
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
    </Helmet>
  );
}

// ============================
// FAQ Data
// ============================
const FAQ_ITEMS = [
  {
    question: 'איך פותחים עוסק פטור?',
    answer: 'פותחים עוסק פטור בשלושה שלבים: פתיחת תיק במע"מ, פתיחת תיק במס הכנסה, ופתיחת תיק בביטוח לאומי. התהליך כולל מילוי טפסים, הגשת מסמכים ובחירת סיווג עיסוק מתאים. עם ליווי מקצועי, אפשר לעשות את זה מהר ובלי טעויות.',
  },
  {
    question: 'כמה עולה לפתוח עוסק פטור?',
    answer: 'פתיחת התיקים ברשויות היא ללא עלות. העלות העיקרית היא של ליווי מקצועי או רואה חשבון, שיכולה לנוע בין מאות בודדות לכמה אלפי שקלים, תלוי בהיקף השירות. השאירו פרטים ונתאים לכם הצעה.',
  },
  {
    question: 'כמה זמן לוקח לפתוח עוסק פטור?',
    answer: 'התהליך יכול לקחת בין מספר ימים לשבועות, תלוי במהירות ההגשה ובזמינות המשרדים. עם ליווי מקצועי, התהליך מתקצר משמעותית כי נמנעים מטעויות ומביורוקרטיה מיותרת.',
  },
  {
    question: 'האם חייבים רואה חשבון לעוסק פטור?',
    answer: 'מבחינה חוקית — לא חייבים. עוסק פטור פטור מהנהלת חשבונות כפולה. אבל רואה חשבון או ליווי מקצועי עוזר להימנע מטעויות, לוודא שהדיווחים נכונים, ולחסוך כסף במס באמצעות תכנון נכון.',
  },
  {
    question: 'מה ההבדל בין עוסק פטור לעוסק מורשה?',
    answer: 'עוסק פטור פטור מגביית מע"מ ומדיווחים מורכבים, אבל מוגבל בתקרת הכנסות (כ-120,000 ₪ בשנה נכון ל-2026). עוסק מורשה גובה מע"מ, יכול לקזז מע"מ על הוצאות, ואין מגבלת הכנסות. לא בטוחים מה מתאים? השאירו פרטים ונבדוק יחד.',
  },
  {
    question: 'האם אפשר לפתוח עוסק פטור גם אם אני שכיר?',
    answer: 'בהחלט. הרבה שכירים פותחים עוסק פטור במקביל לעבודה שלהם כדי לקבל הכנסות צדדיות באופן חוקי. חשוב להבין את ההשלכות על המיסוי ועל ביטוח לאומי — וזה בדיוק מה שאנחנו עוזרים בו.',
  },
  {
    question: 'מה קורה אם עוברים את תקרת ההכנסות?',
    answer: 'אם ההכנסות עוברות את התקרה, חובה לעבור למעמד עוסק מורשה. המעבר כולל רישום מחדש במע"מ והתחלת גביית מע"מ מלקוחות. עם ליווי מקצועי, המעבר פשוט ומסודר.',
  },
];

// ============================
// Main Page
// ============================
export default function OsekPaturSteps() {
  const [openFAQ, setOpenFAQ] = useState(null);

  // Scroll depth tracking
  useEffect(() => {
    let tracked = {};
    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      [25, 50, 75, 100].forEach((threshold) => {
        if (scrollPercent >= threshold && !tracked[threshold]) {
          tracked[threshold] = true;
          if (window.dataLayer) {
            window.dataLayer.push({ event: 'scroll_depth', scroll_percent: threshold, page: 'osek_patur_steps' });
          }
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <HelmetProvider>
      <div dir="rtl" className="portal-root min-h-screen" style={{ fontFamily: "'Heebo', sans-serif" }}>
        {/* SEO Head */}
        <Helmet>
          <title>איך פותחים עוסק פטור – המדריך המלא לפתיחת עוסק פטור בישראל</title>
          <meta name="description" content="רוצים לפתוח עוסק פטור? במדריך הזה תגלו איך פותחים עוסק פטור בישראל, מהם השלבים ומה צריך להכין. קבלו ליווי מקצועי בתהליך." />
          <meta name="keywords" content="איך פותחים עוסק פטור, שלבים לפתיחת עוסק פטור, איך לפתוח עוסק פטור, פתיחת עוסק פטור מדריך, איך לפתוח עוסק פטור בישראל, פתיחת עוסק פטור, עוסק פטור שלבים" />
          <link rel="canonical" href="https://www.perfect1.co.il/OsekPaturSteps" />
          <meta property="og:title" content="איך פותחים עוסק פטור – המדריך המלא + ליווי מקצועי בתהליך" />
          <meta property="og:description" content="המדריך המלא לפתיחת עוסק פטור בישראל: שלבים, מסמכים, טיפים ואפשרות לליווי מקצועי שחוסך זמן וטעויות." />
          <meta property="og:type" content="article" />
          <meta property="og:url" content="https://www.perfect1.co.il/OsekPaturSteps" />
          <meta property="og:image" content="https://www.perfect1.co.il/og-image.png" />
          <meta property="og:locale" content="he_IL" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="robots" content="index, follow" />
        </Helmet>

        <StepsSchemaMarkup faqItems={FAQ_ITEMS} />

        {/* ===== HEADER ===== */}
        <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-portal-navy">פרפקט וואן</span>
              <span className="text-xs text-gray-400 hidden sm:inline">| ליווי עסקי מקצועי</span>
            </a>
            <a
              href={`tel:${PORTAL_CTA.phone}`}
              className="flex items-center gap-2 text-portal-teal font-bold text-sm hover:underline"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">{PORTAL_CTA.phone}</span>
              <span className="sm:hidden">התקשרו</span>
            </a>
          </div>
        </header>

        {/* ===== 1. HERO SECTION ===== */}
        <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #152D4A 50%, #0F766E 100%)' }}>
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, white 2%, transparent 2%), radial-gradient(circle at 75% 75%, white 1.5%, transparent 1.5%)',
              backgroundSize: '60px 60px',
            }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 py-4 sm:py-6 md:py-16">
            <div className="grid md:grid-cols-2 gap-3 md:gap-12 items-start">
              {/* Content */}
              <div className="order-1">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 mb-2 md:mb-5">
                  <BookOpen className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-white/90 text-xs md:text-sm font-medium">המדריך המלא</span>
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white leading-tight mb-2 md:mb-5">
                  איך פותחים עוסק פטור
                  <br />
                  <span className="text-xl sm:text-2xl md:text-4xl" style={{ color: '#F59E0B' }}>בישראל?</span>
                </h1>

                {/* Mobile: Form right after hero text */}
                <div className="md:hidden mb-3">
                  <div className="bg-white rounded-2xl shadow-xl p-5">
                    <StepsLeadForm
                      id="hero-lead-form-mobile"
                      variant="hero"
                      title="בדקו איך לפתוח עוסק פטור"
                      subtitle="בדיקה חינם"
                      ctaText="קבלו ליווי עכשיו"
                    />
                  </div>
                </div>

                {/* Desktop: Social proof */}
                <div className="hidden md:flex items-center gap-3 text-white/60 text-sm mb-6">
                  <div className="flex -space-x-2 space-x-reverse">
                    {['י', 'ד', 'ש', 'מ'].map((letter, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-xs font-bold">
                        {letter}
                      </div>
                    ))}
                  </div>
                  <span>+5,000 עצמאים קיבלו ליווי מאיתנו</span>
                </div>
              </div>

              {/* Form - Desktop only */}
              <div className="hidden md:block order-2">
                <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md mx-auto md:mx-0">
                  <StepsLeadForm
                    id="hero-lead-form"
                    variant="hero"
                    title="בדקו איך לפתוח עוסק פטור"
                    subtitle="בדיקה חינם + הכוונה אישית"
                    ctaText="קבלו ליווי עכשיו"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 2. מה זה עוסק פטור ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy mb-4">
              מה זה עוסק פטור?
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              עוסק פטור הוא עסק קטן שמחזור ההכנסות השנתי שלו נמוך מהתקרה שנקבעה על ידי המדינה (כ-120,000 ₪ נכון ל-2026). עוסק פטור <strong>לא גובה מע"מ</strong> מלקוחות, ולכן מתאים במיוחד למי שמתחיל לעבוד כעצמאי.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              המעמד הזה מתאים לפרילנסרים, נותני שירותים, מורים פרטיים, מעצבים, צלמים, יועצים ועוד — בעיקר למי שרוצה להתחיל לעבוד עצמאי בצורה פשוטה וחוקית.
            </p>

            <InlineCTA
              text="רוצים לבדוק אם עוסק פטור מתאים לכם?"
              buttonText="השאירו פרטים ונחזור אליכם"
            />
          </div>
        </section>

        {/* ===== 3. שלבים לפתיחת עוסק פטור ===== */}
        <section className="py-12 md:py-16" style={{ backgroundColor: '#F8F9FA' }}>
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-3">
              שלבים לפתיחת עוסק פטור בישראל
            </h2>
            <p className="text-gray-500 text-center mb-10 text-lg">
              התהליך כולל שלושה שלבים עיקריים:
            </p>

            <div className="space-y-4 md:space-y-6">
              {[
                {
                  num: '1',
                  title: 'פתיחת תיק במע"מ',
                  desc: 'פונים למשרד מע"מ האזורי או מגישים באתר רשות המסים. ממלאים טופס 821, מצרפים תעודת זהות ואסמכתא על כתובת העסק. בשלב הזה בוחרים את סיווג העיסוק — וזה אחד הדברים שהכי חשוב לעשות נכון.',
                  icon: Building2,
                  color: 'bg-portal-teal',
                },
                {
                  num: '2',
                  title: 'פתיחת תיק במס הכנסה',
                  desc: 'פונים לפקיד שומה באזור המגורים שלכם. ממלאים טופס 5329 ומצרפים את אישור פתיחת התיק במע"מ. כאן קובעים את גובה המקדמות ואת אופן הדיווח השנתי.',
                  icon: FileText,
                  color: 'bg-portal-navy',
                },
                {
                  num: '3',
                  title: 'פתיחת תיק בביטוח לאומי',
                  desc: 'נרשמים כעצמאי באתר ביטוח לאומי או בסניף. מתחילים לשלם דמי ביטוח לאומי ודמי בריאות. גובה התשלום תלוי בגובה ההכנסה — ובשנה הראשונה יש הנחות.',
                  icon: Shield,
                  color: 'bg-amber-500',
                },
              ].map((step, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 flex gap-4 sm:gap-5 items-start">
                  <div className={`w-12 h-12 ${step.color} rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0`}>
                    {step.num}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <step.icon className="w-5 h-5 text-portal-teal" />
                      <h3 className="font-bold text-lg text-portal-navy">{step.title}</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Warning about mistakes */}
            <div className="mt-10 bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-800 text-lg mb-2">למרות שזה נשמע פשוט...</h3>
                  <p className="text-amber-700 mb-3">הרבה אנשים מסתבכים עם:</p>
                  <ul className="space-y-2">
                    {[
                      'טעויות בטפסים שגורמות לעיכובים',
                      'בחירת סיווג עיסוק לא מתאים',
                      'אי הבנה של חובות דיווח ותשלום',
                      'פתיחת תיקים בסדר הלא נכון',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-amber-700">
                        <AlertTriangle className="w-4 h-4 mt-1 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <InlineCTA
              text="רוצים לפתוח נכון מההתחלה?"
              buttonText="השאירו פרטים ונעזור לכם"
            />
          </div>
        </section>

        {/* ===== 4. מה צריך להכין ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy mb-6">
              מה צריך להכין לפתיחת עוסק פטור?
            </h2>

            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: UserCheck, text: 'תעודת זהות (או דרכון לתושבי חוץ)' },
                { icon: CreditCard, text: 'פרטי חשבון בנק' },
                { icon: FileText, text: 'תיאור הפעילות העסקית שלכם' },
                { icon: Building2, text: 'כתובת העסק (יכולה להיות הבית)' },
                { icon: ClipboardCheck, text: 'טפסים לרשויות (821, 5329)' },
                { icon: BookOpen, text: 'מידע על הכנסות צפויות' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-10 h-10 bg-portal-teal/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-portal-teal" />
                  </div>
                  <span className="text-gray-700 font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            <InlineCTA
              text="לא בטוחים מה צריך? אנחנו נסביר הכל"
              buttonText="השאירו פרטים"
            />
          </div>
        </section>

        {/* ===== 5. כמה זמן לוקח ===== */}
        <section className="py-12 md:py-16" style={{ backgroundColor: '#F0FDFA' }}>
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy mb-4">
              כמה זמן לוקח לפתוח עוסק פטור?
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              התהליך יכול לקחת <strong>בין מספר ימים לשבועות</strong>, תלוי בהגשה נכונה של המסמכים ובזמינות המשרדים הרלוונטיים.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              חלק מהתהליך ניתן לבצע אונליין, אבל ייתכן שתצטרכו להגיע פיזית למשרדי מע"מ או מס הכנסה. עם ליווי מקצועי, התהליך מתקצר משמעותית כי <strong>נמנעים מטעויות וחזרות מיותרות</strong>.
            </p>

            <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-8">
              {[
                { label: 'לבד', time: '2-4 שבועות', color: 'bg-red-50 border-red-200 text-red-700' },
                { label: 'עם רו"ח', time: '1-2 שבועות', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                { label: 'עם ליווי שלנו', time: 'מהיר ויעיל', color: 'bg-green-50 border-green-200 text-green-700' },
              ].map((item, i) => (
                <div key={i} className={`text-center p-4 rounded-xl border-2 ${item.color}`}>
                  <div className="font-bold text-sm mb-1">{item.label}</div>
                  <div className="text-lg font-extrabold">{item.time}</div>
                </div>
              ))}
            </div>

            <InlineCTA
              text="רוצים לפתוח מהר ובלי טעויות?"
              buttonText="בדקו עכשיו"
            />
          </div>
        </section>

        {/* ===== 6. למה לא כדאי לפתוח לבד ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-3">
              האם כדאי לפתוח עוסק פטור לבד?
            </h2>
            <p className="text-gray-500 text-center mb-10 text-lg max-w-2xl mx-auto">
              אפשר — אבל הנה מה שקורה לרוב האנשים שמנסים:
            </p>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* לבד */}
              <div className="rounded-2xl border-2 border-red-200 bg-red-50/30 p-6">
                <h3 className="font-bold text-red-600 text-lg mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  לפתוח לבד
                </h3>
                <ul className="space-y-3">
                  {[
                    'רישום פעילות לא נכון שמוביל לבעיות',
                    'חוסר הבנה של חובות דיווח ותשלום',
                    'פתיחת תיקים בסדר לא נכון',
                    'ביקורים מיותרים במשרדים',
                    'עיכובים של שבועות בגלל טעויות',
                    'חשש ואי ודאות לאורך כל הדרך',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-red-700">
                      <span className="text-red-400 mt-0.5">✗</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* עם ליווי */}
              <div className="rounded-2xl border-2 border-green-200 bg-green-50/30 p-6">
                <h3 className="font-bold text-green-700 text-lg mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  עם ליווי מקצועי
                </h3>
                <ul className="space-y-3">
                  {[
                    'סיווג מדויק מההתחלה',
                    'הכוונה ברורה לכל שלב',
                    'חיסכון בזמן ובביקורים',
                    'מענה מהיר לכל שאלה',
                    'הכל מסודר ונכון מהפעם הראשונה',
                    'שקט נפשי ובטחון שעשיתם נכון',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-green-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <InlineCTA
              text="בדיקה קצרה יכולה לחסוך הרבה כאב ראש"
              buttonText="השאירו פרטים"
            />
          </div>
        </section>

        {/* ===== 7. יתרונות השירות ===== */}
        <section className="py-12 md:py-16" style={{ backgroundColor: '#F8F9FA' }}>
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-10">
              למה לבחור בליווי של פרפקט וואן?
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Headphones, title: 'ליווי מקצועי', desc: 'מומחים שמכירים כל פרט בתהליך' },
                { icon: ClipboardCheck, title: 'תהליך ברור', desc: 'שלב אחרי שלב, בלי הפתעות' },
                { icon: Clock, title: 'חיסכון בזמן', desc: 'פתיחה מהירה בלי ביורוקרטיה' },
                { icon: Zap, title: 'מענה מהיר', desc: 'חוזרים אליכם בהקדם' },
                { icon: Shield, title: 'בלי טעויות', desc: 'עושים הכל נכון מההתחלה' },
                { icon: HandCoins, title: 'שקיפות מלאה', desc: 'בלי עלויות נסתרות' },
                { icon: Users, title: 'ניסיון מוכח', desc: 'אלפי לקוחות מרוצים' },
                { icon: Star, title: '5 כוכבים', desc: 'שביעות רצון גבוהה מאוד' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 md:p-5 rounded-2xl bg-white shadow-sm border border-gray-100 hover:border-portal-teal/20 transition-colors">
                  <div className="w-12 h-12 bg-portal-teal/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-6 h-6 text-portal-teal" />
                  </div>
                  <h3 className="font-bold text-portal-navy text-sm md:text-base mb-1">{item.title}</h3>
                  <p className="text-gray-500 text-xs md:text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== MID-PAGE CTA ===== */}
        <section className="py-10 md:py-14" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #0F766E 100%)' }}>
          <div className="max-w-lg mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
              מוכנים להתחיל?
            </h2>
            <p className="text-white/80 text-center mb-6">
              השאירו פרטים ונחזור אליכם עם הסבר ברור איך להתחיל
            </p>

            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <StepsLeadForm
                id="mid-lead-form"
                variant="mid"
                ctaText="קבלו ליווי לפתיחת עוסק פטור"
              />
            </div>
          </div>
        </section>

        {/* ===== 8. FAQ ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-3">
              שאלות נפוצות על פתיחת עוסק פטור
            </h2>
            <p className="text-gray-500 text-center mb-8">
              התשובות לשאלות שרוב האנשים שואלים
            </p>

            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-200">
              {FAQ_ITEMS.map((item, i) => (
                <FAQItem
                  key={i}
                  question={item.question}
                  answer={item.answer}
                  isOpen={openFAQ === i}
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ===== 9. FINAL CTA ===== */}
        <section className="py-14 md:py-20" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #152D4A 50%, #0F766E 100%)' }}>
          <div className="max-w-lg mx-auto px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white text-center mb-3">
              רוצים ליווי בפתיחת עוסק פטור
              <br />
              <span style={{ color: '#F59E0B' }}>בצורה פשוטה ומקצועית?</span>
            </h2>
            <p className="text-white/80 text-center mb-8 text-lg">
              השאירו פרטים ונחזור אליכם עם הסבר ברור איך להתחיל.
              <br />
              בלי בירוקרטיה, בלי טעויות.
            </p>

            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
              <StepsLeadForm
                id="final-lead-form"
                variant="final"
                title="קבלו הכוונה לפתיחת עוסק פטור"
                subtitle="ללא התחייבות · נחזור אליכם בהקדם"
                ctaText="קבלו הכוונה לפתיחת עוסק פטור"
              />
            </div>

            <div className="flex items-center justify-center gap-3 mt-6 text-white/60 text-sm">
              <div className="flex -space-x-2 space-x-reverse">
                {['י', 'ד', 'ש', 'מ'].map((letter, i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-xs font-bold">
                    {letter}
                  </div>
                ))}
              </div>
              <span>+5,000 עצמאים קיבלו ליווי מאיתנו</span>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="bg-portal-navy text-white/60 py-6">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm space-y-3">
            <p>© {new Date().getFullYear()} פרפקט וואן — ליווי עסקי מקצועי. כל הזכויות שמורות.</p>
            <div className="border-t border-white/10 pt-3 text-white/40 text-xs leading-relaxed max-w-2xl mx-auto">
              <p>האתר מופעל על ידי משרד פרטי לליווי עסקי.</p>
              <p>אנו מספקים שירותי ייעוץ וליווי בתהליך פתיחת עוסק פטור.</p>
              <p>האתר אינו אתר ממשלתי ואינו פועל מטעם רשות המסים, מע״מ או ביטוח לאומי.</p>
            </div>
          </div>
        </footer>

        {/* Sticky Mobile CTA */}
        <StickyMobileCTA />
      </div>
    </HelmetProvider>
  );
}
