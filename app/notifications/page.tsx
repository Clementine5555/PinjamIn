'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAuth } from '@/components/AuthProvider';
import { useNotifications } from '@/components/NotificationsProvider';
import { notificationHref } from '@/lib/notifications';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { notifications, loading, error, markRead, markAllRead } = useNotifications();
  const unread = notifications.filter(item => !item.is_read).length;
  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (!user || user.is_anonymous) return <div className="page-container"><h1 className="text-2xl font-bold">Notifikasi</h1><p className="mt-3 text-muted-foreground">Masuk untuk melihat notifikasi akunmu.</p><Link href="/login?next=%2Fnotifications" className="mt-5 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-white">Masuk</Link></div>;
  return <div className="page-container"><div className="mx-auto max-w-2xl">
    <div className="mb-6 flex items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Notifikasi</h1><p className="mt-1 text-sm text-muted-foreground">Pembaruan transaksi dan aktivitas akunmu.</p></div>{unread > 0 && <button type="button" onClick={() => void markAllRead()} className="shrink-0 text-sm font-semibold text-primary">Tandai semua dibaca</button>}</div>
    {loading ? <p role="status">Memuat notifikasi...</p> : error ? <p role="alert" className="rounded-2xl bg-white p-5 text-red-700">{error}</p> : notifications.length ? <div className="space-y-3">{notifications.map(item => <Link key={item.id} href={notificationHref(item.href)} onClick={() => void markRead(item.id)} className={`flex gap-4 rounded-2xl border p-5 transition-colors ${item.is_read ? 'border-primary/10 bg-white' : 'border-mint bg-mint/20'}`}><span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-primary"><Bell size={19} /></span><span className="min-w-0"><span className="block font-bold">{item.title}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{item.message}</span><span className="mt-2 block text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: id })}</span></span>{!item.is_read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" />}</Link>)}</div> : <div className="rounded-2xl bg-white px-6 py-14 text-center"><Bell size={36} className="mx-auto mb-4 text-primary" /><h2 className="text-xl font-bold">Belum ada notifikasi</h2><p className="mt-2 text-sm text-muted-foreground">Pembaruan transaksi akan muncul di sini.</p></div>}
  </div></div>;
}
