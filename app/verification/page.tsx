'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';

type Verification = { student_number: string; university: string; ktm_path: string; ktp_path: string; status: string; reviewer_note: string | null };

export default function VerificationPage() {
  const { user, loading: authLoading } = useAuth();
  const [record, setRecord] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const userId = user && !user.is_anonymous && user.app_metadata.seru_role !== 'admin' ? user.id : '';

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void supabase.from('student_verifications').select('student_number,university,ktm_path,ktp_path,status,reviewer_note').eq('user_id', userId).maybeSingle().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError('Status verifikasi gagal dimuat. Pastikan migrasi terbaru sudah dijalankan.');
      else setRecord(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy) return;
    const values = new FormData(event.currentTarget);
    const ktm = values.get('ktm');
    const ktp = values.get('ktp');
    if (!(ktm instanceof File) || !(ktp instanceof File) || !ktm.size || !ktp.size) return;
    for (const file of [ktm, ktp]) if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('KTM dan KTP harus JPG, PNG, atau WebP, masing-masing maksimal 5 MB.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    const suffix = (file: File) => file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const ktmPath = `${userId}/ktm-${crypto.randomUUID()}.${suffix(ktm)}`;
    const ktpPath = `${userId}/ktp-${crypto.randomUUID()}.${suffix(ktp)}`;
    try {
      const first = await supabase.storage.from('student-verifications').upload(ktmPath, ktm, { contentType: ktm.type });
      if (first.error) throw first.error;
      const second = await supabase.storage.from('student-verifications').upload(ktpPath, ktp, { contentType: ktp.type });
      if (second.error) throw second.error;
      const studentNumber = String(values.get('studentNumber') ?? '').trim();
      const university = String(values.get('university') ?? '').trim();
      const result = await supabase.rpc('submit_student_verification', {
        p_student_number: studentNumber, p_university: university, p_ktm_path: ktmPath, p_ktp_path: ktpPath,
      });
      if (result.error) throw result.error;
      if (record) void supabase.storage.from('student-verifications').remove([record.ktm_path, record.ktp_path]);
      setRecord({ student_number: studentNumber, university, ktm_path: ktmPath, ktp_path: ktpPath, status: 'Menunggu', reviewer_note: null });
      setMessage('Dokumen terkirim. Pengelola akan meninjau pengajuanmu.');
    } catch {
      void supabase.storage.from('student-verifications').remove([ktmPath, ktpPath]);
      setError('Pengajuan gagal disimpan. Periksa dokumen dan coba lagi.');
    } finally { setBusy(false); }
  }

  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (!userId) return <div className="page-container"><h1 className="text-2xl font-bold">Verifikasi mahasiswa</h1><Link href="/login?next=%2Fverification" className="mt-4 inline-block text-primary">Masuk dengan akun pengguna →</Link></div>;
  return <div className="page-container"><div className="mx-auto max-w-xl space-y-5"><h1 className="text-2xl font-bold">Verifikasi mahasiswa</h1><p className="text-sm text-muted-foreground">Email terverifikasi belum membuktikan status mahasiswa. Unggah KTM dan KTP untuk ditinjau pengelola. Dokumen disimpan secara privat dan hanya bisa dibuka oleh kamu serta pengelola.</p>
    {loading ? <p role="status">Memuat status...</p> : <>
      {record && <div className="rounded-2xl bg-white p-5"><p className="font-semibold">Status: {record.status}</p><p className="mt-2 text-sm text-muted-foreground">{record.university} · {record.student_number}</p>{record.reviewer_note && <p className="mt-2 text-sm">Catatan pengelola: {record.reviewer_note}</p>}</div>}
      {(!record || record.status === 'Ditolak') && <form onSubmit={event => void submit(event)} className="space-y-4 rounded-2xl bg-white p-5 sm:p-7">
        <label className="block text-sm font-semibold">Universitas<input name="university" required minLength={3} maxLength={100} defaultValue={record?.university ?? 'Universitas Sumatera Utara'} className="mt-2 w-full rounded-xl border border-primary/20 p-3" /></label>
        <label className="block text-sm font-semibold">Nomor mahasiswa<input name="studentNumber" required minLength={4} maxLength={30} defaultValue={record?.student_number ?? ''} className="mt-2 w-full rounded-xl border border-primary/20 p-3" /></label>
        <label className="block text-sm font-semibold">Foto KTM<input name="ktm" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full text-sm" /></label>
        <label className="block text-sm font-semibold">Foto KTP<input name="ktp" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full text-sm" /></label>
        <p className="text-xs text-muted-foreground">Masing-masing maksimal 5 MB. Jangan kirim dokumen melalui chat.</p>
        <button disabled={busy} className="w-full rounded-full bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Mengirim...' : 'Kirim untuk ditinjau'}</button>
      </form>}
    </>}{message && <p role="status" className="text-sm text-primary">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div></div>;
}
