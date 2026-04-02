import React, { useEffect, useState } from 'react';
import { invokeFunction } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Eye } from 'lucide-react';
import { format } from 'date-fns';

function safeFormat(dateVal, fmt) {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? '-' : format(d, fmt);
}

export default function LandingPagesManager() {
    const [landingPages, setLandingPages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLPs = async () => {
            try {
                const response = await invokeFunction('adminListLandingPages');
                if (response) {
                    setLandingPages(response.landingPages || []);
                }
            } catch (error) {
                console.error("Failed to fetch landing pages", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLPs();
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'published': return 'bg-green-100 text-green-800';
            case 'paid': return 'bg-blue-100 text-blue-800';
            case 'preview': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>ניהול דפי נחיתה</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">שם העסק</TableHead>
                            <TableHead className="text-right">סטטוס</TableHead>
                            <TableHead className="text-right">תאריך יצירה</TableHead>
                            <TableHead className="text-right">סלאג</TableHead>
                            <TableHead className="text-right">פעולות</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">טוען...</TableCell>
                            </TableRow>
                        ) : landingPages.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">לא נמצאו דפי נחיתה</TableCell>
                            </TableRow>
                        ) : (
                            landingPages.map((lp) => (
                                <TableRow key={lp.id}>
                                    <TableCell className="font-medium">{lp.business_name}</TableCell>
                                    <TableCell>
                                        <Badge className={getStatusColor(lp.status)}>
                                            {lp.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{safeFormat(lp.created_date, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="font-mono text-xs">{lp.slug}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => window.open(`/lp/${lp.slug}`, '_blank')}>
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => window.open(`/LandingPagePreview?id=${lp.id}`, '_blank')}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}