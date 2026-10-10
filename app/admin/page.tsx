'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/items';
import { cancellationNoteForDisplay } from '@/lib/display-text';

type Review = { id: number; rental_id: number; item_id: number; rating: number; comment: string; moderation_status: string; created_at: string };
type Report = { id: number; rental_id: number; reporter_id: string; reason: string; details: string; status: string; resolution_outcome: string | null; resolution_note: string | null; created_at: string };
type PaymentSummary = { paid_count: number; paid_amount: number; pending_count: number };
type MarketplaceMetrics = { verified_users: number; active_listings: number; requests: number; approved_requests: number; approval_rate: number; completed_rentals: number; repeat_renters: number; repeat_rate: number; reported_rentals: number; dispute_rate: number };
type CancellationRequest = { rental_id: number; reason: string; status: string; requested_by: string; resolution_note: string | null; created_at: string };
type Payout = { rental_id: number; gross_amount: number; fee_bps: number; platform_fee: number; owner_amount: number; status: string };
type PremiumPayment = { id: number; user_id: string; amount: number; status: string; created_at: string };
type PremiumMembership = { user_id: string; active_until: string; active: boolean };
type StudentVerification = { user_id: string; student_number: string; university: string; ktm_path: string; ktp_path: string; status: string; reviewer_note: string | null; created_at: string };

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
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [metrics, setMetrics] = useState<MarketplaceMetrics | null>(null);
  const [reportNotes, setReportNotes] = useState<Record<number, string>>({});
  const [reportOutcomes, setReportOutcomes] = useState<Record<number, string>>({});
  const [cancellations, setCancellations] = useState<CancellationRequest[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [premiumPayments, setPremiumPayments] = useState<PremiumPayment[]>([]);
  const [premiumMemberships, setPremiumMemberships] = useState<Record<string, PremiumMembership>>({});
  const [verifications, setVerifications] = useState<StudentVerification[]>([]);
  const [verificationNote, setVerificationNote] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const [reviewResult, reportResult, paymentResult, cancellationResult, payoutResult, premiumResult, membershipResult, verificationResult, metricResult] = await Promise.all([
        supabase.from('rental_reviews').select('id,rental_id,item_id,rating,comment,moderation_status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('rental_reports').select('id,rental_id,reporter_id,reason,details,status,resolution_outcome,resolution_note,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.rpc('admin_payment_summary').single(),
        supabase.from('rental_cancellations').select('rental_id,reason,status,requested_by,resolution_note,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('rental_payouts').select('rental_id,gross_amount,fee_bps,platform_fee,owner_amount,status').order('created_at', { ascending: false }).limit(100),
        supabase.from('premium_payments').select('id,user_id,amount,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('premium_memberships').select('user_id,active_until').limit(100),
        supabase.from('student_verifications').select('user_id,student_number,university,ktm_path,ktp_path,status,reviewer_note,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.rpc('admin_marketplace_metrics'),
      ]);
      if (!active) return;
      if (reviewResult.error || reportResult.error || paymentResult.error || cancellationResult.error || payoutResult.error || premiumResult.error || membershipResult.error || verificationResult.error || metricResult.error) setError('Data panel gagal dimuat. Coba muat ulang halaman.');
      else { setReviews(reviewResult.data ?? []); setReports(reportResult.data ?? []); setPaymentSummary(paymentResult.data as PaymentSummary); setMetrics(metricResult.data as MarketplaceMetrics); setCancellations(cancellationResult.data ?? []); setPayouts(payoutResult.data ?? []); setPremiumPayments(premiumResult.data ?? []); setPremiumMemberships(Object.fromEntries((membershipResult.data ?? []).map(entry => [entry.user_id, { ...entry, active: new Date(entry.active_until).getTime() > Date.now() }]))); setVerifications(verificationResult.data ?? []); }
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

  async function updateReport(reportId: number, status: 'Diproses' | 'Selesai') {
    if (busy) return;
    const note = (reportNotes[reportId] ?? '').trim();
    const outcome = reportOutcomes[reportId] ?? 'Diselesaikan bersama';
    if (status === 'Selesai' && note.length < 10) { setError('Catatan penyelesaian minimal 10 karakter.'); return; }
    setBusy(`report-${reportId}`); setError('');
    const { error: updateError } = await supabase.rpc('admin_handle_report', {
      p_report_id: reportId, p_status: status,
      p_outcome: status === 'Selesai' ? outcome : null,
      p_note: status === 'Selesai' ? note : null,
    });
    if (updateError) setError('Status laporan gagal diperbarui. Coba lagi.');
    else setReports(current => current.map(report => report.id === reportId ? { ...report, status, resolution_outcome: status === 'Selesai' ? outcome : null, resolution_note: status === 'Selesai' ? note : null } : report));
    setBusy(null);
  }

  async function reviewCancellation(rentalId: number, action: 'approve' | 'reject' | 'check') {
    if (busy) return;
    setBusy(`cancel-${rentalId}`); setError('');
    try {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) throw new Error('Sesi berakhir. Masuk kembali.');
      const response = await fetch('/api/cancellations/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session.access_token}` },
        body: JSON.stringify({ rentalId, action }),
      });
      const result = await response.json() as { status?: string; resolution_note?: string; error?: string };
      if (!response.ok || !result.status) throw new Error(result.error || 'Pengajuan gagal diproses.');
      setCancellations(current => current.map(entry => entry.rental_id === rentalId
        ? { ...entry, status: result.status!, resolution_note: result.resolution_note ?? entry.resolution_note } : entry));
      if (result.status === 'Selesai') {
        const { data } = await supabase.rpc('admin_payment_summary').single();
        if (data) setPaymentSummary(data as PaymentSummary);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pengajuan gagal diproses.');
    } finally {
      setBusy(null);
    }
  }

  async function markPayout(rentalId: number) {
    if (busy) return;
    setBusy(`payout-${rentalId}`); setError('');
    const { data, error: markError } = await supabase.rpc('mark_sandbox_payout', { p_rental_id: rentalId });
    if (markError) setError('Pencairan belum bisa dicatat. Periksa status pembayaran, sewa, dan laporan pengguna.');
    else setPayouts(current => current.map(payout => payout.rental_id === rentalId ? { ...payout, status: data } : payout));
    setBusy(null);
  }

  async function openDocument(path: string) {
    setError('');
    const { data, error: linkError } = await supabase.storage.from('student-verifications').createSignedUrl(path, 60);
    if (linkError || !data?.signedUrl) setError('Dokumen gagal dibuka.');
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function reviewVerification(entry: StudentVerification, status: 'Disetujui' | 'Ditolak') {
    if (busy) return;
    const note = (verificationNote[entry.user_id] ?? '').trim();
    if (status === 'Ditolak' && note.length < 5) { setError('Tulis alasan penolakan minimal 5 karakter.'); return; }
    setBusy(`verification-${entry.user_id}`); setError('');
    const { error: reviewError } = await supabase.rpc('review_student_verification', { p_user_id: entry.user_id, p_status: status, p_note: note });
    if (reviewError) setError('Verifikasi gagal diproses. Muat ulang lalu coba lagi.');
    else setVerifications(current => current.map(row => row.user_id === entry.user_id ? { ...row, status, reviewer_note: note || null } : row));
    setBusy(null);
  }

  return <div className="page-container"><div className="mx-auto max-w-4xl space-y-7">
    <div><h1 className="text-2xl font-bold">Panel pengelola</h1><p className="mt-2 text-sm text-muted-foreground">Pantau marketplace, pembayaran, ulasan, dan laporan transaksi.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status">Memuat data moderasi...</p> : <>
      {metrics && <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Metrik marketplace</h2><p className="mt-2 text-xs text-muted-foreground">Rasio persetujuan = permintaan yang pernah disetujui ÷ seluruh permintaan. Rasio laporan = transaksi yang dilaporkan ÷ seluruh transaksi. Data lama yang sudah dibatalkan sebelum pencatatan persetujuan mungkin tidak terhitung sebagai disetujui.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {([
          ['Mahasiswa terverifikasi', metrics.verified_users],
          ['Listing tersedia', metrics.active_listings],
          ['Permintaan sewa', metrics.requests],
          ['Disetujui', `${metrics.approved_requests} (${metrics.approval_rate}%)`],
          ['Sewa selesai', metrics.completed_rentals],
          ['Penyewa kembali', `${metrics.repeat_renters} (${metrics.repeat_rate}%)`],
          ['Transaksi dilaporkan', `${metrics.reported_rentals} (${metrics.dispute_rate}%)`],
        ] as const).map(([label, value]) => <div key={label} className="rounded-xl bg-mint/20 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold text-primary">{value}</p></div>)}
      </div></section>}
      <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Verifikasi mahasiswa</h2><p className="mt-2 text-sm text-muted-foreground">Periksa KTM dan KTP secara privat. Jangan sebarkan dokumen pengguna.</p>{verifications.length ? <div className="mt-4 space-y-4">{verifications.map(entry => <article key={entry.user_id} className="border-t border-primary/10 pt-4"><p className="font-semibold">{entry.university} · {entry.student_number}</p><p className="mt-1 break-all text-xs text-muted-foreground">Akun {entry.user_id} · {entry.status}</p><div className="mt-2 flex gap-4 text-sm font-semibold text-primary"><button type="button" onClick={() => void openDocument(entry.ktm_path)}>Buka KTM</button><button type="button" onClick={() => void openDocument(entry.ktp_path)}>Buka KTP</button></div>{entry.status === 'Menunggu' && <><label className="mt-3 block text-xs font-semibold">Catatan untuk pemohon<input value={verificationNote[entry.user_id] ?? ''} onChange={event => setVerificationNote(current => ({ ...current, [entry.user_id]: event.target.value }))} maxLength={500} className="mt-2 w-full rounded-xl border border-primary/20 p-3 text-sm" /></label><div className="mt-3 flex gap-2"><button type="button" disabled={busy !== null} onClick={() => void reviewVerification(entry, 'Disetujui')} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Setujui</button><button type="button" disabled={busy !== null} onClick={() => void reviewVerification(entry, 'Ditolak')} className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Tolak</button></div></>}</article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada pengajuan.</p>}</section>
      {paymentSummary && <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Ringkasan pembayaran</h2><p className="mt-2 text-sm text-muted-foreground">Ringkasan status pembayaran yang tercatat pada transaksi SERU.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-mint/20 p-4"><p className="text-sm text-muted-foreground">Total pembayaran berhasil</p><p className="mt-2 text-xl font-bold text-primary">{formatRupiah(paymentSummary.paid_amount)}</p></div>
          <div className="rounded-xl bg-mint/20 p-4"><p className="text-sm text-muted-foreground">Transaksi dibayar</p><p className="mt-2 text-xl font-bold text-primary">{paymentSummary.paid_count}</p></div>
          <div className="rounded-xl bg-mint/20 p-4"><p className="text-sm text-muted-foreground">Menunggu pembayaran</p><p className="mt-2 text-xl font-bold text-primary">{paymentSummary.pending_count}</p></div>
        </div>
      </section>}
      <section className="rounded-2xl bg-white p-5 sm:p-7">
        <h2 className="text-lg font-bold">Pembagian hasil</h2>
        <p className="mt-2 text-sm text-muted-foreground">Tarif standar 10% dan Premium 5% dikunci saat pesanan disetujui. Nominal belum memperhitungkan biaya gateway atau pajak. Catat pencairan setelah transfer ke pemilik dilakukan.</p>
        {payouts.length ? <div className="mt-4 space-y-4">{payouts.map(payout => <article key={payout.rental_id} className="border-t border-primary/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Transaksi #{payout.rental_id}</p><span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{payout.status === 'Tercatat simulasi' ? 'Pencairan dicatat' : payout.status === 'Menunggu simulasi' ? 'Menunggu pencairan' : payout.status}</span></div>
          <p className="mt-2 text-sm text-muted-foreground">Sewa {formatRupiah(payout.gross_amount)} · Komisi platform {payout.fee_bps / 100}% ({formatRupiah(payout.platform_fee)}) · Bagian pemilik {formatRupiah(payout.owner_amount)}</p>
          {payout.status !== 'Tercatat simulasi' && <button type="button" disabled={busy !== null} onClick={() => void markPayout(payout.rental_id)} className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === `payout-${payout.rental_id}` ? 'Memproses...' : 'Catat pencairan'}</button>}
        </article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada sewa selesai yang dibayar.</p>}
      </section>
      <section className="rounded-2xl bg-white p-5 sm:p-7">
        <h2 className="text-lg font-bold">Keanggotaan Premium</h2>
        <p className="mt-2 text-sm text-muted-foreground">Rp20.000 per bulan. Premium aktif setelah pembayaran terverifikasi.</p>
        {premiumPayments.length ? <div className="mt-4 space-y-4">{premiumPayments.map(entry => <article key={entry.id} className="border-t border-primary/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Pembayaran #{entry.id}</p><span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{entry.status}</span></div>
          <p className="mt-1 break-all text-xs text-muted-foreground">Akun {entry.user_id} · {formatRupiah(entry.amount)} · {new Date(entry.created_at).toLocaleDateString('id-ID')}</p>
          {premiumMemberships[entry.user_id] && <p className="mt-2 text-sm text-muted-foreground">Premium {premiumMemberships[entry.user_id].active ? 'aktif' : 'tidak aktif'} · Hingga {new Date(premiumMemberships[entry.user_id].active_until).toLocaleString('id-ID')}</p>}
        </article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada pembayaran Premium.</p>}
      </section>
      <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Pembatalan & refund</h2><p className="mt-2 text-sm text-muted-foreground">Hanya sebelum serah terima. Refund otomatis bergantung pada metode dan status Midtrans.</p>
        {cancellations.length ? <div className="mt-4 space-y-4">{cancellations.map(entry => <article key={entry.rental_id} className="border-t border-primary/10 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Transaksi #{entry.rental_id} · {entry.requested_by === 'owner' ? 'Pemilik' : 'Penyewa'}</p><span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{entry.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{entry.reason}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleDateString('id-ID')}{entry.resolution_note ? ` · ${cancellationNoteForDisplay(entry.resolution_note)}` : ''}</p><div className="mt-3 flex flex-wrap gap-2">{['Menunggu', 'Perlu manual'].includes(entry.status) && <button type="button" disabled={busy !== null} onClick={() => void reviewCancellation(entry.rental_id, 'approve')} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === `cancel-${entry.rental_id}` ? 'Memproses...' : 'Setujui & proses'}</button>}{entry.status === 'Menunggu' && entry.requested_by !== 'owner' && <button type="button" disabled={busy !== null} onClick={() => void reviewCancellation(entry.rental_id, 'reject')} className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Tolak</button>}{entry.status === 'Diproses' && <button type="button" disabled={busy !== null} onClick={() => void reviewCancellation(entry.rental_id, 'check')} className="rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">Periksa status refund</button>}</div></article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada pengajuan pembatalan.</p>}
      </section>
      <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Ulasan</h2>
        {reviews.length ? <div className="mt-4 space-y-4">{reviews.map(review => <article key={review.id} className="border-t border-primary/10 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold"><Link href={`/items/${review.item_id}`} className="text-primary">Barang #{review.item_id}</Link> · {review.rating}/5</p><span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{review.moderation_status}</span></div><p className="mt-1 text-xs text-muted-foreground">Transaksi #{review.rental_id} · {new Date(review.created_at).toLocaleDateString('id-ID')}</p><p className="mt-3 whitespace-pre-wrap text-sm">{review.comment || 'Tanpa komentar'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy !== null || review.moderation_status === 'Disetujui'} onClick={() => void moderateReview(review.id, 'Disetujui')} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Setujui</button><button type="button" disabled={busy !== null || review.moderation_status === 'Ditolak'} onClick={() => void moderateReview(review.id, 'Ditolak')} className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Tolak</button></div></article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada ulasan.</p>}
      </section>
      <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Laporan pengguna</h2>
        {reports.length ? <div className="mt-4 space-y-4">{reports.map(report => <article key={report.id} className="border-t border-primary/10 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Transaksi #{report.rental_id} · {report.reason}</p><span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{report.status}</span></div><p className="mt-1 text-xs text-muted-foreground">Pelapor: {report.reporter_id} · {new Date(report.created_at).toLocaleDateString('id-ID')}</p><p className="mt-3 whitespace-pre-wrap text-sm">{report.details}</p>{report.resolution_note && <p className="mt-3 rounded-xl bg-mint/20 p-3 text-sm"><span className="font-semibold">{report.resolution_outcome}: </span>{report.resolution_note}</p>}{report.status !== 'Selesai' && <div className="mt-4 space-y-3">{report.status === 'Baru' && <button type="button" disabled={busy !== null} onClick={() => void updateReport(report.id, 'Diproses')} className="rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">Mulai tinjau</button>}<label className="block text-xs font-semibold">Hasil penanganan<select value={reportOutcomes[report.id] ?? 'Diselesaikan bersama'} onChange={event => setReportOutcomes(current => ({ ...current, [report.id]: event.target.value }))} className="mt-2 w-full rounded-xl border border-primary/20 bg-white p-3 text-sm"><option>Tidak terbukti</option><option>Diselesaikan bersama</option><option>Ditangani manual</option></select></label><label className="block text-xs font-semibold">Catatan keputusan<textarea value={reportNotes[report.id] ?? ''} onChange={event => setReportNotes(current => ({ ...current, [report.id]: event.target.value }))} minLength={10} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-primary/20 p-3 text-sm" /></label><button type="button" disabled={busy !== null} onClick={() => void updateReport(report.id, 'Selesai')} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Selesaikan laporan</button></div>}</article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada laporan.</p>}
      </section>
    </>}
  </div></div>;
}
