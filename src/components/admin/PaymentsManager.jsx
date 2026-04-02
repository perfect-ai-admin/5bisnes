import React, { useEffect, useState } from 'react';
import { invokeFunction } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Search, Download, ChevronDown, ChevronUp, User, Mail, Phone, CreditCard, Hash, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

function safeFormat(dateVal, fmt) {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? '-' : format(d, fmt);
}
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PlansManager from './PlansManager';

const STATUS_LABELS = {
    completed: 'שולם',
    pending: 'ממתין',
    failed: 'נכשל',
    cancelled: 'בוטל'
};

const PRODUCT_TYPE_LABELS = {
    plan: 'מסלול',
    goal: 'מטרה',
    'landing-page': 'דף נחיתה',
    cart: 'עגלה',
    'one-time': 'חד פעמי',
    service: 'שירות'
};

export default function PaymentsManager() {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        try {
            const response = await invokeFunction('adminListPayments');
            if (response) {
                setPayments(response.payments || []);
            }
        } catch (error) {
            console.error("Failed to fetch payments", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPayments = payments.filter(payment => {
        const term = searchTerm.toLowerCase();
        return (
            payment.user_id?.toLowerCase().includes(term) ||
            payment.user_name?.toLowerCase().includes(term) ||
            payment.user_email?.toLowerCase().includes(term) ||
            payment.product_name?.toLowerCase().includes(term) ||
            payment.amount?.toString().includes(term) ||
            payment.transaction_id?.toLowerCase().includes(term)
        );
    });

    const exportCSV = () => {
        const headers = ["תאריך", "סכום", "מטבע", "מוצר", "סוג", "סטטוס", "שם משתמש", "אימייל", "טלפון", "מזהה עסקה"];
        const rows = filteredPayments.map(p => [
            safeFormat(p.created_date, 'yyyy-MM-dd HH:mm'),
            p.amount,
            p.currency,
            p.product_name,
            p.product_type,
            p.status,
            p.user_name,
            p.user_email,
            p.user_phone,
            p.transaction_id || ''
        ]);
        
        const csvContent = "\uFEFF" + [
            headers.join(","),
            ...rows.map(r => r.map(v => `"${v || ''}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "payments_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'failed': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const markAsCompleted = async (paymentId) => {
        try {
            await invokeFunction('adminMarkPaymentCompleted', { payment_id: paymentId });
            toast.success('התשלום סומן כ"שולם"');
            fetchPayments();
        } catch (error) {
            toast.error('שגיאה בעדכון סטטוס');
            console.error(error);
        }
    };

    const completedCount = payments.filter(p => p.status === 'completed').length;
    const pendingCount = payments.filter(p => p.status === 'pending').length;
    const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);

    return (
        <div className="space-y-6">
            <Tabs defaultValue="payments" className="w-full">
                <TabsList>
                    <TabsTrigger value="payments">רשימת תשלומים</TabsTrigger>
                    <TabsTrigger value="plans">ניהול מסלולים</TabsTrigger>
                </TabsList>

                <TabsContent value="payments">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-sm text-gray-500">סה"כ הכנסות</p>
                                <p className="text-2xl font-bold text-green-600">₪{totalRevenue.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-sm text-gray-500">שולם</p>
                                <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-sm text-gray-500">ממתין</p>
                                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>היסטוריית תשלומים ({filteredPayments.length})</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="icon" onClick={() => { setLoading(true); fetchPayments(); }}>
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                                <div className="relative">
                                    <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="חיפוש לפי שם, אימייל, מוצר..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pr-8 w-64"
                                    />
                                </div>
                                <Button variant="outline" onClick={exportCSV}>
                                    <Download className="w-4 h-4 ml-2" />
                                    ייצוא CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right w-8"></TableHead>
                                        <TableHead className="text-right">תאריך</TableHead>
                                        <TableHead className="text-right">משתמש</TableHead>
                                        <TableHead className="text-right">מוצר</TableHead>
                                        <TableHead className="text-right">סכום</TableHead>
                                        <TableHead className="text-right">סטטוס</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8">טוען...</TableCell>
                                        </TableRow>
                                    ) : filteredPayments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8">לא נמצאו תשלומים</TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredPayments.map((payment) => (
                                            <React.Fragment key={payment.id}>
                                                <TableRow 
                                                    className="cursor-pointer hover:bg-gray-50"
                                                    onClick={() => setExpandedId(expandedId === payment.id ? null : payment.id)}
                                                >
                                                    <TableCell className="w-8">
                                                        {expandedId === payment.id ? 
                                                            <ChevronUp className="w-4 h-4 text-gray-400" /> : 
                                                            <ChevronDown className="w-4 h-4 text-gray-400" />
                                                        }
                                                    </TableCell>
                                                    <TableCell className="text-sm">{safeFormat(payment.created_date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <span className="font-medium text-sm">{payment.user_name || 'לא ידוע'}</span>
                                                            {payment.user_email && (
                                                                <span className="text-xs text-gray-400 block">{payment.user_email}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <span className="text-sm">{payment.product_name}</span>
                                                            <Badge variant="outline" className="mr-2 text-[10px]">
                                                                {PRODUCT_TYPE_LABELS[payment.product_type] || payment.product_type}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-semibold">₪{payment.amount}</TableCell>
                                                    <TableCell>
                                                        <Badge className={getStatusColor(payment.status)}>
                                                            {STATUS_LABELS[payment.status] || payment.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Expanded details row */}
                                                {expandedId === payment.id && (
                                                    <TableRow className="bg-gray-50">
                                                        <TableCell colSpan={6}>
                                                            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <User className="w-4 h-4 text-gray-400" />
                                                                    <div>
                                                                        <p className="text-gray-500 text-xs">שם מלא</p>
                                                                        <p className="font-medium">{payment.user_name || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Mail className="w-4 h-4 text-gray-400" />
                                                                    <div>
                                                                        <p className="text-gray-500 text-xs">אימייל</p>
                                                                        <p className="font-medium">{payment.user_email || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Phone className="w-4 h-4 text-gray-400" />
                                                                    <div>
                                                                        <p className="text-gray-500 text-xs">טלפון</p>
                                                                        <p className="font-medium">{payment.user_phone || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                                                    <div>
                                                                        <p className="text-gray-500 text-xs">אמצעי תשלום</p>
                                                                        <p className="font-medium">{payment.payment_method || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Hash className="w-4 h-4 text-gray-400" />
                                                                    <div>
                                                                        <p className="text-gray-500 text-xs">מזהה עסקה</p>
                                                                        <p className="font-mono text-xs">{payment.transaction_id || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Hash className="w-4 h-4 text-gray-400" />
                                                                    <div>
                                                                        <p className="text-gray-500 text-xs">מזהה תשלום</p>
                                                                        <p className="font-mono text-xs">{payment.id}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                                    <div>
                                                                        <p className="text-gray-500 text-xs">תאריך השלמה</p>
                                                                        <p className="font-medium">{safeFormat(payment.completed_at, 'dd/MM/yyyy HH:mm')}</p>
                                                                    </div>
                                                                </div>
                                                                {payment.failure_reason && (
                                                                    <div className="col-span-2 flex items-center gap-2">
                                                                        <div>
                                                                            <p className="text-gray-500 text-xs">סיבת כישלון</p>
                                                                            <p className="text-red-600 text-xs">{payment.failure_reason}</p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {payment.items && payment.items.length > 0 && (
                                                                    <div className="col-span-full">
                                                                        <p className="text-gray-500 text-xs mb-1">פריטים בעגלה:</p>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {payment.items.map((item, i) => (
                                                                                <Badge key={i} variant="outline" className="text-xs">
                                                                                    {item.title} – ₪{item.price}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {/* Admin action: Mark as completed */}
                                                                {payment.status === 'pending' && (
                                                                    <div className="col-span-full pt-2 border-t">
                                                                        <Button
                                                                            size="sm"
                                                                            className="bg-green-600 hover:bg-green-700 text-white"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                markAsCompleted(payment.id);
                                                                            }}
                                                                        >
                                                                            <CheckCircle2 className="w-4 h-4 ml-1" />
                                                                            סמן כ"שולם" ידנית
                                                                        </Button>
                                                                        <span className="text-xs text-gray-400 mr-3">
                                                                            אם אתה יודע שהחיוב עבר בטרנזילה
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="plans">
                    <PlansManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}