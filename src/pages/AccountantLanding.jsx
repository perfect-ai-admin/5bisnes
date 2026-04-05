import React, { useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, CheckCircle2, Shield, Clock, ChevronDown, ChevronUp,
  Calculator, FileCheck, DollarSign, Headphones, Zap, UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { submitPortalLead } from '@/api/portalSupabaseClient';
import { motion } from 'framer-motion';

// ─── Fade-in on scroll ───
const FadeIn = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.5, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

// ─── Lead Form Component ───
function LeadForm({ id, variant = 'hero', title, subtitle, ctaText = 'קבלו הצעת מחיר לניהול עוסק פטור' }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { setError('נא למלא שם וטלפון'); return; }
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams(window.location.search);
      await submitPortalLead({
        name: form.name,
        phone: form.phone,
        profession: 'accountant_osek_patur',
        source: 'sales_portal',
        source_page: 'landing-accountant-osek-patur',
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_term: params.get('utm_term') || '',
        utm_content: params.get('utm_content') || '',
        referrer: document.referrer || '',
      });
      navigate('/ThankYou', { state: { source: 'landing-accountant-osek-patur', name: form.name } });
    } catch (err) {
      setError('שגיאה בשליחה, נסו שוב או התקשרו אלינו');
    } finally {
      setLoading(false);
    }
  };

  const isDark = variant === 'final';
  const isLight = variant === 'hero' || variant === 'mid';

  const wrapperClass = isDark
    ? 'bg-white/10 backdrop-blur-sm border border-white/20'
    : 'bg-white shadow-2xl border border-gray-100';

  const titleClass = isDark ? 'text-white' : 'text-gray-900';
  const subtitleClass = isDark ? 'text-white/70' : 'text-gray-500';
  const inputClass = isDark
    ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-green-400'
    : 'bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500';
  const trustClass = isDark ? 'text-white/50' : 'text-gray-400';

  return (
    <div id={id} className={`rounded-2xl p-5 sm:p-7 ${wrapperClass}`}>
      {title && (
        <h3 className={`text-lg sm:text-xl font-bold mb-1 text-center ${titleClass}`}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p className={`text-sm text-center mb-4 ${subtitleClass}`}>{subtitle}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <Input
          value={form.name}
          onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="שם מלא"
          required
          className={`h-11 sm:h-[52px] rounded-lg sm:rounded-xl text-sm sm:text-base ${inputClass}`}
        />
        <Input
          value={form.phone}
          onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
          placeholder="טלפון"
          type="tel"
          required
          className={`h-11 sm:h-[52px] rounded-lg sm:rounded-xl text-sm sm:text-base ${inputClass}`}
        />
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 sm:h-14 rounded-lg sm:rounded-xl text-sm sm:text-lg font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/25 transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : (
            <span className="hidden sm:inline">{ctaText}</span>
          )}
          {!loading && <span className="sm:hidden">בדוק עכשיו</span>}
        </Button>
      </form>

      {error && <p className="text-red-500 text-xs sm:text-sm text-center mt-2">{error}</p>}

      <div className={`hidden sm:flex items-center justify-center gap-3 mt-2 text-xs ${trustClass}`}>
        <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" />בדיקה ללא התחייבות</span>
        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />מענה בדקות</span>
      </div>
    </div>
  );
}

// ─── FAQ Item ───
function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-4 text-right">
        <span className="font-medium text-gray-900 text-base">{q}</span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0 mr-3" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0 mr-3" />}
      </button>
      {open && <p className="pb-4 text-gray-600 text-sm leading-relaxed">{a}</p>}
    </div>
  );
}

// ─── Schema Data ───
const faqData = [
  {
    q: 'כמה עולה רואה חשבון לעוסק פטור?',
    a: 'העלות נעה בין 150-300 ₪ לחודש, תלוי בהיקף הפעילות ומספר העסקאות. ניתן לקבל הצעת מחיר מותאמת אישית.',
  },
  {
    q: 'האם עוסק פטור חייב רואה חשבון?',
    a: 'לא, אין חובה חוקית. אבל רואה חשבון יכול לחסוך לכם כסף, למנוע טעויות בדיווח ולוודא שאתם מנצלים את כל ההטבות שמגיעות לכם.',
  },
  {
    q: 'מה כולל שירות ניהול עוסק פטור?',
    a: 'השירות כולל הגשת דוח שנתי למס הכנסה, ליווי מול ביטוח לאומי, ייעוץ מס שוטף, בדיקת חובות והחזרי מס, וניהול קבלות.',
  },
  {
    q: 'כמה זמן לוקח להכין דוח שנתי?',
    a: 'דוח שנתי לעוסק פטור לוקח בדרך כלל כמה ימי עבודה. עם רואה חשבון מקצועי, התהליך פשוט ולא דורש מכם כמעט מאמץ.',
  },
  {
    q: 'האם ניתן לנהל עוסק פטור אונליין?',
    a: 'כן, רוב השירותים כיום מתבצעים אונליין — שליחת מסמכים, חתימה דיגיטלית, וקבלת ייעוץ בטלפון או בווידאו.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqData.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'רואה חשבון לעוסק פטור – כמה עולה ניהול עוסק פטור?',
  description: 'מחפשים רואה חשבון לעוסק פטור? בדיקה קצרה יכולה לחסוך מאות שקלים בשנה. קבלו הצעת מחיר לניהול עוסק פטור.',
  author: { '@type': 'Organization', name: 'פרפקט וואן', url: 'https://www.perfect1.co.il' },
  publisher: { '@type': 'Organization', name: 'פרפקט וואן', url: 'https://www.perfect1.co.il' },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://www.perfect1.co.il/accountant-osek-patur' },
  inLanguage: 'he',
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'פרפקט וואן', item: 'https://www.perfect1.co.il' },
    { '@type': 'ListItem', position: 2, name: 'רואה חשבון לעוסק פטור', item: 'https://www.perfect1.co.il/accountant-osek-patur' },
  ],
};

// ─── Main Page ───
export default function AccountantLanding() {
  return (
    <HelmetProvider>
      <div className="min-h-screen bg-white" dir="rtl">
        {/* SEO Head */}
        <Helmet>
          <title>רואה חשבון לעוסק פטור – כמה עולה ניהול עוסק פטור? | פרפקט וואן</title>
          <meta name="description" content="מחפשים רואה חשבון לעוסק פטור? בדיקה קצרה יכולה לחסוך מאות שקלים בשנה. קבלו הצעת מחיר לניהול עוסק פטור." />
          <meta name="keywords" content="רואה חשבון לעוסק פטור, כמה עולה רואה חשבון לעוסק פטור, ניהול עוסק פטור, עלות רואה חשבון לעוסק פטור" />
          <link rel="canonical" href="https://www.perfect1.co.il/accountant-osek-patur" />
          <meta property="og:title" content="רואה חשבון לעוסק פטור – כמה עולה ניהול עוסק פטור? | פרפקט וואן" />
          <meta property="og:description" content="מחפשים רואה חשבון לעוסק פטור? בדיקה קצרה יכולה לחסוך מאות שקלים בשנה. קבלו הצעת מחיר לניהול עוסק פטור." />
          <meta property="og:type" content="article" />
          <meta property="og:url" content="https://www.perfect1.co.il/accountant-osek-patur" />
          <meta property="og:image" content="https://www.perfect1.co.il/og-image.png" />
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
          <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
          <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        </Helmet>

        {/* ===== HERO ===== */}
        <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #152D4A 50%, #0F766E 100%)' }}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-300 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 md:py-20">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* Right: Text */}
              <div className="text-center md:text-right">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-5"
                >
                  <Calculator className="w-4 h-4 text-amber-400" />
                  <span className="text-white/80 text-sm">ניהול עוסק פטור מקצועי</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight mb-5"
                >
                  <span className="text-white">רואה חשבון לעוסק פטור</span>
                  <br />
                  <span style={{ color: '#F59E0B' }}>כמה זה עולה לכם באמת?</span>
                </motion.h1>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <p className="text-lg md:text-xl text-white/85 mb-4 leading-relaxed max-w-lg mx-auto md:mx-0">
                    בדיקה קצרה יכולה לחסוך מאות שקלים בשנה בניהול העסק.
                  </p>
                  <p className="text-base text-white/60 mb-6 max-w-lg mx-auto md:mx-0">
                    קבלו הצעת מחיר מותאמת אישית לניהול עוסק פטור.
                  </p>
                </motion.div>

                {/* Trust badges */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="flex flex-wrap gap-x-5 gap-y-2 justify-center md:justify-start mb-6"
                >
                  {['בדיקה ללא התחייבות', 'מענה תוך דקות', 'הצעת מחיר חינם'].map((text, i) => (
                    <div key={i} className="flex items-center gap-2 text-white/80 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>{text}</span>
                    </div>
                  ))}
                </motion.div>

                {/* Social proof */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="flex items-center gap-2 text-white/60 text-sm justify-center md:justify-start"
                >
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-xs text-white/70">
                        {['👤', '👩', '👨', '👤'][i]}
                      </div>
                    ))}
                  </div>
                  <span>אלפי עצמאים כבר משתמשים בשירותי רואה חשבון דרכנו</span>
                </motion.div>
              </div>

              {/* Left: Form */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
              >
                <LeadForm
                  id="hero-form"
                  variant="hero"
                  title="קבלו הצעת מחיר לניהול עוסק פטור"
                  subtitle="השאירו פרטים ונחזור עם הצעה מותאמת לעסק שלכם"
                  ctaText="קבלו הצעת מחיר לניהול עוסק פטור"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ===== PRICE SECTION ===== */}
        <section className="py-14 md:py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
                כמה עולה רואה חשבון לעוסק פטור?
              </h2>
              <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 leading-relaxed">
                עלות רואה חשבון לעוסק פטור משתנה בהתאם להיקף הפעילות ומספר העסקאות.
              </p>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8 text-center">
                <p className="text-gray-500 text-sm mb-2">טווח מחירים מקובל</p>
                <p className="text-5xl sm:text-6xl font-extrabold mb-2" style={{ color: '#D97706' }}>
                  150–300 ₪
                </p>
                <p className="text-gray-500 text-base">לחודש</p>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-3">מה כולל השירות?</h3>
                  <ul className="space-y-2">
                    {[
                      'הגשת דוח שנתי',
                      'ליווי מול מס הכנסה',
                      'ייעוץ מס שוטף',
                      'בדיקת חובות מס',
                      'ניהול קבלות',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-600 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 flex flex-col justify-center">
                  <p className="text-amber-800 font-medium text-base leading-relaxed mb-4">
                    המחיר הסופי תלוי במספר העסקאות, סוג הפעילות וצרכי העסק שלכם.
                  </p>
                  <Button
                    onClick={() => document.getElementById('mid-form')?.scrollIntoView({ behavior: 'smooth' })}
                    className="h-12 rounded-xl text-sm bg-green-500 hover:bg-green-600 text-white font-bold shadow"
                  >
                    בדקו כמה זה יעלה לכם
                  </Button>
                </div>
              </div>
            </FadeIn>

            {/* Lead form #2 */}
            <FadeIn delay={0.2}>
              <LeadForm
                id="mid-form"
                variant="mid"
                title="קבלו הצעת מחיר מותאמת לעסק שלכם"
                subtitle="ללא התחייבות · נחזור אליכם בהקדם"
                ctaText="קבלו הצעת מחיר עכשיו"
              />
            </FadeIn>
          </div>
        </section>

        {/* ===== IS IT REQUIRED ===== */}
        <section className="py-14 md:py-20">
          <div className="max-w-4xl mx-auto px-4">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6">
                האם עוסק פטור חייב רואה חשבון?
              </h2>
              <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 leading-relaxed">
                החוק לא מחייב, אבל רוב העצמאים משתמשים בשירות רואה חשבון כדי להימנע מטעויות מול:
              </p>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mb-8">
                {['מס הכנסה', 'מע"מ', 'ביטוח לאומי'].map((item, i) => (
                  <div key={i} className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                    <span className="font-bold text-blue-800 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="flex items-start gap-3 bg-red-50 rounded-xl p-5 border border-red-100 max-w-2xl mx-auto mb-8">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-gray-700 text-sm leading-relaxed">
                  <span className="font-semibold text-red-700">שימו לב:</span> טעויות בדיווח עלולות לגרור קנסות ובעיות בעתיד.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.25}>
              <div className="text-center">
                <Button
                  onClick={() => document.getElementById('hero-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="h-13 px-8 rounded-xl text-base bg-green-500 hover:bg-green-600 text-white font-bold shadow-lg"
                >
                  קבלו בדיקה מהירה לניהול העסק
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ===== WHY USE ACCOUNTANT ===== */}
        <section className="py-14 md:py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">
                למה עצמאים עובדים עם רואה חשבון?
              </h2>
            </FadeIn>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
              {[
                {
                  icon: DollarSign,
                  title: 'חיסכון במס',
                  desc: 'ניצול מלא של הניכויים וההטבות המגיעים לכם',
                  color: 'text-green-600',
                  bg: 'bg-green-50',
                  border: 'border-green-100',
                },
                {
                  icon: FileCheck,
                  title: 'בדיקה מקצועית',
                  desc: 'בדיקה יסודית של הדוחות למניעת טעויות',
                  color: 'text-blue-600',
                  bg: 'bg-blue-50',
                  border: 'border-blue-100',
                },
                {
                  icon: Shield,
                  title: 'ליווי מול רשויות',
                  desc: 'ייצוג וליווי מול מס הכנסה, מע"מ וביטוח לאומי',
                  color: 'text-purple-600',
                  bg: 'bg-purple-50',
                  border: 'border-purple-100',
                },
                {
                  icon: Headphones,
                  title: 'שקט נפשי',
                  desc: 'ניהול מסודר ומקצועי של כל ענייני העסק',
                  color: 'text-amber-600',
                  bg: 'bg-amber-50',
                  border: 'border-amber-100',
                },
              ].map((item, i) => (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className={`rounded-2xl p-6 text-center shadow-sm border ${item.bg} ${item.border} h-full`}>
                    <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-4 border ${item.border}`}>
                      <item.icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ===== TRUST SECTION ===== */}
        <section className="py-14 md:py-20">
          <div className="max-w-4xl mx-auto px-4">
            <FadeIn>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { icon: Shield, title: 'בדיקה ללא התחייבות', desc: 'חינם, בלי הפתעות' },
                  { icon: UserCheck, title: 'התאמה אישית', desc: 'פתרון שמתאים לעסק שלך' },
                  { icon: Zap, title: 'מענה מהיר', desc: 'חוזרים אליכם בהקדם' },
                  { icon: FileCheck, title: 'ליווי מקצועי', desc: 'מומחים שמכירים כל פרט' },
                ].map((item, i) => (
                  <FadeIn key={i} delay={i * 0.08}>
                    <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-gray-100 h-full">
                      <item.icon className="w-9 h-9 text-blue-600 mx-auto mb-3" />
                      <h4 className="font-bold text-gray-900 text-sm mb-1">{item.title}</h4>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <p className="text-center text-gray-400 text-xs">
                כל הפרטים נשמרים בצורה מאובטחת ולא מועברים לגורם שלישי.
              </p>
            </FadeIn>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="py-14 md:py-20 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">
                שאלות נפוצות
              </h2>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                {faqData.map((item, i) => (
                  <FAQItem key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ===== FINAL CTA ===== */}
        <section className="py-14 md:py-20" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #152D4A 50%, #0F766E 100%)' }}>
          <div className="max-w-lg mx-auto px-4">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white text-center mb-3">
                רוצים לדעת כמה יעלה לכם רואה חשבון?
              </h2>
              <p className="text-white/80 text-center mb-8 text-lg">
                השאירו פרטים ונחזור אליכם עם הצעת מחיר לניהול עוסק פטור.
              </p>

              <LeadForm
                id="final-form"
                variant="final"
                title="קבלו הצעת מחיר עכשיו"
                subtitle="ללא התחייבות · נחזור אליכם בהקדם"
                ctaText="קבלו הצעת מחיר עכשיו"
              />

              {/* Social proof */}
              <div className="flex items-center gap-2 text-white/50 text-sm justify-center mt-6">
                <div className="flex -space-x-2 rtl:space-x-reverse">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-xs text-white/70">
                      {['👤', '👩', '👨', '👤'][i]}
                    </div>
                  ))}
                </div>
                <span>אלפי עצמאים כבר משתמשים בשירותי רואה חשבון דרכנו</span>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="bg-portal-navy text-white/60 py-6">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm space-y-3">
            <p>© {new Date().getFullYear()} פרפקט וואן — ליווי עסקי מקצועי</p>
            <div className="border-t border-white/10 pt-3 text-white/40 text-xs leading-relaxed max-w-2xl mx-auto">
              <p>האתר מופעל על ידי חברה פרטית. אינו אתר ממשלתי.</p>
            </div>
          </div>
        </footer>
      </div>
    </HelmetProvider>
  );
}
