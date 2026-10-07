'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';

type Review = { id: number; rental_id: number; item_id: number; rating: number; comment: string; moderation_status: string; created_at: string };
type Report = { id: number; rental_id: number; reporter_id: string; reason: string; details: string; status: string; created_at: string };

export default function AdminPage() {
  const { user, loading, error } = useAuth();
  if (loading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (error) return <div className="page-container" role="alert">{error}</div>;
  if (!user || user.is_anonymous || user.app_metadata.seru_role !== 'admin') return <div className="page-container"><h1 className="text-2xl font-bold">Akses terbatas</h1><p className="mt-3 text-sm text-muted-foreground">Halaman ini hanya untuk pengelola SERU.</p><Link href="/" className="mt-4 inline-block text-primary">Kembali ke Home →</Link></div>;
  return <AdminWorkspace key={user.id} />;
}

function AdminWorkspace() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const [reviewResult, reportResult] = await Promise.all([
        supabase.from('rental_reviews').select('id,rental_id,item_id,rating,comment,moderation_status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('rental_reports').select('id,rental_id,reporter_id,reason,details,status,created_at').order('created_at', { ascending: false }).limit(100),
      ]);
      if (!active) return;
      if (reviewResult.error || reportResult.error) setError('Data moderasi gagal dimuat. Pastikan migrasi dan hak akses admin sudah aktif.');
      else { setReviews(reviewResult.data ?? []); setReports(reportResult.data ?? []); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  async function moderateReview(reviewId: number, status: 'Disetujui' | 'Ditolak') {
    if (busy) return;
    setBusy(`review-${reviewId}`); setError('');
    const { data, error: updateError } = await supabase.from('rental_reviews')
      .update({ moderation_status: status }).eq('id', reviewId).select('moderation_status').single();
    if (updateError) setError('Status ulasan gagal diperbarui. Coba lagi.');
    else setReviews(current => current.map(review => review.id === reviewId ? { ...review, moderation_status: data.moderation_status } : review));
    setBusy(null);
  }

  async function updateReport(reportId: number, status: 'Baru' | 'Diproses' | 'Selesai') {
    if (busy) return;
    setBusy(`report-${reportId}`); setError('');
    const { data, error: updateError } = await supabase.from('rental_reports')
      .update({ status }).eq('id', reportId).select('status').single();
    if (updateError) setError('Status laporan gagal diperbarui. Coba lagi.');
    else setReports(current => current.map(report => report.id === reportId ? { ...report, status: data.status } : report));
    setBusy(null);
  }

  return <div className="page-container"><div className="mx-auto max-w-4xl space-y-7">
    <div><h1 className="text-2xl font-bold">Panel pengelola</h1><p className="mt-2 text-sm text-muted-foreground">Tinjau ulasan dan laporan transaksi. Hanya 100 entri terbaru yang ditampilkan per bagian.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status">Memuat data moderasi...</p> : <>
      <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Ulasan</h2>
        {reviews.length ? <div className="mt-4 space-y-4">{reviews.map(review => <article key={review.id} className="border-t border-primary/10 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold"><Link href={`/items/${review.item_id}`} className="text-primary">Barang #{review.item_id}</Link> · {review.rating}/5</p><span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{review.moderation_status}</span></div><p className="mt-1 text-xs text-muted-foreground">Transaksi #{review.rental_id} · {new Date(review.created_at).toLocaleDateString('id-ID')}</p><p className="mt-3 whitespace-pre-wrap text-sm">{review.comment || 'Tanpa komentar'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy !== null || review.moderation_status === 'Disetujui'} onClick={() => void moderateReview(review.id, 'Disetujui')} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Setujui</button><button type="button" disabled={busy !== null || review.moderation_status === 'Ditolak'} onClick={() => void moderateReview(review.id, 'Ditolak')} className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Tolak</button></div></article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada ulasan.</p>}
      </section>
      <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Laporan pengguna</h2>
        {reports.length ? <div className="mt-4 space-y-4">{reports.map(report => <article key={report.id} className="border-t border-primary/10 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Transaksi #{report.rental_id} · {report.reason}</p><span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{report.status}</span></div><p className="mt-1 text-xs text-muted-foreground">Pelapor: {report.reporter_id} · {new Date(report.created_at).toLocaleDateString('id-ID')}</p><p className="mt-3 whitespace-pre-wrap text-sm">{report.details}</p><div className="mt-3 flex flex-wrap gap-2">{(['Baru', 'Diproses', 'Selesai'] as const).map(status => <button key={status} type="button" disabled={busy !== null || report.status === status} onClick={() => void updateReport(report.id, status)} className="rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">{status}</button>)}</div></article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada laporan.</p>}
      </section>
    </>}
  </div></div>;
}
