import Link from 'next/link';
import { ArrowLeftRight, ChevronRight, ShieldCheck, UserRound } from 'lucide-react';

export default function Profile() {
  return <div className="page-container">
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Profil</h1>
      <section className="rounded-2xl border border-primary/10 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex size-18 items-center justify-center rounded-full bg-mint/50 text-primary"><UserRound size={32} /></div>
        <h2 className="text-xl font-bold">Pengguna tamu</h2>
        <span className="mt-3 inline-block rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">Mode proyek / MVP</span>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">Permintaan sewa terhubung ke sesi anonim di browser ini. Akun pribadi dan verifikasi mahasiswa belum tersedia.</p>
      </section>
      <Link href="/transactions" className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-5"><ArrowLeftRight className="text-primary" /><span className="flex-1 font-semibold">Transaksi saya</span><ChevronRight size={18} /></Link>
      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-primary/5 p-5 text-sm text-muted-foreground"><ShieldCheck size={22} className="shrink-0 text-primary" /><p>Gunakan browser yang sama untuk melihat riwayat sewa. Menghapus data browser dapat menghilangkan akses ke sesi tamu.</p></div>
    </div>
  </div>;
}
