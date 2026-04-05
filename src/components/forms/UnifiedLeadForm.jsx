import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { User, Phone, Mail, Loader2, CheckCircle, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { trackLeadSubmit } from '../tracking/EventTracker';
import { entities, invokeFunction } from '@/api/supabaseClient';

/**
 * UnifiedLeadForm - טופס לידים אחיד לכל האתר
 * משמש כבסיס לכל וריאציות של טפסים
 */
export default function UnifiedLeadForm({ 
  // תצוגה
  variant = "default", // default, card, compact, popup
  title,
  subtitle,
  ctaText = "בדיקה ללא התחייבות",
  successTitle = "קיבלנו את הפרטים!",
  successMessage = "נציג יצור איתך קשר בהקדם",
  
  // תוכן
  fields = ["name", "phone", "email"], // מאילו שדות צריך
  defaultProfession = "",
  
  // התנהגות
  sourcePage = "כללי",
  onSuccess, // callback אחרי שליחה מוצלחת
  showProfession = false,
  compact = false,
  invertColors = false, // עבור שימוש על רקע ירוק
  
  // דוגמה של profession
  professions = [
    "מעצב גרפי", "צלם", "אנימטור", "מאייר", "עורך וידאו", "מעצב פנים", "מעצב אופנה",
    "קופירייטר", "כותב תוכן", "מתרגם", "סופר", "בלוגר",
    "מפתח אתרים", "מעצב UX/UI", "מנהל מדיה חברתית", "מומחה SEO", "מומחה אקסל",
    "מוזיקאי", "מפיק מוזיקלי", "מורה למוזיקה", "DJ", "זמר",
    "מאמן כושר", "מטפל אלטרנטיבי", "יועץ תזונה", "מורה יוגה", "מסאז'יסט",
    "עוזר וירטואלי", "מנהל פרויקטים", "יועץ עסקי", "נהג הובלות", "איש תחזוקה",
    "שף פרטי", "קונדיטור", "ברמן", "קייטרינג", "מארגן אירועים",
    "מורה פרטי", "מדריך ילדים", "קואוצ'ר", "מורה לשפות", "אחר"
  ]
}) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    profession: defaultProfession,
    consent: true,
  });
  const uniqueId = React.useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.phone) {
      setError('נא למלא שם וטלפון');
      return;
    }

    if (fields.includes('email') && !formData.email) {
      setError('נא למלא מייל');
      return;
    }

    if (!formData.consent) {
        setError('חובה לאשר את תנאי השימוש ומדיניות הפרטיות');
        return;
    }

    setIsSubmitting(true);

    try {
      // Capture UTM params – check URL first, fall back to localStorage (persisted across login redirect)
      const urlParams = new URLSearchParams(window.location.search);
      const getUtm = (key) => urlParams.get(key) || localStorage.getItem(`lead_${key}`) || '';
      const referrer = document.referrer || localStorage.getItem('lead_referrer') || '';

      // Determine source page - use the prop, but enrich with landing URL if available
      const landingUrl = localStorage.getItem('lead_landing_url') || '';
      const effectiveSource = sourcePage || landingUrl || window.location.pathname;

      // יצירת לד
      const newLead = await entities.Lead.create({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        profession: showProfession ? formData.profession : undefined,
        source_page: effectiveSource,
        status: 'new',
        utm_source: getUtm('utm_source'),
        utm_medium: getUtm('utm_medium'),
        utm_campaign: getUtm('utm_campaign'),
        utm_term: getUtm('utm_term'),
        utm_content: getUtm('utm_content'),
        referrer
      });

      // קריאה ל-submitLeadToN8N כדי להפעיל את הבוט וודוא שהלידים משודרים לN8N
      try {
        const submitResponse = await fetch(
          import.meta.env.VITE_SUPABASE_URL + '/functions/v1/submitLeadToN8N',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              name: formData.name,
              phone: formData.phone,
              email: formData.email || undefined,
              pageSlug: effectiveSource,
              businessName: sourcePage || 'Landing Page'
            })
          }
        );

        if (!submitResponse.ok) {
          console.warn('submitLeadToN8N response not ok:', submitResponse.status);
        } else {
          console.log('Lead sent to submitLeadToN8N successfully');
        }
      } catch (submitErr) {
        console.warn('submitLeadToN8N call failed:', submitErr.message);
        // Continue anyway - lead was created in DB
      }

      // Tracking
      trackLeadSubmit(newLead);

      // Push to dataLayer for GTM - NO PII (Google policy compliant)
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'lead_submit',
        lead_source: sourcePage,
        lead_has_email: !!newLead.email,
        lead_has_profession: !!newLead.profession
      });

      // Email notification
      try {
        await invokeFunction('sendEmail', {
          to: 'yosi5919@gmail.com',
          subject: `ליד חדש מ${sourcePage}`,
          body: `
            <div style="direction: rtl; font-family: Arial, sans-serif;">
              <h2 style="color: #1E3A5F;">ליד חדש התקבל!</h2>
              <p><strong>שם:</strong> ${newLead.name}</p>
              <p><strong>טלפון:</strong> ${newLead.phone}</p>
              ${newLead.email ? `<p><strong>אימייל:</strong> ${newLead.email}</p>` : ''}
              ${newLead.profession ? `<p><strong>מקצוע:</strong> ${newLead.profession}</p>` : ''}
              <p><strong>מקור:</strong> ${sourcePage}</p>
              <p><strong>תאריך:</strong> ${new Date().toLocaleString('he-IL')}</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Email send failed:', emailError);
      }

      setIsSuccess(true);

      // Callback אם יש
      if (onSuccess) {
        onSuccess(newLead);
      } else {
        // Default: redirect אחרי 1.5 שניות
        await new Promise(resolve => setTimeout(resolve, 1500));
        navigate('/ThankYou', { state: { source: effectiveSource, name: formData.name } });
      }
    } catch (submitError) {
      console.error('Error submitting lead:', submitError);
      setError('אירעה שגיאה, אנא נסה שוב');
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`text-center p-6 ${variant === 'card' ? 'bg-white rounded-2xl shadow-elegant' : ''}`}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">{successTitle}</h3>
        <p className="text-sm text-gray-600">{successMessage}</p>
      </motion.div>
    );
  }

  // Variants rendering
  const baseClasses = {
    default: '',
    card: 'bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100',
    compact: 'bg-white rounded-xl p-4',
    popup: ''
  };

  const containerClass = baseClasses[variant];

  return (
    <div className={containerClass}>
      {(title || subtitle) && (
        <div className="text-center mb-4">
          {title && (
            <h3 className={`font-black text-[#1E3A5F] mb-1 ${
              variant === 'popup' ? 'text-base' : 'text-2xl md:text-3xl'
            }`}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className={`text-gray-600 font-medium ${
              variant === 'popup' ? 'text-xs' : 'text-base'
            }`}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`space-y-${variant === 'compact' ? '2' : '3'}`}>
         {/* Name */}
         {fields.includes('name') && (
           <div>
             <label htmlFor="form-name" className="text-sm font-semibold text-gray-700 mb-2 block">שם מלא *</label>
             <div className="relative">
               <User className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${invertColors ? 'text-white/40' : 'text-[#1E3A5F]/40'}`} aria-hidden="true" />
               <Input
                 id="form-name"
                 placeholder="הקלד שם מלא"
                 value={formData.name}
                 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                 className={`pr-11 border-2 rounded-xl font-medium ${
                   invertColors 
                     ? 'border-white/30 bg-white/20 text-white placeholder-white/70 focus:border-white focus:ring-2 focus:ring-white/30'
                     : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20'
                 } ${variant === 'compact' ? 'h-11 text-base' : 'h-14 text-base sm:text-lg'}`}
                 required
                 aria-required="true"
                 aria-describedby="form-name-error"
               />
               {formData.name === '' && (
                 <p id="form-name-error" className="text-red-500 text-xs mt-1">📝 אנא הכנס שם מלא</p>
               )}
             </div>
           </div>
         )}

        {/* Phone */}
         {fields.includes('phone') && (
           <div>
             <label htmlFor="form-phone" className="text-sm font-semibold text-gray-700 mb-2 block">טלפון *</label>
             <div className="relative">
               <Phone className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${invertColors ? 'text-white/40' : 'text-[#1E3A5F]/40'}`} aria-hidden="true" />
               <Input
                 id="form-phone"
                 type="tel"
                 placeholder="הקלד מספר טלפון"
                 value={formData.phone}
                 onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                 className={`pr-11 border-2 rounded-xl font-medium ${
                   invertColors 
                     ? 'border-white/30 bg-white/20 text-white placeholder-white/70 focus:border-white focus:ring-2 focus:ring-white/30'
                     : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20'
                 } ${variant === 'compact' ? 'h-11 text-base' : 'h-14 text-base sm:text-lg'}`}
                 required
                 aria-required="true"
                 aria-describedby="form-phone-error"
               />
               {formData.phone === '' && (
                 <p id="form-phone-error" className="text-red-500 text-xs mt-1">📞 אנא הכנס מספר טלפון</p>
               )}
             </div>
           </div>
         )}

        {/* Email */}
         {fields.includes('email') && (
           <div>
             <label htmlFor="form-email" className="text-sm font-semibold text-gray-700 mb-2 block">מייל *</label>
             <div className="relative">
               <Mail className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${invertColors ? 'text-white/40' : 'text-[#1E3A5F]/40'}`} aria-hidden="true" />
               <Input
                 id="form-email"
                 type="email"
                 placeholder="הקלד כתובת מייל"
                 value={formData.email}
                 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                 className={`pr-11 border-2 rounded-xl font-medium ${
                   invertColors 
                     ? 'border-white/30 bg-white/20 text-white placeholder-white/70 focus:border-white focus:ring-2 focus:ring-white/30'
                     : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20'
                 } ${variant === 'compact' ? 'h-11 text-base' : 'h-14 text-base sm:text-lg'}`}
                 required
                 aria-required="true"
                 aria-describedby="form-email-error"
               />
               {formData.email === '' && (
                 <p id="form-email-error" className="text-red-500 text-xs mt-1">📧 אנא הכנס כתובת מייל</p>
               )}
             </div>
           </div>
         )}

        {/* General Error - Only shown if not field-specific */}
         {error && !error.includes('שם') && !error.includes('טלפון') && !error.includes('מייל') && (
           <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded" role="alert">
             <p className="text-red-700 text-sm font-medium">⚠️ {error}</p>
           </div>
         )}

        <div className="flex items-start space-x-3 space-x-reverse py-2">
            <Checkbox 
                id={`terms-${uniqueId}`}
                checked={formData.consent}
                onCheckedChange={(checked) => setFormData({...formData, consent: checked})}
                className={`mt-1 ${invertColors ? 'border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-green-600' : ''}`}
            />
            <div className="grid gap-1.5 leading-none">
                <label
                    htmlFor={`terms-${uniqueId}`}
                    className={`text-xs font-medium leading-relaxed ${invertColors ? 'text-white/90' : 'text-gray-500'}`}
                >
                    אני מאשר/ת את <Link to="/Terms" className="underline hover:text-current" target="_blank">תנאי השימוש</Link> ו<Link to="/Privacy" className="underline hover:text-current" target="_blank">מדיניות הפרטיות</Link> ומסכימ/ה לקבלת פניות ותוכן שיווקי.
                </label>
            </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className={`w-full text-white font-bold rounded-xl bg-gradient-to-r from-[#27AE60] to-[#2ECC71] hover:from-[#2ECC71] hover:to-[#27AE60] shadow-lg hover:shadow-xl transition-all active:scale-95 touch-manipulation ${
            variant === 'compact' ? 'h-11 text-sm' : 'h-16 text-lg sm:text-xl'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
              שולח...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 ml-2" />
              {ctaText}
            </>
          )}
        </Button>

        {/* Footer Trust Text */}
        <p className={`text-xs text-center font-bold ${invertColors ? 'text-white' : 'text-gray-500'}`}>
          🔒 ליווי אנושי • בלי ספאם
        </p>
      </form>
    </div>
  );
}