'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/items';

type Rental = {
  id: number;
  item_id: number;
  status: string;
  start_date: string;
  end_date: string;
  days: number;
  total_price: number;
  items: { title: string } | null;
};

export default function Transactions() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        if (!auth.session) return;
        const { data, error } = await supabase.from('rentals')
          .select('id,item_id,status,start_date,end_date,days,total_price,items(title)')
          .eq('renter_id', auth.session.user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (active) setRentals((data ?? []).map(row => ({ ...row, items: Array.isArray(row.items) ? row.items[0] ?? null : row.items })));
      } catch {
        if (active) setError('Transaksi gagal dimuat. Periksa koneksi lalu coba lagi.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  return <div className="page-container">
    <h1 className="text-2xl font-bold">Transaksi</h1>
    <p className="mt-2 mb-6 text-sm text-muted-foreground">Pantau permintaan sewa dari browser ini.</p>
    {loading ? <p role="status">Memuat transaksi...</p> : error ? <div role="alert" className="rounded-2xl bg-white p-6"><p>{error}</p><button onClick={() => window.location.reload()} className="mt-3 text-primary">Coba lagi</button></div> : rentals.length ? <div className="grid gap-4 md:grid-cols-2">
      {rentals.map(rental => <article key={rental.id} className="rounded-2xl border border-primary/10 bg-white p-5 sm:p-6">
        <span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{rental.status}</span>
        <h2 className="mt-4 font-bold">{rental.items?.title ?? 'Barang sewaan'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{format(new Date(rental.start_date + 'T00:00:00'), 'd MMM yyyy', { locale: id })} – {format(new Date(rental.end_date + 'T00:00:00'), 'd MMM yyyy', { locale: id })}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-primary/10 pt-4"><p className="text-sm text-muted-foreground">{rental.days} hari</p><p className="font-bold text-primary">{formatRupiah(rental.total_price)}</p></div>
        <Link href={`/items/${rental.item_id}`} className="mt-4 inline-block text-sm font-semibold text-primary">Lihat barang →</Link>
      </article>)}
    </div> : <div className="rounded-2xl bg-white px-6 py-14 text-center">
      <ArrowLeftRight size={36} className="mx-auto mb-4 text-primary" />
      <h2 className="text-xl font-bold">Belum ada transaksi</h2>
      <p className="mt-2 text-sm text-muted-foreground">Permintaan sewa yang kamu buat akan muncul di sini.</p>
      <Link href="/search" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white">Cari Barang</Link>
    </div>}
  </div>;
}
