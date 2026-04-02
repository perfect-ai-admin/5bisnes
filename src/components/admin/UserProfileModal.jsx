import React, { useState, useEffect } from 'react';
import { invokeFunction } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, X, User, Shield, Target, CreditCard, FileText, Activity, MousePointerClick } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

function safeFormat(dateVal, fmt) {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? '-' : format(d, fmt);
}

export default function UserProfileModal({ user, onClose, onUpdate }) {
    const [formData, setFormData] = useState({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        status: user.status || 'active',
        is_admin: user.is_admin || false,
        marketing_enabled: user.marketing_enabled || false,
        mentor_enabled: user.mentor_enabled || false,
        finance_enabled: user.finance_enabled || false,
        goals_limit_override: user.goals_limit_override || null,
        max_active_goals_override: user.max_active_goals_override || null
    });
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(user.current_plan_id || '');
    const [saving, setSaving] = useState(false);
    const [extendedData, setExtendedData] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(true);

    useEffect(() => {
        loadPlans();
        loadFullDetails();
    }, []);

    const loadFullDetails = async () => {
        setLoadingDetails(true);
        try {
            const response = await invokeFunction('adminGetUserFullDetails', { user_id: user.id });
            if (response) {
                setExtendedData(response);
            }
        } catch (error) {
            console.error("Failed to load user details", error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const loadPlans = async () => {
       
        const allPlans = [];
        setPlans(allPlans);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = { ...formData };
            if (updates.goals_limit_override === '') updates.goals_limit_override = null;
            if (updates.max_active_goals_override === '') updates.max_active_goals_override = null;

            const response = await invokeFunction('adminUpdateUser', {
                user_id: user.id,
                updates: updates
            });
            
            if (response?.error) {
                throw new Error(response.error);
            }

            toast.success('המשתמש עודכן בהצלחה');
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Update failed:', error);
            const errorMessage = error.message || 'שגיאה לא ידועה';
            toast.error(`שגיאה בעדכון המשתמש: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    const handleAssignPlan = async () => {
        if (!selectedPlan) return;
        setSaving(true);
        try {
            await invokeFunction('assignPlanToUser', {
                user_id: user.id,
                plan_id: selectedPlan
            });
            toast.success('המסלול שויך בהצלחה');
            onUpdate();
            loadFullDetails(); // Reload to reflect changes
        } catch (error) {
            toast.error('שגיאה בשיוך המסלול');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <User className="w-6 h-6" />
                        ניהול משתמש - {user.full_name}
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="info" className="mt-4">
                    <TabsList className="grid grid-cols-5 w-full">
                        <TabsTrigger value="info">פרטים</TabsTrigger>
                        <TabsTrigger value="plan">מסלול</TabsTrigger>
                        <TabsTrigger value="financial">פיננסי</TabsTrigger>
                        <TabsTrigger value="marketing">שיווק</TabsTrigger>
                        <TabsTrigger value="activity">פעילות</TabsTrigger>
                    </TabsList>

                    <TabsContent value="info" className="space-y-4 mt-4">
                        {/* Payment & Activity Summary Cards */}
                        {!loadingDetails && extendedData && (
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                    <CreditCard className="w-5 h-5 text-green-600 mx-auto mb-1" />
                                    <p className="text-2xl font-black text-green-700">
                                        {extendedData.payments?.filter(p => p.status === 'completed').length || 0}
                                    </p>
                                    <p className="text-xs text-green-600">תשלומים הושלמו</p>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                    <CreditCard className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                                    <p className="text-2xl font-black text-blue-700">
                                        ₪{(extendedData.ltv || 0).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-blue-600">סה״כ תשלומים (LTV)</p>
                                </div>
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                                    <Activity className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                                    <p className="text-sm font-bold text-purple-700">
                                        {(() => {
                                            const completed = extendedData.payments?.filter(p => p.status === 'completed') || [];
                                            if (completed.length === 0) return '---';
                                            const sorted = completed.sort((a, b) => new Date(b.completed_at || b.created_date || 0) - new Date(a.completed_at || a.created_date || 0));
                                            return safeFormat(sorted[0]?.completed_at || sorted[0]?.created_date, 'dd/MM/yyyy');
                                        })()}
                                    </p>
                                    <p className="text-xs text-purple-600">תשלום אחרון</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>שם מלא</Label>
                                <Input
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                />
                            </div>
                            <div>
                                <Label>אימייל</Label>
                                <Input
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                            <div>
                                <Label>טלפון</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    placeholder="0502277087"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <Label>סטטוס</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={(val) => setFormData({...formData, status: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="paused">🟡 מושהה (משתמש חדש)</SelectItem>
                                        <SelectItem value="active">🟢 פעיל (התחיל תהליך)</SelectItem>
                                        <SelectItem value="blocked">🔴 חסום (ידני ע״י מנהל)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-orange-600" />
                                <Label>הרשאות מנהל</Label>
                            </div>
                            <Switch
                                checked={formData.is_admin}
                                onCheckedChange={(checked) => setFormData({...formData, is_admin: checked})}
                            />
                        </div>

                        {/* Goals Limits */}
                        <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                            <h3 className="font-semibold flex items-center gap-2 text-blue-800">
                                <Target className="w-4 h-4" />
                                מגבלות מטרות
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs">מכסת מטרות (Override)</Label>
                                    <Input
                                        type="number"
                                        value={formData.goals_limit_override ?? ''}
                                        onChange={(e) => setFormData({...formData, goals_limit_override: e.target.value === '' ? null : parseInt(e.target.value)})}
                                        placeholder={`ברירת מחדל מהמסלול: ${user.goals_limit || 1}`}
                                        min={0}
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">השאר ריק כדי להשתמש בלימיט מהמסלול</p>
                                </div>
                                <div>
                                    <Label className="text-xs">מקס מטרות פעילות (Override)</Label>
                                    <Input
                                        type="number"
                                        value={formData.max_active_goals_override ?? ''}
                                        onChange={(e) => setFormData({...formData, max_active_goals_override: e.target.value === '' ? null : parseInt(e.target.value)})}
                                        placeholder={`ברירת מחדל מהמסלול: ${user.max_active_goals || 1}`}
                                        min={0}
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">השאר ריק כדי להשתמש בלימיט מהמסלול</p>
                                </div>
                            </div>
                            <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                                <strong>לימיט בפועל:</strong> {formData.goals_limit_override ?? user.goals_limit ?? 1} מטרות | 
                                <strong> מקס פעילות:</strong> {formData.max_active_goals_override ?? user.max_active_goals ?? 1}
                            </div>
                        </div>

                        {/* User Goals List */}
                        {!loadingDetails && extendedData?.goals?.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Target className="w-4 h-4" />
                                    מטרות המשתמש ({extendedData.goals.length})
                                </h3>
                                <div className="border rounded-md max-h-48 overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-right">שם מטרה</TableHead>
                                                <TableHead className="text-right">סטטוס</TableHead>
                                                <TableHead className="text-right">התקדמות</TableHead>
                                                <TableHead className="text-right">פעולות</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {extendedData.goals.map(g => (
                                                <TableRow key={g.id}>
                                                    <TableCell className="font-medium">{g.title}</TableCell>
                                                    <TableCell>
                                                        <Badge className={
                                                            g.status === 'active' ? 'bg-green-100 text-green-800' :
                                                            g.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'
                                                        }>{g.status}</Badge>
                                                    </TableCell>
                                                    <TableCell>{g.progress || 0}%</TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                                                            onClick={async () => {
                                                                if (!confirm(`למחוק את המטרה "${g.title}"?`)) return;
                                                                try {
                                                                    await invokeFunction('adminUpdateUser', {
                                                                        user_id: user.id,
                                                                        delete_goal_id: g.id
                                                                    });
                                                                    toast.success('המטרה נמחקה');
                                                                    loadFullDetails();
                                                                } catch (e) {
                                                                    toast.error('שגיאה במחיקה');
                                                                }
                                                            }}
                                                        >
                                                            מחק
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        </TabsContent>

                    <TabsContent value="plan" className="space-y-4 mt-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold mb-2">מסלול נוכחי</h3>
                            {user.current_plan_id ? (
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-[#27AE60] text-white">
                                        {user.plan_name || 'מסלול פעיל'}
                                    </Badge>
                                    {user.plan_price != null && (
                                        <span className="text-sm text-gray-500">₪{user.plan_price}</span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500">חינמי (ללא מסלול)</p>
                            )}
                        </div>
                        <div>
                            <Label>שיוך מסלול חדש</Label>
                            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                                <SelectTrigger>
                                    <SelectValue placeholder="בחר מסלול..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {plans.map(plan => (
                                        <SelectItem key={plan.id} value={plan.id}>
                                            {plan.name} - ₪{plan.price}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                className="mt-2 w-full bg-[#27AE60] hover:bg-[#2ECC71]"
                                onClick={handleAssignPlan}
                                disabled={!selectedPlan || saving}
                            >
                                שייך מסלול
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="financial" className="mt-4">
                        {loadingDetails ? <p>טוען נתונים...</p> : (
                            <div className="space-y-4">
                                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                    <h3 className="font-bold text-green-800">LTV: ₪{extendedData?.ltv?.toLocaleString()}</h3>
                                    <p className="text-sm text-green-600">סך הכנסות מצטברות מהלקוח</p>
                                </div>
                                <h3 className="font-semibold flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" />
                                    היסטוריית תשלומים
                                </h3>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-right">תאריך</TableHead>
                                                <TableHead className="text-right">מוצר</TableHead>
                                                <TableHead className="text-right">סכום</TableHead>
                                                <TableHead className="text-right">סטטוס</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {extendedData?.payments?.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center">אין תשלומים</TableCell></TableRow>
                                            ) : (
                                                extendedData?.payments?.map(p => (
                                                    <TableRow key={p.id}>
                                                        <TableCell>{safeFormat(p.created_date, 'dd/MM/yyyy')}</TableCell>
                                                        <TableCell>{p.product_name}</TableCell>
                                                        <TableCell>₪{p.amount}</TableCell>
                                                        <TableCell><Badge>{p.status}</Badge></TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="marketing" className="mt-4">
                         {loadingDetails ? <p>טוען נתונים...</p> : (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                                        <FileText className="w-4 h-4" />
                                        דפי נחיתה
                                    </h3>
                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-right">שם העסק</TableHead>
                                                    <TableHead className="text-right">סטטוס</TableHead>
                                                    <TableHead className="text-right">תאריך</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {extendedData?.landingPages?.length === 0 ? (
                                                    <TableRow><TableCell colSpan={3} className="text-center">אין דפי נחיתה</TableCell></TableRow>
                                                ) : (
                                                    extendedData?.landingPages?.map(lp => (
                                                        <TableRow key={lp.id}>
                                                            <TableCell>{lp.business_name}</TableCell>
                                                            <TableCell><Badge>{lp.status}</Badge></TableCell>
                                                            <TableCell>{safeFormat(lp.created_date, 'dd/MM/yyyy')}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                                        <MousePointerClick className="w-4 h-4" />
                                        לידים אחרונים
                                    </h3>
                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-right">שם</TableHead>
                                                    <TableHead className="text-right">טלפון</TableHead>
                                                    <TableHead className="text-right">תאריך</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {extendedData?.leads?.length === 0 ? (
                                                    <TableRow><TableCell colSpan={3} className="text-center">אין לידים</TableCell></TableRow>
                                                ) : (
                                                    extendedData?.leads?.map(lead => (
                                                        <TableRow key={lead.id}>
                                                            <TableCell>{lead.name}</TableCell>
                                                            <TableCell>{lead.phone}</TableCell>
                                                            <TableCell>{safeFormat(lead.created_date, 'dd/MM/yyyy')}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="activity" className="mt-4">
                         {loadingDetails ? <p>טוען נתונים...</p> : (
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    יומן פעילות
                                </h3>
                                <div className="border rounded-md max-h-60 overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-right">פעולה</TableHead>
                                                <TableHead className="text-right">פרטים</TableHead>
                                                <TableHead className="text-right">תאריך</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {extendedData?.activityLog?.length === 0 ? (
                                                <TableRow><TableCell colSpan={3} className="text-center">אין פעילות</TableCell></TableRow>
                                            ) : (
                                                extendedData?.activityLog?.map(log => (
                                                    <TableRow key={log.id}>
                                                        <TableCell>{log.action}</TableCell>
                                                        <TableCell>
                                                            {typeof log.details === 'object' && log.details !== null 
                                                                ? JSON.stringify(log.details) 
                                                                : log.details}
                                                        </TableCell>
                                                        <TableCell dir="ltr" className="text-left">{safeFormat(log.created_date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <div className="flex gap-2 mt-6">
                    <Button 
                        className="flex-1 bg-[#1E3A5F] hover:bg-[#2C5282]"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        <Save className="w-4 h-4 ml-2" />
                        שמור שינויים
                    </Button>
                    <Button variant="outline" onClick={onClose}>
                        <X className="w-4 h-4 ml-2" />
                        ביטול
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}