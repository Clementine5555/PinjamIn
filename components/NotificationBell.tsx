'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useNotifications } from './NotificationsProvider';
import { notificationHref } from '@/lib/notifications';

export default function NotificationBell() {
  const panelRef = useRef<HTMLDetailsElement>(null);
  const { user } = useAuth();
  const { notifications, loading, error, markRead, markAllRead } = useNotifications();
  const permanent = user && !user.is_anonymous;
  const unread = notifications.filter(item => !item.is_read).length;

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) panelRef.current.open = false;
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  if (!permanent) return <Link href="/login?next=%2Fnotifications" aria-label="Masuk untuk melihat notifikasi" className="rounded-full p-2 hover:bg-background"><Bell size={22} /></Link>;
  return <details ref={panelRef} className="relative">
    <summary aria-label={unread ? `${unread} notifikasi belum dibaca` : 'Notifikasi'} className="relative flex cursor-pointer list-none rounded-full p-2 hover:bg-background [&::-webkit-details-marker]:hidden">
      <Bell size={22} />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
    </summary>
    <div className="absolute right-0 top-12 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-primary/10 bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between gap-3"><p className="font-bold">Notifikasi</p>{unread > 0 && <button type="button" onClick={() => void markAllRead()} className="text-xs font-semibold text-primary">Tandai dibaca</button>}</div>
      <div className="mt-3 space-y-2">
        {loading ? <p className="text-sm text-muted-foreground">Memuat...</p> : error ? <p role="alert" className="text-sm text-red-700">{error}</p> : notifications.length ? notifications.slice(0, 3).map(item => <Link key={item.id} href={notificationHref(item.href)} onClick={() => { if (panelRef.current) panelRef.current.open = false; void markRead(item.id); }} className={`block rounded-xl p-3 text-sm ${item.is_read ? 'bg-background' : 'bg-mint/25'}`}><span className="font-semibold">{item.title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.message}</span></Link>) : <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>}
      </div>
      <Link href="/notifications" onClick={() => { if (panelRef.current) panelRef.current.open = false; }} className="mt-3 inline-block text-sm font-semibold text-primary">Lihat semua notifikasi →</Link>
    </div>
  </details>;
}
