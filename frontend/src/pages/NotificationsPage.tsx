import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../api/client';
import { useSignalR } from '../context/SignalRContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications: realtime, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } = useSignalR();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const res = await api.get('/api/notifications?unreadOnly=false').catch(() => ({ data: [] }));
    setRows(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (realtime.length > 0) void load();
  }, [realtime.length]);

  const merged = useMemo(() => {
    const extra = realtime.filter((r) => !rows.find((x) => x.id === r.id));
    return [...extra, ...rows].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [realtime, rows]);

  const openNotification = async (n: any) => {
    await api.post(`/api/notifications/${n.id}/read`).catch(() => null);
    markNotificationRead(n.id);
    setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    if (n.actionUrl) navigate(n.actionUrl);
  };

  const markAll = async () => {
    await api.post('/api/notifications/read-all').catch(() => null);
    markAllNotificationsRead();
    setRows((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  if (loading) return <Loader label="Loading notifications..." />;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-emerald-700" />
          <h1 className="text-2xl font-black text-slate-900">Notifications</h1>
          {unreadNotificationCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{unreadNotificationCount}</span>}
        </div>
        <Button variant="outline" onClick={markAll}><CheckCheck className="mr-2 h-4 w-4" />Mark all read</Button>
      </div>
      <Card className="p-0">
        <div className="divide-y divide-slate-200">
          {merged.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No notifications yet.</p>
            ) : merged.map((n) => (
            <button key={n.id} onClick={() => openNotification(n)} className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${n.isRead ? '' : 'bg-emerald-50/40'}`}>
              <p className="text-sm font-bold text-slate-900">{n.title}</p>
              <p className="text-xs text-slate-600">{n.message}</p>
              <p className="mt-1 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};
