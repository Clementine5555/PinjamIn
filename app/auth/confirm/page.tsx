'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { safeReturnPath } from '@/lib/auth';

export default function Confirm() {
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function confirm() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      try {
        if (hash.has('error') || url.searchParams.has('error')) throw new Error('invalid_link');
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw new Error('no_session');
        const { data: verified, error: verifyError } = await supabase.auth.getUser();
        if (verifyError || !verified.user?.email_confirmed_at || verified.user.is_anonymous) throw new Error('unverified');
        const next = safeReturnPath(url.searchParams.get('next'));
        const flow = url.searchParams.get('flow');
        if (active) router.replace(flow === 'upgrade' || flow === 'recovery' || verified.user.user_metadata.needs_password ? '/auth/password?next=' + encodeURIComponent(next) : next);
      } catch {
        if (active) setError('Tautan tidak valid atau kedaluwarsa. Minta email baru dari halaman login atau lupa kata sandi.');
      }
    }
    void confirm();
    return () => { active = false; };
  }, [router]);
  return <div className="page-container"><section className="mx-auto max-w-md rounded-2xl bg-white p-8"><h1 className="mb-4 text-xl font-bold">Konfirmasi akun</h1>{error ? <><p role="alert" className="text-sm text-red-700">{error}</p><Link href="/login" className="mt-4 inline-block text-primary">Kembali ke login</Link></> : <p role="status">Memeriksa tautan email...</p>}</section></div>;
}
