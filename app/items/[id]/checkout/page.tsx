'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { formatRupiah, type Item } from '@/lib/items';

export default function Checkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!/^\d+$/.test(id)) throw new Error('Barang tidak ditemukan.');
        const { data, error } = await supabase.from('items').select('*').eq('id', Number(id)).maybeSingle();
        if (error) throw new Error('Barang gagal dimuat. Periksa koneksi lalu muat ulang.');
        if (!data) throw new Error('Barang tidak ditemukan.');
        if (active) setItem(data);
      } catch (error) {
        if (active) setErrorMsg(error instanceof Error ? error.message : 'Barang gagal dimuat.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  async function handleRent(event: React.FormEvent) {
    event.preventDefault();
    if (!item || submitting.current || !item.is_available) return;
    submitting.current = true;
    setSaving(true);
    setErrorMsg('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      let user = sessionData.session?.user;
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) throw new Error('Sesi pengguna gagal dibuat. Coba lagi.');
        user = data.user;
      }
      const { data: current, error: itemError } = await supabase.from('items').select('*').eq('id', item.id).single();
      if (itemError) throw new Error('Harga dan ketersediaan belum bisa diperiksa. Coba lagi.');
      if (!current.is_available) throw new Error('Maaf, barang ini sudah tidak tersedia.');
      if (current.price_per_day !== item.price_per_day) {
        setItem(current);
        throw new Error('Harga barang berubah. Periksa total baru lalu konfirmasi ulang.');
      }
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + days);
      const { error } = await supabase.from('rentals').insert({
        item_id: item.id,
        renter_id: user.id,
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
        days,
        total_price: current.price_per_day * days,
        status: 'Menunggu persetujuan',
      });
      if (error) throw new Error('Permintaan sewa gagal disimpan. Silakan coba lagi.');
      router.replace('/transactions');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Permintaan sewa gagal dibuat.');
      setSaving(false);
      submitting.current = false;
    }
  }

  return <div className="page-container">
    <div className="mx-auto max-w-xl">
      <Link href={`/items/${id}`} className="mb-6 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={18} />Kembali ke barang</Link>
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>
      {loading ? <p role="status">Memuat barang...</p> : <div className="rounded-2xl border border-primary/10 bg-white p-6 sm:p-8">
        {item && <form onSubmit={handleRent}>
          <p className="text-xs text-muted-foreground">{item.category} · {item.location}</p>
          <h2 className="mt-2 text-xl font-bold">{item.title}</h2>
          <p className="mt-2 text-sm text-primary">{formatRupiah(item.price_per_day)} /hari</p>
          <label htmlFor="days" className="mt-6 mb-2 block text-sm font-semibold">Durasi sewa</label>
          <select id="days" value={days} disabled={saving} onChange={e => setDays(Number(e.target.value))} className="w-full rounded-xl border border-primary/20 bg-white px-3 py-3">
            {[1, 2, 3, 4, 5, 6, 7].map(day => <option key={day} value={day}>{day} hari</option>)}
          </select>
          <div className="my-6 flex items-center justify-between gap-4 border-y border-primary/10 py-5"><p className="text-sm">Total sewa</p><p className="text-xl font-bold text-primary">{formatRupiah(item.price_per_day * days)}</p></div>
          <p className="mb-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck size={18} className="shrink-0 text-primary" />Ini permintaan sewa, bukan pembayaran. Tunggu persetujuan sebelum serah terima barang.</p>
          <button disabled={saving || !item.is_available} className="w-full rounded-full bg-primary px-4 py-3 font-semibold text-white hover:bg-primary/90 disabled:opacity-50">{saving ? 'Menyimpan permintaan...' : item.is_available ? 'Konfirmasi Sewa' : 'Barang tidak tersedia'}</button>
        </form>}
        {errorMsg && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMsg}</p>}
      </div>}
    </div>
  </div>;
}
