'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { formatRupiah, type Item } from '@/lib/items';
import { cancellationNoteForDisplay } from '@/lib/display-text';
import RentalStageControl, { type RentalStage } from '@/components/RentalStageControl';
import OwnerItemEditor from '@/components/OwnerItemEditor';

type OwnedItem = Item;
type IncomingRental = RentalStage & { item_id: number; start_date: string; end_date: string; total_price: number; late_days: number; late_fee_amount: number };
type Cancellation = { status: string; requested_by: string; resolution_note: string | null };
type Payout = { rental_id: number; gross_amount: number; fee_bps: number; platform_fee: number; owner_amount: number; status: string };

export default function LendWorkspace({ section }: { section: 'new' | 'items' | 'requests' }) {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [items, setItems] = useState<OwnedItem[]>([]);
  const [boosts, setBoosts] = useState<Record<number, string>>({});
  const [premiumActive, setPremiumActive] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [rentals, setRentals] = useState<IncomingRental[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<number, string>>({});
  const [cancellations, setCancellations] = useState<Record<number, Cancellation>>({});
  const [payouts, setPayouts] = useState<Record<number, Payout>>({});
  const [cancellationOpenId, setCancellationOpenId] = useState<number | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [itemError, setItemError] = useState('');
  const [itemMessage, setItemMessage] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const userId = user && !user.is_anonymous ? user.id : '';

  useEffect(() => {
    if (!userId || section !== 'new') return;
    let active = true;
    void supabase.rpc('is_verified_student', { p_user_id: userId }).then(({ data, error: verificationError }) => {
      if (active) { setVerified(verificationError ? null : data === true); if (verificationError) setError('Status verifikasi gagal dimuat. Muat ulang halaman.'); }
    });
    return () => { active = false; };
  }, [userId, section]);

  useEffect(() => {
    if (!userId || section === 'new') return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const { data: owned, error: itemError } = await supabase.from('items')
          .select('*').eq('owner_id', userId).order('created_at', { ascending: false });
        if (itemError) throw itemError;
        const ownItems = (owned ?? []) as OwnedItem[];
        if (active) setItems(ownItems);
        if (section === 'items') {
          const [boostResult, membershipResult] = await Promise.all([
            supabase.from('item_boosts').select('item_id,boosted_until').in('item_id', ownItems.length ? ownItems.map(item => item.id) : [-1]),
            supabase.from('premium_memberships').select('active_until').eq('user_id', userId).maybeSingle(),
          ]);
          if (boostResult.error || membershipResult.error) throw boostResult.error ?? membershipResult.error;
          if (active) {
            setBoosts(Object.fromEntries((boostResult.data ?? []).filter(entry => new Date(entry.boosted_until).getTime() > Date.now()).map(entry => [entry.item_id, entry.boosted_until])));
            setPremiumActive(!!membershipResult.data && new Date(membershipResult.data.active_until).getTime() > Date.now());
          }
        }
        if (section === 'requests' && ownItems.length) {
          const { data: requests, error: rentalError } = await supabase.from('rentals')
            .select('id,item_id,status,start_date,end_date,total_price,late_days,late_fee_amount,handoff_renter_confirmed_at,handoff_owner_confirmed_at,return_renter_confirmed_at,return_owner_confirmed_at')
            .in('item_id', ownItems.map(item => item.id)).order('created_at', { ascending: false });
          if (rentalError) throw rentalError;
          if (requests?.length) {
            const rentalIds = requests.map(rental => rental.id);
            const [paymentResult, cancellationResult, payoutResult] = await Promise.all([
              supabase.from('rental_payments').select('rental_id,status').in('rental_id', rentalIds),
              supabase.from('rental_cancellations').select('rental_id,status,requested_by,resolution_note').in('rental_id', rentalIds),
              supabase.from('rental_payouts').select('rental_id,gross_amount,fee_bps,platform_fee,owner_amount,status').in('rental_id', rentalIds),
            ]);
            if (paymentResult.error || cancellationResult.error || payoutResult.error) throw paymentResult.error ?? cancellationResult.error ?? payoutResult.error;
            if (active) setPaymentStatuses(Object.fromEntries((paymentResult.data ?? []).map(payment => [payment.rental_id, payment.status])));
            if (active) setCancellations(Object.fromEntries((cancellationResult.data ?? []).map(cancellation => [cancellation.rental_id, cancellation])));
            if (active) setPayouts(Object.fromEntries((payoutResult.data ?? []).map(payout => [payout.rental_id, payout])));
          }
          if (active) setRentals((requests ?? []) as IncomingRental[]);
        } else if (active) { setRentals([]); setPaymentStatuses({}); setCancellations({}); setPayouts({}); }
      } catch {
        if (active) setError('Data pemilik gagal dimuat. Coba muat ulang halaman.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [userId, section]);

  useEffect(() => {
    if (!userId || section !== 'requests') return;
    let active = true;
    const channel = supabase.channel(`owner-returns:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, async payload => {
        const notification = payload.new as { kind?: string; rental_id?: number };
        if (notification.kind !== 'return:renter' || !notification.rental_id) return;
        const { data } = await supabase.from('rentals')
          .select('status,late_days,late_fee_amount,return_renter_confirmed_at,return_owner_confirmed_at')
          .eq('id', notification.rental_id).single();
        if (active && data) setRentals(current => current.map(rental => rental.id === notification.rental_id ? { ...rental, ...data } : rental));
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId, section]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving || verified !== true) return;
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
      const { data: studentVerified, error: verificationError } = await supabase.rpc('is_verified_student', { p_user_id: userId });
      if (verificationError || !studentVerified) throw new Error('Verifikasi mahasiswa diperlukan sebelum menambah barang.');
      const extension = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('item-photos').upload(path, photo, { contentType: photo.type });
      if (uploadError) throw uploadError;
      const { data: image } = supabase.storage.from('item-photos').getPublicUrl(path);
      const { data, error: insertError } = await supabase.from('items').insert({
        owner_id: userId, title, description, category, location,
        price_per_day: price, image_url: image.publicUrl, is_available: true,
      }).select('*').single();
      if (insertError) throw insertError;
      setItems(current => [data as OwnedItem, ...current]);
      form.reset();
      setMessage('Barang berhasil ditambahkan ke katalog.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Barang gagal ditambahkan. Coba lagi.');
    } finally { setSaving(false); }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>, item: OwnedItem) {
    event.preventDefault();
    if (!userId || updatingId !== null) return;
    const values = new FormData(event.currentTarget);
    const title = String(values.get('title') ?? '').trim();
    const description = String(values.get('description') ?? '').trim();
    const category = String(values.get('category') ?? 'Lainnya');
    const location = String(values.get('location') ?? '').trim();
    const price = Number(values.get('price'));
    const selectedPhoto = values.get('photo');
    const photo = selectedPhoto instanceof File && selectedPhoto.size ? selectedPhoto : null;
    if (title.length < 3 || title.length > 100 || description.length > 1000 || !location || location.length > 100 || !Number.isSafeInteger(price) || price <= 0) {
      setItemError('Periksa nama, deskripsi, lokasi, dan harga barang.'); return;
    }
    if (photo && (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024)) {
      setItemError('Foto harus JPG, PNG, atau WebP, maksimal 5 MB.'); return;
    }

    setUpdatingId(item.id); setItemError(''); setItemMessage('');
    let uploadedPath = '';
    try {
      let imageUrl = item.image_url;
      if (photo) {
        const extension = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
        uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('item-photos').upload(uploadedPath, photo, { contentType: photo.type });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from('item-photos').getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { data, error: updateError } = await supabase.from('items').update({
        title, description, category, location, price_per_day: price, image_url: imageUrl,
      }).eq('id', item.id).eq('owner_id', userId).select('*').single();
      if (updateError) throw updateError;
      setItems(current => current.map(entry => entry.id === item.id ? data as OwnedItem : entry));
      setEditingId(null);
      setItemMessage('Perubahan barang berhasil disimpan.');
      if (uploadedPath) {
        const marker = '/storage/v1/object/public/item-photos/';
        const oldPath = item.image_url.split(marker)[1]?.split('?')[0];
        if (oldPath?.startsWith(`${userId}/`)) {
          void supabase.storage.from('item-photos').remove([oldPath]);
        }
      }
    } catch (saveError) {
      if (uploadedPath) void supabase.storage.from('item-photos').remove([uploadedPath]);
      setItemError((saveError as { code?: string })?.code === '23505' ? 'Nama barang sudah digunakan. Pilih nama lain.' : 'Perubahan barang gagal disimpan. Coba lagi.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleItem(item: OwnedItem) {
    if (!userId || updatingId !== null) return;
    setUpdatingId(item.id); setItemError(''); setItemMessage('');
    try {
      const { data, error: updateError } = await supabase.from('items')
        .update({ is_available: !item.is_available }).eq('id', item.id).eq('owner_id', userId).select('*').single();
      if (updateError) throw updateError;
      setItems(current => current.map(entry => entry.id === item.id ? data as OwnedItem : entry));
      setItemMessage(item.is_available ? 'Listing dinonaktifkan.' : 'Listing diaktifkan.');
    } catch {
      setItemError('Status listing gagal diubah. Coba lagi.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function boostItem(item: OwnedItem) {
    if (updatingId !== null) return;
    if (!item.is_available || item.is_rented) { setItemError('Boost hanya bisa diaktifkan saat barang tersedia.'); return; }
    setUpdatingId(item.id); setItemError(''); setItemMessage('');
    const { data, error: boostError } = await supabase.rpc('boost_my_item', { p_item_id: item.id });
    if (boostError) setItemError('Boost gagal diaktifkan. Pastikan Premium aktif dan barang tidak sedang disewa.');
    else { setBoosts(current => ({ ...current, [item.id]: data as string })); setItemMessage('Boost listing aktif selama 7 hari.'); }
    setUpdatingId(null);
  }

  async function reviewRental(rentalId: number, status: 'Disetujui' | 'Ditolak') {
    if (reviewing !== null) return;
    setReviewing(rentalId); setError('');
    const { error: reviewError } = await supabase.rpc('review_rental', { p_rental_id: rentalId, p_status: status });
    if (reviewError) setError(reviewError.code === '23P01' || reviewError.message.includes('Tanggal sewa bentrok')
      ? 'Tanggal sewa bentrok dengan pesanan lain yang sudah disetujui. Pilih permintaan lain atau tolak permintaan ini.'
      : reviewError.message.includes('Barang tidak tersedia untuk disetujui')
        ? 'Barang sedang disewa atau listing nonaktif. Aktifkan listing setelah barang tersedia.'
      : 'Permintaan gagal diproses. Muat ulang dan coba lagi.');
    else setRentals(current => current.map(rental => rental.id === rentalId ? { ...rental, status } : rental));
    setReviewing(null);
  }

  async function cancelOwnerRental(rentalId: number) {
    if (cancellingId !== null) return;
    const reason = cancellationReason.trim();
    if (reason.length < 5 || reason.length > 500) {
      setError('Alasan pembatalan harus 5 sampai 500 karakter.'); return;
    }
    setCancellingId(rentalId); setError(''); setMessage('');
    const { data, error: cancelError } = await supabase.rpc('cancel_owner_rental', {
      p_rental_id: rentalId, p_reason: reason,
    });
    if (cancelError) {
      setError(cancelError.message.includes('Pengajuan pembatalan sudah ada')
        ? 'Pembatalan sudah diajukan. Muat ulang halaman untuk melihat statusnya.'
        : 'Pembatalan gagal. Muat ulang status transaksi lalu coba lagi.');
    } else {
      if (data === 'Dibatalkan') {
        setRentals(current => current.map(rental => rental.id === rentalId ? { ...rental, status: 'Dibatalkan' } : rental));
        setMessage('Pesanan dibatalkan. Penyewa sudah diberi notifikasi.');
      } else {
        setCancellations(current => ({ ...current, [rentalId]: { status: 'Menunggu', requested_by: 'owner', resolution_note: null } }));
        setMessage('Pembatalan diajukan. Pengelola akan memeriksa status pembayaran.');
      }
      setCancellationOpenId(null); setCancellationReason('');
    }
    setCancellingId(null);
  }

  async function confirmStage(rentalId: number, stage: 'handoff' | 'return') {
    if (confirming !== null) return;
    setConfirming(rentalId); setError('');
    const { error: confirmError } = await supabase.rpc('confirm_rental_stage', { p_rental_id: rentalId, p_stage: stage });
    if (confirmError) {
      setError('Konfirmasi gagal. Muat ulang status transaksi lalu coba lagi.');
    } else {
      const { data, error: loadError } = await supabase.from('rentals')
        .select('status,late_days,late_fee_amount,handoff_renter_confirmed_at,handoff_owner_confirmed_at,return_renter_confirmed_at,return_owner_confirmed_at')
        .eq('id', rentalId).single();
      if (loadError) setError('Konfirmasi tersimpan, tetapi status belum tampil. Muat ulang halaman.');
      else {
        setRentals(current => current.map(rental => rental.id === rentalId ? { ...rental, ...data } : rental));
        if (data.status === 'Selesai') {
          const { data: payout } = await supabase.from('rental_payouts')
            .select('rental_id,gross_amount,fee_bps,platform_fee,owner_amount,status').eq('rental_id', rentalId).maybeSingle();
          if (payout) setPayouts(current => ({ ...current, [rentalId]: payout }));
        }
      }
    }
    setConfirming(null);
  }

  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (authError) return <div className="page-container" role="alert">{authError}</div>;
  if (!userId) return <div className="page-container"><h1 className="text-2xl font-bold">Kelola barang</h1><p className="mt-3">Masuk untuk mengelola barang dan permintaan sewa.</p><Link href="/login?next=%2Flend%2Fitems" className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-white">Masuk</Link></div>;
  if (user?.app_metadata.seru_role === 'admin') return <div className="page-container"><h1 className="text-2xl font-bold">Akses pengelola</h1><p className="mt-3 text-sm text-muted-foreground">Akun pengelola tidak dapat menyewakan barang.</p><Link href="/admin" className="mt-4 inline-block text-primary">Buka panel pengelola →</Link></div>;

  return <div className="page-container"><div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-bold">{section === 'new' ? 'Tambah barang' : section === 'requests' ? 'Permintaan masuk' : 'Barang saya'}</h1><p className="mt-2 text-sm text-muted-foreground">Kelola barang dan permintaan sewa dari satu akun.</p></div>
    <nav aria-label="Kelola barang" className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 text-center text-xs font-semibold sm:text-sm">
      {([{ href: '/lend/items', label: 'Barang saya', key: 'items' }, { href: '/lend/new', label: 'Tambah barang', key: 'new' }, { href: '/lend/requests', label: 'Permintaan', key: 'requests' }] as const).map(tab =>
        <Link key={tab.key} href={tab.href} aria-current={section === tab.key ? 'page' : undefined} className={`rounded-xl px-2 py-3 ${section === tab.key ? 'bg-mint/50 text-primary' : 'text-muted-foreground hover:text-primary'}`}>{tab.label}</Link>
      )}
    </nav>
    {section === 'new' && verified === false && <div className="rounded-2xl bg-mint/30 p-5 text-sm text-primary">Barang baru bisa ditambahkan setelah verifikasi mahasiswa disetujui. <Link href="/verification" className="font-semibold underline">Ajukan verifikasi →</Link></div>}
    {section === 'new' && verified === null && <p role="status" className="text-sm text-muted-foreground">Memeriksa verifikasi mahasiswa...</p>}
    {section === 'new' && verified === null && error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {section === 'new' && verified === true && <form onSubmit={addItem} className="space-y-4 rounded-2xl border border-primary/10 bg-white p-5 sm:p-7">
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
    </form>}
    {section === 'items' && <section className="rounded-2xl bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">Barang saya</h2>{loading ? <p className="mt-3 text-sm">Memuat...</p> : items.length ? <div className="mt-4 space-y-4">{items.map(item => <div key={item.id} className="border-t border-primary/10 pt-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/items/${item.id}`} className="font-semibold text-primary">{item.title}</Link><p className="mt-1 text-sm text-muted-foreground">{formatRupiah(item.price_per_day)} /hari · {item.is_rented ? 'Sedang disewa' : item.is_available ? 'Aktif' : 'Nonaktif'}{item.is_rented && !item.is_available ? ' · Listing nonaktif' : ''}</p>{boosts[item.id] && <p className="mt-1 text-xs font-semibold text-primary">Boost berlaku hingga {new Date(boosts[item.id]).toLocaleDateString('id-ID')}{item.is_rented ? ' · Tidak tampil selama disewa' : ''}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={updatingId !== null} onClick={() => { setEditingId(editingId === item.id ? null : item.id); setItemError(''); }} className="rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">{editingId === item.id ? 'Tutup' : 'Edit'}</button><button type="button" disabled={updatingId !== null} onClick={() => void toggleItem(item)} className="rounded-full border border-primary/20 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">{updatingId === item.id ? 'Menyimpan...' : item.is_available ? 'Nonaktifkan' : 'Aktifkan'}</button>{premiumActive && item.is_available && !item.is_rented && !boosts[item.id] && <button type="button" disabled={updatingId !== null} onClick={() => void boostItem(item)} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Boost 7 hari</button>}</div></div>{editingId === item.id && <OwnerItemEditor item={item} saving={updatingId === item.id} onSave={(event, current) => void saveItem(event, current)} onCancel={() => setEditingId(null)} />}</div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada barang milikmu di katalog. <Link href="/lend/new" className="font-semibold text-primary">Tambah barang →</Link></p>}{itemMessage && <p role="status" className="mt-4 text-sm text-primary">{itemMessage}</p>}{itemError && <p role="alert" className="mt-4 text-sm text-red-700">{itemError}</p>}</section>}
    {section === 'requests' && <section className="rounded-2xl bg-white p-5 sm:p-7">
      <h2 className="text-lg font-bold">Permintaan masuk</h2>
      {loading ? <p className="mt-3 text-sm">Memuat...</p> : rentals.length ? <div className="mt-4 space-y-4">{rentals.map(rental => <div key={rental.id} className="border-t border-primary/10 pt-4">
        <p className="font-semibold">{items.find(item => item.id === rental.item_id)?.title ?? 'Barang sewaan'}</p>
        <p className="mt-1 text-sm text-muted-foreground">{rental.start_date} – {rental.end_date} · {rental.status}</p>
        {rental.status === 'Sedang disewa' && !rental.return_renter_confirmed_at && rental.end_date < format(new Date(), 'yyyy-MM-dd') && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Tanggal pengembalian sudah lewat. Denda bertambah 15% dari tarif harian per hari terlambat. Hubungi penyewa melalui chat.</p>}
        {rental.late_fee_amount > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Denda keterlambatan: {formatRupiah(rental.late_fee_amount)} ({rental.late_days} hari × 15% tarif harian). Tercatat, belum dibayar. <Link href={`/transactions/${rental.id}/feedback`} className="font-semibold underline">Laporkan jika tidak sesuai</Link>.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {rental.status === 'Menunggu persetujuan' && <><button type="button" disabled={reviewing !== null} onClick={() => void reviewRental(rental.id, 'Disetujui')} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Setujui</button><button type="button" disabled={reviewing !== null} onClick={() => void reviewRental(rental.id, 'Ditolak')} className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Tolak</button></>}
          <Link href={`/chat/${rental.id}`} className="text-sm font-semibold text-primary">Buka chat →</Link>
          <Link href={`/transactions/${rental.id}/condition`} className="text-sm font-semibold text-primary">Bukti kondisi →</Link>
          <Link href={`/transactions/${rental.id}/feedback`} className="text-sm font-semibold text-primary">Laporkan masalah →</Link>
        </div>
        <RentalStageControl rental={rental} role="owner" paymentStatus={paymentStatuses[rental.id] ?? null} cancellationStatus={cancellations[rental.id]?.status} busy={confirming !== null} onConfirm={(rentalId, stage) => void confirmStage(rentalId, stage)} />
        {payouts[rental.id] && <div className="mt-4 rounded-xl bg-mint/20 p-4 text-sm">
          <p className="font-semibold text-primary">Bagian pemilik: {formatRupiah(payouts[rental.id].owner_amount)}</p>
          <p className="mt-1 text-muted-foreground">Harga sewa {formatRupiah(payouts[rental.id].gross_amount)} · Komisi platform {payouts[rental.id].fee_bps / 100}% ({formatRupiah(payouts[rental.id].platform_fee)}) · {payouts[rental.id].status === 'Tercatat simulasi' ? 'Pencairan dicatat' : payouts[rental.id].status === 'Menunggu simulasi' ? 'Menunggu pencairan' : payouts[rental.id].status}</p>
        </div>}
        {rental.status === 'Disetujui' && !rental.handoff_renter_confirmed_at && !rental.handoff_owner_confirmed_at && (cancellations[rental.id]
          ? <div className="mt-4 rounded-xl border border-primary/10 p-4 text-sm"><p className="font-semibold">Pembatalan {cancellations[rental.id].requested_by === 'owner' ? 'oleh pemilik' : 'oleh penyewa'}: {cancellations[rental.id].status}</p><p className="mt-1 text-muted-foreground">{cancellations[rental.id].resolution_note ? cancellationNoteForDisplay(cancellations[rental.id].resolution_note) : 'Menunggu peninjauan pengelola.'}</p></div>
          : cancellationOpenId === rental.id
            ? <form onSubmit={event => { event.preventDefault(); void cancelOwnerRental(rental.id); }} className="mt-4 space-y-3 rounded-xl border border-primary/10 p-4"><label className="block text-sm font-semibold">Alasan pembatalan<textarea required minLength={5} maxLength={500} value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} className="mt-2 w-full rounded-xl border border-primary/20 p-3" rows={3} /></label><p className="text-xs text-muted-foreground">Sebelum pembayaran, pesanan langsung dibatalkan. Jika pembayaran sudah dibuat, pengelola akan meninjau status dan pengembalian dana.</p><div className="flex gap-3"><button type="submit" disabled={cancellingId !== null} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{cancellingId === rental.id ? 'Memproses...' : 'Batalkan pesanan'}</button><button type="button" onClick={() => setCancellationOpenId(null)} className="text-sm text-muted-foreground">Tutup</button></div></form>
            : <button type="button" onClick={() => { setCancellationOpenId(rental.id); setCancellationReason(''); }} className="mt-4 text-sm font-semibold text-red-700">Batalkan pesanan →</button>)}
      </div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Belum ada permintaan sewa.</p>}
      {message && <p role="status" className="mt-3 text-sm text-primary">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>}
  </div></div>;
}
