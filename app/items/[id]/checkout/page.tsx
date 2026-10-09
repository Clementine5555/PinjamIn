'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { formatRupiah, itemAvailable, type Item } from '@/lib/items';
import { useAuth } from '@/components/AuthProvider';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';

export default function Checkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [today, setToday] = useState('');
  const [bookedRanges, setBookedRanges] = useState<{ start_date: string; end_date: string }[]>([]);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [maxDays, setMaxDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!/^\d+$/.test(id)) throw new Error('Barang tidak ditemukan.');
        const { data, error } = await supabase.from('items').select('*').eq('id', Number(id)).maybeSingle();
        const currentDay = format(new Date(), 'yyyy-MM-dd');
        if (active) { setStartDate(currentDay); setToday(currentDay); }
        if (error) throw new Error('Barang gagal dimuat. Periksa koneksi lalu muat ulang.');
        if (!data) throw new Error('Barang tidak ditemukan.');
        if (active) setItem(data);
        const { data: ranges, error: rangeError } = await supabase.rpc('item_booked_ranges', { p_item_id: Number(id) });
        if (rangeError) throw new Error('Kalender ketersediaan gagal dimuat. Muat ulang halaman.');
        if (active) { setBookedRanges(ranges ?? []); setScheduleReady(true); }
      } catch (error) {
        if (active) setErrorMsg(error instanceof Error ? error.message : 'Barang gagal dimuat.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!currentUser || currentUser.is_anonymous) return;
    let active = true;
    void supabase.from('premium_memberships').select('active_until').eq('user_id', currentUser.id).maybeSingle().then(({ data }) => {
      if (active) {
        const limit = data && new Date(data.active_until).getTime() > Date.now() ? 7 : 3;
        setMaxDays(limit);
        setDays(current => Math.min(current, limit));
      }
    });
    return () => { active = false; };
  }, [currentUser]);

  const endDate = startDate ? format(addDays(new Date(`${startDate}T12:00:00`), days), 'yyyy-MM-dd') : '';
  const overlaps = !!startDate && bookedRanges.some(range => startDate <= range.end_date && endDate >= range.start_date);

  async function handleRent(event: React.FormEvent) {
    event.preventDefault();
    if (!item || submitting.current || !itemAvailable(item) || !scheduleReady || !startDate || startDate < today || overlaps) return;
    submitting.current = true;
    setSaving(true);
    setErrorMsg('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData.session?.user;
      if (!user || user.is_anonymous) {
        router.push('/login?next=' + encodeURIComponent('/items/' + id + '/checkout'));
        setSaving(false);
        submitting.current = false;
        return;
      }
      if (user.app_metadata.seru_role === 'admin') throw new Error('Akun pengelola tidak dapat menyewa barang.');
      const { data: current, error: itemError } = await supabase.from('items').select('*').eq('id', item.id).single();
      if (itemError) throw new Error('Harga dan ketersediaan belum bisa diperiksa. Coba lagi.');
      if (current.owner_id === user.id) throw new Error('Kamu tidak bisa menyewa barang milikmu sendiri.');
      if (!itemAvailable(current)) { setItem(current); throw new Error('Maaf, barang ini sudah tidak tersedia.'); }
      if (current.price_per_day !== item.price_per_day) {
        setItem(current);
        throw new Error('Harga barang berubah. Periksa total baru lalu konfirmasi ulang.');
      }
      const { error } = await supabase.from('rentals').insert({
        item_id: item.id,
        renter_id: user.id,
        start_date: startDate,
        end_date: endDate,
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
      {currentUser?.app_metadata.seru_role === 'admin' && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Akun pengelola tidak dapat menyewa barang.</p>}
      {loading ? <p role="status">Memuat barang...</p> : <div className="rounded-2xl border border-primary/10 bg-white p-6 sm:p-8">
        {item && <form onSubmit={handleRent}>
          <p className="text-xs text-muted-foreground">{item.category} · {item.location}</p>
          <h2 className="mt-2 text-xl font-bold">{item.title}</h2>
          <p className="mt-2 text-sm text-primary">{formatRupiah(item.price_per_day)} /hari</p>
          <label htmlFor="start-date" className="mt-6 mb-2 block text-sm font-semibold">Mulai sewa</label>
          <input id="start-date" type="date" required min={today} value={startDate} onChange={e => setStartDate(e.target.value)} disabled={saving} className="w-full rounded-xl border border-primary/20 bg-white px-3 py-3" />
          <label htmlFor="days" className="mt-6 mb-2 block text-sm font-semibold">Durasi sewa</label>
          <select id="days" value={days} disabled={saving} onChange={e => setDays(Number(e.target.value))} className="w-full rounded-xl border border-primary/20 bg-white px-3 py-3">
            {Array.from({ length: maxDays }, (_, index) => index + 1).map(day => <option key={day} value={day}>{day} hari</option>)}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">Standar maksimal 3 hari, Premium maksimal 7 hari. Perkiraan tanggal kembali: {endDate || '—'}.</p>
          <AvailabilityCalendar selected={startDate} today={today} ranges={bookedRanges} onSelect={setStartDate} />
          {overlaps && <p role="alert" className="mt-3 text-sm text-red-700">Tanggal ini bentrok dengan pesanan yang sudah disetujui. Pilih tanggal lain.</p>}
          <div className="my-6 flex items-center justify-between gap-4 border-y border-primary/10 py-5"><p className="text-sm">Total sewa</p><p className="text-xl font-bold text-primary">{formatRupiah(item.price_per_day * days)}</p></div>
          <p className="-mt-3 mb-5 text-xs leading-relaxed text-muted-foreground">Harga barang × {days} hari. Biaya platform 10% (pemilik Premium 5%) dipotong dari bagian pemilik saat transaksi selesai, bukan ditambahkan ke total penyewa. Tidak ada deposit.</p>
          <p className="mb-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck size={18} className="shrink-0 text-primary" />Ini permintaan sewa, bukan pembayaran. Tunggu persetujuan sebelum serah terima barang.</p>
          <button disabled={saving || authLoading || !scheduleReady || overlaps || !startDate || currentUser?.app_metadata.seru_role === 'admin' || currentUser?.id === item.owner_id || !itemAvailable(item)} className="w-full rounded-full bg-primary px-4 py-3 font-semibold text-white hover:bg-primary/90 disabled:opacity-50">{saving ? 'Menyimpan permintaan...' : currentUser?.app_metadata.seru_role === 'admin' ? 'Akun pengelola tidak bisa menyewa' : currentUser?.id === item.owner_id ? 'Tidak bisa menyewa barang sendiri' : itemAvailable(item) ? 'Konfirmasi Sewa' : 'Barang tidak tersedia'}</button>
        </form>}
        {errorMsg && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMsg}</p>}
      </div>}
    </div>
  </div>;
}
