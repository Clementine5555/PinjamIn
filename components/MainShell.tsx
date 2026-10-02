'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, Home, Package, Search, UserRound } from 'lucide-react';
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
  const visibleRoutes = permanent ? [...routes.slice(0, 3), { href: '/lend/items', label: 'Barang saya', icon: Package }, routes[3]] : routes;
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
    <div className="min-h-dvh pb-24 md:pb-0">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Ke konten utama</a>
      <header className="sticky top-0 z-30 border-b border-primary/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-8 md:h-20">
          <Link href="/" aria-label="PinjamIn Home" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary">
            <Image src="/pinjamin-logo.png" width={36} height={36} alt="" className="rounded-lg" />
            PinjamIn
          </Link>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">{navigation}</nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link href="/search" aria-label="Cari barang" className="rounded-full p-2 hover:bg-background"><Search size={23} /></Link>
            <NotificationBell />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main id="content">{children}</main>
      <nav aria-label="Navigasi mobile" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-primary/10 bg-white px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">{navigation}</nav>
    </div>
  );
}
