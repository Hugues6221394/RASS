import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { label: t('nav.home', 'Home'), to: '/' },
    { label: t('common.marketplace', 'Marketplace'), to: '/marketplace' },
    { label: t('nav.prices', 'Prices'), to: '/prices' },
    { label: t('nav.forecast', 'AI Forecast'), to: '/ai-forecast' },
    { label: t('nav.tracking', 'Tracking'), to: '/tracking' },
  ];

  const platformLinks = [
    { label: t('nav.logistics', 'Logistics'), to: '/logistics' },
    { label: t('common.dashboard', 'Dashboard'), to: '/dashboard' },
    { label: t('common.settings', 'Settings'), to: '/settings' },
  ];

  return (
    <footer className="relative overflow-hidden">
      {/* Main Footer */}
      <div 
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #001A0D 0%, #002D15 50%, #003D20 100%)',
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #00A651 0%, transparent 70%)' }}
          />
          <div 
            className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #F5A623 0%, transparent 70%)' }}
          />
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            
            {/* Brand Column */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #00E070 0%, #00A651 50%, #00793E 100%)',
                    boxShadow: '0 8px 24px rgba(0, 166, 81, 0.4)',
                  }}
                >
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 8C8 10 5.9 16.17 3.82 21h3.28l.48-1.66A4.008 4.008 0 0 1 11 16c4 0 4-2 8-2c-4 0-4-2-8-2c0-2 4-4 6-4z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-white font-black text-xl tracking-tight">RASS</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-[10px] font-bold tracking-widest uppercase">
                      National Platform
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-green-200/70 text-sm leading-relaxed mb-6 max-w-xs">
                {t('footer.description', 'Rwanda Agri Stability System - Connecting farmers, cooperatives, and buyers for a sustainable agricultural future.')}
              </p>
              {/* Rwanda Flag Colors */}
              <div className="flex gap-1">
                <div className="w-8 h-2 rounded-full bg-[#00A1DE]" />
                <div className="w-8 h-2 rounded-full bg-[#FAD201]" />
                <div className="w-8 h-2 rounded-full bg-[#20603D]" />
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-5">
                {t('footer.quick_links', 'Quick Links')}
              </h3>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.to}>
                    <Link 
                      to={link.to}
                      className="text-green-200/70 text-sm hover:text-white transition-colors flex items-center gap-2 group"
                    >
                      <span className="w-1 h-1 rounded-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Platform */}
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-5">
                {t('footer.platform', 'Platform')}
              </h3>
              <ul className="space-y-3">
                {platformLinks.map((link) => (
                  <li key={link.to}>
                    <Link 
                      to={link.to}
                      className="text-green-200/70 text-sm hover:text-white transition-colors flex items-center gap-2 group"
                    >
                      <span className="w-1 h-1 rounded-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact & Stats */}
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-5">
                {t('footer.contact', 'Contact')}
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Kigali, Rwanda</p>
                    <p className="text-green-200/60 text-xs">Ministry of Agriculture</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">support@rass.rw</p>
                    <p className="text-green-200/60 text-xs">24/7 Support</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-green-200/50 text-xs">
                © {currentYear} RASS - Rwanda Agri Stability System. {t('footer.rights', 'All rights reserved.')}
              </p>
              <div className="flex items-center gap-4">
                <span className="text-green-200/50 text-xs">
                  {t('footer.powered_by', 'Powered by')} 
                  <span className="text-green-400 font-semibold ml-1">Ministry of Agriculture</span>
                </span>
                <span className="text-green-200/30">•</span>
                <span className="text-green-200/50 text-xs">🇷🇼 Rwanda</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
