'use client';

import type { FormEvent } from 'react';
import type { Item } from '@/lib/items';
import ProductImage from './ProductImage';

export default function OwnerItemEditor({ item, saving, onSave, onCancel }: {
  item: Item;
  saving: boolean;
  onSave: (event: FormEvent<HTMLFormElement>, item: Item) => void;
  onCancel: () => void;
}) {
  return <form onSubmit={event => onSave(event, item)} className="mt-4 space-y-4 rounded-xl bg-background p-4">
    <div className="relative aspect-[4/3] max-w-64 overflow-hidden rounded-xl bg-white"><ProductImage src={item.image_url} alt={item.title} /></div>
    <label className="block text-sm font-semibold">Nama barang<input name="title" required minLength={3} maxLength={100} defaultValue={item.title} disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3" /></label>
    <label className="block text-sm font-semibold">Deskripsi<textarea name="description" maxLength={1000} rows={3} defaultValue={item.description} disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Kategori<select name="category" defaultValue={item.category} disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3">{['Elektronik', 'Peralatan Lab', 'Olahraga', 'Kuliah', 'Lainnya'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block text-sm font-semibold">Harga per hari (Rp)<input name="price" type="number" required min={1} step={1} defaultValue={item.price_per_day} disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3" /></label>
    </div>
    <label className="block text-sm font-semibold">Lokasi serah terima<input name="location" required maxLength={100} defaultValue={item.location} disabled={saving} className="mt-2 w-full rounded-xl border border-primary/20 bg-white px-4 py-3" /></label>
    <label className="block text-sm font-semibold">Ganti foto (opsional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} className="mt-2 block w-full text-sm" /><span className="mt-1 block font-normal text-muted-foreground">JPG, PNG, atau WebP. Maksimal 5 MB.</span></label>
    <div className="flex flex-wrap gap-3"><button disabled={saving} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan perubahan'}</button><button type="button" disabled={saving} onClick={onCancel} className="rounded-full border border-primary/20 px-5 py-2 text-sm font-semibold text-primary disabled:opacity-50">Batal</button></div>
  </form>;
}
