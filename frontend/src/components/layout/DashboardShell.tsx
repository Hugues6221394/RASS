import type { ReactNode } from 'react';
import { useState } from 'react';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSignalR } from '../../context/SignalRContext';
import { api } from '../../api/client';
import { useTranslation } from 'react-i18next';

interface NavItem {
  key: string;
  label: ReactNode;
  icon: ReactNode;
}

interface DashboardShellProps {
  brand: string;
  subtitle: string;
  title: string;
  activeKey: string;
  navItems: NavItem[];
  onNavChange: (key: string) => void;
  onLogout: () => void;
  rightStatus?: string;
  children: ReactNode;
}

export const DashboardShell = ({
  brand,
  subtitle,
  title,
  activeKey,
  navItems,
  onNavChange,
  onLogout,
  rightStatus,
  children,
}: DashboardShellProps) => {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const { unreadNotificationCount, unreadByRoute, unreadContractCount, unreadMessageCount } = useSignalR();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminApplicationUnread, setAdminApplicationUnread] = useState(0);
  const dashboardPath = hasRole('Farmer')
    ? '/farmer-dashboard'
    : hasRole('CooperativeManager')
      ? '/cooperative-dashboard'
      : hasRole('Applicant')
        ? '/applicant-dashboard'
      : hasRole('Buyer')
        ? '/buyer-dashboard'
        : hasRole('Transporter')
          ? '/transporter-dashboard'
          : hasRole('Government')
            ? '/government-dashboard'
            : hasRole('Admin')
              ? '/admin'
              : hasRole('MarketAgent')
                ? '/agent-dashboard'
                : '/storage-dashboard';

  const roleLinks = hasRole('Applicant')
    ? [
        { to: dashboardPath, label: t('dashboard_shell.links.application', 'Application') },
        { to: '/messages', label: t('dashboard_shell.links.messages', 'Messages') },
        { to: '/notifications', label: t('dashboard_shell.links.notifications', 'Notifications') },
      ]
    : [
        { to: dashboardPath, label: t('dashboard_shell.links.dashboard', 'Dashboard') },
        { to: '/messages', label: t('dashboard_shell.links.messages', 'Messages') },
        { to: '/notifications', label: t('dashboard_shell.links.notifications', 'Notifications') },
        { to: '/contracts', label: t('dashboard_shell.links.contracts', 'Contracts') },
        { to: '/prices', label: t('dashboard_shell.links.market_prices', 'Market prices') },
        { to: '/tracking', label: t('dashboard_shell.links.tracking', 'Tracking') },
        { to: '/ai-forecast', label: t('dashboard_shell.links.ai_forecast', 'AI forecast') },
        { to: '/settings', label: t('dashboard_shell.links.settings', 'Settings') },
        { to: '/licensing', label: t('dashboard_shell.links.licensing', 'Licensing') },
        ...(hasRole(['Transporter', 'Admin']) ? [{ to: '/logistics', label: t('dashboard_shell.links.logistics', 'Logistics') }] : []),
        ...(hasRole('Buyer') ? [{ to: '/marketplace', label: t('dashboard_shell.links.marketplace', 'Marketplace') }] : []),
        ...(hasRole('CooperativeManager') ? [{ to: '/cooperative-profile-settings', label: t('dashboard_shell.links.profile_settings', 'Profile settings') }] : []),
      ];
  const globalTopLinks = new Set(['/', '/marketplace', dashboardPath.toLowerCase()]);
  const dedupedRoleLinks = Array.from(
    new Map(
      roleLinks
        .filter((item) => !globalTopLinks.has(item.to))
        .map((item) => [item.to.toLowerCase(), item]),
    ).values(),
  );

  const getLinkBadgeCount = (path: string) => {
    const routeCount = unreadByRoute[path] || 0;
    if (path === '/contracts') return unreadContractCount;
    if (path === '/messages') return unreadMessageCount;
    if (path === '/admin' && hasRole('Admin')) return adminApplicationUnread;
    if (path === '/notifications') return unreadNotificationCount;
    return routeCount;
  };

  useEffect(() => {
    if (!hasRole('Admin')) return;
    let mounted = true;
    const loadAdminUnread = () => {
      api.get('/api/applications/admin')
        .then((res) => {
          if (!mounted) return;
          setAdminApplicationUnread(Number(res.data?.unreadCount || 0));
        })
        .catch(() => {
          if (!mounted) return;
          setAdminApplicationUnread(0);
        });
    };
    loadAdminUnread();
    const timer = window.setInterval(loadAdminUnread, 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [hasRole, unreadNotificationCount, unreadMessageCount, unreadByRoute, unreadContractCount]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-700">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed z-40 h-full max-h-screen w-72 border-r border-slate-200 bg-white transition-transform overscroll-y-auto lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{brand}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{subtitle}</p>
              </div>
              <button className="rounded-lg p-1 text-slate-500 lg:hidden" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <nav className="space-y-1 p-4">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    onNavChange(item.key);
                    setMobileOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    activeKey === item.key ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="px-4 pb-4">
              <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('dashboard_shell.role_pages', 'Role pages')}</p>
              <div className="space-y-1">
                {dedupedRoleLinks.map((item) => {
                  const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <span>{item.label}</span>
                      {getLinkBadgeCount(item.to) > 0 && (
                        <span className={`min-w-[18px] rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-white text-slate-900' : 'bg-red-500 text-white'}`}>
                          {getLinkBadgeCount(item.to) > 99 ? '99+' : getLinkBadgeCount(item.to)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 p-4">
            <button
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700"
            >
              <LogOut className="h-4 w-4" /> {t('common.logout', 'Logout')}
            </button>
          </div>
        </div>
      </aside>

    <main className="w-full lg:ml-72 lg:w-[calc(100%-18rem)]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-black text-slate-900">{title}</h1>
        </div>
        {rightStatus && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{rightStatus}</span>}
      </header>
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-6">
        {children}
      </motion.section>
    </main>
  </div>
  );
};
