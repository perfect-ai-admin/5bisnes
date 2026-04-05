import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle, Check, ArrowLeft, ChevronDown, Send, Star, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const LEAD_WEBHOOK_URL = import.meta.env.VITE_N8N_LEAD_WEBHOOK_URL || 'https://n8n.perfect-1.one/webhook/perfect-one-incoming';

// --- Theme & Style Utilities ---
const getContrastColor = (hexColor) => {
    // Simple logic to decide text color based on background luminance
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#1e293b' : '#ffffff'; // slate-800 or white
};

const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2
        }
    }
};

export default function DynamicLandingPage({ data, isThumbnail = false }) {
    // Form state
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '', consent: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const uniqueId = React.useId();

    // Sticky CTA Logic
    const [showStickyCTA, setShowStickyCTA] = useState(false);
    useEffect(() => {
        if (isThumbnail) return;
        const handleScroll = () => setShowStickyCTA(window.scrollY > 600);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isThumbnail]);

    if (!data) return null;

    const { primary_color = '#2563EB', sections_json, business_name, slug } = data;
    const contrastColor = getContrastColor(primary_color);

    // CSS Variables for dynamic theming
    const themeStyle = {
        '--primary': primary_color,
        '--primary-foreground': contrastColor,
        '--primary-50': `${primary_color}0d`, // 5% opacity
        '--primary-100': `${primary_color}1a`, // 10% opacity
        '--primary-500': primary_color, // base
        '--primary-900': `${primary_color}e6`, // 90% opacity
    };

    const scrollToContact = () => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        
        if (!formData.phone.trim()) {
            toast.error('טלפון הוא שדה חובה');
            return;
        }

        if (!formData.consent) {
            toast.error('חובה לאשר את תנאי השימוש ומדיניות הפרטיות');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(LEAD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    message: formData.message,
                    pageSlug: slug,
                    businessName: business_name
                })
            });

            if (response.ok) {
                toast.success('הלידים שלך נשלחו בהצלחה!');
                setFormData({ name: '', phone: '', email: '', message: '', consent: false });
            } else {
                toast.error('שגיאה בשליחת הלידים');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            toast.error('שגיאה בשליחה: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getMotionProps = () => ({
        initial: isThumbnail ? "visible" : "hidden",
        animate: isThumbnail ? "visible" : undefined,
        whileInView: isThumbnail ? undefined : "visible",
        viewport: { once: true }
    });

    // --- Renderers ---

    const renderHero = (section, idx) => {
        const bgImage = section.image_prompt
            ? `https://image.pollinations.ai/prompt/${encodeURIComponent(section.image_prompt)}?width=1920&height=1080&nologo=true`
            : null;

        return (
            <header key={idx} className={`relative flex items-center justify-center overflow-hidden bg-slate-900 ${isThumbnail ? 'h-[600px]' : 'min-h-[90vh]'}`}>
                {/* Background Layer */}
                <div className="absolute inset-0 z-0">
                    {bgImage && (
                        <motion.img
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 0.4 }}
                            transition={{ duration: 1.5 }}
                            src={bgImage}
                            alt="Background"
                            className="w-full h-full object-cover mix-blend-overlay"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-transparent to-slate-900/90" />
                </div>

                {/* Content Layer */}
                <div className="relative z-10 container mx-auto px-6 text-center">
                    <motion.div
                        {...getMotionProps()}
                        variants={staggerContainer}
                        className="max-w-4xl mx-auto"
                    >
                        <motion.div variants={fadeInUp} className="mb-6 flex justify-center">
                            <span className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-blue-100 text-sm font-medium flex items-center gap-2">
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                {section.badge || 'המובילים בתחום'}
                            </span>
                        </motion.div>

                        <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-8 leading-[1.1] tracking-tight drop-shadow-xl">
                            {section.title}
                        </motion.h1>

                        <motion.p variants={fadeInUp} className="text-lg md:text-2xl text-slate-200 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
                            {section.subtitle}
                        </motion.p>

                        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Button
                                onClick={scrollToContact}
                                className="h-14 px-8 text-lg rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 hover:shadow-lg hover:shadow-[var(--primary)]/40 transition-all duration-300 font-bold"
                            >
                                {section.ctaText || 'התחל עכשיו'}
                                <ArrowLeft className="mr-2 w-5 h-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                                className="h-14 px-8 text-lg rounded-full text-white border border-white/20 hover:bg-white/10 transition-all duration-300"
                            >
                                גלה עוד
                                <ChevronDown className="mr-2 w-5 h-5" />
                            </Button>
                        </motion.div>
                    </motion.div>
                </div>
            </header>
        );
    };

    const renderStats = (section, idx) => (
        <section key={idx} className="py-20 bg-white relative z-20">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {section.items?.map((stat, i) => (
                        <motion.div
                            key={i}
                            {...getMotionProps()}
                            variants={{
                                hidden: { opacity: 0, y: 20 },
                                visible: { opacity: 1, y: 0 }
                            }}
                            transition={{ delay: i * 0.1 }}
                            className="text-center p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                            <div className="text-4xl md:text-5xl font-black text-[var(--primary)] mb-2">{stat.value}</div>
                            <div className="text-sm md:text-base text-slate-600 font-medium">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );

    const renderSuitedFor = (section, idx) => (
        <section key={idx} className="py-20 bg-gradient-to-b from-white to-slate-50">
            <div className="container mx-auto px-6">
                <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-16">{section.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
                    <motion.div {...getMotionProps()} className="space-y-4">
                        <h3 className="text-lg font-bold text-green-600 flex items-center gap-2">
                            <Check className="w-5 h-5" /> למי זה כן מתאים
                        </h3>
                        {section.suited?.map((item, i) => (
                            <div key={i} className="flex gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-700">{item}</span>
                            </div>
                        ))}
                    </motion.div>
                    <motion.div {...getMotionProps()} className="space-y-4">
                        <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" /> למי זה פחות מתאים
                        </h3>
                        {section.not_suited?.map((item, i) => (
                            <div key={i} className="flex gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-700">{item}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );

    const renderPainExpansion = (section, idx) => (
        <section key={idx} className="py-24 bg-slate-50 overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8">{section.title}</h2>
                    <motion.p {...getMotionProps()} className="text-lg text-slate-700 mb-12 leading-relaxed">
                        {section.description}
                    </motion.p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {section.items?.map((item, i) => (
                            <motion.div key={i} {...getMotionProps()} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ delay: i * 0.1 }} className="p-6 bg-white rounded-2xl border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                                <p className="text-slate-600 text-sm">{item.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );

    const renderHowItWorks = (section, idx) => (
        <section key={idx} className="py-24 bg-white">
            <div className="container mx-auto px-6">
                <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-16">{section.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
                    <div className="hidden md:block absolute top-1/3 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] via-[var(--primary)]/50 to-transparent -z-0" />
                    {section.steps?.map((step, i) => (
                        <motion.div key={i} {...getMotionProps()} variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }} transition={{ delay: i * 0.1 }} className="relative z-10">
                            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 rounded-full flex items-center justify-center text-white text-3xl font-black mb-6 shadow-lg">
                                {step.step}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 text-center mb-3">{step.title}</h3>
                            <p className="text-slate-600 text-center text-sm">{step.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );

    const renderWhyUs = (section, idx) => (
        <section key={idx} className="py-24 bg-gradient-to-b from-slate-50 to-white">
            <div className="container mx-auto px-6">
                <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-6">{section.title}</h2>
                {section.description && (
                    <p className="text-center text-lg text-slate-600 mb-12 max-w-2xl mx-auto">{section.description}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {section.items?.map((item, i) => (
                        <motion.div key={i} {...getMotionProps()} variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }} transition={{ delay: i * 0.1 }} className="p-8 bg-white rounded-2xl border-2 border-[var(--primary)]/10 hover:border-[var(--primary)]/30 transition-all">
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                            <p className="text-slate-600">{item.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );

    const renderHumanVoice = (section, idx) => (
         <section key={idx} className="py-32 bg-gradient-to-b from-white via-slate-50 to-white">
             <div className="container mx-auto px-6">
                 <h2 className="text-4xl md:text-5xl font-black text-center text-slate-900 mb-4">{section.title}</h2>
                 <p className="text-center text-slate-600 mb-20 text-lg max-w-2xl mx-auto">קולות אמיתיים של אנשים שהתחיל עם אנחנו</p>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                     {section.items?.map((item, i) => {
                         const bgColor = i === 0 ? 'from-blue-50 to-blue-100/50' : i === 1 ? 'from-purple-50 to-purple-100/50' : 'from-green-50 to-green-100/50';
                         const borderColor = i === 0 ? 'border-blue-200' : i === 1 ? 'border-purple-200' : 'border-green-200';
                         const badgeColor = i === 0 ? 'bg-blue-100 text-blue-700' : i === 1 ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700';

                         return (
                             <motion.div
                                 key={i}
                                 {...getMotionProps()}
                                 variants={{
                                     hidden: { opacity: 0, y: 40 },
                                     visible: { opacity: 1, y: 0 }
                                 }}
                                 transition={{ delay: i * 0.15 }}
                                 className={`p-8 rounded-3xl border-2 ${borderColor} bg-gradient-to-br ${bgColor} hover:shadow-xl transition-all duration-300`}
                             >
                                 <div className="flex items-start justify-between mb-4">
                                     <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${badgeColor} uppercase tracking-wide`}>
                                         {item.type === 'testimonial' ? 'לקוח' : item.type === 'founder_message' ? 'מייסד' : 'סיפור'}
                                     </span>
                                     {i === 0 && <span className="text-2xl">⭐</span>}
                                     {i === 1 && <span className="text-2xl">💡</span>}
                                     {i === 2 && <span className="text-2xl">❤️</span>}
                                 </div>

                                 <p className="text-slate-800 text-base leading-relaxed mb-6 font-medium min-h-[100px]">
                                     "{item.content}"
                                 </p>

                                 <div className="pt-4 border-t-2 border-current border-opacity-20">
                                     <p className="font-bold text-slate-900 text-sm">{item.author}</p>
                                     <p className="text-xs text-slate-600 mt-1">{item.role}</p>
                                 </div>
                             </motion.div>
                         );
                     })}
                 </div>
             </div>
         </section>
     );

    const renderFeatures = (section, idx) => (
        <section key={idx} id="features" className="py-24 bg-slate-50 overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">{section.title}</h2>
                    <p className="text-lg text-slate-600">{section.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {section.items?.map((item, i) => (
                        <motion.div
                            key={i}
                            {...getMotionProps()}
                            variants={{
                                hidden: { opacity: 0, y: 30 },
                                visible: { opacity: 1, y: 0 }
                            }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-[var(--primary-100)] flex items-center justify-center mb-6 text-[var(--primary)] group-hover:scale-110 transition-transform duration-300">
                                <Zap className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-4">{item.title}</h3>
                            <p className="text-slate-600 leading-relaxed">{item.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );

    const renderTestimonials = (section, idx) => (
        <section key={idx} className="py-24 bg-white">
            <div className="container mx-auto px-6">
                <h2 className="text-3xl md:text-5xl font-bold text-center text-slate-900 mb-16">{section.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {section.items?.map((item, i) => (
                        <motion.div
                            key={i}
                            {...getMotionProps()}
                            variants={{
                                hidden: { opacity: 0, scale: 0.95 },
                                visible: { opacity: 1, scale: 1 }
                            }}
                            transition={{ delay: i * 0.1 }}
                            className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 relative"
                        >
                            <div className="flex gap-1 mb-6">
                                {[...Array(5)].map((_, stars) => (
                                    <Star key={stars} className="w-4 h-4 fill-amber-400 text-amber-400" />
                                ))}
                            </div>
                            <p className="text-slate-700 text-lg mb-8 font-medium leading-relaxed">"{item.text}"</p>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                                    {item.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900">{item.name}</div>
                                    <div className="text-sm text-slate-500">{item.role || 'לקוח מאומת'}</div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );

    const renderContact = (section, idx) => (
        <section key={idx} id="contact" className="py-24 bg-slate-900 text-white relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--primary)] blur-[120px] opacity-20 rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500 blur-[120px] opacity-10 rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-4xl md:text-6xl font-black mb-6">{section.title || 'בואו נדבר'}</h2>
                        <p className="text-xl text-slate-300 mb-12 font-light">{section.subtitle || 'אנחנו זמינים לכל שאלה. השאירו פרטים ונחזור אליכם.'}</p>

                        <div className="space-y-6">
                            {section.phone && (
                                <a href={`tel:${section.phone}`} className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                                    <div className="w-12 h-12 rounded-full bg-[var(--primary)] flex items-center justify-center text-white">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-400">טלפון</div>
                                        <div className="text-xl font-bold dir-ltr text-right">{section.phone}</div>
                                    </div>
                                </a>
                            )}
                            {section.whatsapp && (
                                <a href={`https://wa.me/${section.whatsapp.replace(/[^0-9]/g, '')}`} className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                                    <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center text-white">
                                        <MessageCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-400">WhatsApp</div>
                                        <div className="text-xl font-bold">שלח הודעה</div>
                                    </div>
                                </a>
                            )}
                        </div>
                    </div>

                    <Card className="bg-white/5 backdrop-blur-xl border-white/10 p-8 md:p-10 rounded-[2rem] shadow-2xl">
                        <form className="space-y-5" onSubmit={handleSubmitForm}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {section.form_fields?.includes('name') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">שם מלא</label>
                                        <Input 
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-[var(--primary)]" 
                                            placeholder="ישראל ישראלי" 
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                )}
                                {section.form_fields?.includes('phone') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">טלפון *</label>
                                        <Input 
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-[var(--primary)]" 
                                            placeholder="050-0000000" 
                                            disabled={isSubmitting}
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                            
                            {section.form_fields?.includes('email') && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">אימייל</label>
                                    <Input 
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-[var(--primary)]" 
                                        placeholder="example@mail.com"
                                        type="email"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            )}
                            
                            {section.form_fields?.includes('message') && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">הודעה</label>
                                    <Textarea 
                                        value={formData.message}
                                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                                        className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-[var(--primary)] resize-none" 
                                        placeholder="כיצד נוכל לעזור?"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            )}

                            <div className="flex items-start space-x-3 space-x-reverse">
                                <Checkbox 
                                    id={`terms-${uniqueId}`}
                                    checked={formData.consent}
                                    onCheckedChange={(checked) => setFormData({...formData, consent: checked})}
                                    className="mt-1 border-white/30 data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label
                                        htmlFor={`terms-${uniqueId}`}
                                        className="text-xs text-slate-300 font-medium leading-relaxed"
                                    >
                                        אני מאשר/ת את <Link to="/Terms" className="underline hover:text-white" target="_blank">תנאי השימוש</Link> ו<Link to="/Privacy" className="underline hover:text-white" target="_blank">מדיניות הפרטיות</Link> ומסכימ/ה לקבלת פניות ותוכן שיווקי.
                                    </label>
                                </div>
                            </div>

                            <Button 
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-14 text-lg font-bold bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 rounded-xl mt-4 shadow-lg shadow-[var(--primary)]/25 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                                        שולח...
                                    </>
                                ) : (
                                    <>
                                        {section.ctaText || 'שליחת פרטים'}
                                        <Send className="mr-2 w-5 h-5" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </Card>
                </div>
            </div>
        </section>
    );

    const renderFAQ = (section, idx) => (
        <section key={idx} className="py-24 bg-white">
            <div className="max-w-3xl mx-auto px-6">
                <h2 className="text-3xl md:text-5xl font-bold text-center text-slate-900 mb-16">{section.title}</h2>
                <div className="space-y-4">
                    {section.items?.map((item, i) => (
                        <Accordion key={i} type="single" collapsible className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                            <AccordionItem value={`item-${i}`} className="border-0">
                                <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-slate-100 transition-colors text-lg font-bold text-slate-800">
                                    {item.question}
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 text-slate-600 leading-relaxed text-base bg-slate-50">
                                    {item.answer}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ))}
                </div>
            </div>
        </section>
    );

    // --- Main Component Return ---

    return (
        <div
            style={themeStyle}
            className={`font-sans bg-slate-50 selection:bg-[var(--primary)] selection:text-[var(--primary-foreground)] ${isThumbnail ? 'overflow-hidden rounded-t-xl' : 'min-h-screen'}`}
            dir="rtl"
        >
            {/* Sticky CTA (Mobile/Desktop) */}
            <AnimatePresence>
                {!isThumbnail && showStickyCTA && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-slate-200 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
                    >
                        <div className="container mx-auto flex items-center justify-between">
                            <div className="hidden md:block">
                                <div className="font-bold text-slate-900">{business_name}</div>
                                <div className="text-sm text-slate-500">אנחנו כאן כדי לעזור לך להצליח</div>
                            </div>
                            <Button
                                onClick={scrollToContact}
                                className="w-full md:w-auto h-12 px-8 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] font-bold shadow-lg"
                            >
                                צור קשר עכשיו
                                <ArrowLeft className="mr-2 w-4 h-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sections Loop */}
            {sections_json?.map((section, idx) => {
                switch (section.type) {
                    case 'hero': return renderHero(section, idx);
                    case 'suited_for': return renderSuitedFor(section, idx);
                    case 'pain_expansion': return renderPainExpansion(section, idx);
                    case 'how_it_works': return renderHowItWorks(section, idx);
                    case 'why_us': return renderWhyUs(section, idx);
                    case 'human_voice': return section.items && section.items.length > 0 ? renderHumanVoice(section, idx) : null;
                    case 'features': 
                    case 'pain_points': // Handle pain_points same as features
                        return renderFeatures(section, idx);
                    case 'stats': return renderStats(section, idx);
                    case 'testimonials': return renderTestimonials(section, idx);
                    case 'contact': return renderContact(section, idx);
                    case 'faq': return renderFAQ(section, idx);
                    case 'process': // Simple process fallback reused features style or custom
                        return (
                            <section key={idx} className="py-24 bg-white">
                                <div className="container mx-auto px-6 text-center">
                                    <h2 className="text-3xl md:text-5xl font-bold mb-16">{section.title}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                                        <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-slate-100 -z-0" />
                                        {section.steps?.map((step, i) => (
                                            <div key={i} className="relative z-10">
                                                <div className="w-24 h-24 mx-auto bg-white rounded-full border-4 border-[var(--primary)] flex items-center justify-center text-3xl font-black text-[var(--primary)] mb-6 shadow-xl">
                                                    {i + 1}
                                                </div>
                                                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                                <p className="text-slate-600 max-w-xs mx-auto">{step.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        );
                    default: return null;
                }
            })}

            <footer className="bg-slate-950 text-slate-400 py-12 border-t border-white/5">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p>© {new Date().getFullYear()} {business_name}. כל הזכויות שמורות.</p>
                    <div className="flex gap-6">
                        <span className="hover:text-white cursor-pointer transition-colors">תנאי שימוש</span>
                        <span className="hover:text-white cursor-pointer transition-colors">מדיניות פרטיות</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}