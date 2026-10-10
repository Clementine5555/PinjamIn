'use client';

import Link from 'next/link';
import { use, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';

type Rental = { id: number; item_id: number; renter_id: string; status: string; items: { title: string; owner_id: string | null } | null };
type Review = { rating: number; comment: string; moderation_status: string };
type Report = { reason: string; details: string; status: string; resolution_outcome: string | null; resolution_note: string | null };
const reasons = ['Barang rusak', 'Tidak sesuai deskripsi', 'Terlambat', 'Lainnya'] as const;

export default function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading, error: authError } = useAuth();
  const [rental, setRental] = useState<Rental | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState<'review' | 'report' | null>(null);
  const [rating, setRating] = useState(5);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.is_anonymous || !/^\d+$/.test(id)) return;
    let active = true;
    async function load() {
      const rentalId = Number(id);
      const { data, error: rentalError } = await supabase.from('rentals')
        .select('id,item_id,renter_id,status,items(title,owner_id)').eq('id', rentalId).maybeSingle();
      if (!active) return;
      if (rentalError || !data) { setError('Transaksi tidak ditemukan atau gagal dimuat.'); setLoading(false); return; }
      const item = Array.isArray(data.items) ? data.items[0] ?? null : data.items;
      const current = { ...data, items: item } as Rental;
      setRental(current);
      const queries = [
        supabase.from('rental_reports').select('reason,details,status,resolution_outcome,resolution_note').eq('rental_id', rentalId).eq('reporter_id', user!.id).maybeSingle(),
        current.renter_id === user!.id
          ? supabase.from('rental_reviews').select('rating,comment,moderation_status').eq('rental_id', rentalId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ] as const;
      const [reportResult, reviewResult] = await Promise.all(queries);
      if (!active) return;
      if (reportResult.error || reviewResult.error) setError('Ulasan atau laporan gagal dimuat. Coba muat ulang halaman.');
      else { setReport(reportResult.data); setReview(reviewResult.data); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id, user, authLoading]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !rental || saving || review) return;
    const comment = String(new FormData(event.currentTarget).get('comment') ?? '').trim();
    if (comment && (comment.length < 10 || comment.length > 500)) { setActionError('Komentar harus 10–500 karakter, atau kosongkan.'); return; }
    setSaving('review'); setActionError('');
    const { data, error: saveError } = await supabase.from('rental_reviews').insert({
      rental_id: rental.id, item_id: rental.item_id, reviewer_id: user.id, rating, comment,
    }).select('rating,comment,moderation_status').single();
    if (saveError) setActionError('Ulasan gagal disimpan. Periksa status transaksi lalu coba lagi.');
    else setReview(data);
    setSaving(null);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !rental || saving || report) return;
    const values = new FormData(event.currentTarget);
    const reason = String(values.get('reason') ?? '');
    const details = String(values.get('details') ?? '').trim();
    if (!reasons.includes(reason as typeof reasons[number]) || details.length < 20 || details.length > 1000) {
      setActionError('Pilih alasan dan tulis kronologi 20–1000 karakter.'); return;
    }
    setSaving('report'); setActionError('');
    const { data, error: saveError } = await supabase.from('rental_reports').insert({
      rental_id: rental.id, reporter_id: user.id, reason, details,
    }).select('reason,details,status,resolution_outcome,resolution_note').single();
    if (saveError) setActionError('Laporan gagal dikirim. Coba lagi.');
    else setReport(data);
    setSaving(null);
  }

  if (authLoading) return <div className="page-container" role="status">Memuat...</div>;
  if (authError) return <div className="page-container" role="alert">{authError}</div>;
  if (!user || user.is_anonymous) return <div className="page-container"><p>Masuk untuk melihat ulasan dan laporan transaksi.</p><Link href={`/login?next=${encodeURIComponent(`/transactions/${id}/feedback`)}`} className="mt-3 inline-block text-primary">Masuk →</Link></div>;
  if (!/^\d+$/.test(id)) return <div className="page-container" role="alert">Transaksi tidak ditemukan.</div>;
  if (loading) return <div className="page-container" role="status">Memuat...</div>;
  if (!rental || (rental.renter_id !== user.id && rental.items?.owner_id !== user.id)) return <div className="page-container" role="alert">{error || 'Transaksi tidak ditemukan.'}</div>;

  return <div className="page-container"><div className="mx-auto max-w-2xl space-y-5">
    <Link href={rental.renter_id === user.id ? '/transactions' : '/lend/requests'} className="text-sm font-semibold text-primary">← Kembali ke transaksi</Link>
    <div><h1 className="mt-4 text-2xl font-bold">Ulasan & bantuan</h1><p className="mt-2 text-sm text-muted-foreground">{rental.items?.title ?? 'Barang sewaan'} · {rental.status}</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {actionError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
    {rental.renter_id === user.id && <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Ulasan barang</h2>
      {review ? <><p className="mt-3 font-semibold text-primary">{review.rating} dari 5 bintang</p><p className="mt-2 whitespace-pre-wrap text-sm">{review.comment || 'Tanpa komentar'}</p><p className="mt-2 text-xs text-muted-foreground">Status ulasan: {review.moderation_status}. {review.moderation_status === 'Menunggu' ? 'Ulasan akan tampil di katalog setelah disetujui pengelola.' : review.moderation_status === 'Ditolak' ? 'Ulasan tidak ditampilkan di katalog.' : ''}</p></>
        : rental.status !== 'Selesai' ? <p className="mt-3 text-sm text-muted-foreground">Ulasan tersedia setelah sewa selesai.</p>
        : <form onSubmit={submitReview} className="mt-4 space-y-4"><label className="block text-sm font-semibold">Rating<select value={rating} onChange={event => setRating(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3">{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} bintang</option>)}</select></label><label className="block text-sm font-semibold">Komentar (opsional)<textarea name="comment" minLength={10} maxLength={500} rows={4} placeholder="Ceritakan pengalamanmu dengan barang ini" className="mt-2 w-full rounded-xl border border-primary/20 px-4 py-3" /></label><button disabled={saving !== null || !!error} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving === 'review' ? 'Menyimpan...' : 'Kirim ulasan'}</button></form>}
    </section>}
    <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Laporkan masalah</h2><p className="mt-2 text-sm text-muted-foreground">Laporan terkait transaksi ini ditinjau pengelola SERU.</p>
      {report ? <div className="mt-4 text-sm"><p className="font-semibold text-primary">{report.reason} · {report.status}</p><p className="mt-2 whitespace-pre-wrap">{report.details}</p>{report.resolution_note && <p className="mt-3 rounded-xl bg-mint/20 p-3"><span className="font-semibold">{report.resolution_outcome}: </span>{report.resolution_note}</p>}</div>
        : <form onSubmit={submitReport} className="mt-4 space-y-4"><label className="block text-sm font-semibold">Alasan<select name="reason" className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3">{reasons.map(reason => <option key={reason}>{reason}</option>)}</select></label><label className="block text-sm font-semibold">Kronologi<textarea name="details" required minLength={20} maxLength={1000} rows={5} placeholder="Jelaskan masalah dan kapan terjadi" className="mt-2 w-full rounded-xl border border-primary/20 px-4 py-3" /></label><button disabled={saving !== null || !!error} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving === 'report' ? 'Mengirim...' : 'Kirim laporan'}</button></form>}
    </section>
  </div></div>;
}
