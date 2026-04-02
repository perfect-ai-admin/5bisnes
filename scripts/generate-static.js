/**
 * Static HTML Generator for SEO
 * Generates static HTML pages from JSON content — NO browser needed.
 * Works on Vercel, Netlify, GitHub Actions — anywhere Node.js runs.
 *
 * Each generated page includes:
 * - Unique <title>, <meta description>, <canonical>
 * - Open Graph + Twitter Card tags
 * - JSON-LD Schema (Article, FAQ, BreadcrumbList, Organization)
 * - The actual article content as readable HTML
 * - React app script that hydrates on top for interactivity
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve, join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '../dist');
const CONTENT_DIR = resolve(__dirname, '../src/content');
const BASE_URL = 'https://www.perfect1.co.il';
const BRAND = 'פרפקט וואן';

// Read the base index.html from dist
function getBaseHtml() {
  return readFileSync(join(DIST_DIR, 'index.html'), 'utf-8');
}

// Discover all portal routes from content JSON files
function discoverRoutes() {
  const routes = [];
  const categories = ['osek-patur', 'osek-murshe', 'hevra-bam', 'sgirat-tikim', 'guides'];

  for (const cat of categories) {
    // Category hub page
    const catFile = join(CONTENT_DIR, cat, '_category.json');
    if (existsSync(catFile)) {
      const catData = JSON.parse(readFileSync(catFile, 'utf-8'));
      routes.push({
        path: `/${cat}`,
        type: 'category',
        data: catData,
        category: cat
      });
    }

    // Article pages
    const catDir = join(CONTENT_DIR, cat);
    if (existsSync(catDir)) {
      for (const file of readdirSync(catDir)) {
        if (file.startsWith('_') || extname(file) !== '.json') continue;
        const slug = file.replace('.json', '');
        const data = JSON.parse(readFileSync(join(catDir, file), 'utf-8'));
        routes.push({
          path: `/${cat}/${slug}`,
          type: 'article',
          data,
          category: cat
        });
      }
    }
  }

  // Comparison pages
  const compDir = join(CONTENT_DIR, 'comparisons');
  if (existsSync(compDir)) {
    for (const file of readdirSync(compDir)) {
      if (extname(file) !== '.json') continue;
      const data = JSON.parse(readFileSync(join(compDir, file), 'utf-8'));
      routes.push({
        path: `/compare/${file.replace('.json', '')}`,
        type: 'comparison',
        data,
        category: 'comparisons'
      });
    }
  }

  return routes;
}

// Generate SEO meta tags
function generateMetaTags(route) {
  const { data, path } = route;
  const url = `${BASE_URL}${path}`;

  const title = data.metaTitle || data.heroTitle || data.title || BRAND;
  const description = data.metaDescription || data.description || '';
  const keywords = (data.keywords || []).join(', ');

  return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(keywords)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="he_IL" />
    <meta property="og:site_name" content="${BRAND}" />
    <meta property="og:image" content="${BASE_URL}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
  `;
}

// Generate JSON-LD Schema
function generateSchema(route) {
  const { data, path, type } = route;
  const url = `${BASE_URL}${path}`;
  const schemas = [];

  // BreadcrumbList
  const breadcrumbs = [{ name: 'דף הבית', url: BASE_URL }];
  if (route.category && route.category !== 'comparisons') {
    const catNames = {
      'osek-patur': 'עוסק פטור',
      'osek-murshe': 'עוסק מורשה',
      'hevra-bam': 'חברה בע"מ',
      'sgirat-tikim': 'סגירת תיקים',
      'guides': 'מדריכים'
    };
    breadcrumbs.push({ name: catNames[route.category] || route.category, url: `${BASE_URL}/${route.category}` });
  }
  if (type === 'article' || type === 'comparison') {
    breadcrumbs.push({ name: data.heroTitle || data.title || '', url });
  }

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((bc, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: bc.name,
      item: bc.url
    }))
  });

  // Article schema
  if (type === 'article' && data.sections) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.heroTitle || data.metaTitle || '',
      description: data.metaDescription || '',
      datePublished: data.publishDate || '',
      dateModified: data.updatedDate || data.publishDate || '',
      author: {
        '@type': 'Person',
        name: data.author?.name || BRAND
      },
      publisher: {
        '@type': 'Organization',
        name: BRAND,
        url: BASE_URL
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url }
    });
  }

  // FAQ schema
  const faqSection = data.sections?.find(s => s.type === 'faq');
  const faqItems = faqSection?.items || data.faq;
  if (faqItems?.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer
        }
      }))
    });
  }

  return schemas.map(s =>
    `<script type="application/ld+json">${JSON.stringify(s)}</script>`
  ).join('\n    ');
}

// Generate readable HTML content from article sections
function generateContent(route) {
  const { data, type } = route;
  if (type === 'category') {
    return generateCategoryContent(data);
  }

  const sections = data.sections || [];
  let html = '';

  if (data.heroTitle) {
    html += `<h1>${escapeHtml(data.heroTitle)}</h1>\n`;
  }
  if (data.heroSubtitle) {
    html += `<p>${escapeHtml(data.heroSubtitle)}</p>\n`;
  }

  for (const section of sections) {
    switch (section.type) {
      case 'text':
        html += `<h2>${escapeHtml(section.title || '')}</h2>\n`;
        html += `<div>${formatContent(section.content || '')}</div>\n`;
        break;

      case 'list':
        html += `<h2>${escapeHtml(section.title || '')}</h2>\n`;
        if (section.description) html += `<p>${escapeHtml(section.description)}</p>\n`;
        html += '<ul>\n';
        for (const item of (section.items || [])) {
          html += `  <li><strong>${escapeHtml(item.title || '')}</strong>: ${escapeHtml(item.description || '')}</li>\n`;
        }
        html += '</ul>\n';
        break;

      case 'steps':
        html += `<h2>${escapeHtml(section.title || '')}</h2>\n`;
        html += '<ol>\n';
        for (const step of (section.steps || [])) {
          html += `  <li><strong>${escapeHtml(step.title || '')}</strong>: ${escapeHtml(step.description || '')}</li>\n`;
        }
        html += '</ol>\n';
        break;

      case 'faq':
        html += `<h2>${escapeHtml(section.title || '')}</h2>\n`;
        for (const item of (section.items || [])) {
          html += `<h3>${escapeHtml(item.question)}</h3>\n`;
          html += `<p>${escapeHtml(item.answer)}</p>\n`;
        }
        break;

      case 'callout':
        html += `<aside><strong>${escapeHtml(section.title || '')}</strong>: ${escapeHtml(section.content || '')}</aside>\n`;
        break;

      case 'cta-inline':
        html += `<div><strong>${escapeHtml(section.title || '')}</strong> — ${escapeHtml(section.description || '')}</div>\n`;
        break;
    }
  }

  return html;
}

function generateCategoryContent(data) {
  let html = `<h1>${escapeHtml(data.title || '')}</h1>\n`;
  html += `<p>${escapeHtml(data.description || '')}</p>\n`;

  if (data.subcategories?.length) {
    html += '<h2>נושאים</h2>\n<ul>\n';
    for (const sub of data.subcategories) {
      html += `  <li>${escapeHtml(sub.title)}</li>\n`;
    }
    html += '</ul>\n';
  }

  if (data.articles?.length) {
    html += '<h2>מאמרים</h2>\n<ul>\n';
    for (const article of data.articles) {
      html += `  <li>${escapeHtml(article.title)}</li>\n`;
    }
    html += '</ul>\n';
  }

  if (data.faq?.length) {
    html += '<h2>שאלות נפוצות</h2>\n';
    for (const item of data.faq) {
      html += `<h3>${escapeHtml(item.question)}</h3>\n`;
      html += `<p>${escapeHtml(item.answer)}</p>\n`;
    }
  }

  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatContent(text) {
  return escapeHtml(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
}

// Main: inject SEO content into each page's HTML
function generate() {
  const routes = discoverRoutes();
  console.log(`\n📄 Generating static HTML for ${routes.length} portal pages:\n`);

  if (!existsSync(DIST_DIR)) {
    console.error('❌ dist/ not found. Run `vite build` first.');
    process.exit(1);
  }

  const baseHtml = getBaseHtml();
  let count = 0;

  for (const route of routes) {
    const metaTags = generateMetaTags(route);
    const schemas = generateSchema(route);
    const content = generateContent(route);

    // Start with base HTML
    let html = baseHtml;

    // Replace <title> and meta tags in <head>
    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta name="description"[^>]*>/, '');
    html = html.replace(/<meta name="keywords"[^>]*>/, '');
    html = html.replace(/<link rel="canonical"[^>]*>/, '');
    html = html.replace(/<meta property="og:title"[^>]*>/, '');
    html = html.replace(/<meta property="og:description"[^>]*>/, '');
    html = html.replace(/<meta property="og:url"[^>]*>/, '');
    html = html.replace(/<meta property="og:site_name"[^>]*>/, '');
    html = html.replace(/<meta name="twitter:title"[^>]*>/, '');
    html = html.replace(/<meta name="twitter:description"[^>]*>/, '');

    // Inject new meta tags after <head>
    html = html.replace('<head>', `<head>\n    <meta name="prerender-status" content="200">\n    ${metaTags}`);

    // Inject schemas before </head>
    html = html.replace('</head>', `    ${schemas}\n  </head>`);

    // Inject content inside #root for SEO (React will hydrate over this)
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root"><div dir="rtl" class="portal-root" style="font-family:Heebo,sans-serif">\n${content}\n</div></div>`
    );

    // Write the file
    const outputDir = join(DIST_DIR, ...route.path.split('/').filter(Boolean));
    mkdirSync(outputDir, { recursive: true });
    const outputFile = join(outputDir, 'index.html');
    writeFileSync(outputFile, html, 'utf-8');

    count++;
    console.log(`  ✅ ${route.path}`);
  }

  console.log(`\n📊 Generated ${count} static HTML pages`);
  console.log(`📁 Output: ${DIST_DIR}\n`);
}

// SEO data for public pages that aren't JSON-based portal pages.
// Each gets unique meta tags so Google sees the right title/description/canonical.
const PUBLIC_PAGES_SEO = {
  '/About': {
    title: 'אודות פרפקט וואן — הסיפור שלנו | פרפקט וואן',
    description: 'פרפקט וואן מלווה בעלי עסקים בישראל בפתיחת עוסק פטור, עוסק מורשה וחברה בע״מ. גלו מי אנחנו ואיך אנחנו עוזרים.',
    keywords: 'אודות פרפקט וואן, פרפקט וואן, ליווי עסקי',
  },
  '/FAQ': {
    title: 'שאלות נפוצות — פתיחת עסק בישראל | פרפקט וואן',
    description: 'תשובות לשאלות הנפוצות ביותר על פתיחת עוסק פטור, עוסק מורשה, חברה בע״מ, מיסוי ורישום עסק בישראל.',
    keywords: 'שאלות נפוצות פתיחת עסק, FAQ עוסק פטור, שאלות ותשובות עסק',
  },
  '/Pricing': {
    title: 'מחירון שירותים — פתיחת עסק וליווי מקצועי | פרפקט וואן',
    description: 'מחירים שקופים לפתיחת עוסק פטור, עוסק מורשה וחברה בע״מ. ליווי מקצועי, לוגו, כרטיס ביקור דיגיטלי ועוד.',
    keywords: 'מחירים פתיחת עסק, עלות פתיחת עוסק פטור, מחירון שירותים עסקיים',
  },
  '/Features': {
    title: 'תכונות ושירותים — הכלים שלנו לבעלי עסקים | פרפקט וואן',
    description: 'כל הכלים והשירותים שפרפקט וואן מציעה: פתיחת עסק, לוגו חכם, כרטיס ביקור דיגיטלי, מצגת עסקית ועוד.',
    keywords: 'שירותים לעסקים, כלים לעסקים, פרפקט וואן שירותים',
  },
  '/Privacy': {
    title: 'מדיניות פרטיות | פרפקט וואן',
    description: 'מדיניות הפרטיות של פרפקט וואן — כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם.',
    keywords: 'מדיניות פרטיות, פרטיות פרפקט וואן',
    noindex: false,
  },
  '/Terms': {
    title: 'תנאי שימוש | פרפקט וואן',
    description: 'תנאי השימוש של אתר פרפקט וואן — כללים, אחריות ותנאים לשימוש בשירותים.',
    keywords: 'תנאי שימוש, תנאים פרפקט וואן',
    noindex: false,
  },
  '/SmartLogo': {
    title: 'לוגו חכם לעסק — עיצוב לוגו מקצועי בדקות | פרפקט וואן',
    description: 'צרו לוגו מקצועי לעסק שלכם בדקות. עיצוב לוגו חכם עם AI — מותאם אישית, איכות גבוהה, מחיר נגיש.',
    keywords: 'לוגו לעסק, עיצוב לוגו, לוגו מקצועי, לוגו חכם, לוגו AI',
  },
  '/DigitalBusinessCard': {
    title: 'כרטיס ביקור דיגיטלי לעסק — צרו כרטיס ביקור אונליין | פרפקט וואן',
    description: 'כרטיס ביקור דיגיטלי מקצועי לעסק שלכם. שתפו פרטי קשר, לוגו וקישורים — הכל בקליק אחד.',
    keywords: 'כרטיס ביקור דיגיטלי, כרטיס ביקור אונליין, כרטיס ביקור לעסק',
  },
  '/BusinessPresentation': {
    title: 'מצגת עסקית מקצועית — צרו מצגת לעסק שלכם | פרפקט וואן',
    description: 'צרו מצגת עסקית מקצועית בדקות. מותאמת אישית לעסק שלכם עם עיצוב מרשים ותוכן ממוקד.',
    keywords: 'מצגת עסקית, מצגת לעסק, מצגת מקצועית, עיצוב מצגת',
  },
  '/BusinessSticker': {
    title: 'סטיקר לעסק — עיצוב סטיקרים מקצועיים | פרפקט וואן',
    description: 'עצבו סטיקרים מקצועיים לעסק שלכם — לוגו, פרטי קשר ועיצוב מותאם אישית. הדפסה באיכות גבוהה.',
    keywords: 'סטיקר לעסק, סטיקרים מקצועיים, עיצוב סטיקר, סטיקרים עסקיים',
  },
  '/OsekPaturLanding': {
    title: 'פתיחת עוסק פטור אונליין | ליווי מקצועי מהתחלה ועד הסוף — פרפקט וואן',
    description: 'רוצים לפתוח עוסק פטור? קבלו ליווי מקצועי מלא — בדיקת התאמה חינם, הכוונה לפתיחת תיקים. בלי בירוקרטיה, בלי טעויות.',
    keywords: 'פתיחת עוסק פטור, פתיחת עוסק פטור אונליין, ליווי פתיחת עוסק פטור',
  },
  '/OsekPaturSteps': {
    title: 'איך פותחים עוסק פטור — המדריך המלא לפתיחת עוסק פטור בישראל | פרפקט וואן',
    description: 'רוצים לפתוח עוסק פטור? במדריך הזה תגלו את כל השלבים, המסמכים והטיפים לפתיחת עוסק פטור בישראל.',
    keywords: 'איך פותחים עוסק פטור, שלבים לפתיחת עוסק פטור, פתיחת עוסק פטור מדריך',
  },
  '/patur-vs-murshe': {
    title: 'עוסק פטור או מורשה — מה באמת מתאים לך? | פרפקט וואן',
    description: 'בדקו מה ההבדל בין עוסק פטור לעוסק מורשה ומה מתאים לכם. השוואה מלאה + ייעוץ חינם ללא התחייבות.',
    keywords: 'עוסק פטור או מורשה, מה ההבדל בין עוסק פטור למורשה, מה עדיף עוסק פטור או מורשה',
  },
  '/patur-vs-murshe-quiz': {
    title: 'עוסק פטור או מורשה – בדיקה חכמה תוך 30 שניות | פרפקט וואן',
    description: 'בדקו תוך 30 שניות האם עוסק פטור או עוסק מורשה מתאים לכם. בדיקה חינם ללא התחייבות.',
    keywords: 'עוסק פטור או מורשה, איך לבחור עוסק פטור או מורשה, בדיקת התאמה עוסק פטור',
  },
  '/accountant-osek-patur': {
    title: 'רואה חשבון לעוסק פטור – כמה עולה ניהול עוסק פטור? | פרפקט וואן',
    description: 'מחפשים רואה חשבון לעוסק פטור? בדיקה קצרה יכולה לחסוך מאות שקלים בשנה. קבלו הצעת מחיר לניהול עוסק פטור.',
    keywords: 'רואה חשבון לעוסק פטור, כמה עולה רואה חשבון לעוסק פטור, ניהול עוסק פטור, עלות רואה חשבון לעוסק פטור',
  },
  '/blog/logo-leasek': {
    title: 'לוגו לעסק — למה חשוב ואיך לעצב אחד מושלם | פרפקט וואן',
    description: 'למה כל עסק צריך לוגו מקצועי? מדריך מקיף על עיצוב לוגו לעסק — טיפים, דוגמאות ופתרונות.',
    keywords: 'לוגו לעסק, עיצוב לוגו, לוגו מקצועי, לוגו לעסק קטן',
  },
  '/blog/kartis-bikur-digitali': {
    title: 'כרטיס ביקור דיגיטלי — המדריך המלא | פרפקט וואן',
    description: 'כל מה שצריך לדעת על כרטיס ביקור דיגיטלי: למה כדאי, איך יוצרים, ומה היתרונות על כרטיס מודפס.',
    keywords: 'כרטיס ביקור דיגיטלי, כרטיס ביקור אונליין, כרטיס דיגיטלי לעסק',
  },
  '/blog/daf-nchita': {
    title: 'דף נחיתה לעסק — איך יוצרים דף נחיתה שממיר | פרפקט וואן',
    description: 'מדריך ליצירת דף נחיתה שממיר: עקרונות עיצוב, תוכן שמוכר, וטיפים מעשיים לבעלי עסקים.',
    keywords: 'דף נחיתה, דף נחיתה לעסק, איך ליצור דף נחיתה, דף נחיתה שממיר',
  },
  '/blog/matzget-iskit': {
    title: 'מצגת עסקית — איך להכין מצגת שמרשימה | פרפקט וואן',
    description: 'מדריך להכנת מצגת עסקית מקצועית: מבנה, עיצוב, תוכן וטיפים ליצירת מצגת שמשיגה תוצאות.',
    keywords: 'מצגת עסקית, מצגת לעסק, איך להכין מצגת, מצגת מקצועית',
  },
  '/blog/matzget-mashkiim': {
    title: 'מצגת למשקיעים — איך להכין Pitch Deck מנצח | פרפקט וואן',
    description: 'מדריך מלא להכנת מצגת למשקיעים (Pitch Deck): מבנה, תוכן, עיצוב וטיפים מעשיים לגיוס הון.',
    keywords: 'מצגת למשקיעים, pitch deck, מצגת גיוס הון, מצגת סטארטאפ',
  },
  '/blog/sticker-leasek': {
    title: 'סטיקר לעסק — למה זה חשוב ואיך לעצב נכון | פרפקט וואן',
    description: 'מדריך לעיצוב סטיקר מקצועי לעסק: סוגים, גדלים, עיצוב וטיפים למיתוג אפקטיבי.',
    keywords: 'סטיקר לעסק, עיצוב סטיקר, סטיקר מותאם אישית, סטיקר עסקי',
  },
};

// Generate HTML for public pages with unique SEO meta tags
function generatePublicPages() {
  const baseHtml = getBaseHtml();
  let count = 0;

  console.log(`\n🌐 Generating SEO-optimized public pages:\n`);

  for (const [pagePath, seo] of Object.entries(PUBLIC_PAGES_SEO)) {
    const url = `${BASE_URL}${pagePath}`;
    let html = baseHtml;

    // Remove existing meta tags from base HTML
    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta name="description"[^>]*>/, '');
    html = html.replace(/<meta name="keywords"[^>]*>/, '');
    html = html.replace(/<link rel="canonical"[^>]*>/, '');
    html = html.replace(/<meta property="og:title"[^>]*>/, '');
    html = html.replace(/<meta property="og:description"[^>]*>/, '');
    html = html.replace(/<meta property="og:url"[^>]*>/, '');
    html = html.replace(/<meta property="og:site_name"[^>]*>/, '');
    html = html.replace(/<meta name="twitter:title"[^>]*>/, '');
    html = html.replace(/<meta name="twitter:description"[^>]*>/, '');

    // Build page-specific meta tags
    const metaTags = `
    <title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="keywords" content="${escapeHtml(seo.keywords)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="he_IL" />
    <meta property="og:site_name" content="${BRAND}" />
    <meta property="og:image" content="${BASE_URL}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    `;

    html = html.replace('<head>', `<head>\n    <meta name="prerender-status" content="200">\n    ${metaTags}`);

    // Write the file
    const outputDir = join(DIST_DIR, ...pagePath.split('/').filter(Boolean));
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'index.html'), html, 'utf-8');
    count++;
    console.log(`  ✅ ${pagePath}`);
  }

  console.log(`\n📊 Generated ${count} SEO-optimized public pages`);
}

// Auto-discover SPA routes from pages.config.js exports
function discoverAppRoutes() {
  const pagesConfigPath = resolve(__dirname, '../src/pages.config.js');
  const content = readFileSync(pagesConfigPath, 'utf-8');

  // Extract page keys from the PAGES object (e.g., "APP": ..., "Home": ..., "blog/logo-leasek": ...)
  const pageKeys = [];
  const pagesMatch = content.match(/export\s+const\s+PAGES\s*=\s*\{([\s\S]*?)\}/);
  if (pagesMatch) {
    const body = pagesMatch[1];
    const keyRegex = /"([^"]+)"\s*:/g;
    let m;
    while ((m = keyRegex.exec(body)) !== null) {
      pageKeys.push(`/${m[1]}`);
    }
  }

  // Add extra routes that aren't in PAGES but need SPA fallback
  const extraRoutes = [
    '/CRM',
    '/CRM/leads',
    '/CRM/dashboard',
    '/CRM/tasks',
    '/CRM/settings',
    '/DigitalCard',
    '/open-osek-patur',
    '/patur-vs-murshe',
    '/patur-vs-murshe-quiz',
    '/accountant-osek-patur',
    '/ThankYou',
    '/OsekPaturLanding',
  ];

  const allRoutes = [...new Set([...pageKeys, ...extraRoutes])];
  return allRoutes;
}

// Copy base index.html to SPA routes that aren't pre-rendered
// This ensures Vercel serves the SPA shell for non-portal routes
function generateSPAFallbacks() {
  const spaRoutes = discoverAppRoutes();

  const baseHtml = getBaseHtml();
  let count = 0;

  for (const route of spaRoutes) {
    const outputDir = join(DIST_DIR, ...route.split('/').filter(Boolean));
    // Skip if already has a pre-rendered file
    if (existsSync(join(outputDir, 'index.html'))) continue;

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'index.html'), baseHtml, 'utf-8');
    count++;
    console.log(`  📋 ${route} (SPA fallback)`);
  }

  if (count > 0) {
    console.log(`\n📊 Generated ${count} SPA fallback pages`);
  }
}

generate();
generatePublicPages();
generateSPAFallbacks();
