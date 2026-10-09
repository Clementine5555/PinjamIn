'use client';

import Link from 'next/link';
import { use, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';

type Rental = { id: number; status: string; renter_id: string; item_id: number; items: { owner_id: string | null; title: string } | null };
type Condition = { stage: 'handoff' | 'return'; author_id: string; condition_note: string; photo_path: string; created_at: string };

export default function ConditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [rental, setRental] = useState<Rental | null>(null);
  const [reports, setReports] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const userId = user && !user.is_anonymous ? user.id : '';

  useEffect(() => {
    if (!userId || !/^\d+$/.test(id)) return;
    let active = true;
    async function load() {
      const [rentalResult, reportResult] = await Promise.all([
        supabase.from('rentals').select('id,status,renter_id,item_id,items(owner_id,title)').eq('id', Number(id)).maybeSingle(),
        supabase.from('rental_condition_reports').select('stage,author_id,condition_note,photo_path,created_at').eq('rental_id', Number(id)).order('created_at'),
      ]);
      if (!active) return;
      if (rentalResult.error || reportResult.error) setError('Bukti kondisi gagal dimuat.');
      else {
        const row = rentalResult.data;
        setRental(row ? { ...row, items: Array.isArray(row.items) ? row.items[0] ?? null : row.items } : null);
        setReports((reportResult.data ?? []) as Condition[]);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id, userId]);

  async function openPhoto(path: string) {
    const { data, error: signedError } = await supabase.storage.from('rental-condition').createSignedUrl(path, 60);
    if (signedError || !data?.signedUrl) setError('Foto tidak bisa dibuka.');
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !rental || busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const stage = rental.status === 'Disetujui' ? 'handoff' : 'return';
    const note = String(values.get('note') ?? '').trim();
    const photo = values.get('photo');
    if (note.length < 10 || note.length > 1000 || !(photo instanceof File) || !photo.size ||
      !['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
      setError('Tulis kondisi 10–1000 karakter dan unggah foto JPG, PNG, atau WebP maksimal 5 MB.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    const extension = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${rental.id}-${stage}-${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('rental-condition').upload(path, photo, { contentType: photo.type });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('rental_condition_reports').insert({
        rental_id: rental.id, stage, author_id: userId, condition_note: note, photo_path: path,
      });
      if (insertError) throw insertError;
      setReports(current => [...current, { stage, author_id: userId, condition_note: note, photo_path: path, created_at: new Date().toISOString() }]);
      form.reset(); setMessage('Bukti kondisi tersimpan.');
    } catch {
      void supabase.storage.from('rental-condition').remove([path]);
      setError('Bukti gagal disimpan. Muat ulang dan coba lagi.');
    } finally { setBusy(false); }
  }

  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (!userId) return <div className="page-container"><Link href="/login" className="text-primary">Masuk untuk melihat bukti kondisi →</Link></div>;
  const participant = rental && (rental.renter_id === userId || rental.items?.owner_id === userId);
  const stage = rental?.status === 'Disetujui' ? 'handoff' : rental?.status === 'Sedang disewa' ? 'return' : null;
  const ownSubmitted = reports.some(report => report.stage === stage && report.author_id === userId);
  return <div className="page-container"><div className="mx-auto max-w-xl"><Link href={rental?.renter_id === userId ? '/transactions' : '/lend/requests'} className="text-sm font-semibold text-primary">← Kembali ke transaksi</Link><h1 className="mt-6 text-2xl font-bold">Bukti kondisi barang</h1>{loading ? <p className="mt-4" role="status">Memuat bukti...</p> : !participant ? <p className="mt-4" role="alert">Transaksi tidak ditemukan atau kamu bukan pesertanya.</p> : <>
    <p className="mt-2 text-sm text-muted-foreground">{rental.items?.title} · {rental.status}. Simpan foto dan catatan saat serah terima serta pengembalian.</p>
    {stage && !ownSubmitted && <form onSubmit={event => void submit(event)} className="mt-6 space-y-4 rounded-2xl bg-white p-5"><h2 className="font-bold">{stage === 'handoff' ? 'Kondisi saat serah terima' : 'Kondisi saat pengembalian'}</h2><label className="block text-sm font-semibold">Catatan kondisi<textarea name="note" required minLength={10} maxLength={1000} rows={4} className="mt-2 w-full rounded-xl border border-primary/20 p-3" /></label><label className="block text-sm font-semibold">Foto barang<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full text-sm" /></label><button disabled={busy} className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Menyimpan...' : 'Simpan bukti kondisi'}</button></form>}
    <section className="mt-6 rounded-2xl bg-white p-5"><h2 className="font-bold">Riwayat bukti</h2>{reports.length ? <div className="mt-3 space-y-4">{reports.map(report => <article key={`${report.stage}-${report.author_id}`} className="border-t border-primary/10 pt-3"><p className="text-sm font-semibold">{report.stage === 'handoff' ? 'Serah terima' : 'Pengembalian'} · {report.author_id === rental.renter_id ? 'Penyewa' : 'Pemilik'}</p><p className="mt-2 whitespace-pre-wrap text-sm">{report.condition_note}</p><button type="button" onClick={() => void openPhoto(report.photo_path)} className="mt-2 text-sm font-semibold text-primary">Lihat foto privat →</button><p className="mt-1 text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString('id-ID')}</p></article>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Belum ada bukti kondisi.</p>}</section>
  </>}{message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}</div></div>;
}
