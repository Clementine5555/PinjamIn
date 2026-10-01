'use client';

import Link from 'next/link';
import { useState, type ChangeEvent } from 'react';
import { ArrowLeftRight, Camera, ChevronRight, PackagePlus, UserRound } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '@/components/AuthProvider';
import UserAvatar from '@/components/UserAvatar';
import { supabase } from '@/lib/supabase';
import { authError } from '@/lib/auth';

function Account({ user }: { user: User }) {
  const [name, setName] = useState(String(user.user_metadata.full_name ?? ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Gunakan foto JPG, PNG, atau WebP.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Ukuran foto maksimal 2 MB.'); return; }
    setBusy(true); setMessage(''); setError('');
    try {
      const path = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: `${data.publicUrl}?v=${Date.now()}` } });
      if (updateError) throw updateError;
      setMessage('Foto profil berhasil diperbarui.');
    } catch {
      setError('Foto gagal diunggah. Pastikan migrasi Storage sudah dijalankan lalu coba lagi.');
    } finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) { setError('Nama minimal 2 karakter.'); return; }
    setBusy(true); setMessage(''); setError('');
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (error) throw error;
      setMessage('Profil berhasil disimpan.');
    } catch (error) { setError(authError(error)); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) { setError(authError(error)); }
    finally { setBusy(false); }
  }
  return <>
    <div className="relative mx-auto mb-4 w-fit">
      <UserAvatar user={user} className="size-24 text-2xl" />
      <label aria-label="Pilih foto profil" className="absolute bottom-0 right-0 flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow"><Camera size={17} /><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={uploadAvatar} className="sr-only" /></label>
    </div>
    <p className="mb-4 text-xs text-muted-foreground">JPG, PNG, atau WebP. Maksimal 2 MB.</p>
    <h2 className="break-words text-xl font-bold">{String(user.user_metadata.full_name || 'Pengguna PinjamIn')}</h2>
    <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
    <span className="mt-3 inline-block rounded-full bg-mint/40 px-3 py-1 text-xs text-primary">{user.email_confirmed_at ? 'Email terverifikasi' : 'Email belum terverifikasi'}</span>
    {user.user_metadata.needs_password && <p className="mt-4 text-sm"><Link href="/auth/password" className="text-primary underline">Selesaikan pendaftaran: buat kata sandi</Link></p>}
    <form onSubmit={save} className="mt-6 space-y-4 text-left">
      <label className="block text-sm font-semibold">Nama lengkap<input name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} required disabled={busy} className="mt-2 w-full rounded-xl border border-primary/20 px-4 py-3" /></label>
      <button disabled={busy} className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Memproses...' : 'Simpan profil'}</button>
    </form>
    {message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex items-center justify-between gap-3 text-sm"><Link href="/auth/password" className="text-primary">Ubah kata sandi</Link><button disabled={busy} onClick={logout} className="rounded-full border border-red-200 px-4 py-2 text-red-700">Keluar</button></div>
  </>;
}

export default function Profile() {
  const { user, loading, error } = useAuth();
  if (loading) return <div className="page-container" role="status">Memuat profil...</div>;
  if (error) return <div className="page-container" role="alert">{error}</div>;
  const permanent = user && !user.is_anonymous;
  return <div className="page-container"><div className="mx-auto max-w-2xl">
    <h1 className="mb-6 text-2xl font-bold">Profil</h1>
    <section className="rounded-2xl border border-primary/10 bg-white p-6 text-center sm:p-8">
      {permanent ? <Account key={user.id} user={user} /> : <>
        <div className="mx-auto mb-4 flex size-18 items-center justify-center rounded-full bg-mint/50 text-primary"><UserRound size={32} /></div>
        <h2 className="text-xl font-bold">Pengguna tamu</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{user ? 'Daftarkan sesi tamu ini agar riwayat sewa dapat diakses dari perangkat lain.' : 'Masuk atau daftar untuk menyewa barang dan menyimpan riwayat transaksi.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/login" className="rounded-full bg-primary px-6 py-3 font-semibold text-white">Masuk</Link><Link href="/register" className="rounded-full border border-primary px-6 py-3 font-semibold text-primary">Daftar</Link></div>
      </>}
    </section>
    <Link href="/transactions" className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-5"><ArrowLeftRight className="text-primary" /><span className="flex-1 font-semibold">Transaksi saya</span><ChevronRight size={18} /></Link>
    {permanent && <Link href="/lend" className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-5"><PackagePlus className="text-primary" /><span className="flex-1 font-semibold">Sewakan barang saya</span><ChevronRight size={18} /></Link>}
    <p className="mt-5 text-sm text-muted-foreground">{permanent ? 'Riwayat sewa mengikuti akunmu. Verifikasi email bukan verifikasi identitas mahasiswa.' : 'Riwayat tamu tetap bisa dilihat selama sesi browser masih tersimpan.'}</p>
  </div></div>;
}
