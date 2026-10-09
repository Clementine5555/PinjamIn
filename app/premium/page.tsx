'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';

type Membership = { active_from: string; active_until: string };
type PremiumPayment = { id: number; amount: number; status: string; created_at: string; redirect_url: string | null };

async function loadPremium(userId: string) {
  const [membershipResult, paymentResult] = await Promise.all([
    supabase.from('premium_memberships').select('active_from,active_until').eq('user_id', userId).maybeSingle(),
    supabase.from('premium_payments').select('id,amount,status,created_at,redirect_url')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (membershipResult.error || paymentResult.error) throw new Error('Status Premium gagal dimuat. Pastikan migrasi database sudah dijalankan.');
  return { membership: membershipResult.data as Membership | null, payment: paymentResult.data as PremiumPayment | null };
}

async function premiumRequest(path: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sesi berakhir. Masuk kembali.');
  const response = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  const result = await response.json() as { status?: string | null; redirect_url?: string; error?: string };
  if (!response.ok) throw new Error(result.error || 'Pembayaran Premium gagal diproses.');
  return result;
}

export default function PremiumPage() {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [payment, setPayment] = useState<PremiumPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const userId = user && !user.is_anonymous && user.app_metadata.seru_role !== 'admin' ? user.id : '';

  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function load() {
      try {
        let data = await loadPremium(userId);
        if (data.payment?.status === 'Menunggu') {
          try {
            await premiumRequest('/api/premium/status');
            data = await loadPremium(userId);
          } catch (cause) {
            if (active) setError(cause instanceof Error ? cause.message : 'Status pembayaran belum dapat diperiksa.');
          }
        }
        if (active) { setMembership(data.membership); setPayment(data.payment); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Status Premium gagal dimuat.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [userId]);

  async function startPayment() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await premiumRequest('/api/premium/create');
      if (!result.redirect_url) throw new Error('Alamat pembayaran tidak tersedia.');
      const redirect = new URL(result.redirect_url);
      if (redirect.protocol !== 'https:' || redirect.hostname !== 'app.sandbox.midtrans.com') throw new Error('Alamat pembayaran tidak valid.');
      window.location.assign(redirect.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pembayaran Premium gagal disiapkan.');
      setBusy(false);
    }
  }

  async function refreshStatus() {
    if (busy || !userId) return;
    setBusy(true); setError('');
    try {
      if (payment && !['Gagal', 'Kedaluwarsa', 'Dikembalikan'].includes(payment.status)) await premiumRequest('/api/premium/status');
      const data = await loadPremium(userId);
      setMembership(data.membership); setPayment(data.payment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status Premium gagal diperiksa.');
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (authError) return <div className="page-container" role="alert">{authError}</div>;
  if (!user || user.is_anonymous) return <div className="page-container"><h1 className="text-2xl font-bold">SERU Premium</h1><p className="mt-3 text-sm text-muted-foreground">Masuk dengan akun terdaftar untuk melihat Premium.</p><Link href="/login?next=%2Fpremium" className="mt-4 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-white">Masuk</Link></div>;
  if (user.app_metadata.seru_role === 'admin') return <div className="page-container"><h1 className="text-2xl font-bold">SERU Premium</h1><p className="mt-3 text-sm text-muted-foreground">Akun pengelola tidak dapat membeli Premium.</p><Link href="/admin" className="mt-4 inline-block text-primary">Buka panel pengelola →</Link></div>;

  const active = !!membership && new Date(membership.active_from).getTime() <= Date.now() && new Date(membership.active_until).getTime() > Date.now();
  return <div className="page-container"><div className="mx-auto max-w-2xl space-y-5">
    <Link href="/profile" className="text-sm font-semibold text-primary">← Kembali ke profil</Link>
    <section className="rounded-2xl bg-primary p-6 text-white sm:p-8">
      <p className="text-sm font-semibold text-mint">SERU Premium</p>
      <h1 className="mt-3 text-2xl font-bold">Komisi lebih ringan untuk pemilik barang</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/85">Standar 10% · Premium 5%. Tarif dikunci saat pesanan disetujui, jadi perubahan keanggotaan tidak mengubah pesanan yang sudah berjalan.</p>
    </section>
    <section className="rounded-2xl bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-bold">Premium 1 bulan</h2><strong className="text-xl text-primary">Rp20.000</strong></div>
      {loading ? <p className="mt-4" role="status">Memuat status Premium...</p> : <>
        <p className="mt-4 text-sm">Status akun: <strong>{active ? 'Premium aktif' : 'Standar'}</strong></p>
        {active && membership && <p className="mt-2 text-sm text-muted-foreground">Aktif sampai {new Date(membership.active_until).toLocaleString('id-ID')}.</p>}
        {payment && <p className="mt-2 text-sm text-muted-foreground">Pembayaran terakhir: {payment.status} · {new Date(payment.created_at).toLocaleDateString('id-ID')}</p>}
        {process.env.NEXT_PUBLIC_PAYMENT_SANDBOX_ENABLED === 'true' ? <>
          <button type="button" disabled={busy} onClick={() => void startPayment()} className="mt-5 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Memproses...' : payment?.status === 'Menunggu' ? 'Lanjutkan pembayaran sandbox' : active ? 'Perpanjang 1 bulan di sandbox' : 'Bayar Rp20.000 di sandbox'}</button>
          <button type="button" disabled={busy} onClick={() => void refreshStatus()} className="mt-3 w-full rounded-full border border-primary/20 px-5 py-3 text-sm font-semibold text-primary disabled:opacity-50">Periksa status pembayaran</button>
        </> : <p className="mt-4 text-sm text-muted-foreground">Pembayaran sandbox belum diaktifkan.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </>}
    </section>
    <p className="text-xs leading-relaxed text-muted-foreground">Pembayaran ini hanya simulasi Midtrans Sandbox, bukan tagihan uang sungguhan. Keanggotaan bertambah satu bulan setelah pembayaran terverifikasi. Perpanjangan dilakukan manual, tanpa penagihan otomatis. Tarif 5% hanya memengaruhi pembagian hasil simulasi sewa yang disetujui selama Premium aktif.</p>
  </div></div>;
}
