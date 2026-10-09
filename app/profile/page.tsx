'use client';

import Link from 'next/link';
import { ArrowLeftRight, ChevronRight, Crown, PackagePlus, UserRound } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import UserAvatar from '@/components/UserAvatar';

export default function Profile() {
  const { user, loading, error } = useAuth();
  if (loading) return <div className="page-container" role="status">Memuat profil...</div>;
  if (error) return <div className="page-container" role="alert">{error}</div>;
  const permanent = user && !user.is_anonymous;
  const isAdmin = user?.app_metadata.seru_role === 'admin';
  return <div className="page-container"><div className="mx-auto max-w-2xl">
    <h1 className="mb-6 text-2xl font-bold">Profil</h1>
    <section className="rounded-2xl border border-primary/10 bg-white p-6 text-center sm:p-8">
      {permanent ? <>
        <div className="mx-auto mb-4 w-fit"><UserAvatar user={user} className="size-24 text-2xl" /></div>
        <h2 className="break-words text-xl font-bold">{String(user.user_metadata.full_name || 'Pengguna SERU')}</h2>
        <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
        <span className="mt-3 inline-block rounded-full bg-mint/40 px-3 py-1 text-xs text-primary">{user.email_confirmed_at ? 'Email terverifikasi' : 'Email belum terverifikasi'}</span>
        <p className="mt-4 text-xs text-muted-foreground">Edit profil dan pengaturan akun tersedia lewat foto profil di kanan atas.</p>
      </> : <>
        <div className="mx-auto mb-4 flex size-18 items-center justify-center rounded-full bg-mint/50 text-primary"><UserRound size={32} /></div>
        <h2 className="text-xl font-bold">Pengguna tamu</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{user ? 'Daftarkan sesi tamu ini agar riwayat sewa dapat diakses dari perangkat lain.' : 'Masuk atau daftar untuk menyewa barang dan menyimpan riwayat transaksi.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/login" className="rounded-full bg-primary px-6 py-3 font-semibold text-white">Masuk</Link><Link href="/register" className="rounded-full border border-primary px-6 py-3 font-semibold text-primary">Daftar</Link></div>
      </>}
    </section>
    {isAdmin ? <Link href="/admin" className="mt-6 flex items-center gap-3 rounded-2xl bg-white p-5"><UserRound className="text-primary" /><span className="flex-1 font-semibold">Panel pengelola</span><ChevronRight size={18} /></Link> : <>
    <h2 className="mt-6 mb-2 text-sm font-semibold text-muted-foreground">Sebagai penyewa</h2>
    <Link href="/transactions" className="flex items-center gap-3 rounded-2xl bg-white p-5"><ArrowLeftRight className="text-primary" /><span className="flex-1 font-semibold">Pesanan saya</span><ChevronRight size={18} /></Link>
    {permanent && <>
      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted-foreground">Sebagai pemilik</h2>
      <Link href="/premium" className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-5"><Crown className="text-primary" /><span className="flex-1 font-semibold">SERU Premium</span><ChevronRight size={18} /></Link>
      <Link href="/lend/items" className="flex items-center gap-3 rounded-2xl bg-white p-5"><PackagePlus className="text-primary" /><span className="flex-1 font-semibold">Barang saya</span><ChevronRight size={18} /></Link>
      <Link href="/lend/requests" className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-5"><ArrowLeftRight className="text-primary" /><span className="flex-1 font-semibold">Permintaan masuk</span><ChevronRight size={18} /></Link>
    </>}
    </>}
    <p className="mt-5 text-sm text-muted-foreground">{isAdmin ? 'Akun ini khusus untuk mengelola laporan dan ulasan.' : permanent ? 'Riwayat sewa mengikuti akunmu. Verifikasi email bukan verifikasi identitas mahasiswa.' : 'Riwayat tamu tetap bisa dilihat selama sesi browser masih tersimpan.'}</p>
  </div></div>;
}
