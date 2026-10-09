'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import ProductCard from '@/components/ProductCard';
import { supabase } from '@/lib/supabase';
import type { Item } from '@/lib/items';

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userId = user && !user.is_anonymous ? user.id : '';
  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function load() {
      const { data, error: loadError } = await supabase.from('item_favorites').select('item_id,items(*)').eq('user_id', userId).order('created_at', { ascending: false });
      if (!active) return;
      if (loadError) setError('Favorit gagal dimuat.');
      else setItems((data ?? []).flatMap(row => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        return item ? [item as Item] : [];
      }));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [userId]);
  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (!userId) return <div className="page-container"><h1 className="text-2xl font-bold">Favorit</h1><Link href="/login?next=%2Ffavorites" className="mt-4 inline-block text-primary">Masuk untuk melihat favorit →</Link></div>;
  return <div className="page-container"><h1 className="mb-6 text-2xl font-bold">Favorit saya</h1>{loading ? <p role="status">Memuat favorit...</p> : error ? <p role="alert">{error}</p> : items.length ? <div className="product-grid">{items.map(item => <ProductCard key={item.id} item={item} />)}</div> : <p className="rounded-2xl bg-white p-6 text-sm text-muted-foreground">Belum ada barang favorit. <Link href="/search" className="font-semibold text-primary">Jelajahi katalog →</Link></p>}</div>;
}
