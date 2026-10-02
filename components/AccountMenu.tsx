'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, UserRound } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from './AuthProvider';
import UserAvatar from './UserAvatar';
import { supabase } from '@/lib/supabase';
import { authError } from '@/lib/auth';

export default function AccountMenu() {
  const { user, loading } = useAuth();
  if (loading) return <span aria-label="Memuat akun" className="flex size-9 items-center justify-center rounded-full bg-mint/60 text-primary"><UserRound size={20} /></span>;
  return <AccountPanel key={user?.id ?? 'guest'} user={user && !user.is_anonymous ? user : null} />;
}

function AccountPanel({ user }: { user: User | null }) {
  const panelRef = useRef<HTMLDetailsElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(String(user?.user_metadata.full_name ?? ''));
  const [savedName, setSavedName] = useState(String(user?.user_metadata.full_name ?? ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const nameChanged = name.trim() !== savedName;

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) panelRef.current.open = false;
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  function close() { if (panelRef.current) panelRef.current.open = false; }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!user || !file || busy) return;
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
      setMessage('Foto profil diperbarui.');
    } catch {
      setError('Foto gagal diunggah. Coba lagi.');
    } finally { setBusy(false); }
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy || !nameChanged) return;
    if (name.trim().length < 2) { setError('Nama minimal 2 karakter.'); return; }
    setBusy(true); setMessage(''); setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (updateError) throw updateError;
      setName(name.trim());
      setSavedName(name.trim());
      setEditing(false);
      setMessage('Profil berhasil disimpan.');
    } catch (saveError) { setError(authError(saveError)); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      close();
    } catch (signOutError) { setError(authError(signOutError)); }
    finally { setBusy(false); }
  }

  return <details ref={panelRef} className="relative">
    <summary aria-label="Buka menu akun" className="flex cursor-pointer list-none rounded-full [&::-webkit-details-marker]:hidden">{user ? <UserAvatar user={user} className="size-9" decorative /> : <span className="flex size-9 items-center justify-center rounded-full bg-mint/60 text-primary"><UserRound size={20} /></span>}</summary>
    <div className="absolute right-0 top-12 z-50 max-h-[calc(100dvh-11rem)] w-[min(21rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-primary/10 bg-white p-4 shadow-lg md:max-h-[calc(100dvh-6rem)]">
      {user ? <>
        <Link href="/profile" onClick={close} className="flex items-center gap-3 border-b border-primary/10 pb-4"><UserAvatar user={user} className="size-12" decorative /><span className="min-w-0"><span className="block truncate font-semibold">{savedName || 'Pengguna PinjamIn'}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span></Link>
        <button type="button" onClick={() => { setEditing(!editing); setError(''); setMessage(''); }} className="mt-3 block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-mint/20">{editing ? 'Tutup edit profil' : 'Edit profil'}</button>
        {editing && <form onSubmit={saveName} className="space-y-3 rounded-xl bg-background p-3">
          <label className="block text-xs font-semibold">Foto profil<span className="mt-2 flex cursor-pointer items-center gap-2 text-primary"><Camera size={16} />Ganti foto</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={uploadAvatar} className="sr-only" /></label>
          <p className="text-xs text-muted-foreground">JPG, PNG, atau WebP. Maksimal 2 MB.</p>
          <label className="block text-xs font-semibold">Nama lengkap<input name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={80} required disabled={busy} className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm" /></label>
          {nameChanged && <button disabled={busy} className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Menyimpan...' : 'Simpan profil'}</button>}
        </form>}
        <Link href="/auth/password" onClick={close} className="mt-1 block rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-mint/20">{user.user_metadata.needs_password ? 'Buat kata sandi' : 'Ubah kata sandi'}</Link>
        <button type="button" disabled={busy} onClick={() => void logout()} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Keluar</button>
      </> : <>
        <p className="mb-3 font-semibold">Akun PinjamIn</p>
        <Link href="/login" onClick={close} className="block rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-mint/20">Masuk</Link>
        <Link href="/register" onClick={close} className="block rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-mint/20">Daftar</Link>
      </>}
      {message && <p role="status" className="mt-3 text-xs text-primary">{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    </div>
  </details>;
}
