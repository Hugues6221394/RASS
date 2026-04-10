import { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CartIcon } from './CartIcon';
import { NotificationBell } from './NotificationBell';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, TrendingUp, Cpu,
  MapPin, Home, Menu, X, Globe, LogOut, Leaf
} from 'lucide-react';

export const NavBar = () => {
  const { user, logout, hasRole } = useAuth();
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'kin' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('rass_lang', newLang);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardLink = () => {
    if (hasRole('Farmer'))             return '/farmer-dashboard';
    if (hasRole('CooperativeManager')) return '/cooperative-dashboard';
    if (hasRole('Buyer'))              return '/buyer-dashboard';
    if (hasRole('Transporter'))        return '/transporter-dashboard';
    if (hasRole('Government'))         return '/government-dashboard';
    if (hasRole('Admin'))              return '/admin';
    if (hasRole('MarketAgent'))        return '/agent-dashboard';
    if (hasRole('StorageOperator') || hasRole('StorageManager')) return '/storage-dashboard';
    return '/dashboard';
  };

  const getNavigationLinks = () => {
    if (user) {
      return [
        { label: t('nav.home'), to: '/' },
        { label: t('common.marketplace'), to: '/marketplace' },
        { label: t('common.dashboard'), to: getDashboardLink() },
        { label: t('dashboard_shell.links.settings', 'Settings'), to: '/settings' },
      ];
    }
      return [
        { label: t('nav.home'), to: '/' },
        { label: t('common.marketplace'), to: '/marketplace' },
        { label: t('nav.prices'), to: '/prices' },
        { label: t('nav.tracking'), to: '/tracking' },
        { label: t('nav.agriculture_rwanda', 'Agriculture in Rwanda'), to: '/agriculture-in-rwanda' },
        { label: t('nav.forecast'), to: '/ai-forecast' },
      ];
    };

  const links = getNavigationLinks();
  const iconForLink = (to: string) => {
    if (to.includes('dashboard') || to === '/admin') return <Home className="w-4 h-4" />;
    if (to === '/marketplace') return <ShoppingCart className="w-4 h-4" />;
    if (to === '/prices') return <TrendingUp className="w-4 h-4" />;
    if (to === '/ai-forecast') return <Cpu className="w-4 h-4" />;
    if (to === '/tracking') return <MapPin className="w-4 h-4" />;
    return <Home className="w-4 h-4" />;
  };
  const initials = user?.fullName?.split(' ').map((w: string) => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 nav-glass backdrop-blur-2xl bg-[#064E3B]/90 border-b border-white/10"
      style={{ boxShadow: '0 6px 32px rgba(0,0,0,0.28)' }}>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[68px]">

          {/* ─── Logo ─── */}
          <RouterLink to="/" className="flex items-center gap-3 flex-shrink-0 group">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-all group-hover:scale-105 group-hover:shadow-xl"
              style={{ background: 'linear-gradient(135deg,#34D399 0%,#059669 50%,#065F46 100%)', boxShadow: '0 4px 14px rgba(5,150,105,0.4)' }}>
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-white font-extrabold tracking-tight text-lg leading-none drop-shadow-sm">RASS</div>
              <div className="hidden sm:flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 font-semibold leading-none" style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  National Platform
                </span>
              </div>
            </div>
          </RouterLink>

          {/* ─── Desktop nav links ─── */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map((link) => {
              const isActive = location.pathname === link.to ||
                (link.to !== '/' && location.pathname.startsWith(link.to));
              return (
                <RouterLink key={link.to} to={link.to}
                  className={`flex items-center px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActive ? 'bg-white/20 text-white shadow-inner' : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}>
                  <span className="mr-2">{iconForLink(link.to)}</span>
                  {link.label}
                </RouterLink>
              );
            })}
          </div>

          {/* ─── Right side ─── */}
          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                <button onClick={toggleLanguage}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all glass-overlay border-white/10 text-white/70 hover:text-white">
                  <Globe className="w-3 h-3" />
                  {i18n.language === 'en' ? 'KIN' : 'EN'}
                </button>

                <RouterLink to={getDashboardLink()} className="hidden lg:flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white">
                  Dashboard
                </RouterLink>
                {hasRole('Buyer') && (
                  <div className="hidden sm:flex items-center gap-1">
                    <CartIcon />
                    <NotificationBell />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-white text-xs font-black shadow-lg bg-gradient-to-br from-[#34D399] to-[#059669]">
                    {initials}
                  </div>
                  <button onClick={handleLogout} className="group flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20">
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Logout</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={toggleLanguage} className="hidden sm:flex items-center px-3 py-2 rounded-xl text-[10px] font-black text-white/60 hover:text-white transition-all uppercase tracking-widest">
                  {i18n.language === 'en' ? 'KIN' : 'EN'}
                </button>
                <RouterLink to="/login" className="px-6 py-2.5 rounded-xl text-xs font-black bg-[#34D399] text-[#064E3B] transition-all hover:bg-white shadow-lg active:scale-95 uppercase tracking-widest">
                  Login
                </RouterLink>
              </div>
            )}

            <button className="md:hidden p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all ml-1" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="md:hidden border-t border-white/10 px-4 py-6 overflow-hidden bg-[#064E3B] backdrop-blur-2xl"
          >
            <div className="flex flex-col gap-2">
                  {links.map((link) => (
                <RouterLink key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-4 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
                    location.pathname === link.to ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}>
                  <span className="mr-3">{iconForLink(link.to)}</span>
                  {link.label}
                </RouterLink>
              ))}
              {user && (
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex items-center px-4 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest text-red-400 bg-red-500/10 mt-4">
                  <LogOut className="mr-3 w-5 h-5" /> Logout
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};
