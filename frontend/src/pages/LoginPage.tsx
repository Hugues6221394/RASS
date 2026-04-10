import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AGRI_IMAGES } from '../api/unsplash';
import { Eye, EyeOff, Lock, User, Leaf, ArrowRight } from 'lucide-react';

type LoginFormInputs = { identifier: string; password: string };
type PlatformStats = {
  totalFarmers: number;
  totalCooperatives: number;
  totalListings: number;
};

export const LoginPage = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);

  const bgImages = [
    AGRI_IMAGES.tea.url,
    AGRI_IMAGES.farming.url,
    AGRI_IMAGES.marketplace.url,
    AGRI_IMAGES.coffee.url,
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % bgImages.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [bgImages.length]);

  useEffect(() => {
    let mounted = true;
    api.get('/api/reference/platform-stats')
      .then((res) => {
        if (!mounted) return;
        setPlatformStats(res.data ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setPlatformStats(null);
      });
    return () => { mounted = false; };
  }, []);

  const schema = z.object({
    identifier: z.string().min(1, t('errors.required_field'))
      .refine(v => v.trim().length > 0, t('errors.required_field')),
    password: z.string().min(1, t('errors.required_field')),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormInputs>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setError('');
    try {
      await login({ identifier: data.identifier.trim(), password: data.password, otp: requiresOtp ? otp.trim() : undefined });
      navigate('/dashboard');
    } catch (err: any) {
      const m = err?.response?.data;
      if (m?.requiresTwoFactor) {
        setRequiresOtp(true);
        setError(m?.message || t('settings.otp_help', 'Enter OTP code from your authenticator app.'));
        return;
      }
      setError(typeof m === 'string' ? m : m?.message ?? t('errors.login_failed'));
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-black">
      {/* ── Background Carousel ── */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/40 to-transparent z-10" />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBgIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full"
          >
            <img 
              src={bgImages[currentBgIndex]} 
              alt="Agricultural Background" 
              className="w-full h-full object-cover"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 opacity-20 z-15 pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      <div className="relative z-20 w-full max-w-5xl px-4 flex flex-col lg:flex-row items-center gap-12">
        {/* ── Left Content (Hidden on small) ── */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block lg:w-1/2 text-white"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
              <Leaf className="w-6 h-6 text-[#34D399]" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight">RASS</div>
              <div className="text-[#34D399] text-[10px] font-bold uppercase tracking-widest leading-none">National Platform</div>
            </div>
          </div>
          
          <h2 className="text-5xl font-black leading-tight mb-6">
            Providing <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34D399] to-[#059669]">Stability</span> <br />
            to Rwanda's Harvests.
          </h2>
          <p className="text-green-100/70 text-lg leading-relaxed mb-8 max-w-md">
            The unified system for farmers, cooperatives, and buyers to trade smarter, faster, and more securely.
          </p>

          <div className="grid grid-cols-3 gap-6">
            {[
              { label: 'Farmers', value: platformStats ? platformStats.totalFarmers.toLocaleString() : '—' },
              { label: 'Cooperatives', value: platformStats ? platformStats.totalCooperatives.toLocaleString() : '—' },
              { label: 'Active Listings', value: platformStats ? platformStats.totalListings.toLocaleString() : '—' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#34D399]">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Login Form Card ── */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="glass-overlay border-white/10 p-8 sm:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden backdrop-blur-2xl">
            {/* Form decorative glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#34D399]/10 rounded-full blur-3xl" />
            
            <div className="relative z-10 mb-8">
              <h1 className="text-3xl font-black text-white mb-2">{t('common.welcome', 'Welcome back')}</h1>
              <p className="text-green-100/50 text-sm font-medium">{t('auth.login_subtitle', 'Sign in to RASS ecosystem')}</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-500 text-sm font-bold">✕</span>
                </div>
                <p className="text-red-200 text-xs font-medium">{error}</p>
              </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-green-100/60 ml-1">
                    {t('auth.phone_or_email', 'Email (all users) or phone (farmers only)')}
                  </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-100/40" />
                    <input
                      {...register('identifier')}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/20 focus:ring-2 focus:ring-[#34D399] transition-all outline-none"
                      placeholder="Email for all roles, phone only for farmers"
                    />
                </div>
                {errors.identifier && <p className="text-[10px] text-red-400 ml-1">{errors.identifier.message}</p>}
              </div>

              {requiresOtp && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-green-100/60 ml-1">
                    OTP (Authenticator)
                  </label>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white placeholder-white/20 focus:ring-2 focus:ring-[#34D399] transition-all outline-none"
                    placeholder="6-digit code"
                    maxLength={6}
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-green-100/60">
                    {t('auth.password', 'Password')}
                  </label>
                  <Link to="/forgot-password" title={t('auth.forgot_password', 'Forgot?')} className="text-[10px] font-bold text-[#34D399] hover:text-white uppercase tracking-tighter transition-colors">
                    {t('auth.forgot_password', 'Forgot?')}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-100/40" />
                  <input
                    {...register('password')}
                    type={showPwd ? 'text' : 'password'}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-white/20 focus:ring-2 focus:ring-[#34D399] transition-all outline-none"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[10px] text-red-400 ml-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#34D399] hover:bg-[#10B981] text-[#064E3B] font-black py-4 rounded-2xl shadow-[0_8px_24px_rgba(52,211,153,0.3)] flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-[#064E3B]/30 border-t-[#064E3B] rounded-full animate-spin" />
                ) : (
                  <>
                    {t('auth.sign_in', 'Sign In')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <div className="relative flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{t('auth.or', 'Need help?')}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
                <Link to="/register" className="text-white/60 hover:text-white transition-colors">
                  {t('auth.new_buyer', 'New buyer?')}{' '}
                  <span className="text-[#34D399] font-bold">{t('auth.register_here', 'Register')}</span>
                </Link>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white/10" />
                <Link to="/apply-role" className="text-white/60 hover:text-white transition-colors">
                  <span className="text-[#34D399] font-bold">Apply for Role</span>
                </Link>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white/10" />
                <Link to="/farmer-activation" className="text-white/60 hover:text-white transition-colors font-semibold">
                  {t('auth.activate_here', 'Activate Farmer Account')}
                </Link>
              </div>
            </div>
          </div>
          
          <p className="mt-8 text-center text-white/30 text-[10px] font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} RASS Ecosystem · Republic of Rwanda
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
