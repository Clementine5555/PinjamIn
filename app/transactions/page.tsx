'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/items';
import { cancellationNoteForDisplay } from '@/lib/display-text';
import { useAuth } from '@/components/AuthProvider';
import RentalStageControl, { type RentalStage } from '@/components/RentalStageControl';

type Rental = RentalStage & {
  item_id: number;
  start_date: string;
  end_date: string;
  days: number;
  total_price: number;
  late_days: number;
  late_fee_amount: number;
  items: { title: string; owner_id: string | null } | null;
};
type Cancellation = { reason: string; status: string; requested_by: string; resolution_note: string | null };

export default function Transactions() {
  const { user, loading, error } = useAuth();
  if (loading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (error) return <div className="page-container" role="alert">{error}</div>;
  if (!user) return <div className="page-container"><h1 className="text-2xl font-bold">Transaksi</h1><p className="mt-4 text-sm text-muted-foreground">Masuk untuk melihat riwayat sewamu.</p><Link href="/login?next=%2Ftransactions" className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-white">Masuk</Link></div>;
  return <RentalList key={user.id} />;
}

function RentalList() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<number, string>>({});
  const [cancellations, setCancellations] = useState<Record<number, Cancellation>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [cancellationOpenId, setCancellationOpenId] = useState<number | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        if (!auth.session) return;
        const { data, error } = await supabase.from('rentals')
          .select('id,item_id,status,start_date,end_date,days,total_price,late_days,late_fee_amount,handoff_renter_confirmed_at,handoff_owner_confirmed_at,return_renter_confirmed_at,return_owner_confirmed_at,items(title,owner_id)')
          .eq('renter_id', auth.session.user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data?.length) {
          const rentalIds = data.map(row => row.id);
          const [paymentResult, cancellationResult] = await Promise.all([
            supabase.from('rental_payments').select('rental_id,status').in('rental_id', rentalIds),
            supabase.from('rental_cancellations').select('rental_id,reason,status,requested_by,resolution_note').in('rental_id', rentalIds),
          ]);
          if (paymentResult.error || cancellationResult.error) throw paymentResult.error ?? cancellationResult.error;
          const payments = paymentResult.data;
          if (active) setPaymentStatuses(Object.fromEntries((payments ?? []).map(row => [row.rental_id, row.status])));
          if (active) setCancellations(Object.fromEntries((cancellationResult.data ?? []).map(row => [row.rental_id, row])));
        }
        if (active) setRentals((data ?? []).map(row => ({ ...row, items: Array.isArray(row.items) ? row.items[0] ?? null : row.items })));
      } catch {
        if (active) setError('Transaksi gagal dimuat. Periksa koneksi lalu coba lagi.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function cancelRental(rentalId: number) {
    if (cancelingId !== null || !window.confirm('Batalkan permintaan sewa ini?')) return;
    setCancelingId(rentalId);
    setActionError('');
    try {
      const { error } = await supabase.rpc('cancel_rental', { p_rental_id: rentalId });
      if (error) throw error;
      setRentals(current => current.map(rental => rental.id === rentalId ? { ...rental, status: 'Dibatalkan' } : rental));
    } catch {
      setActionError('Permintaan gagal dibatalkan. Mungkin sudah diproses pemilik; muat ulang untuk melihat status terbaru.');
    } finally {
      setCancelingId(null);
    }
  }

  async function requestCancellation(rentalId: number) {
    const reason = cancellationReason.trim();
    if (requestingId !== null || reason.length < 5 || reason.length > 500) {
      setActionError('Alasan pembatalan harus 5 sampai 500 karakter.'); return;
    }
    setRequestingId(rentalId); setActionError('');
    const { error } = await supabase.rpc('request_rental_cancellation', { p_rental_id: rentalId, p_reason: reason });
    if (error) setActionError('Pengajuan gagal dikirim. Pastikan transaksi belum memasuki serah terima dan coba lagi.');
    else {
      setCancellations(current => ({ ...current, [rentalId]: { reason, status: 'Menunggu', requested_by: 'renter', resolution_note: null } }));
      setCancellationOpenId(null); setCancellationReason('');
    }
    setRequestingId(null);
  }

  async function confirmStage(rentalId: number, stage: 'handoff' | 'return') {
    if (confirmingId !== null) return;
    setConfirmingId(rentalId);
    setActionError('');
    const { error: confirmError } = await supabase.rpc('confirm_rental_stage', { p_rental_id: rentalId, p_stage: stage });
    if (confirmError) {
      setActionError('Konfirmasi gagal. Muat ulang status transaksi lalu coba lagi.');
    } else {
      const { data, error: loadError } = await supabase.from('rentals')
        .select('status,late_days,late_fee_amount,handoff_renter_confirmed_at,handoff_owner_confirmed_at,return_renter_confirmed_at,return_owner_confirmed_at')
        .eq('id', rentalId).single();
      if (loadError) setActionError('Konfirmasi tersimpan, tetapi status belum tampil. Muat ulang halaman.');
      else setRentals(current => current.map(rental => rental.id === rentalId ? { ...rental, ...data } : rental));
    }
    setConfirmingId(null);
  }

  return <div className="page-container">
    <h1 className="text-2xl font-bold">Transaksi</h1>
    <p className="mt-2 mb-6 text-sm text-muted-foreground">Pantau permintaan sewa milik akunmu.</p>
    {actionError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
    {loading ? <p role="status">Memuat transaksi...</p> : error ? <div role="alert" className="rounded-2xl bg-white p-6"><p>{error}</p><button onClick={() => window.location.reload()} className="mt-3 text-primary">Coba lagi</button></div> : rentals.length ? <div className="grid gap-4 md:grid-cols-2">
      {rentals.map(rental => <article key={rental.id} className="rounded-2xl border border-primary/10 bg-white p-5 sm:p-6">
        <span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{rental.status}</span>
        <h2 className="mt-4 font-bold">{rental.items?.title ?? 'Barang sewaan'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{format(new Date(rental.start_date + 'T00:00:00'), 'd MMM yyyy', { locale: id })} – {format(new Date(rental.end_date + 'T00:00:00'), 'd MMM yyyy', { locale: id })}</p>
        {rental.status === 'Sedang disewa' && !rental.return_renter_confirmed_at && rental.end_date < format(new Date(), 'yyyy-MM-dd') && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Tanggal pengembalian sudah lewat. Denda bertambah 15% dari tarif harian untuk setiap hari terlambat. Hubungi pemilik melalui chat.</p>}
        {rental.late_fee_amount > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Denda keterlambatan: {formatRupiah(rental.late_fee_amount)} ({rental.late_days} hari × 15% tarif harian). Tercatat, belum dibayar. <Link href={`/transactions/${rental.id}/feedback`} className="font-semibold underline">Laporkan jika tidak sesuai</Link>.</p>}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-primary/10 pt-4"><p className="text-sm text-muted-foreground">{rental.days} hari</p><p className="font-bold text-primary">{formatRupiah(rental.total_price)}</p></div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-primary"><Link href={`/items/${rental.item_id}`}>Lihat barang →</Link>{rental.items?.owner_id && <Link href={`/chat/${rental.id}`}>Chat pemilik →</Link>}<Link href={`/transactions/${rental.id}/condition`}>Bukti kondisi →</Link><Link href={`/transactions/${rental.id}/feedback`}>{rental.status === 'Selesai' ? 'Ulasan & bantuan →' : 'Laporkan masalah →'}</Link>{process.env.NEXT_PUBLIC_PAYMENT_SANDBOX_ENABLED === 'true' && rental.status === 'Disetujui' && !['Menunggu', 'Diproses', 'Perlu manual'].includes(cancellations[rental.id]?.status ?? '') && <Link href={`/transactions/${rental.id}/payment`}>Pembayaran →</Link>}</div>
        <RentalStageControl rental={rental} role="renter" paymentStatus={paymentStatuses[rental.id] ?? null} cancellationStatus={cancellations[rental.id]?.status} busy={confirmingId !== null} onConfirm={(rentalId, stage) => void confirmStage(rentalId, stage)} />
        {rental.status === 'Menunggu persetujuan' && <button type="button" disabled={cancelingId !== null} onClick={() => void cancelRental(rental.id)} className="mt-4 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{cancelingId === rental.id ? 'Membatalkan...' : 'Batalkan permintaan'}</button>}
        {rental.status === 'Disetujui' && !rental.handoff_renter_confirmed_at && !rental.handoff_owner_confirmed_at && (cancellations[rental.id]
          ? <div className="mt-4 rounded-xl border border-primary/10 p-4 text-sm"><p className="font-semibold">Pembatalan {cancellations[rental.id].requested_by === 'owner' ? 'oleh pemilik' : 'oleh penyewa'}: {cancellations[rental.id].status}</p><p className="mt-1 text-muted-foreground">{cancellations[rental.id].reason}</p><p className="mt-1 text-muted-foreground">{cancellations[rental.id].resolution_note ? cancellationNoteForDisplay(cancellations[rental.id].resolution_note) : 'Menunggu peninjauan pengelola.'}</p></div>
          : cancellationOpenId === rental.id
            ? <form onSubmit={event => { event.preventDefault(); void requestCancellation(rental.id); }} className="mt-4 space-y-3 rounded-xl border border-primary/10 p-4"><label className="block text-sm font-semibold">Alasan pembatalan<textarea required minLength={5} maxLength={500} value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} className="mt-2 w-full rounded-xl border border-primary/20 p-3" rows={3} /></label><p className="text-xs text-muted-foreground">Sebelum serah terima. Pembayaran yang sudah berhasil perlu ditinjau untuk pengembalian dana.</p><div className="flex gap-3"><button type="submit" disabled={requestingId !== null} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{requestingId === rental.id ? 'Mengirim...' : 'Kirim pengajuan'}</button><button type="button" onClick={() => setCancellationOpenId(null)} className="text-sm text-muted-foreground">Tutup</button></div></form>
            : <button type="button" onClick={() => { setCancellationOpenId(rental.id); setCancellationReason(''); }} className="mt-4 text-sm font-semibold text-red-700">Ajukan pembatalan →</button>)}
      </article>)}
    </div> : <div className="rounded-2xl bg-white px-6 py-14 text-center">
      <ArrowLeftRight size={36} className="mx-auto mb-4 text-primary" />
      <h2 className="text-xl font-bold">Belum ada transaksi</h2>
      <p className="mt-2 text-sm text-muted-foreground">Permintaan sewa yang kamu buat akan muncul di sini.</p>
      <Link href="/search" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white">Cari Barang</Link>
    </div>}
  </div>;
}
