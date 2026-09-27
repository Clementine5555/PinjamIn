'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import { authError, safeReturnPath } from '@/lib/auth';

type Mode = 'login' | 'register' | 'forgot' | 'password';
const inputClass = 'mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3 text-sm';

function FieldHint({ id, valid, children }: { id: string; valid?: boolean; children: React.ReactNode }) {
  const color = valid === false ? 'text-red-700' : valid === true ? 'text-primary' : 'text-muted-foreground';
  return <p id={id} aria-live="polite" className={`mt-1.5 text-xs ${color}`}>{children}</p>;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function AuthForm({ mode, next = '/profile' }: { mode: Mode; next?: string }) {
  const { user, loading, error: sessionError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [resendType, setResendType] = useState<'signup' | 'email_change'>('signup');
  const [acknowledged, setAcknowledged] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const lock = useRef(false);
  const destination = safeReturnPath(next);
  const guest = !!user?.is_anonymous;
  const upgrading = mode === 'register' && guest;
  const address = email.trim();
  const emailIsValid = validEmail(address);
  const nameIsValid = name.trim().length >= 2;
  const needsNewPassword = mode === 'password' || (mode === 'register' && !upgrading);
  const passwordIsValid = password.length >= 8;
  const confirmationIsValid = confirmation.length > 0 && confirmation === password;
  const loginPasswordIsValid = password.length > 0;
  const showEmailError = !emailIsValid && (attempted || email.length > 0);
  const showNameError = !nameIsValid && (attempted || name.length > 0);
  const showPasswordError = needsNewPassword ? !passwordIsValid && (attempted || password.length > 0) : mode === 'login' && !loginPasswordIsValid && attempted;
  const showConfirmationError = needsNewPassword && !confirmationIsValid && (attempted || confirmation.length > 0);
  const titles = { login: 'Selamat datang kembali', register: 'Buat akun PinjamIn', forgot: 'Lupa kata sandi?', password: 'Atur kata sandi' };
  const link = (path: string) => path + '?next=' + encodeURIComponent(destination);
  const callback = (flow: string) => window.location.origin + '/auth/confirm?flow=' + flow + '&next=' + encodeURIComponent(destination);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setAttempted(true);
    setError('');
    setMessage('');
    if (mode !== 'password' && !emailIsValid) return;
    if (mode === 'register' && !nameIsValid) return;
    if (needsNewPassword && (!passwordIsValid || !confirmationIsValid)) return;
    if (mode === 'login' && !loginPasswordIsValid) return;
    if (mode === 'login' && guest && !acknowledged) { setError('Baca dan setujui keterangan sesi tamu terlebih dahulu.'); return; }
    lock.current = true;
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) {
          if (error.code === 'email_not_confirmed') { setSentEmail(address); setResendType('signup'); }
          throw error;
        }
        router.replace(destination);
      } else if (mode === 'register' && upgrading) {
        const { error } = await supabase.auth.updateUser({ email: address, data: { full_name: name.trim(), needs_password: true } }, { emailRedirectTo: callback('upgrade') });
        if (error) throw error;
        setSentEmail(address);
        setResendType('email_change');
        setMessage('Cek email untuk verifikasi, lalu buat kata sandi. Riwayat tamu tetap terhubung karena akun yang sama ditingkatkan.');
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: address, password, options: { data: { full_name: name.trim() }, emailRedirectTo: callback('signup') } });
        if (error) throw error;
        setPassword('');
        setConfirmation('');
        if (data.session) router.replace(destination);
        else {
          setSentEmail(address);
          setResendType('signup');
          setMessage('Jika alamat ini dapat didaftarkan, email konfirmasi telah dikirim. Periksa inbox dan spam. Jika sudah punya akun, silakan masuk.');
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: callback('recovery') });
        if (error) throw error;
        setMessage('Jika email terdaftar, tautan untuk mengatur ulang kata sandi akan dikirim. Periksa inbox dan spam.');
      } else {
        const { data, error: verifyError } = await supabase.auth.getUser();
        if (verifyError || !data.user || data.user.is_anonymous || !data.user.email_confirmed_at) {
          setError('Buka tautan verifikasi/reset yang masih berlaku atau masuk terlebih dahulu.');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password, data: { needs_password: false } });
        if (error) throw error;
        setPassword('');
        setConfirmation('');
        router.replace(destination);
      }
    } catch (error) { setError(authError(error)); }
    finally { lock.current = false; setBusy(false); }
  }

  async function resend() {
    if (lock.current) return;
    if (Date.now() < cooldown) { setError('Tunggu satu menit sebelum meminta email lagi.'); return; }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.resend({ type: resendType, email: sentEmail, options: { emailRedirectTo: callback(resendType === 'email_change' ? 'upgrade' : 'signup') } });
      if (error) throw error;
      setCooldown(Date.now() + 60000);
      setMessage('Permintaan email konfirmasi dikirim. Periksa inbox dan spam.');
    } catch (error) { setError(authError(error)); }
    finally { lock.current = false; setBusy(false); }
  }

  if (loading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (sessionError) return <div className="page-container" role="alert">{sessionError}</div>;
  if (user && !guest && (mode === 'login' || mode === 'register')) return <div className="page-container"><div className="mx-auto max-w-md rounded-2xl bg-white p-8"><h1 className="text-xl font-bold">Kamu sudah masuk</h1><Link href={user.user_metadata.needs_password ? link('/auth/password') : destination} className="mt-4 inline-block text-primary">{user.user_metadata.needs_password ? 'Selesaikan pengaturan kata sandi' : 'Lanjutkan'}</Link></div></div>;

  return <div className="page-container">
    <section className="mx-auto max-w-md rounded-2xl border border-primary/10 bg-white p-6 sm:p-8">
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-mint/40 text-primary"><LockKeyhole size={24} /></div>
      <h1 className="text-2xl font-bold">{titles[mode]}</h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">{upgrading ? 'Verifikasi email dulu, lalu buat kata sandi. Jangan hapus data browser selama proses ini.' : mode === 'password' ? 'Gunakan kata sandi minimal 8 karakter.' : 'Satu akun untuk profil dan riwayat sewa di semua perangkat.'}</p>
      {mode === 'password' && (!user || guest) ? <div><p role="alert" className="text-sm">Buka tautan dari email untuk melanjutkan.</p><Link href={link('/forgot-password')} className="mt-4 inline-block text-primary">Minta tautan baru</Link></div> : <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
          {mode === 'register' && <label className="block text-sm font-semibold">Nama lengkap<input name="name" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} aria-invalid={showNameError} aria-describedby="name-hint" className={`${inputClass} ${showNameError ? 'border-red-500' : ''}`} /><FieldHint id="name-hint" valid={name.length > 0 ? nameIsValid : undefined}>{nameIsValid ? 'Nama sudah valid.' : '*Minimal 2 karakter.'}</FieldHint></label>}
          {mode !== 'password' && <label className="block text-sm font-semibold">Email<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} aria-invalid={showEmailError} aria-describedby="email-hint" className={`${inputClass} ${showEmailError ? 'border-red-500' : ''}`} /><FieldHint id="email-hint" valid={email.length > 0 ? emailIsValid : undefined}>{emailIsValid ? 'Format email sudah valid.' : '*Gunakan format email seperti nama@domain.com.'}</FieldHint></label>}
          {mode !== 'forgot' && !upgrading && <label className="block text-sm font-semibold">Kata sandi<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} aria-invalid={showPasswordError} aria-describedby="password-hint" className={`${inputClass} ${showPasswordError ? 'border-red-500' : ''}`} /><FieldHint id="password-hint" valid={password.length > 0 ? (mode === 'login' ? loginPasswordIsValid : passwordIsValid) : undefined}>{mode === 'login' ? password.length > 0 ? 'Kata sandi sudah diisi.' : '*Kata sandi wajib diisi.' : passwordIsValid ? 'Minimal 8 karakter terpenuhi.' : '*Kata sandi harus berisi minimal 8 karakter.'}</FieldHint></label>}
          {needsNewPassword && <label className="block text-sm font-semibold">Konfirmasi kata sandi<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} aria-invalid={showConfirmationError} aria-describedby="confirmation-hint" className={`${inputClass} ${showConfirmationError ? 'border-red-500' : ''}`} /><FieldHint id="confirmation-hint" valid={confirmation.length > 0 ? confirmationIsValid : undefined}>{confirmationIsValid ? 'Kata sandi sudah sama.' : '*Harus sama dengan kata sandi di atas.'}</FieldHint></label>}
          {mode === 'login' && guest && <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed"><input type="checkbox" required checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1" /><span>Saya paham login ke akun lain tidak memindahkan riwayat tamu dan mengganti sesi ini. Untuk mempertahankan riwayat, pilih Daftar dengan email baru.</span></label>}
          <button className="w-full rounded-full bg-primary px-4 py-3 font-semibold text-white hover:bg-primary/90">{busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : mode === 'register' ? upgrading ? 'Verifikasi email' : 'Daftar' : mode === 'forgot' ? 'Kirim tautan reset' : 'Simpan kata sandi'}</button>
        </fieldset>
      </form>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-xl bg-primary/5 p-3 text-sm text-primary">{message}</p>}
      {sentEmail && <button type="button" disabled={busy} onClick={resend} className="mt-4 text-sm font-semibold text-primary">Kirim ulang konfirmasi email</button>}
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-primary">
        {mode === 'login' ? <><Link href={link('/register')}>Belum punya akun? Daftar</Link><Link href={link('/forgot-password')}>Lupa kata sandi?</Link></> : <Link href={link('/login')}>Kembali ke login</Link>}
      </div>
    </section>
  </div>;
}
