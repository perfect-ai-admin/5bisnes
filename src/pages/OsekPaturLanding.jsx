import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { HelmetProvider } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, CheckCircle2, Phone, MessageCircle, Clock,
  Shield, FileCheck, Headphones, Zap, ArrowLeft,
  Users, AlertTriangle, ChevronDown, ChevronUp,
  Briefcase, Building2, Star, BadgeCheck, HandCoins,
  ClipboardCheck
} from 'lucide-react';
import { submitPortalLead } from '@/api/portalSupabaseClient';
import { PORTAL_CTA } from '@/portal/config/navigation';

// ============================
// Lead Form Component (Reusable)
// ============================
function LeadForm({
  id,
  variant = 'hero', // hero | mid | final
  title,
  subtitle,
  ctaText = 'בדקו התאמה עכשיו',
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
        content_name: 'osek_patur_landing',
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

    // Basic phone validation
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
        source_page: `landing-osek-patur-${variant}`,
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_term: params.get('utm_term') || '',
        utm_content: params.get('utm_content') || '',
        referrer: document.referrer || '',
      });

      // Redirect to ThankYou — conversion tracking fires there
      navigate('/ThankYou', { state: { source: `landing-osek-patur-${variant}`, name: form.name } });
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

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <Input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="שם מלא"
          required
          className="h-11 sm:h-[52px] rounded-lg sm:rounded-xl text-sm sm:text-base border-gray-200 bg-white focus:border-portal-teal focus:ring-portal-teal text-right"
        />

        <Input
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="טלפון נייד"
          type="tel"
          required
          dir="ltr"
          className="h-11 sm:h-[52px] rounded-lg sm:rounded-xl text-sm sm:text-base border-gray-200 bg-white focus:border-portal-teal focus:ring-portal-teal text-right"
        />

        {error && <p className="text-red-400 text-xs sm:text-sm text-center font-medium">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg sm:rounded-2xl text-sm sm:text-lg font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            height: '44px',
            backgroundColor: '#F59E0B',
            color: '#1E3A5F',
            fontSize: 'clamp(14px, 2vw, 18px)',
          }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          ) : (
            <>
              <Phone className="ml-1.5 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">{ctaText}</span>
              <span className="sm:hidden">קבלו הצעה</span>
            </>
          )}
        </Button>
      </form>

      <p className={`text-xs text-center mt-2 ${variant === 'hero' ? 'text-white/60' : 'text-gray-400'}`}>
        🔒 ללא התחייבות · המידע שלך מאובטח · נחזור אליך תוך דקות
      </p>
    </div>
  );
}

// ============================
// FAQ Accordion Item
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
function LandingStickyMobileCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToForm = () => {
    const form = document.getElementById('hero-lead-form');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth' });
    }
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
            בדיקת התאמה חינם
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================
// Schema Markup for Landing Page
// ============================
function LandingSchemaMarkup({ faqItems }) {
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'פתיחת עוסק פטור',
    description: 'ליווי מקצועי לפתיחת עוסק פטור בישראל — בדיקת התאמה, הכוונה למסמכים, וליווי בתהליך מול מס הכנסה, מע"מ וביטוח לאומי.',
    provider: {
      '@type': 'Organization',
      name: 'פרפקט וואן',
      url: 'https://perfect1.co.il',
      logo: 'https://perfect1.co.il/og-image.png',
      telephone: '+972502277087',
      areaServed: { '@type': 'Country', name: 'Israel' },
    },
    serviceType: 'פתיחת עוסק פטור',
    areaServed: { '@type': 'Country', name: 'Israel' },
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: 'https://perfect1.co.il/OsekPaturLanding',
      servicePhone: '+972502277087',
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'פרפקט וואן', item: 'https://perfect1.co.il' },
      { '@type': 'ListItem', position: 2, name: 'פתיחת עוסק פטור', item: 'https://perfect1.co.il/OsekPaturLanding' },
    ],
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
    </Helmet>
  );
}

// ============================
// Main Landing Page
// ============================
const FAQ_ITEMS = [
  {
    question: 'מה זה עוסק פטור?',
    answer: 'עוסק פטור הוא מעמד מס המיועד לעצמאים עם הכנסה שנתית עד 120,000 ₪ (נכון ל-2026). במעמד זה אתם פטורים מגביית מע"מ, מניהול הנהלת חשבונות כפולה, ומדיווחים רבים שמעמדים אחרים מחייבים. זה המעמד הפשוט ביותר להתחלת עבודה עצמאית בישראל.',
  },
  {
    question: 'למי מתאים לפתוח עוסק פטור?',
    answer: 'עוסק פטור מתאים לפרילנסרים, נותני שירותים, מורים פרטיים, מעצבים, צלמים, יועצים, בעלי מקצועות חופשיים, ושכירים שרוצים הכנסה צדדית. בעיקר למי שמתחיל ולא צפוי לעבור את תקרת ההכנסות השנתית.',
  },
  {
    question: 'כמה זמן לוקח לפתוח עוסק פטור?',
    answer: 'התהליך עצמו יכול להיגמר תוך מספר ימי עסקים. עם ליווי מקצועי, אנחנו מפשטים את התהליך ומוודאים שהכל מתבצע נכון כבר מההתחלה, כך שלא תצטרכו לתקן טעויות בהמשך.',
  },
  {
    question: 'האם חייבים להגיע פיזית למשרדי מס הכנסה?',
    answer: 'לא בהכרח. חלק גדול מהתהליך ניתן לבצע אונליין. אנחנו נכוון אתכם בדיוק מה צריך, איפה, ואיך — כדי לחסוך לכם ביקורים מיותרים.',
  },
  {
    question: 'מה צריך להכין לפתיחת עוסק פטור?',
    answer: 'בעיקר תעודת זהות, פרטי חשבון בנק, ומידע על סוג העיסוק שלכם. אנחנו נסביר בדיוק מה צריך כשנדבר — אל תדאגו לחפש לבד.',
  },
  {
    question: 'כמה זה עולה?',
    answer: 'השאירו פרטים ונתאים לכם הצעה בהתאם למצב שלכם. הבדיקה הראשונית היא ללא עלות וללא התחייבות.',
  },
  {
    question: 'אפשר לפתוח עוסק פטור גם אם אני עובד כשכיר?',
    answer: 'בהחלט! הרבה שכירים פותחים עוסק פטור במקביל כדי לקבל הכנסות צדדיות באופן חוקי. זה נפוץ מאוד ולגיטימי לחלוטין. אנחנו נסביר לכם בדיוק מה ההשלכות על המיסוי.',
  },
  {
    question: 'מה ההבדל בין עוסק פטור לעוסק מורשה?',
    answer: 'עוסק פטור פטור מגביית מע"מ ומדיווחים מורכבים, אבל מוגבל בתקרת הכנסות. עוסק מורשה גובה מע"מ, יכול לקזז מע"מ על הוצאות, ואין מגבלת הכנסות. אנחנו נבדוק מה מתאים לכם.',
  },
  {
    question: 'האם הבדיקה מחייבת?',
    answer: 'לא. הבדיקה הראשונית היא בחינם, ללא התחייבות. אנחנו נבין את המצב שלכם ונמליץ על הדרך הנכונה.',
  },
  {
    question: 'תוך כמה זמן חוזרים אליי?',
    answer: 'אנחנו חוזרים תוך דקות ספורות בשעות פעילות, ולא יאוחר מיום עסקים אחד.',
  },
];

export default function OsekPaturLanding() {
  const [openFAQ, setOpenFAQ] = useState(null);

  // Track scroll depth
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
            window.dataLayer.push({
              event: 'scroll_depth',
              scroll_percent: threshold,
              page: 'osek_patur_landing',
            });
          }
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track CTA clicks
  const trackClick = (ctaName) => {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'click_cta',
        cta_name: ctaName,
        page: 'osek_patur_landing',
      });
    }
  };

  return (
    <HelmetProvider>
      <div dir="rtl" className="portal-root min-h-screen" style={{ fontFamily: "'Heebo', sans-serif" }}>
        {/* SEO Head */}
        <Helmet>
          <title>פתיחת עוסק פטור אונליין | ליווי מקצועי מהתחלה ועד הסוף - פרפקט וואן</title>
          <meta name="description" content="רוצים לפתוח עוסק פטור? קבלו ליווי מקצועי מלא — בדיקת התאמה חינם, הכוונה לפתיחת תיקים במס הכנסה, מע״מ וביטוח לאומי. בלי בירוקרטיה, בלי טעויות. התחילו עכשיו!" />
          <meta name="keywords" content="פתיחת עוסק פטור, איך פותחים עוסק פטור, פתיחת עוסק פטור אונליין, כמה עולה לפתוח עוסק פטור, פתיחת תיק עוסק פטור, פתיחת עוסק פטור מס הכנסה, פתיחת עוסק פטור ביטוח לאומי, עוסק פטור למתחילים" />
          <link rel="canonical" href="https://www.perfect1.co.il/OsekPaturLanding" />
          <meta property="og:title" content="פתיחת עוסק פטור אונליין — ליווי מקצועי מ-א׳ ועד ת׳" />
          <meta property="og:description" content="בדיקת התאמה חינם לפתיחת עוסק פטור. ליווי מקצועי, בלי בירוקרטיה, בלי טעויות. השאירו פרטים ונחזור אליכם תוך דקות." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://www.perfect1.co.il/OsekPaturLanding" />
          <meta property="og:image" content="https://www.perfect1.co.il/og-image.png" />
          <meta property="og:locale" content="he_IL" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="robots" content="index, follow" />
        </Helmet>

        <LandingSchemaMarkup faqItems={FAQ_ITEMS} />

        {/* ===== MINIMAL HEADER ===== */}
        <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-portal-navy">פרפקט וואן</span>
              <span className="text-xs text-gray-400 hidden sm:inline">| ליווי עסקי מקצועי</span>
            </div>
            <a
              href={`tel:${PORTAL_CTA.phone}`}
              onClick={() => trackClick('header_phone')}
              className="flex items-center gap-2 text-portal-teal font-bold text-sm hover:underline"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">{PORTAL_CTA.phone}</span>
              <span className="sm:hidden">התקשרו</span>
            </a>
          </div>
        </header>

        {/* ===== HERO SECTION ===== */}
        <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #152D4A 50%, #0F766E 100%)' }}>
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, white 2%, transparent 2%), radial-gradient(circle at 75% 75%, white 1.5%, transparent 1.5%)',
              backgroundSize: '60px 60px',
            }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 py-10 md:py-16">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
              {/* Left side: Content */}
              <div className="order-1 md:order-1">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-white/90 text-sm font-medium">בדיקת התאמה חינם — ללא התחייבות</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-5">
                  פותחים עוסק פטור
                  <br />
                  <span style={{ color: '#F59E0B' }}>בלי בירוקרטיה, בלי טעויות</span>
                </h1>

                <p className="text-lg md:text-xl text-white/85 mb-6 leading-relaxed max-w-lg">
                  רוצים להתחיל לעבוד עצמאי? אנחנו מלווים אתכם בכל שלב — מבדיקת ההתאמה ועד פתיחת התיקים. בלי לחפש לבד, בלי טעויות.
                </p>

                {/* Mobile: Form right after the hero text */}
                <div className="md:hidden mb-6">
                  <div className="bg-white rounded-3xl shadow-2xl p-6">
                    <LeadForm
                      id="hero-lead-form-mobile"
                      variant="hero"
                      title="השאירו פרטים — נחזור תוך דקות"
                      subtitle="בדיקת התאמה חינם, ללא התחייבות"
                      ctaText="בדקו התאמה עכשיו →"
                    />
                  </div>
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6">
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span>ליווי צמוד מההתחלה</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span>מענה תוך דקות</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span>חיסכון בזמן ובכסף</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span>אלפי לקוחות מרוצים</span>
                  </div>
                </div>

                {/* Social proof - subtle */}
                <div className="hidden md:flex items-center gap-3 text-white/60 text-sm">
                  <div className="flex -space-x-2 space-x-reverse">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-xs font-bold">
                        {['י', 'ד', 'ש', 'מ'][i]}
                      </div>
                    ))}
                  </div>
                  <span>+5,000 לקוחות כבר פתחו איתנו</span>
                </div>
              </div>

              {/* Right side: Form (desktop only) */}
              <div className="hidden md:block order-2">
                <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md mx-auto md:mx-0">
                  <LeadForm
                    id="hero-lead-form"
                    variant="hero"
                    title="השאירו פרטים — נחזור תוך דקות"
                    subtitle="בדיקת התאמה חינם, ללא התחייבות"
                    ctaText="בדקו התאמה עכשיו →"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== PAIN / PROBLEM SECTION ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-3">
              רוצים לפתוח עוסק פטור אבל לא יודעים מאיפה להתחיל?
            </h2>
            <p className="text-gray-500 text-center mb-10 text-lg max-w-2xl mx-auto">
              אתם לא לבד. רוב האנשים שמתחילים מרגישים בדיוק ככה:
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: AlertTriangle, text: 'לא ברור מה פותחים קודם — מס הכנסה? מע"מ? ביטוח לאומי?', color: 'text-red-500' },
                { icon: Clock, text: 'חוששים לבזבז ימים שלמים מול רשויות ובירוקרטיה', color: 'text-orange-500' },
                { icon: FileCheck, text: 'מפחדים לעשות טעויות שיעלו בכסף בהמשך', color: 'text-red-500' },
                { icon: Shield, text: 'לא בטוחים אם עוסק פטור בכלל מתאים לכם', color: 'text-orange-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-red-50/60 border border-red-100">
                  <item.icon className={`w-6 h-6 ${item.color} flex-shrink-0 mt-0.5`} />
                  <p className="text-gray-700 font-medium leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            <p className="text-center mt-8 text-lg text-portal-navy font-semibold">
              😤 מכירים את זה? יש דרך פשוטה יותר.
            </p>
          </div>
        </section>

        {/* ===== SOLUTION SECTION ===== */}
        <section className="py-12 md:py-16" style={{ backgroundColor: '#F0FDFA' }}>
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-3">
              אנחנו מפשטים לכם את כל התהליך
            </h2>
            <p className="text-gray-600 text-center mb-10 text-lg max-w-2xl mx-auto">
              במקום לחפש מידע לבד, לעמוד בתורים, ולקוות שעשיתם הכל נכון — אנחנו מלווים אתכם בכל שלב. מההתחלה ועד שהתיק פתוח ואתם מוכנים לעבוד.
            </p>

            <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8 border border-portal-teal/20">
              <div className="grid sm:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="w-14 h-14 bg-portal-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Headphones className="w-7 h-7 text-portal-teal" />
                  </div>
                  <h3 className="font-bold text-portal-navy mb-1">מסבירים מה צריך</h3>
                  <p className="text-gray-500 text-sm">בשפה פשוטה, בלי ז'רגון. מה שרלוונטי לכם בלבד.</p>
                </div>
                <div>
                  <div className="w-14 h-14 bg-portal-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <FileCheck className="w-7 h-7 text-portal-teal" />
                  </div>
                  <h3 className="font-bold text-portal-navy mb-1">עוזרים לפתוח נכון</h3>
                  <p className="text-gray-500 text-sm">מוודאים שאין טעויות ושהתהליך חלק מההתחלה.</p>
                </div>
                <div>
                  <div className="w-14 h-14 bg-portal-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-7 h-7 text-portal-teal" />
                  </div>
                  <h3 className="font-bold text-portal-navy mb-1">חוסכים זמן וכאב ראש</h3>
                  <p className="text-gray-500 text-sm">בלי לחפש בגוגל, בלי טפסים מבלבלים, בלי תורים.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== BENEFITS SECTION ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-10">
              למה לבחור בליווי מקצועי?
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[
                { icon: Zap, title: 'תהליך מהיר', desc: 'חוסכים לכם ימים של בירוקרטיה' },
                { icon: Shield, title: 'בלי טעויות', desc: 'עושים הכל נכון מההתחלה' },
                { icon: Headphones, title: 'מענה מהיר', desc: 'שאלות? אנחנו כאן בשבילכם' },
                { icon: BadgeCheck, title: 'ליווי אישי', desc: 'הכל מותאם למצב שלכם' },
                { icon: Clock, title: 'חיסכון בזמן', desc: 'אתם עושים מה שאתם טובים בו' },
                { icon: HandCoins, title: 'שקיפות מלאה', desc: 'בלי הפתעות, בלי עלויות נסתרות' },
                { icon: Users, title: 'ניסיון מוכח', desc: 'אלפי לקוחות כבר פתחו איתנו' },
                { icon: Star, title: 'שירות 5 כוכבים', desc: 'שביעות רצון גבוהה מאוד' },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 md:p-5 rounded-2xl bg-gray-50 hover:bg-portal-teal/5 transition-colors border border-transparent hover:border-portal-teal/20">
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

        {/* ===== HOW IT WORKS (STEPS) ===== */}
        <section className="py-12 md:py-16" style={{ backgroundColor: '#F8F9FA' }}>
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-3">
              איך זה עובד? 4 שלבים פשוטים
            </h2>
            <p className="text-gray-500 text-center mb-10">
              מהרגע שאתם משאירים פרטים — אנחנו לוקחים את זה משם
            </p>

            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-4 md:gap-4">
              {[
                { num: '1', title: 'משאירים פרטים', desc: 'ממלאים שם וטלפון — 10 שניות', color: 'bg-portal-teal' },
                { num: '2', title: 'בודקים התאמה', desc: 'נחזור אליכם ונבין מה מתאים לכם', color: 'bg-portal-navy' },
                { num: '3', title: 'מלווים בפתיחה', desc: 'הכוונה מלאה לכל השלבים', color: 'bg-portal-teal' },
                { num: '4', title: 'מתחילים לעבוד!', desc: 'העסק פתוח — אתם מוכנים', color: 'bg-amber-500' },
              ].map((step, i) => (
                <div key={i} className="relative flex md:flex-col items-start md:items-center gap-4 md:gap-0 md:text-center bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className={`w-12 h-12 ${step.color} rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 md:mb-3`}>
                    {step.num}
                  </div>
                  <div>
                    <h3 className="font-bold text-portal-navy text-lg mb-1">{step.title}</h3>
                    <p className="text-gray-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== WHAT'S INCLUDED ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-3">
              מה כולל השירות?
            </h2>
            <p className="text-gray-500 text-center mb-10">
              הכל כלול — אתם לא צריכים לדאוג לשום דבר
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              {[
                'בדיקת התאמה ראשונית — בחינם',
                'הסבר על סוג העסק המתאים לכם',
                'הכוונה לפתיחת תיק במס הכנסה',
                'הכוונה לפתיחת תיק במע"מ',
                'הכוונה לפתיחת תיק בביטוח לאומי',
                'רשימת מסמכים נדרשים',
                'הסבר על חובות דיווח ותשלום',
                'מענה לכל השאלות שלכם',
                'ליווי צמוד עד סיום התהליך',
                'הכוונה לשלבים הבאים',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-green-50/50 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 font-medium">{item}</span>
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
              השאירו פרטים ונבדוק יחד מה מתאים לכם — בחינם
            </p>

            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <LeadForm
                id="mid-lead-form"
                variant="mid"
                ctaText="קבלו בדיקת התאמה חינם →"
              />
            </div>
          </div>
        </section>

        {/* ===== WHY NOT ALONE ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-3">
              למה לא לעשות את זה לבד?
            </h2>
            <p className="text-gray-500 text-center mb-10 max-w-2xl mx-auto">
              אפשר, אבל הנה מה שקורה לרוב האנשים שמנסים:
            </p>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="rounded-2xl border-2 border-red-200 bg-red-50/30 p-6">
                <h3 className="font-bold text-red-600 text-lg mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  לבד ❌
                </h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✕</span>
                    <span>מחפשים מידע בעשרות אתרים סותרים</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✕</span>
                    <span>מבזבזים ימים על בירוקרטיה</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✕</span>
                    <span>עושים טעויות שעולות בכסף אחר כך</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✕</span>
                    <span>לא בטוחים שעשו הכל נכון</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✕</span>
                    <span>אין למי לשאול שאלות</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border-2 border-green-200 bg-green-50/30 p-6">
                <h3 className="font-bold text-green-600 text-lg mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  עם ליווי מקצועי ✓
                </h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>מקבלים הכוונה מדויקת ומותאמת</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>חוסכים זמן וכאב ראש</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>פותחים נכון מההתחלה</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>בטוחים שהכל בסדר</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>יש למי לפנות עם כל שאלה</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ===== TRUST SECTION ===== */}
        <section className="py-12 md:py-16" style={{ backgroundColor: '#F8F9FA' }}>
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-10">
              למה אנשים בוחרים בנו?
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center mb-10">
              {[
                { num: '5,000+', label: 'לקוחות מרוצים' },
                { num: '8+', label: 'שנות ניסיון' },
                { num: '98%', label: 'שביעות רצון' },
                { num: '< 1 שעה', label: 'זמן תגובה ממוצע' },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-3xl md:text-4xl font-extrabold text-portal-teal mb-1" dir="ltr">{stat.num}</div>
                  <div className="text-gray-500 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Shield, title: 'ללא התחייבות', desc: 'הבדיקה הראשונית בחינם. לא מתאים? בלי בעיה.' },
                { icon: BadgeCheck, title: 'מידע מאובטח', desc: 'הפרטים שלכם לא מועברים לאף גורם שלישי.' },
                { icon: Headphones, title: 'מענה אנושי', desc: 'אנשים אמיתיים שמבינים את המצב שלכם.' },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
                  <item.icon className="w-8 h-8 text-portal-teal mx-auto mb-3" />
                  <h3 className="font-bold text-portal-navy mb-1">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FAQ SECTION ===== */}
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-portal-navy text-center mb-10">
              שאלות נפוצות על פתיחת עוסק פטור
            </h2>

            <div className="bg-gray-50 rounded-2xl p-4 md:p-6">
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

        {/* ===== FINAL CTA ===== */}
        <section className="py-14 md:py-20" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #152D4A 40%, #0F766E 100%)' }}>
          <div className="max-w-lg mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              מספיק לחפש. הגיע הזמן לפתוח.
            </h2>
            <p className="text-white/80 mb-2">
              אלפי ישראלים כבר פתחו עוסק פטור עם ליווי מקצועי.
            </p>
            <p className="text-white/80 mb-8">
              השאירו פרטים עכשיו — ותתחילו לעבוד מסודר.
            </p>

            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
              <LeadForm
                id="final-lead-form"
                variant="final"
                title="בדיקת התאמה חינם"
                subtitle="10 שניות ואנחנו חוזרים אליכם"
                ctaText="רוצה לפתוח עוסק פטור →"
              />
            </div>

            <p className="text-white/50 text-xs mt-6">
              או התקשרו ישירות:{' '}
              <a
                href={`tel:${PORTAL_CTA.phone}`}
                onClick={() => trackClick('final_phone')}
                className="text-white/70 underline"
              >
                {PORTAL_CTA.phone}
              </a>
              {' '}|{' '}
              <a
                href={`${PORTAL_CTA.whatsapp}?text=${encodeURIComponent('היי, אני רוצה לפתוח עוסק פטור')}`}
                onClick={() => trackClick('final_whatsapp')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 underline"
              >
                WhatsApp
              </a>
            </p>
          </div>
        </section>

        {/* ===== MINIMAL FOOTER ===== */}
        <footer className="bg-portal-navy py-6">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-white/50 text-sm mb-2">
              © {new Date().getFullYear()} פרפקט וואן — ליווי עסקי מקצועי
            </p>
            <p className="text-white/30 text-xs">
              שירות פרטי — לא אתר ממשלתי |{' '}
              <a href="/Privacy" className="hover:text-white/50 underline">מדיניות פרטיות</a>
              {' '}|{' '}
              <a href="/Terms" className="hover:text-white/50 underline">תנאי שימוש</a>
            </p>
          </div>
        </footer>

        {/* Sticky Mobile CTA */}
        <LandingStickyMobileCTA />
      </div>
    </HelmetProvider>
  );
}
