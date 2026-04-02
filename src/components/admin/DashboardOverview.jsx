import React, { useEffect, useState } from 'react';
import { invokeFunction } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CreditCard, FileText, Activity, Image, Presentation, Smile, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

function safeFormat(dateVal, fmt) {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? '-' : format(d, fmt);
}

export default function DashboardOverview({ loginData }) {
    const [stats, setStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [recentUsers, setRecentUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Pass bypass details if available
                const payload = loginData ? { 
                    bypassCode: loginData.code, 
                    phone: loginData.phone 
                } : {};

                const response = await invokeFunction('adminGetDashboardStats', payload);
                if (response) {
                    setStats(response.stats);
                    setRecentActivity(response.recentActivity || []);
                    setRecentUsers(response.recentUsers || []);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
            <Skeleton className="h-64 w-full" />
        </div>;
    }

    if (!stats) return null;

    return (
        <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">משתמשים</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.users.total}</div>
                        <p className="text-xs text-muted-foreground">
                            +{stats.users.new_this_month} החודש
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.users.active} פעילים
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">הכנסות (החודש)</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₪{stats.revenue.this_month.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            סה״כ בכל הזמנים: ₪{stats.revenue.total.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">דפי נחיתה</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.landingPages.published}</div>
                        <p className="text-xs text-muted-foreground">
                            מתוך {stats.landingPages.total} סה״כ
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">לוגואים</CardTitle>
                        <Image className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.products?.logos || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            נרכשו בהצלחה
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">מצגות</CardTitle>
                        <Presentation className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.products?.presentations || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            נרכשו בהצלחה
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">סטיקרים</CardTitle>
                        <Smile className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.products?.stickers || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            נרכשו בהצלחה
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Users with Source Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        משתמשים אחרונים - מקור הגעה ו-UTM
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {recentUsers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">אין משתמשים להצגה</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50">
                                        <th className="text-right p-3 font-semibold">תאריך</th>
                                        <th className="text-right p-3 font-semibold">שם</th>
                                        <th className="text-right p-3 font-semibold">אימייל</th>
                                        <th className="text-right p-3 font-semibold">דף מקור</th>
                                        <th className="text-right p-3 font-semibold">UTM Source</th>
                                        <th className="text-right p-3 font-semibold">UTM Medium</th>
                                        <th className="text-right p-3 font-semibold">UTM Campaign</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentUsers.map(u => (
                                        <tr key={u.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3 text-gray-500 whitespace-nowrap">
                                                {safeFormat(u.created_date, 'dd/MM/yy HH:mm')}
                                            </td>
                                            <td className="p-3 font-medium">{u.full_name || '-'}</td>
                                            <td className="p-3 text-gray-600 text-xs">{u.email || '-'}</td>
                                            <td className="p-3">
                                                {u.acquisition_source?.ref_page ? (
                                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded truncate block max-w-[180px]" title={u.acquisition_source.ref_page}>
                                                        {u.acquisition_source.ref_page}
                                                    </span>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="p-3">
                                                {u.acquisition_source?.utm_source ? (
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                                                        {u.acquisition_source.utm_source}
                                                    </Badge>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="p-3">
                                                {u.acquisition_source?.utm_medium ? (
                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                                                        {u.acquisition_source.utm_medium}
                                                    </Badge>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="p-3">
                                                {u.acquisition_source?.utm_campaign ? (
                                                    <span className="text-xs text-gray-600 truncate block max-w-[180px]" title={u.acquisition_source.utm_campaign}>
                                                        {u.acquisition_source.utm_campaign}
                                                    </span>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        פעילות אחרונה במערכת
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentActivity.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">אין פעילות אחרונה להצגה</p>
                        ) : (
                            recentActivity.map((log) => (
                                <div key={log.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <p className="text-sm font-medium">{log.action}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {log.entity_name} • {typeof log.details === 'object' && log.details !== null 
                                                ? JSON.stringify(log.details) 
                                                : log.details}
                                        </p>
                                    </div>
                                    <div className="text-xs text-muted-foreground text-left" dir="ltr">
                                        {safeFormat(log.created_date, 'dd/MM/yyyy HH:mm')}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}