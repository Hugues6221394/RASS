import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export const Hero = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-[0_20px_40px_-10px_rgba(27,94,32,0.3)] mb-4 flex items-center min-h-[360px] md:h-[540px]"
      style={{ background: '#1b5e20' }}
    >
      {/* Background Image with Gradient Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center z-[1]"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1594498653385-d5172c532c00?q=80&w=2000&auto=format&fit=crop")', backgroundPosition: 'center 40%' }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(27,94,32,0.9) 0%, rgba(27,94,32,0.7) 40%, rgba(27,94,32,0.1) 100%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-[2] max-w-screen-lg mx-auto px-6 py-12 md:py-0 w-full">
        <div className="max-w-[650px] space-y-5">

          {/* Overline */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#a5d6a7]" />
            <span className="text-[#a5d6a7] text-xs font-extrabold tracking-[3px] uppercase">
              {t('hero.overline', 'Rwanda Agri Stability System')}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-white text-4xl md:text-6xl font-black leading-[1.05] drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
            {t('hero.title_line1', 'Empowering')} <br />
            <span className="text-[#81c784]">{t('hero.title_line2', "Rwanda's Farmers")}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-[#f1f8e9] text-lg md:text-xl font-medium leading-relaxed opacity-95">
            {t('hero.subtitle', 'Connect with cooperatives, access fair market prices, and grow your agricultural business with RASS.')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 pt-3">
            <button
              onClick={() => navigate('/marketplace')}
              className="inline-flex items-center justify-center gap-2 bg-white text-[#1b5e20] font-extrabold px-8 py-4 rounded-xl text-lg shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:bg-[#f1f8e9] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.2)] transition-all"
            >
              {t('hero.primary_cta', 'Explore Marketplace')}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
            {!isAuthenticated && (
              <button
                onClick={() => navigate('/farmer-activation')}
                className="inline-flex items-center justify-center gap-2 border border-white/40 text-white font-bold px-6 py-4 rounded-xl text-base backdrop-blur-sm hover:border-white hover:bg-white/10 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {t('hero.secondary_cta', 'Activate Farmer Account')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
