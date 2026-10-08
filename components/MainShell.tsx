'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, ArrowUpRight, Home, Mail, Package, Search, UserRound } from 'lucide-react';
import { useAuth } from './AuthProvider';
import NotificationBell from './NotificationBell';
import AccountMenu from './AccountMenu';

const routes = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Cari', icon: Search },
  { href: '/transactions', label: 'Pesanan', icon: ArrowLeftRight },
  { href: '/profile', label: 'Profil', icon: UserRound },
];

export default function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const permanent = user && !user.is_anonymous;
  const isAdmin = user?.app_metadata.seru_role === 'admin';
  const visibleRoutes = isAdmin ? [routes[0], routes[1], routes[3]] : permanent ? [...routes.slice(0, 3), { href: '/lend/items', label: 'Barang saya', icon: Package }, routes[3]] : routes;
  const navigation = visibleRoutes.map(({ href, label, icon: Icon }) => {
    const active = href === '/lend/items' ? pathname.startsWith('/lend') : pathname === href;
    return (
      <Link key={href} href={href} aria-current={active ? 'page' : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center gap-1 text-xs font-semibold transition-colors md:flex-none md:flex-row md:gap-2 md:rounded-full md:px-4 md:py-2 md:text-sm ${active ? 'text-primary md:bg-mint/30' : 'text-muted-foreground hover:text-primary'}`}>
        <span className={`flex h-8 w-14 items-center justify-center rounded-full md:h-auto md:w-auto ${active ? 'bg-mint/60 md:bg-transparent' : ''}`}><Icon size={21} aria-hidden="true" /></span>
        {label}
      </Link>
    );
  });
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Ke konten utama</a>
      <header className="sticky top-0 z-30 border-b border-primary/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-8 md:h-20">
          <Link href="/" aria-label="SERU Home" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary">
            <Image src="/pinjamin-logo.png" width={36} height={36} alt="" className="rounded-lg" />
            SERU
          </Link>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">{navigation}</nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link href="/search" aria-label="Cari barang" className="rounded-full p-2 hover:bg-background"><Search size={23} /></Link>
            <NotificationBell />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main id="content" className="flex-1">{children}</main>
      <footer className="mt-16 border-t-4 border-mint bg-[#1f4d3d] text-white">
        <div className="mx-auto max-w-[1200px] px-5 pb-28 pt-12 sm:px-8 md:pb-8 md:pt-16">
          <div className="grid gap-10 md:grid-cols-[1.4fr_0.8fr_1fr] md:gap-12">
            <div className="max-w-sm">
              <Link href="/" className="inline-flex items-center gap-3 text-2xl font-extrabold tracking-tight">
                <span className="rounded-xl bg-white p-1.5"><Image src="/pinjamin-logo.png" width={32} height={32} alt="" className="rounded-md" /></span>
                SERU
              </Link>
              <p className="mt-5 text-sm leading-7 text-white/75">Butuh barang untuk tugas atau kegiatan kampus? Temukan yang kamu perlukan, pakai seperlunya.</p>
              <Link href="/search" className="mt-6 inline-flex items-center gap-2 rounded-full bg-mint px-5 py-2.5 text-sm font-bold text-[#1f4d3d] transition-colors hover:bg-white">
                Jelajahi katalog <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-mint">Jelajahi</h2>
              <div className="mt-5 flex flex-col items-start gap-3 text-sm text-white/75">
                <Link href="/" className="transition-colors hover:text-mint">Beranda</Link>
                <Link href="/search" className="transition-colors hover:text-mint">Katalog barang</Link>
                {isAdmin ? <Link href="/admin" className="transition-colors hover:text-mint">Panel pengelola</Link> : <Link href="/transactions" className="transition-colors hover:text-mint">Pesanan saya</Link>}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-mint">Terhubung dengan SERU</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href="https://www.instagram.com/sewabarangusu/" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 px-4 py-2 text-sm transition-colors hover:border-mint hover:bg-white/10" aria-label="Instagram SERU, buka di tab baru">Instagram</a>
                <a href="https://www.tiktok.com/@sewabarangusu" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 px-4 py-2 text-sm transition-colors hover:border-mint hover:bg-white/10" aria-label="TikTok SERU, buka di tab baru">TikTok</a>
                <a href="https://x.com/Seru_ofc" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 px-4 py-2 text-sm transition-colors hover:border-mint hover:bg-white/10" aria-label="X SERU, buka di tab baru">X</a>
              </div>
              <a href="mailto:seru.officialy@gmail.com" className="mt-6 inline-flex items-center gap-2 break-all text-sm text-white/75 transition-colors hover:text-mint">
                <Mail size={17} className="shrink-0" aria-hidden="true" /> seru.officialy@gmail.com
              </a>
            </div>
          </div>
          <div className="mt-12 border-t border-white/15 pt-6 text-xs text-white/55">© SERU. Dibuat untuk kebutuhan mahasiswa.</div>
        </div>
      </footer>
      <nav aria-label="Navigasi mobile" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-primary/10 bg-white px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">{navigation}</nav>
    </div>
  );
}
