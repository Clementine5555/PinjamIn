'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/items';

type Rental = { id: number; renter_id: string; status: string; total_price: number };
type Payment = { amount: number; status: string };

async function checkPaymentStatus(rentalId: number) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('Sesi berakhir. Masuk kembali.');
  const response = await fetch('/api/payments/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
    body: JSON.stringify({ rentalId }),
  });
  const result = await response.json() as { status?: string | null; error?: string };
  if (!response.ok) throw new Error(result.error || 'Status pembayaran gagal diperiksa.');
  return result.status;
}

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [rental, setRental] = useState<Rental | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user || user.is_anonymous || !/^\d+$/.test(id)) return;
    let active = true;
    async function load() {
      const [rentalResult, paymentResult] = await Promise.all([
        supabase.from('rentals').select('id,renter_id,status,total_price').eq('id', Number(id)).maybeSingle(),
        supabase.from('rental_payments').select('amount,status').eq('rental_id', Number(id)).maybeSingle(),
      ]);
      if (!active) return;
      if (rentalResult.error || paymentResult.error) setError('Data pembayaran gagal dimuat. Pastikan migrasi database sudah dijalankan.');
      else {
        let currentPayment = paymentResult.data;
        if (currentPayment && !['Dibayar', 'Dikembalikan'].includes(currentPayment.status)) {
          try {
            const status = await checkPaymentStatus(Number(id));
            if (status) currentPayment = { ...currentPayment, status };
          } catch (cause) {
            if (active) setError(cause instanceof Error ? cause.message : 'Status pembayaran gagal diperiksa.');
          }
        }
        if (!active) return;
        setRental(rentalResult.data); setPayment(currentPayment);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id, user, authLoading]);

  async function startPayment() {
    if (!rental || busy) return;
    setBusy(true); setError('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('Sesi berakhir. Masuk kembali.');
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ rentalId: rental.id }),
      });
      const result = await response.json() as { redirect_url?: string; error?: string };
      if (!response.ok || !result.redirect_url) throw new Error(result.error || 'Pembayaran gagal disiapkan.');
      const redirect = new URL(result.redirect_url);
      if (redirect.protocol !== 'https:' || redirect.hostname !== 'app.sandbox.midtrans.com') throw new Error('Alamat pembayaran tidak valid.');
      window.location.assign(redirect.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pembayaran gagal disiapkan.');
      setBusy(false);
    }
  }

  async function refreshPaymentStatus() {
    if (!rental || checking) return;
    setChecking(true); setError('');
    try {
      const status = await checkPaymentStatus(rental.id);
      if (status) setPayment(current => current ? { ...current, status } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status pembayaran gagal diperiksa.');
    } finally {
      setChecking(false);
    }
  }

  if (process.env.NEXT_PUBLIC_PAYMENT_SANDBOX_ENABLED !== 'true') return <div className="page-container"><p>Pembayaran uji coba belum diaktifkan.</p><Link href="/transactions" className="mt-3 inline-block text-primary">Kembali ke transaksi →</Link></div>;
  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (!user || user.is_anonymous) return <div className="page-container"><p>Masuk untuk melihat pembayaran.</p><Link href={`/login?next=${encodeURIComponent(`/transactions/${id}/payment`)}`} className="mt-3 inline-block text-primary">Masuk →</Link></div>;
  if (!/^\d+$/.test(id)) return <div className="page-container" role="alert">Transaksi tidak ditemukan.</div>;
  if (loading) return <div className="page-container" role="status">Memuat pembayaran...</div>;
  if (error && !rental) return <div className="page-container" role="alert">{error}</div>;
  if (!rental || rental.renter_id !== user.id) return <div className="page-container" role="alert">Transaksi tidak ditemukan.</div>;

  return <div className="page-container"><div className="mx-auto max-w-xl space-y-5">
    <Link href="/transactions" className="text-sm font-semibold text-primary">← Kembali ke transaksi</Link>
    <div className="rounded-2xl bg-white p-6 sm:p-8"><h1 className="text-2xl font-bold">Pembayaran uji coba</h1><p className="mt-2 text-sm text-muted-foreground">Midtrans sandbox · tidak menggunakan uang sungguhan.</p>
      <div className="mt-5 flex justify-between border-y border-primary/10 py-4"><span>Total sewa</span><strong className="text-primary">{formatRupiah(rental.total_price)}</strong></div>
      <p className="mt-4 text-sm">Status sewa: <strong>{rental.status}</strong></p><p className="mt-1 text-sm">Status pembayaran: <strong>{payment?.status ?? 'Belum dimulai'}</strong></p>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Biaya platform, premium, dan boost listing belum dikenakan. Persentase dalam BMC masih draft.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {rental.status === 'Disetujui' && !['Dibayar', 'Gagal', 'Kedaluwarsa', 'Dikembalikan'].includes(payment?.status ?? '') && <button type="button" disabled={busy} onClick={() => void startPayment()} className="mt-5 w-full rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Mempersiapkan...' : payment ? 'Lanjutkan pembayaran uji coba' : 'Bayar di sandbox'}</button>}
      <button type="button" disabled={checking} onClick={() => void refreshPaymentStatus()} className="mt-3 w-full rounded-full border border-primary/20 px-5 py-3 text-sm font-semibold text-primary disabled:opacity-50">{checking ? 'Memeriksa status...' : 'Periksa status pembayaran'}</button>
    </div>
  </div></div>;
}
