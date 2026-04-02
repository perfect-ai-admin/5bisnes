import React, { useState, useEffect } from 'react';
import { invokeFunction } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, UserCog, Loader2, CheckSquare, XSquare, Info } from 'lucide-react';
import UserProfileModal from './UserProfileModal';

export default function UsersTable() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [bulkAction, setBulkAction] = useState('');
    const [bulkStatus, setBulkStatus] = useState('');
    const [bulkPlan, setBulkPlan] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            // Use backend function to list users (supports bypass and admin check)
            const response = await invokeFunction('adminListUsers');
            
            if (response && response.users) {
                const sortedUsers = response.users.sort((a, b) =>
                    new Date(b.created_date) - new Date(a.created_date)
                );
                setUsers(sortedUsers);
            } else {
                // Fallback for direct entity access if function fails or returns weird format
               
                const allUsers = [];
                const sortedUsers = allUsers.sort((a, b) =>
                    new Date(b.created_date) - new Date(a.created_date)
                );
                setUsers(sortedUsers);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            try {
               
                const allUsers = [];
                setUsers(allUsers);
            } catch (e) {
                console.error('Fallback failed:', e);
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u => 
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.phone?.includes(search)
    );

    const toggleSelectAll = () => {
        if (selectedUserIds.length === filteredUsers.length) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(filteredUsers.map(u => u.id));
        }
    };

    const toggleSelectUser = (userId) => {
        setSelectedUserIds(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleBulkAction = async () => {
        if (selectedUserIds.length === 0) {
            alert('לא נבחרו משתמשים');
            return;
        }

        if (!bulkAction) {
            alert('בחר פעולה לביצוע');
            return;
        }

        if (bulkAction === 'delete') {
            if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedUserIds.length} משתמשים?`)) {
                return;
            }
        }

        if (bulkAction === 'status' && !bulkStatus) {
            alert('בחר סטטוס');
            return;
        }

        if (bulkAction === 'plan' && !bulkPlan) {
            alert('בחר מסלול');
            return;
        }

        setIsProcessing(true);
        try {
            for (const userId of selectedUserIds) {
                if (bulkAction === 'delete') {
                    await invokeFunction('adminUpdateUser', { user_id: userId, deleted: true });
                } else if (bulkAction === 'status') {
                    await invokeFunction('adminUpdateUser', { user_id: userId, status: bulkStatus });
                } else if (bulkAction === 'plan') {
                    await invokeFunction('adminUpdateUser', { user_id: userId, current_plan_id: bulkPlan });
                }
            }
            
            alert('הפעולה בוצעה בהצלחה');
            setSelectedUserIds([]);
            setBulkAction('');
            setBulkStatus('');
            setBulkPlan('');
            await loadUsers();
        } catch (error) {
            console.error('Bulk action error:', error);
            alert('שגיאה בביצוע הפעולה');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-md p-8 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {/* Search & Bulk Actions */}
            <div className="p-6 border-b space-y-4">
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                        placeholder="חפש לפי שם, אימייל או טלפון..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pr-10"
                    />
                </div>

                {/* Bulk Actions Panel */}
                {selectedUserIds.length > 0 && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                                <CheckSquare className="w-5 h-5 text-blue-600" />
                                <span className="font-bold text-blue-900">
                                    נבחרו {selectedUserIds.length} משתמשים
                                </span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedUserIds([])}
                                    className="text-blue-600 hover:text-blue-800"
                                >
                                    <XSquare className="w-4 h-4 ml-1" />
                                    בטל בחירה
                                </Button>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <Select value={bulkAction} onValueChange={setBulkAction}>
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="בחר פעולה" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="delete">מחיקה</SelectItem>
                                        <SelectItem value="status">שינוי סטטוס</SelectItem>
                                        <SelectItem value="plan">שינוי מסלול</SelectItem>
                                    </SelectContent>
                                </Select>

                                {bulkAction === 'status' && (
                                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                                        <SelectTrigger className="w-32">
                                            <SelectValue placeholder="סטטוס" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="paused">מושהה (חדש)</SelectItem>
                                            <SelectItem value="active">פעיל (התחיל תהליך)</SelectItem>
                                            <SelectItem value="blocked">חסום (ידני)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}

                                {bulkAction === 'plan' && (
                                    <Input
                                        placeholder="Plan ID"
                                        value={bulkPlan}
                                        onChange={(e) => setBulkPlan(e.target.value)}
                                        className="w-40"
                                    />
                                )}

                                <Button
                                    onClick={handleBulkAction}
                                    disabled={isProcessing || !bulkAction}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                            מעבד...
                                        </>
                                    ) : (
                                        'בצע פעולה'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-4 w-12">
                                <Checkbox
                                    checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </th>
                            <th className="text-right p-4 font-semibold text-gray-700">תאריך הצטרפות</th>
                            <th className="text-right p-4 font-semibold text-gray-700">שם</th>
                            <th className="text-right p-4 font-semibold text-gray-700">אימייל</th>
                            <th className="text-right p-4 font-semibold text-gray-700">מסע לקוח</th>
                            <th className="text-right p-4 font-semibold text-gray-700">טלפון</th>
                            <th className="text-right p-4 font-semibold text-gray-700">מקור הגעה</th>
                            <th className="text-right p-4 font-semibold text-gray-700">UTM</th>
                            <th className="text-right p-4 font-semibold text-gray-700">מסלול</th>
                            <th className="text-right p-4 font-semibold text-gray-700">
                                <div className="flex items-center gap-2 justify-end">
                                    סטטוס
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info className="w-4 h-4 text-gray-400" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                                <p className="font-bold mb-2">סטטוסים:</p>
                                                <p className="text-sm mb-1">🟡 <strong>מושהה:</strong> משתמש חדש שנכנס למערכת</p>
                                                <p className="text-sm mb-1">🟢 <strong>פעיל:</strong> התחיל תהליך - גישה מלאה + הודעות WhatsApp</p>
                                                <p className="text-sm">🔴 <strong>חסום:</strong> נחסם ידנית ע״י מנהל</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </th>
                            <th className="text-right p-4 font-semibold text-gray-700">מודולים</th>
                            <th className="text-right p-4 font-semibold text-gray-700">פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 w-12">
                                    <Checkbox
                                        checked={selectedUserIds.includes(user.id)}
                                        onCheckedChange={() => toggleSelectUser(user.id)}
                                    />
                                </td>
                                <td className="p-4 text-gray-600">
                                    {user.created_date && !isNaN(new Date(user.created_date).getTime()) ? new Date(user.created_date).toLocaleDateString('he-IL') : '-'}
                                </td>
                                <td className="p-4">
                                    <div className="font-medium">{user.full_name}</div>
                                    {user.is_admin && (
                                        <Badge variant="outline" className="mt-1 text-xs">מנהל</Badge>
                                    )}
                                </td>
                                <td className="p-4 text-gray-600">{user.email}</td>
                                <td className="p-4">
                                    {user.has_started_journey ? (
                                        <Badge className="bg-green-100 text-green-800 border-green-200">
                                            פעיל ✓
                                        </Badge>
                                    ) : user.business_journey_completed ? (
                                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                            השלים שאלון (ללא טלפון)
                                        </Badge>
                                    ) : (
                                        <span className="text-gray-400 text-sm">טרם התחיל</span>
                                    )}
                                </td>
                                <td className="p-4 text-gray-600">{user.phone || '-'}</td>
                                <td className="p-4 text-gray-600 text-sm">
                                    {user.acquisition_source?.ref_page ? (
                                        <div className="max-w-[150px] truncate" title={user.acquisition_source.ref_page}>
                                            {user.acquisition_source.ref_page}
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="p-4 text-gray-600 text-sm">
                                    {user.acquisition_source ? (
                                        <div className="flex flex-col gap-1">
                                            {user.acquisition_source.utm_source && (
                                                <Badge variant="outline" className="w-fit bg-blue-50">
                                                    Source: {user.acquisition_source.utm_source}
                                                </Badge>
                                            )}
                                            {user.acquisition_source.utm_campaign && (
                                                <span className="text-xs text-gray-500 truncate max-w-[150px]" title={user.acquisition_source.utm_campaign}>
                                                    Camp: {user.acquisition_source.utm_campaign}
                                                </span>
                                            )}
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="p-4">
                                    {user.current_plan_id ? (
                                        <Badge className={
                                            (user.plan_price && user.plan_price > 0) 
                                                ? "bg-green-100 text-green-800 border-green-200" 
                                                : "bg-gray-100 text-gray-700 border-gray-200"
                                        }>
                                            {user.plan_name || 'מסלול פעיל'}
                                        </Badge>
                                    ) : (
                                        <span className="text-gray-400">חינמי</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Badge 
                                                    className={
                                                        user.status === 'active' ? 'bg-green-100 text-green-800 cursor-help' :
                                                        user.status === 'blocked' ? 'bg-red-100 text-red-800 cursor-help' :
                                                        'bg-yellow-100 text-yellow-800 cursor-help'
                                                    }
                                                >
                                                    {user.status === 'active' ? '🟢 פעיל' : 
                                                     user.status === 'blocked' ? '🔴 חסום' : '🟡 מושהה'}
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-sm">
                                                    {user.status === 'active' ? 'התחיל תהליך - גישה מלאה + הודעות WhatsApp' :
                                                     user.status === 'blocked' ? 'נחסם ידנית ע״י מנהל' :
                                                     'משתמש חדש - טרם התחיל תהליך'}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-1">
                                        {user.marketing_enabled && (
                                            <Badge className="bg-purple-100 text-purple-800 text-xs">M</Badge>
                                        )}
                                        {user.mentor_enabled && (
                                            <Badge className="bg-blue-100 text-blue-800 text-xs">Me</Badge>
                                        )}
                                        {user.finance_enabled && (
                                            <Badge className="bg-green-100 text-green-800 text-xs">F</Badge>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setSelectedUser(user)}
                                    >
                                        <UserCog className="w-4 h-4 ml-2" />
                                        ניהול
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        לא נמצאו משתמשים
                    </div>
                )}
            </div>

            {/* User Profile Modal */}
            {selectedUser && (
                <UserProfileModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    onUpdate={loadUsers}
                />
            )}
        </div>
    );
}