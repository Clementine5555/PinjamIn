'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/lib/notifications';

type NotificationContextValue = {
  notifications: AppNotification[];
  loading: boolean;
  error: string;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  loading: false,
  error: '',
  markRead: async () => {},
  markAllRead: async () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadedUserId, setLoadedUserId] = useState('');
  const [error, setError] = useState('');
  const userId = user && !user.is_anonymous ? user.id : '';

  useEffect(() => {
    let active = true;
    if (!userId) return;
    supabase.from('notifications').select('id,title,message,href,is_read,created_at').order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (!active) return;
        setLoadedUserId(userId);
        if (error) setError('Notifikasi belum bisa dimuat. Coba muat ulang halaman.');
        else { setError(''); setNotifications((data ?? []) as AppNotification[]); }
      });
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        if (!active) return;
        const incoming = payload.new as AppNotification;
        setNotifications(current => current.some(item => item.id === incoming.id) ? current : [incoming, ...current].slice(0, 50));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        if (!active) return;
        const changed = payload.new as AppNotification;
        setNotifications(current => current.map(item => item.id === changed.id ? changed : item));
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markRead(id: number) {
    if (!userId) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', userId);
    if (error) { setError('Notifikasi gagal diperbarui.'); return; }
    setNotifications(current => current.map(item => item.id === id ? { ...item, is_read: true } : item));
  }

  async function markAllRead() {
    if (!userId) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    if (error) { setError('Notifikasi gagal diperbarui.'); return; }
    setNotifications(current => current.map(item => ({ ...item, is_read: true })));
  }

  const currentUserLoaded = !!userId && loadedUserId === userId;
  return <NotificationContext.Provider value={{ notifications: currentUserLoaded ? notifications : [], loading: !!userId && !currentUserLoaded, error: currentUserLoaded ? error : '', markRead, markAllRead }}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}
