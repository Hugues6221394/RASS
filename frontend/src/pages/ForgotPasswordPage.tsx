import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';

const requestSchema = z.object({ identifier: z.string().min(1, 'Email or phone is required') });
const verifySchema  = z.object({ otp: z.string().length(6, 'OTP must be exactly 6 digits') });
const resetSchema   = z.object({
  newPassword:     z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[0-9]/, 'Must include a number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeStep, setActiveStep]     = useState(0);
  const [error, setError]               = useState('');
  const [successMsg, setSuccessMsg]     = useState('');
  const [identifier, setIdentifier]     = useState('');
  const [otp, setOtp]                   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);

  const requestForm = useForm({ resolver: zodResolver(requestSchema) });
  const verifyForm  = useForm({ resolver: zodResolver(verifySchema) });
  const resetForm   = useForm({ resolver: zodResolver(resetSchema) });

  const stepLabels = [
    t('auth.step_identify', 'Identify Account'),
    t('auth.step_verify_otp', 'Verify OTP'),
    t('auth.step_reset_password', 'Set New Password'),
  ];

  const onRequestSubmit = async (data: any) => {
    setIsLoading(true); setError('');
    try {
      const res = await api.post('/auth/forgot-password', data);
      if (res.data.success) {
        setIdentifier(data.identifier);
        setSuccessMsg(res.data.message);
        setActiveStep(1);
      } else setError(res.data.message || t('errors.otp_send_failed'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('errors.reset_request_failed'));
    } finally { setIsLoading(false); }
  };

  const onVerifySubmit = async (data: any) => {
    setIsLoading(true); setError('');
    try {
      const res = await api.post('/auth/verify-otp', { identifier, otp: data.otp });
      if (res.data.success) {
        setOtp(data.otp);
        setSuccessMsg(t('auth.otp_verified', 'OTP verified! Set your new password.'));
        setActiveStep(2);
      } else setError(res.data.message || t('errors.invalid_otp'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('errors.verification_failed'));
    } finally { setIsLoading(false); }
  };

  const onResetSubmit = async (data: any) => {
    setIsLoading(true); setError('');
    try {
      const res = await api.post('/auth/reset-password', {
        identifier, otp,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      if (res.data.success) {
        setSuccessMsg(t('auth.reset_success', 'Password reset successfully! Redirecting…'));
        setTimeout(() => navigate('/login'), 2000);
      } else setError(res.data.message || t('errors.reset_failed'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('errors.reset_failed'));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundImage: "linear-gradient(135deg, rgba(0,45,21,0.92) 0%, rgba(0,61,32,0.84) 50%, rgba(0,121,62,0.76) 100%), url('https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?auto=format&fit=crop&w=1800&q=80')", backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Decorative background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.02]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back to login */}
        <button onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold mb-6 transition-colors group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t('auth.back_to_login', 'Back to Login')}
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Card header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-[#EDF5F0]">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#003D20,#00793E)' }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-[#0D1B12]">{t('auth.reset_password', 'Reset Password')}</h1>
            <p className="text-sm text-[#4A6358] mt-1">{t('auth.reset_subtitle', 'We\'ll send a verification code to your account')}</p>
          </div>

          {/* Step indicator */}
          <div className="px-8 py-5 border-b border-[#EDF5F0]">
            <div className="flex items-center">
              {stepLabels.map((label, idx) => (
                <div key={idx} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold transition-all ${
                      idx < activeStep ? 'bg-[#00793E] text-white' :
                      idx === activeStep ? 'border-2 border-[#00793E] text-[#00793E]' :
                      'bg-[#EDF5F0] text-[#9AAFA6]'
                    }`}>
                      {idx < activeStep ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : idx + 1}
                    </div>
                    <span className={`text-[10px] font-semibold mt-1 text-center leading-tight w-16 ${
                      idx === activeStep ? 'text-[#00793E]' : 'text-[#9AAFA6]'
                    }`}>{label}</span>
                  </div>
                  {idx < stepLabels.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${idx < activeStep ? 'bg-[#00793E]' : 'bg-[#EDF5F0]'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form area */}
          <div className="px-8 py-6">
            {error && (
              <div className="alert alert-error mb-4">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}
            {successMsg && !error && (
              <div className="alert alert-success mb-4">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{successMsg}</span>
              </div>
            )}

            {/* ── Step 1: Identify ── */}
            {activeStep === 0 && (
              <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} noValidate className="space-y-4">
                <p className="text-sm text-[#4A6358]">
                  {t('auth.reset_hint', 'Enter your email address or phone number to receive a verification code.')}
                </p>
                <div>
                  <label className="form-label">{t('auth.phone_or_email', 'Email or Phone')} *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AAFA6]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <input type="text" {...requestForm.register('identifier')} placeholder={t('auth.phone_or_email_placeholder', 'you@example.com or 0780000000')}
                      className={`form-input pl-9 ${requestForm.formState.errors.identifier ? 'error' : ''}`} autoComplete="email" />
                  </div>
                  {requestForm.formState.errors.identifier && (
                    <p className="form-error">{requestForm.formState.errors.identifier.message as string}</p>
                  )}
                </div>
                <button type="submit" disabled={isLoading}
                  className="btn btn-primary w-full justify-center py-3 text-base">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t('auth.sending', 'Sending…')}
                    </span>
                  ) : t('auth.send_otp', 'Send Verification Code')}
                </button>
              </form>
            )}

            {/* ── Step 2: Verify OTP ── */}
            {activeStep === 1 && (
              <form onSubmit={verifyForm.handleSubmit(onVerifySubmit)} noValidate className="space-y-4">
                <p className="text-sm text-[#4A6358]">
                  {t('auth.otp_sent_to', { identifier })}
                </p>
                <div>
                  <label className="form-label">{t('auth.otp_placeholder', '6-Digit OTP Code')} *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AAFA6]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </span>
                    <input type="text" inputMode="numeric" maxLength={6} {...verifyForm.register('otp')}
                      placeholder="000000"
                      className={`form-input pl-9 tracking-[0.5em] text-center font-bold text-lg ${verifyForm.formState.errors.otp ? 'error' : ''}`}
                      autoComplete="one-time-code" />
                  </div>
                  {verifyForm.formState.errors.otp && (
                    <p className="form-error">{verifyForm.formState.errors.otp.message as string}</p>
                  )}
                  <p className="form-hint">{t('auth.otp_expires', 'Code expires in 10 minutes')}</p>
                </div>
                <button type="submit" disabled={isLoading} className="btn btn-primary w-full justify-center py-3 text-base">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t('auth.verifying', 'Verifying…')}
                    </span>
                  ) : t('auth.verify_otp', 'Verify Code')}
                </button>
                <button type="button" onClick={() => { setActiveStep(0); setError(''); setSuccessMsg(''); }}
                  disabled={isLoading} className="btn btn-ghost w-full justify-center text-sm">
                  {t('auth.change_identifier', '← Use a different email / phone')}
                </button>
              </form>
            )}

            {/* ── Step 3: New Password ── */}
            {activeStep === 2 && (
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} noValidate className="space-y-4">
                <p className="text-sm text-[#4A6358]">
                  {t('auth.reset_password_hint', 'Choose a strong password with at least 8 characters.')}
                </p>
                <div>
                  <label className="form-label">{t('auth.new_password', 'New Password')} *</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} {...resetForm.register('newPassword')}
                      placeholder={t('auth.new_password_placeholder', 'Min 8 chars, uppercase, number')}
                      className={`form-input pr-10 ${resetForm.formState.errors.newPassword ? 'error' : ''}`}
                      autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AAFA6] hover:text-[#4A6358]">
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {resetForm.formState.errors.newPassword && (
                    <p className="form-error">{resetForm.formState.errors.newPassword.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">{t('auth.confirm_password', 'Confirm Password')} *</label>
                  <input type={showPassword ? 'text' : 'password'} {...resetForm.register('confirmPassword')}
                    placeholder={t('auth.confirm_password_placeholder', 'Re-enter your new password')}
                    className={`form-input ${resetForm.formState.errors.confirmPassword ? 'error' : ''}`}
                    autoComplete="new-password" />
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="form-error">{resetForm.formState.errors.confirmPassword.message as string}</p>
                  )}
                </div>
                <button type="submit" disabled={isLoading} className="btn btn-primary w-full justify-center py-3 text-base">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t('auth.resetting', 'Resetting…')}
                    </span>
                  ) : t('auth.reset_password', 'Reset Password')}
                </button>
              </form>
            )}
          </div>

          {/* Card footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-[#9AAFA6]">
              {t('auth.remember_password', 'Already remember it?')}{' '}
              <button onClick={() => navigate('/login')} className="text-[#00793E] font-semibold hover:text-[#005B2F]">
                {t('auth.sign_in', 'Sign in')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
