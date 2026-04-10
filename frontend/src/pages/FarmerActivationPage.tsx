import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type IdentifierInputs = { identifier: string };
type PasswordInputs  = { password: string; confirmPassword: string };
interface FarmerData  { userId: string; fullName: string }

const EyeIcon = ({ show }: { show: boolean }) => show ? (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
) : (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const STEPS = ['Find Account', 'Set Password', 'Done'];

const StepIndicator = ({ step, active, completed }: { step: number; active: boolean; completed: boolean }) => (
  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0
    ${completed ? 'bg-[#00793E] text-white' : active ? 'bg-[#003D20] text-white' : 'bg-[#D9EFE4] text-[#4A6358]'}`}>
    {completed ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ) : step}
  </div>
);

export const FarmerActivationPage = () => {
  const navigate    = useNavigate();
  const { t }      = useTranslation();

  /* ─── Schemas ─── */
  const identifierSchema = z.object({
    identifier: z.string().min(1, t('activation.identifier_required', 'Identifier is required')),
  });

  const passwordSchema = z.object({
    password: z.string()
      .min(8, t('activation.password_min', 'At least 8 characters required'))
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  }).refine(d => d.password === d.confirmPassword, {
    message: t('activation.passwords_mismatch', 'Passwords do not match'),
    path: ['confirmPassword'],
  });

  const [activeStep, setActiveStep]   = useState(0);
  const [farmerData, setFarmerData]   = useState<FarmerData | null>(null);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const [showPass, setShowPass]       = useState(false);

  /* ─── Step 1 Form ─── */
  const { register: regId, handleSubmit: submitId, formState: { errors: errId, isSubmitting: loadId } } =
    useForm<IdentifierInputs>({ resolver: zodResolver(identifierSchema) });

  /* ─── Step 2 Form ─── */
  const { register: regPw, handleSubmit: submitPw, formState: { errors: errPw, isSubmitting: loadPw } } =
    useForm<PasswordInputs>({ resolver: zodResolver(passwordSchema) });

  /* ─── Handlers ─── */
  const handleCheckIdentifier = async (data: IdentifierInputs) => {
    try {
      setError('');
      interface ActivationCheckResponse { userId: string; fullName: string; needsPasswordSetup: boolean }
      const res = await api.post<ActivationCheckResponse>('/api/auth/farmer/activate-check', {
        identifier: data.identifier,
      });
      if (!res.data.needsPasswordSetup) {
        setError(t('activation.already_active', 'This account is already activated. Please log in.'));
        return;
      }
      setFarmerData({ userId: res.data.userId, fullName: res.data.fullName });
      setActiveStep(1);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || t('activation.verify_failed', 'Account not found. Please check your identifier.'));
    }
  };

  const handleSetPassword = async (data: PasswordInputs) => {
    if (!farmerData) return;
    try {
      setError('');
      await api.post('/api/auth/farmer/activate-complete', {
        userId: farmerData.userId,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      setSuccess(true);
      setActiveStep(2);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || t('activation.set_password_failed', 'Failed to activate account. Please try again.'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#002D15 0%,#003D20 50%,#00793E 100%)' }}>

      {/* Decorative dot grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='1.5'/%3E%3C/g%3E%3C/svg%3E\")" }} />

      <div className="relative w-full max-w-md">

        {/* Back to login */}
        <button onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t('auth.back_to_login', 'Back to Login')}
        </button>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Card header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-[#EDF5F0]">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#003D20,#00793E)' }}>
              {/* Tractor / Agriculture icon */}
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-[#0D1B12]">
              {t('activation.title', 'Farmer Account Activation')}
            </h1>
            <p className="text-sm text-[#4A6358] mt-1">
              {t('activation.subtitle', 'Activate your account to access the RASS platform')}
            </p>
          </div>

          {/* Stepper */}
          <div className="px-8 py-5 border-b border-[#EDF5F0]">
            <div className="flex items-center justify-between">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <StepIndicator step={i + 1} active={activeStep === i} completed={activeStep > i} />
                    <span className={`text-[10px] font-semibold text-center leading-tight
                      ${activeStep === i ? 'text-[#003D20]' : activeStep > i ? 'text-[#00793E]' : 'text-[#9AAFA6]'}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${activeStep > i ? 'bg-[#00793E]' : 'bg-[#D9EFE4]'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">

            {/* Error alert */}
            {error && (
              <div className="alert alert-error mb-5">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* ── STEP 1: Find Account ── */}
            {activeStep === 0 && (
              <form onSubmit={submitId(handleCheckIdentifier)} noValidate className="space-y-4">
                <p className="text-sm text-[#4A6358]">
                  {t('activation.identifier_help', 'Enter your National ID, phone number, or the email registered by your cooperative manager.')}
                </p>
                <div>
                  <label className="form-label">
                    {t('activation.identifier_label', 'National ID / Phone / Email')} *
                  </label>
                  <input
                    type="text"
                    {...regId('identifier')}
                    className={`form-input ${errId.identifier ? 'error' : ''}`}
                    placeholder={t('activation.identifier_placeholder', 'e.g. 1198080123456789 or +250 788 000 000')}
                    autoComplete="username"
                  />
                  {errId.identifier && <p className="form-error">{errId.identifier.message}</p>}
                </div>
                <button type="submit" disabled={loadId} className="btn btn-primary w-full">
                  {loadId ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Searching…
                    </span>
                  ) : t('activation.find_account', 'Find My Account')}
                </button>
              </form>
            )}

            {/* ── STEP 2: Set Password ── */}
            {activeStep === 1 && (
              <form onSubmit={submitPw(handleSetPassword)} noValidate className="space-y-4">

                {/* Account found banner */}
                <div className="flex items-start gap-3 p-3 bg-[#EDF5F0] rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-[#00793E] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#003D20]">Account Found</p>
                    <p className="text-xs text-[#4A6358]">
                      {t('activation.account_found', { name: farmerData?.fullName, defaultValue: `Welcome, ${farmerData?.fullName}!` })}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[#4A6358]">
                  {t('activation.create_password_help', 'Create a strong password to secure your account.')}
                </p>

                <div>
                  <label className="form-label">New Password *</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      {...regPw('password')}
                      className={`form-input pr-10 ${errPw.password ? 'error' : ''}`}
                      placeholder={t('activation.new_password_placeholder', 'Min 8 chars, uppercase, number')}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AAFA6] hover:text-[#4A6358]">
                      <EyeIcon show={showPass} />
                    </button>
                  </div>
                  {errPw.password && <p className="form-error">{errPw.password.message}</p>}
                </div>

                <div>
                  <label className="form-label">Confirm Password *</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    {...regPw('confirmPassword')}
                    className={`form-input ${errPw.confirmPassword ? 'error' : ''}`}
                    placeholder={t('activation.confirm_password_placeholder', 'Re-enter your password')}
                    autoComplete="new-password"
                  />
                  {errPw.confirmPassword && <p className="form-error">{errPw.confirmPassword.message}</p>}
                </div>

                {/* Password requirements */}
                <div className="bg-[#F4FAF7] rounded-xl p-3">
                  <p className="text-xs font-bold text-[#0D1B12] mb-2">Password Requirements</p>
                  <ul className="space-y-1">
                    {['At least 8 characters', 'One uppercase letter (A-Z)', 'One number (0-9)', 'Passwords must match'].map(tip => (
                      <li key={tip} className="flex items-center gap-1.5 text-xs text-[#4A6358]">
                        <svg className="w-3 h-3 text-[#00793E] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <button type="submit" disabled={loadPw} className="btn btn-primary w-full">
                  {loadPw ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Activating…
                    </span>
                  ) : t('activation.activate_account', 'Activate Account')}
                </button>
              </form>
            )}

            {/* ── STEP 3: Success ── */}
            {activeStep === 2 && success && (
              <div className="text-center py-4 space-y-4">
                <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#003D20,#00793E)' }}>
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0D1B12]">
                    {t('activation.success_title', 'Account Activated!')}
                  </h2>
                  <p className="text-sm text-[#4A6358] mt-1">
                    {t('activation.success_subtitle', 'Your account is ready. You can now log in to access the RASS platform and manage your farm.')}
                  </p>
                </div>

                {/* Confirmation details */}
                <div className="bg-[#EDF5F0] rounded-xl p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-[#00793E]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs font-bold text-[#003D20]">Account Details</span>
                  </div>
                  <p className="text-sm font-semibold text-[#0D1B12]">{farmerData?.fullName}</p>
                  <p className="text-xs text-[#4A6358]">Farmer · RASS Platform</p>
                </div>

                <button onClick={() => navigate('/login')} className="btn btn-primary w-full">
                  {t('activation.go_to_login', 'Go to Login')}
                </button>
              </div>
            )}
          </div>

          {/* Card footer */}
          <div className="px-8 py-4 bg-[#F4FAF7] border-t border-[#EDF5F0] text-center">
            <p className="text-xs text-[#4A6358]">
              Need help?{' '}
              <a href="mailto:support@rass.rw" className="text-[#00793E] font-semibold hover:underline">
                Contact support
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-white/50 text-xs mt-5">
          © {new Date().getFullYear()} Rwanda Agri Stability System · RASS
        </p>
      </div>
    </div>
  );
};
