import React, { useState } from 'react';
import { KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { getSupabase } from './lib/supabase';

export default function AccountSettings({ session, setError, setNotice }) {
  const supabase = getSupabase();
  const currentEmail = session.user.email || '';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  function clearMessages() {
    setError('');
    setNotice('');
  }

  async function changePassword(event) {
    event.preventDefault();
    clearMessages();
    if (!currentPassword) return setError('Enter your current password.');
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('New password and confirmation do not match.');
    if (currentPassword === newPassword) return setError('New password must be different from your current password.');

    setPasswordSaving(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword
      });
      if (verifyError) throw new Error('Current password is incorrect.');

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword
      });
      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('✓ Password changed successfully.');
    } catch (err) {
      setError(err.message || 'Could not change your password.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function changeEmail(event) {
    event.preventDefault();
    clearMessages();
    const email = newEmail.trim().toLowerCase();
    const confirmation = confirmEmail.trim().toLowerCase();
    if (!email) return setError('Enter a new email address.');
    if (email === currentEmail.toLowerCase()) return setError('The new email must be different from your current email.');
    if (email !== confirmation) return setError('New email and confirmation do not match.');

    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/admin` }
      );
      if (error) throw error;
      setNewEmail('');
      setConfirmEmail('');
      setNotice('✓ Verification email sent. Check your email to verify your new email.');
    } catch (err) {
      setError(err.message || 'Could not start the email change.');
    } finally {
      setEmailSaving(false);
    }
  }

  return <div className="settings-grid">
    <form className="panel form-panel" onSubmit={changePassword}>
      <div className="section-heading"><div><h2><ShieldCheck size={19} /> Security</h2><p className="muted">Change your client dashboard password securely.</p></div></div>
      <div className="form-grid">
        <label className="wide"><span>Current Password</span><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" required /></label>
        <label><span>New Password</span><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" minLength="8" required /><small className="muted">Minimum 8 characters.</small></label>
        <label><span>Confirm New Password</span><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength="8" required /></label>
      </div>
      <button className="primary-btn" type="submit" disabled={passwordSaving}>{passwordSaving ? 'Changing password...' : 'Change Password'}</button>
    </form>

    <form className="panel form-panel" onSubmit={changeEmail}>
      <div className="section-heading"><div><h2><Mail size={19} /> Email Change</h2><p className="muted">Your new email becomes active only after verification.</p></div></div>
      <div className="form-grid">
        <label className="wide"><span>Current Email</span><input type="email" value={currentEmail} readOnly /></label>
        <label><span>New Email</span><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="email" required /></label>
        <label><span>Confirm New Email</span><input type="email" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} autoComplete="email" required /></label>
      </div>
      <div className="security-note"><KeyRound size={16} /><span>Check your Email to Verify Your New Email</span></div>
      <button className="primary-btn" type="submit" disabled={emailSaving}>{emailSaving ? 'Sending verification...' : 'Send Verification Email'}</button>
    </form>
  </div>;
}
