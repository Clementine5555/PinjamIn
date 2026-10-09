'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/items';

type QueueState = { queued: boolean; position: number | null; my_turn: boolean; priority_until: string | null; reserved: boolean };

export default function ItemExtras({ item, hasStorefront }: { item: Item; hasStorefront: boolean }) {
  const { user } = useAuth();
  const userId = user && !user.is_anonymous && user.app_metadata.seru_role !== 'admin' ? user.id : '';
  const [favorite, setFavorite] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [premium, setPremium] = useState(false);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Promise.all([
      supabase.from('item_favorites').select('item_id').eq('user_id', userId).eq('item_id', item.id).maybeSingle(),
      supabase.from('item_waitlist').select('item_id').eq('user_id', userId).eq('item_id', item.id).maybeSingle(),
      supabase.from('premium_memberships').select('active_until').eq('user_id', userId).maybeSingle(),
      supabase.rpc('item_waitlist_state', { p_item_id: item.id }),
    ]).then(([fav, wait, membership, state]) => {
      if (active) { setFavorite(!!fav.data); setWaiting(!!wait.data); setPremium(!!membership.data && new Date(membership.data.active_until).getTime() > Date.now()); setQueue(state.data as QueueState | null); }
    });
    return () => { active = false; };
  }, [item.id, userId]);

  async function toggleFavorite() {
    if (!userId || busy) return;
    setBusy(true); setError('');
    const result = favorite
      ? await supabase.from('item_favorites').delete().eq('item_id', item.id).eq('user_id', userId)
      : await supabase.from('item_favorites').insert({ item_id: item.id, user_id: userId });
    if (result.error) setError('Favorit gagal diperbarui.'); else setFavorite(!favorite);
    setBusy(false);
  }

  async function toggleWaitlist() {
    if (!userId || busy) return;
    setBusy(true); setError('');
    const result = waiting
      ? await supabase.from('item_waitlist').delete().eq('item_id', item.id).eq('user_id', userId)
      : await supabase.from('item_waitlist').insert({ item_id: item.id, user_id: userId });
    if (result.error) setError('Antrean gagal diperbarui. Muat ulang dan coba lagi.');
    else {
      setWaiting(!waiting);
      const { data } = await supabase.rpc('item_waitlist_state', { p_item_id: item.id });
      setQueue(data as QueueState | null);
    }
    setBusy(false);
  }

  return <div className="mt-4 space-y-3">
    {item.owner_id && hasStorefront && <Link href={`/owners/${item.owner_id}`} className="block text-sm font-semibold text-primary">Lihat etalase Premium pemilik →</Link>}
    {userId && userId !== item.owner_id && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void toggleFavorite()} className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"><Heart size={16} fill={favorite ? 'currentColor' : 'none'} />{favorite ? 'Tersimpan' : 'Simpan favorit'}</button>
      {(item.is_rented || waiting) && <button type="button" disabled={busy} onClick={() => void toggleWaitlist()} className="rounded-full border border-primary/20 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">{waiting ? 'Keluar antrean' : 'Masuk antrean'}</button>}
    </div>}
    {userId && queue?.queued && <p className="text-sm text-primary">Posisimu saat ini: {queue.position}. {premium ? 'Akun Premium diprioritaskan.' : 'Akun Premium didahulukan, jadi posisi bisa berubah.'} Saat giliranmu tiba, kamu punya 24 jam untuk mengajukan sewa.</p>}
    {userId && queue?.my_turn && <p className="text-sm text-primary">Giliranmu mengajukan sewa{queue.priority_until ? ` hingga ${new Date(queue.priority_until).toLocaleString('id-ID')}` : ''}. <Link href={`/items/${item.id}/checkout`} className="font-semibold underline">Ajukan sekarang →</Link></p>}
    {userId && queue?.reserved && !item.is_rented && <p className="text-sm text-muted-foreground">Barang ini sedang diprioritaskan untuk pengguna dalam antrean.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
