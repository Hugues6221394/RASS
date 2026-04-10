import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

type Preferences = {
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifySecurityAlerts: boolean;
  notifyMarketing: boolean;
};

export const SettingsPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [otpSetup, setOtpSetup] = useState<{ qrCodeUrl: string; manualEntryKey: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [disableOtpCode, setDisableOtpCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [prefs, setPrefs] = useState<Preferences>({
    notifyInApp: true,
    notifyEmail: true,
    notifySecurityAlerts: true,
    notifyMarketing: false,
  });

  const passwordValidation = useMemo(() => {
    const hasLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const matches = newPassword.length > 0 && newPassword === confirmPassword;
    return { hasLength, hasUpper, hasNumber, matches };
  }, [newPassword, confirmPassword]);

  const resetFeedback = () => {
    setError('');
    setMessage('');
  };

  const showError = (e: any) => {
    setError(String(e?.response?.data?.message || e?.response?.data || e?.message || t('shared.action_failed', 'Action failed.')));
  };

  const loadProfile = async () => {
    try {
      const res = await api.get('/api/profile');
      const s = res.data?.settings || {};
      setTwoFactorEnabled(Boolean(s.twoFactorEnabled));
      setPrefs({
        notifyInApp: Boolean(s.notifyInApp),
        notifyEmail: Boolean(s.notifyEmail),
        notifySecurityAlerts: Boolean(s.notifySecurityAlerts),
        notifyMarketing: Boolean(s.notifyMarketing),
      });
    } catch {
      // no-op
    }
  };

  useEffect(() => { void loadProfile(); }, []);

  const changePassword = async () => {
    resetFeedback();
    if (!currentPassword || !newPassword || !confirmPassword) return setError(t('settings.fill_password_fields', 'Fill all password fields.'));
    if (!passwordValidation.hasLength || !passwordValidation.hasUpper || !passwordValidation.hasNumber) {
      return setError(t('settings.password_strength_error', 'Password must be at least 8 characters and include uppercase + number.'));
    }
    if (newPassword !== confirmPassword) return setError(t('settings.passwords_mismatch', 'Passwords do not match'));
    setBusy(true);
    try {
      await api.put('/api/profile/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(t('settings.password_updated', 'Password updated successfully'));
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const beginOtpSetup = async () => {
    resetFeedback();
    setBusy(true);
    try {
      const res = await api.post('/api/profile/otp/setup');
      setOtpSetup({ qrCodeUrl: res.data?.qrCodeUrl, manualEntryKey: res.data?.manualEntryKey });
      setMessage(t('settings.otp_scan_guidance', 'Scan the QR code in Google/Microsoft Authenticator, then enter the 6-digit code.'));
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtpSetup = async () => {
    resetFeedback();
    if (!/^\d{6}$/.test(otpCode.trim())) return setError(t('settings.otp_invalid_format', 'Enter a valid 6-digit OTP code.'));
    setBusy(true);
    try {
      await api.post('/api/profile/otp/setup/verify', { otpCode: otpCode.trim() });
      setOtpCode('');
      setOtpSetup(null);
      setMessage(t('settings.otp_enabled', 'Two-factor authentication enabled.'));
      await loadProfile();
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const disableOtp = async () => {
    resetFeedback();
    if (!/^\d{6}$/.test(disableOtpCode.trim())) return setError(t('settings.otp_invalid_format', 'Enter a valid 6-digit OTP code.'));
    setBusy(true);
    try {
      await api.post('/api/profile/otp/disable', { otpCode: disableOtpCode.trim() });
      setDisableOtpCode('');
      setMessage(t('settings.otp_disabled', 'Two-factor authentication disabled.'));
      await loadProfile();
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const requestEmailChange = async () => {
    resetFeedback();
    if (!newEmail.trim()) return setError(t('settings.new_email_required', 'Enter a new email address.'));
    setBusy(true);
    try {
      await api.post('/api/profile/email-change/request', { newEmail: newEmail.trim() });
      setMessage(t('settings.email_code_sent', 'Email verification code sent to your notifications.'));
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmEmailChange = async () => {
    resetFeedback();
    if (!/^\d{6}$/.test(emailOtp.trim())) return setError(t('settings.otp_invalid_format', 'Enter a valid 6-digit OTP code.'));
    setBusy(true);
    try {
      await api.post('/api/profile/email-change/confirm', { otpCode: emailOtp.trim() });
      setEmailOtp('');
      setNewEmail('');
      setMessage(t('settings.email_changed', 'Email changed successfully.'));
      await loadProfile();
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const requestPhoneChange = async () => {
    resetFeedback();
    if (!newPhone.trim()) return setError(t('settings.new_phone_required', 'Enter a new phone number.'));
    setBusy(true);
    try {
      await api.post('/api/profile/phone-change/request', { newPhone: newPhone.trim() });
      setMessage(t('settings.phone_code_sent', 'Phone verification code sent to your notifications.'));
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmPhoneChange = async () => {
    resetFeedback();
    if (!/^\d{6}$/.test(phoneOtp.trim())) return setError(t('settings.otp_invalid_format', 'Enter a valid 6-digit OTP code.'));
    setBusy(true);
    try {
      await api.post('/api/profile/phone-change/confirm', { otpCode: phoneOtp.trim() });
      setPhoneOtp('');
      setNewPhone('');
      setMessage(t('settings.phone_changed', 'Phone number changed successfully.'));
      await loadProfile();
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const savePreferences = async () => {
    resetFeedback();
    setBusy(true);
    try {
      await api.put('/api/profile/notifications/preferences', prefs);
      setMessage(t('settings.notification_preferences_updated', 'Notification preferences updated.'));
    } catch (e: any) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-black">{t('settings.title', 'Account Settings')}</h1>
      <p className="text-sm text-slate-600">{t('settings.subtitle_full', 'Manage security, contact details, and notifications for {{name}}.', { name: user?.fullName || '' })}</p>
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-black">{t('settings.change_password', 'Change Password')}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border p-2" type="password" placeholder={t('settings.current_password', 'Current password')} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <input className="rounded-lg border p-2" type="password" placeholder={t('settings.new_password', 'New password')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input className="rounded-lg border p-2" type="password" placeholder={t('settings.confirm_new_password', 'Confirm new password')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <ul className="space-y-1 text-xs text-slate-600">
          <li>• {t('settings.password_rule_length', 'At least 8 characters')}</li>
          <li>• {t('settings.password_rule_upper', 'Contains uppercase letter (A-Z)')}</li>
          <li>• {t('settings.password_rule_number', 'Contains a number (0-9)')}</li>
        </ul>
        <button disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-60" onClick={changePassword}>{t('settings.update_password', 'Update Password')}</button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-black">{t('settings.authenticator_otp', 'Authenticator OTP (2FA)')}</h2>
        <p className="text-sm text-slate-600">{t('settings.otp_status', 'Status')}: <strong>{twoFactorEnabled ? t('settings.enabled', 'enabled') : t('settings.disabled', 'disabled')}</strong></p>
        {!twoFactorEnabled && (
          <div className="space-y-3">
            <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60" onClick={beginOtpSetup}>{t('settings.generate_qr', 'Generate QR code')}</button>
            {otpSetup && (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <img src={otpSetup.qrCodeUrl} alt={t('settings.otp_qr_alt', 'OTP QR code')} className="h-44 w-44 rounded border" />
                <p className="text-xs text-slate-600">{t('settings.manual_key', 'Manual key')}: <span className="font-mono">{otpSetup.manualEntryKey}</span></p>
                <div className="flex gap-2">
                  <input className="rounded-lg border p-2" placeholder={t('settings.enter_otp_code', 'Enter 6-digit authenticator code')} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                  <button disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-60" onClick={verifyOtpSetup}>{t('settings.verify_enable', 'Verify & Enable')}</button>
                </div>
              </div>
            )}
          </div>
        )}
        {twoFactorEnabled && (
          <div className="flex flex-wrap items-center gap-2">
            <input className="rounded-lg border p-2" placeholder={t('settings.enter_otp_disable', 'Enter OTP code to disable')} value={disableOtpCode} onChange={(e) => setDisableOtpCode(e.target.value)} />
            <button disabled={busy} className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-red-700 disabled:opacity-60" onClick={disableOtp}>{t('settings.disable_2fa', 'Disable 2FA')}</button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-black">{t('settings.change_email', 'Change email')}</h2>
        <div className="flex flex-wrap gap-2">
          <input className="rounded-lg border p-2 min-w-[260px]" placeholder={t('settings.new_email', 'New email')} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60" onClick={requestEmailChange}>{t('settings.send_code', 'Send code')}</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="rounded-lg border p-2 min-w-[260px]" placeholder={t('settings.verification_code', 'Verification code')} value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} />
          <button disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-60" onClick={confirmEmailChange}>{t('settings.confirm_email_change', 'Confirm email change')}</button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-black">{t('settings.change_phone', 'Change phone number')}</h2>
        <div className="flex flex-wrap gap-2">
          <input className="rounded-lg border p-2 min-w-[260px]" placeholder={t('settings.new_phone', 'New phone number')} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60" onClick={requestPhoneChange}>{t('settings.send_code', 'Send code')}</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="rounded-lg border p-2 min-w-[260px]" placeholder={t('settings.verification_code', 'Verification code')} value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} />
          <button disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-60" onClick={confirmPhoneChange}>{t('settings.confirm_phone_change', 'Confirm phone change')}</button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-black">{t('settings.notification_management', 'Notification management')}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.notifyInApp} onChange={(e) => setPrefs((p) => ({ ...p, notifyInApp: e.target.checked }))} /> {t('settings.pref_in_app', 'In-app notifications')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.notifyEmail} onChange={(e) => setPrefs((p) => ({ ...p, notifyEmail: e.target.checked }))} /> {t('settings.pref_email', 'Email notifications')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.notifySecurityAlerts} onChange={(e) => setPrefs((p) => ({ ...p, notifySecurityAlerts: e.target.checked }))} /> {t('settings.pref_security', 'Security alerts')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.notifyMarketing} onChange={(e) => setPrefs((p) => ({ ...p, notifyMarketing: e.target.checked }))} /> {t('settings.pref_marketing', 'Product updates')}</label>
        </div>
        <button disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-60" onClick={savePreferences}>{t('settings.save_preferences', 'Save preferences')}</button>
      </section>
    </div>
  );
};

export default SettingsPage;
