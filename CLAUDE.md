# פרפקט וואן - פורטל עסקי ישראלי

## מידע בסיסי
- **מותג:** פרפקט וואן | perfect-dashboard.com
- **שפת תוכן:** עברית בלבד, RTL
- **סוג אתר:** SPA (React + Vite), אין SSR — תוכן מוגש כ-JSON ומרונדר בצד לקוח

## תוכנית SEO
תוכנית התוכן המלאה נמצאת ב-`seo-plan-500-keywords.md` — קרא רק כשעובדים על SEO/תוכן.

## מבנה URLs
```
/                        → דף בית
/{category}              → רכזת קטגוריה
/{category}/{slug}       → מאמר
/compare/{slug}          → דף השוואה
```

## כללי תוכן
- כל מאמר: JSON ב-`src/content/{category}/{slug}.json`
- שדות חובה: `metaTitle` (60 תו), `metaDescription` (155 תו), `keywords`, `sections` (5+), `faq`
- סוגי sections: `text` | `list` | `steps` | `callout` | `faq` | `quote` | `comparison` | `cta-inline`
- אחרי הוספת מאמרים: עדכן `public/sitemap.xml`
- אחרי הוספת קטגוריה: עדכן `src/portal/config/navigation.js`
- CTA בכל עמוד: טופס לידים + WhatsApp
