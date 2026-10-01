'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/items';

type OwnedItem = { id: number; title: string; price_per_day: number };
type IncomingRental = { id: number; item_id: number; status: string; start_date: string; end_date: string };

export default function LendPage() {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [items, setItems] = useState<OwnedItem[]>([]);
  const [rentals, setRentals] = useState<IncomingRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const userId = user && !user.is_anonymous ? user.id : '';

  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const { data: owned, error: itemError } = await supabase.from('items')
          .select('id,title,price_per_day').eq('owner_id', userId).order('created_at', { ascending: false });
        if (itemError) throw itemError;
        const ownItems = (owned ?? []) as OwnedItem[];
        if (active) setItems(ownItems);
        if (ownItems.length) {
          const { data: requests, error: rentalError } = await supabase.from('rentals')
            .select('id,item_id,status,start_date,end_date')
            .in('item_id', ownItems.map(item => item.id)).order('created_at', { ascending: false });
          if (rentalError) throw rentalError;
          if (active) setRentals((requests ?? []) as IncomingRental[]);
        } else if (active) setRentals([]);
      } catch {
        if (active) setError('Data pemilik gagal dimuat. Pastikan migrasi database chat sudah dijalankan.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [userId]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get('title') ?? '').trim();
    const description = String(values.get('description') ?? '').trim();
    const category = String(values.get('category') ?? 'Lainnya');
    const location = String(values.get('location') ?? '').trim();
    const price = Number(values.get('price'));
    const photo = values.get('photo');
    if (title.length < 3 || !location || !Number.isSafeInteger(price) || price <= 0 || !(photo instanceof File) || !photo.size) {
      setError('Lengkapi nama, lokasi, harga, dan foto barang.'); return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
      setError('Foto harus JPG, PNG, atau WebP, maksimal 5 MB.'); return;
    }
    setSaving(true); setError(''); setMessage('');
    try {
      const extension = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('item-photos').upload(path, photo, { contentType: photo.type });
      if (uploadError) throw uploadError;
      const { data: image } = supabase.storage.from('item-photos').getPublicUrl(path);
      const { data, error: insertError } = await supabase.from('items').insert({
        owner_id: userId, title, description, category, location,
        price_per_day: price, image_url: image.publicUrl, is_available: true,
      }).select('id,title,price_per_day').single();
      if (insertError) throw insertError;
      setItems(current => [data as OwnedItem, ...current]);
      form.reset();
      setMessage('Barang berhasil ditambahkan ke katalog.');
    } catch {
      setError('Barang gagal ditambahkan. Periksa migrasi database dan coba lagi.');
    } finally { setSaving(false); }
  }

  async function reviewRental(rentalId: number, status: 'Disetujui' | 'Ditolak') {
    if (reviewing !== null) return;
    setReviewing(rentalId); setError('');
    const { error: reviewError } = await supabase.rpc('review_rental', { p_rental_id: rentalId, p_status: status });
    if (reviewError) setError('Permintaan gagal diproses. Muat ulang dan coba lagi.');
    else setRentals(current => current.map(rental => rental.id === rentalId ? { ...rental, status } : rental));
    setReviewing(null);
  }

  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (authError) return <div className="page-container" role="alert">{authError}</div>;
  if (!userId) return <div className="page-container"><h1 className="text-2xl font-bold">Sewakan barang</h1><p className="mt-3">Masuk untuk menambahkan barangmu.</p><Link href="/login?next=%2Flend" className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-white">Masuk</Link></div>;

  return <div className="page-container"><div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-bold">Sewakan barang</h1><p className="mt-2 text-sm text-muted-foreground">Tambahkan barangmu dan lihat permintaan sewa yang masuk.</p></div>
    <form onSubmit={addItem} className="space-y-4 rounded-2xl border border-primary/10 bg-white p-5 sm:p-7">
      <h2 className="text-lg font-bold">Tambah barang</h2>
      <label className="block text-sm font-semibold">Nama barang<input name="title" required minLength={3} maxLength={100} disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 px-4 py-3" /></label>
      <label className="block text-sm font-semibold">Deskripsi<textarea name="description" maxLength={1000} rows={3} disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 px-4 py-3" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Kategori<select name="category" disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3">{['Elektronik', 'Peralatan Lab', 'Olahraga', 'Kuliah', 'Lainnya'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="block text-sm font-semibold">Harga per hari (Rp)<input name="price" type="number" required min={1} step={1} disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 px-4 py-3" /></label>
      </div>
      <label className="block text-sm font-semibold">Lokasi serah terima<input name="location" required maxLength={100} defaultValue="USU Medan" disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 px-4 py-3" /></label>
      <label className="block text-sm font-semibold">Foto barang<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={saving} className="mt-2 block w-full text-sm" /><span className="mt-1 block font-normal text-muted-foreground">JPG, PNG, atau WebP. Maksimal 5 MB.</span></label>
      <button disabled={saving} className="w-full rounded-full bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Tambahkan ke katalog'}</button>
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
    <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Barang saya</h2>{loading ? <p className="mt-3 text-sm">Memuat...</p> : items.length ? <div className="mt-4 space-y-3">{items.map(item => <Link key={item.id} href={`/items/${item.id}`} className="flex items-center justify-between gap-3 border-t border-primary/10 pt-3 text-sm"><span className="font-semibold">{item.title}</span><span className="shrink-0 text-primary">{formatRupiah(item.price_per_day)} /hari</span></Link>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada barang milikmu di katalog.</p>}</section>
    <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Permintaan masuk</h2>{loading ? <p className="mt-3 text-sm">Memuat...</p> : rentals.length ? <div className="mt-4 space-y-4">{rentals.map(rental => <div key={rental.id} className="border-t border-primary/10 pt-4"><p className="font-semibold">{items.find(item => item.id === rental.item_id)?.title ?? 'Barang sewaan'}</p><p className="mt-1 text-sm text-muted-foreground">{rental.start_date} – {rental.end_date} · {rental.status}</p><div className="mt-3 flex flex-wrap items-center gap-3">{rental.status === 'Menunggu persetujuan' && <><button type="button" disabled={reviewing !== null} onClick={() => void reviewRental(rental.id, 'Disetujui')} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Setujui</button><button type="button" disabled={reviewing !== null} onClick={() => void reviewRental(rental.id, 'Ditolak')} className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Tolak</button></>}<Link href={`/chat/${rental.id}`} className="text-sm font-semibold text-primary">Buka chat →</Link></div></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada permintaan sewa.</p>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section>
  </div></div>;
}
