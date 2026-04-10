import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export const DashboardPage = () => {
  const { hasRole } = useAuth();
  const navigate    = useNavigate();
  const { t }       = useTranslation();

  useEffect(() => {
    if (hasRole('Farmer'))                                   navigate('/farmer-dashboard');
    else if (hasRole('CooperativeManager'))                  navigate('/cooperative-dashboard');
    else if (hasRole('Buyer'))                               navigate('/buyer-dashboard');
    else if (hasRole('Transporter'))                         navigate('/transporter-dashboard');
    else if (hasRole('Admin'))                               navigate('/admin');
    else if (hasRole('Government') || hasRole('PolicyMaker'))navigate('/government-dashboard');
    else if (hasRole('StorageOperator') || hasRole('StorageManager')) navigate('/storage-dashboard');
    else if (hasRole('MarketAgent'))                         navigate('/agent-dashboard');
    else if (hasRole('Applicant'))                           navigate('/applicant-dashboard');
  }, [hasRole, navigate]);

  return (
    <div className="min-h-[70vh] p-4 sm:p-6 flex items-center justify-center bg-slate-50">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl w-full rounded-3xl overflow-hidden border border-[#D9EFE4] shadow-[0_24px_50px_rgba(0,45,21,0.14)]">
        <div
          className="relative p-8 sm:p-10"
          style={{ backgroundImage: "linear-gradient(120deg, rgba(0,45,21,0.92), rgba(0,121,62,0.82)), url('https://images.unsplash.com/photo-1620568674298-64f4a0c6fd5f?auto=format&fit=crop&w=1400&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 mx-auto mb-4">
            <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          </div>
          <p className="text-center text-white text-2xl font-extrabold">{t('common.welcome', 'Welcome')}</p>
          <p className="text-center text-green-100 mt-1">{t('dashboard.redirecting', 'Redirecting to your dashboard…')}</p>
          <div className="flex justify-center gap-2 mt-5">
            <span className="rass-metric-chip">🌾 Role-aware</span>
            <span className="rass-metric-chip">🤖 AI-enabled</span>
            <span className="rass-metric-chip">📊 Analytics first</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
