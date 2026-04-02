import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { format } from 'date-fns';

function safeFormat(dateVal, fmt) {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? '-' : format(d, fmt);
}

export default function ActivityLogView() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
       
        const allLogs = [];
        setLogs(allLogs);
        setLoading(false);
    };

    const getActivityColor = (type) => {
        switch(type) {
            case 'login': return 'bg-blue-100 text-blue-800';
            case 'plan_change': return 'bg-purple-100 text-purple-800';
            case 'permission_change': return 'bg-orange-100 text-orange-800';
            case 'admin_action': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
                <Activity className="w-6 h-6" />
                לוג פעילות מערכת
            </h2>

            <div className="space-y-3">
                {logs.map(log => (
                    <div key={log.id} className="border-r-4 border-[#1E3A5F] bg-gray-50 p-4 rounded">
                        <div className="flex items-start justify-between mb-2">
                            <Badge className={getActivityColor(log.activity_type)}>
                                {log.activity_type}
                            </Badge>
                            <span className="text-xs text-gray-500">
                                {safeFormat(log.created_date, 'dd/MM/yyyy HH:mm')}
                            </span>
                        </div>
                        <p className="text-sm">{log.description}</p>
                        {log.performed_by && (
                            <p className="text-xs text-gray-500 mt-1">
                                בוצע ע״י: {log.performed_by}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}