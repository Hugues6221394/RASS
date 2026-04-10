import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import type { LoginResponse } from '../types';
import { useTranslation } from 'react-i18next';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { buildLocationText, emptyRwandaLocation } from '../utils/rwandaLocation';

type RegisterFormInputs = {
  fullName: string; email: string; password: string; confirmPassword: string;
  organization?: string; businessType?: string; location?: string; phone?: string; taxId?: string;
};

const InputField = ({
  label, error, hint, children,
}: { label: string; error?: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="form-label">{label}</label>
    {children}
    {error && (
      <p className="form-error">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {error}
      </p>
    )}
    {hint && !error && <p className="form-hint">{hint}</p>}
  </div>
);

const PasswordStrength = ({ password }: { password: string }) => {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'];

  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4].map(n => (
          <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= score ? colors[score] : 'bg-[#E2EDE7]'}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${score >= 3 ? 'text-emerald-600' : score === 2 ? 'text-blue-600' : 'text-amber-600'}`}>
        {labels[score]}
      </p>
    </div>
  );
};

export const RegisterPage = () => {
  const { t } = useTranslation();
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [watchedPwd, setWatchedPwd] = useState('');
  const [locationForm, setLocationForm] = useState(emptyRwandaLocation());

  const schema = z.object({
    fullName:        z.string().min(2, t('errors.required_field')).max(100),
    email:           z.string().email(t('errors.invalid_email')),
    password:        z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string().min(1, t('errors.required_field')),
    organization:    z.string().optional(),
    businessType:    z.string().optional(),
    location:        z.string().optional(),
    phone:           z.string().optional().refine(v => !v || /^[0-9+\s()-]{7,20}$/.test(v), 'Invalid phone number'),
    taxId:           z.string().optional(),
  }).refine(d => d.password === d.confirmPassword, {
    message: t('errors.password_mismatch'),
    path: ['confirmPassword'],
  });

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<RegisterFormInputs>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    setValue('location', buildLocationText(locationForm));
  }, [locationForm, setValue]);

  const onSubmit = async (data: RegisterFormInputs) => {
    setError('');
    try {
      const { confirmPassword, ...payload } = data;
      const res = await api.post<LoginResponse>('/api/auth/register/buyer', payload);
      const { id, token, fullName, roles } = res.data;
      setToken(token);
      setUser({ id, fullName, roles });
      localStorage.setItem('rass_token', token);
      localStorage.setItem('rass_user', JSON.stringify({ id, fullName, roles }));
      navigate('/dashboard');
    } catch (err: any) {
      const m = err?.response?.data?.message || err?.response?.data || t('errors.registration_failed');
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    }
  };

  const businessTypes = ['Hotel', 'Restaurant', 'Supermarket', 'Processor', 'Wholesaler', 'Institution', 'Other'];

  return (
    <div className="min-h-screen flex">
      {/* ── Brand panel ── */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between p-10 relative overflow-hidden"
        style={{ backgroundImage: "linear-gradient(155deg, rgba(0,31,16,0.96) 0%, rgba(0,61,32,0.9) 40%, rgba(0,91,47,0.82) 80%, rgba(0,121,62,0.78) 100%), url('https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1600&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#00C261 0%,transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#F5A623 0%,transparent 70%)' }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg,#00A651,#00793E)' }}>
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 8C8 10 5.9 16.17 3.82 21h3.28l.48-1.66A4.008 4.008 0 0 1 11 16c4 0 4-2 8-2c-4 0-4-2-8-2c0-2 4-4 6-4z"/>
              </svg>
            </div>
            <div>
              <div className="text-white font-extrabold text-xl">RASS</div>
              <div className="text-green-300 font-semibold" style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                National Platform
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
            Join Rwanda's<br />Agricultural Network
          </h2>
          <p className="text-green-200 text-sm leading-relaxed max-w-xs">
            Register as a buyer to access fresh produce directly from verified cooperatives across Rwanda.
          </p>
        </div>

        {/* Benefits */}
        <div className="relative z-10 space-y-4">
          {[
            { icon: '✓', text: 'Direct access to 200+ cooperatives' },
            { icon: '✓', text: 'Transparent pricing and quality grades' },
            { icon: '✓', text: 'MTN Mobile Money payment integration' },
            { icon: '✓', text: 'Real-time order tracking' },
            { icon: '✓', text: 'AI-powered price forecasting' },
          ].map(b => (
            <div key={b.text} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-900 mt-0.5"
                style={{ background: 'linear-gradient(135deg,#00C261,#00A651)' }}>{b.icon}</div>
              <span className="text-green-100 text-sm">{b.text}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 text-green-400 text-xs">
          © {new Date().getFullYear()} RASS · Government of Rwanda
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex-1 overflow-y-auto bg-[#F4FAF7]">
        <div className="min-h-full flex items-start justify-center p-6 py-10">
          <div className="w-full max-w-lg">

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#00A651,#003D20)' }}>
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 8C8 10 5.9 16.17 3.82 21h3.28l.48-1.66A4.008 4.008 0 0 1 11 16c4 0 4-2 8-2c-4 0-4-2-8-2c0-2 4-4 6-4z"/>
                </svg>
              </div>
              <span className="font-extrabold text-xl text-[#003D20]">RASS</span>
            </div>

            <div className="bg-white rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.10)] border border-[#D9EFE4] p-8">
              <div className="mb-7">
                <h1 className="text-2xl font-extrabold text-[#0D1B12] tracking-tight">
                  {t('auth.register_title', 'Create Buyer Account')}
                </h1>
                <p className="text-sm text-[#4A6358] mt-1">
                  {t('auth.register_subtitle', 'Join Rwanda\'s agricultural marketplace')}
                </p>
              </div>

              {error && (
                <div className="alert alert-error mb-5">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

                {/* ── Account credentials section ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg,#00A651,#00793E)' }}>1</div>
                    <h3 className="font-bold text-[#0D1B12] text-sm">Account Credentials</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label={t('auth.full_name', 'Full Name')} error={errors.fullName?.message}>
                      <input {...register('fullName')} type="text" autoComplete="name"
                        placeholder="Jean Paul Habimana"
                        className={`form-input ${errors.fullName ? 'error' : ''}`} />
                    </InputField>
                    <InputField label={t('auth.email', 'Email Address')} error={errors.email?.message}>
                      <input {...register('email')} type="email" autoComplete="email"
                        placeholder="you@example.com"
                        className={`form-input ${errors.email ? 'error' : ''}`} />
                    </InputField>
                    <InputField label={t('auth.password', 'Password')} error={errors.password?.message}>
                      <div className="relative">
                        <input {...register('password', { onChange: e => setWatchedPwd(e.target.value) })}
                          type={showPwd ? 'text' : 'password'} autoComplete="new-password"
                          placeholder="Min. 8 characters"
                          className={`form-input pr-11 ${errors.password ? 'error' : ''}`} />
                        <button type="button" onClick={() => setShowPwd(!showPwd)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8F7A] hover:text-[#003D20] transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            {showPwd
                              ? <><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></>
                              : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                            }
                          </svg>
                        </button>
                      </div>
                      <PasswordStrength password={watchedPwd} />
                    </InputField>
                    <InputField label={t('auth.confirm_password', 'Confirm Password')} error={errors.confirmPassword?.message}>
                      <input {...register('confirmPassword')} type={showPwd ? 'text' : 'password'} autoComplete="new-password"
                        placeholder="Re-enter password"
                        className={`form-input ${errors.confirmPassword ? 'error' : ''}`} />
                    </InputField>
                  </div>
                </div>

                {/* ── Business details section ── */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg,#F5A623,#D97706)' }}>2</div>
                    <h3 className="font-bold text-[#0D1B12] text-sm">
                      Business Details <span className="text-[#9AAFA6] font-normal">(optional)</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label={t('auth.organization_name', 'Organization')} error={errors.organization?.message}>
                      <input {...register('organization')} type="text" placeholder="Company or organization name"
                        className={`form-input ${errors.organization ? 'error' : ''}`} />
                    </InputField>
                    <InputField label={t('auth.business_type', 'Business Type')} error={errors.businessType?.message}>
                      <select {...register('businessType')} className={`form-input ${errors.businessType ? 'error' : ''}`}>
                        <option value="">Select type…</option>
                        {businessTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                      </select>
                    </InputField>
                    <InputField label={t('auth.phone', 'Phone Number')} error={errors.phone?.message}
                      hint="e.g. +250 780 000 000">
                      <input {...register('phone')} type="tel" autoComplete="tel" placeholder="+250 780 000 000"
                        className={`form-input ${errors.phone ? 'error' : ''}`} />
                    </InputField>
                    <div className="sm:col-span-2">
                      <input {...register('location')} type="hidden" />
                      <RwandaLocationFields
                        value={locationForm}
                        onChange={setLocationForm}
                        showDetail
                        detailLabel={t('auth.location', 'Location')}
                        detailPlaceholder="Office, delivery gate, or business landmark"
                      />
                    </div>
                    <InputField label={t('auth.tax_id', 'Tax ID / TIN')} error={errors.taxId?.message}>
                      <input {...register('taxId')} type="text" placeholder="RRA Tax ID (optional)"
                        className={`form-input ${errors.taxId ? 'error' : ''}`} />
                    </InputField>
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting}
                  className="btn btn-primary btn-lg w-full justify-center mt-2">
                  {isSubmitting ? (
                    <svg className="animate-spin w-4.5 h-4.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : null}
                  {isSubmitting ? 'Creating account…' : t('auth.sign_up', 'Create account')}
                </button>
              </form>

              <p className="text-center text-sm text-[#4A6358] mt-5">
                {t('auth.already_have_account', 'Already have an account?')}{' '}
                <Link to="/login" className="font-bold text-[#00793E] hover:text-[#005B2F] transition-colors">
                  {t('auth.sign_in', 'Sign in')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
