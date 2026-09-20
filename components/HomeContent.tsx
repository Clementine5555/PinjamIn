'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowDownWideNarrow, ChevronRight, GraduationCap, MapPin, Search, UsersRound } from 'lucide-react';
import ProductCard from './ProductCard';
import Chip from './Chip';
import type { Item } from '@/lib/items';

export default function HomeContent({ items, error, search = false }: { items: Item[]; error?: string; search?: boolean }) {
  const [category, setCategory] = useState('Semua');
  const [location, setLocation] = useState('Semua lokasi');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const categories = ['Semua', ...new Set(items.map(item => item.category))];
  const locations = ['Semua lokasi', ...new Set(items.map(item => item.location))];
  const filtered = items.filter(item =>
    (category === 'Semua' || item.category === category) &&
    (location === 'Semua lokasi' || item.location === location) &&
    item.title.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => sort === 'price' ? a.price_per_day - b.price_per_day : a.id - b.id);

  return (
    <div className="page-container">
      <section className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{search ? 'Cari barang' : 'Halo, teman kampus! 👋'}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{search ? 'Temukan perlengkapan untuk kebutuhanmu.' : 'Mau pinjam perlengkapan apa hari ini?'}</p>
        </div>
        <label className="flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm">
          <MapPin size={17} className="shrink-0 text-primary" />
          <select aria-label="Pilih lokasi" value={location} onChange={e => setLocation(e.target.value)} className="max-w-48 bg-transparent pr-1 text-sm font-semibold">
            {locations.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
      </section>
      {!search && <section className="relative mb-6 flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-primary p-5 text-white sm:mb-8 sm:p-8">
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-primary"><UsersRound size={14} />Komunitas mahasiswa</span>
          <h2 className="mt-3 text-xl leading-tight font-bold sm:text-3xl">Hemat pengeluaran kuliah.</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">Sewa alat lab, buku, hingga kamera dari sesama mahasiswa sekitarmu!</p>
        </div>
        <div className="hidden shrink-0 rounded-3xl bg-white/10 p-5 min-[380px]:block sm:p-8"><GraduationCap className="size-12 text-mint sm:size-20" strokeWidth={1.5} /></div>
      </section>}
      {search && <label className="mb-6 flex items-center gap-3 rounded-2xl border border-primary/15 bg-white px-4 py-3">
        <Search size={21} className="text-primary" />
        <input type="search" aria-label="Cari nama barang" placeholder="Cari kamera, kalkulator, buku..." value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>}
      <div aria-label="Kategori barang" className="mb-7 flex gap-2 overflow-x-auto pb-2">
        {categories.map(value => <Chip key={value} label={value} selected={category === value} onSelect={() => setCategory(value)} />)}
      </div>
      <section aria-labelledby="catalog-title">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 id="catalog-title" className="text-lg font-bold tracking-tight sm:text-2xl">{search ? 'Hasil pencarian' : 'Tersedia di dekatmu'}</h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{search ? `${filtered.length} barang ditemukan` : 'Bisa COD langsung di area kampus'}</p>
          </div>
          {!search && <Link href="/search" className="flex shrink-0 items-center text-xs font-semibold text-primary sm:text-sm">Lihat Semua<ChevronRight size={16} /></Link>}
        </div>
        <div className="mb-4 flex justify-end">
          <label className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
            <ArrowDownWideNarrow size={15} />
            <select aria-label="Urutkan barang" value={sort} onChange={e => setSort(e.target.value)} className="bg-transparent">
              <option value="default">Urutan katalog</option><option value="price">Harga termurah</option>
            </select>
          </label>
        </div>
        {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-sm"><p>{error}</p><button onClick={() => window.location.reload()} className="mt-3 font-semibold text-primary">Coba lagi</button></div>
          : filtered.length ? <div className="product-grid">{filtered.map(item => <ProductCard key={item.id} item={item} />)}</div>
          : <div className="rounded-2xl bg-white p-10 text-center"><Search className="mx-auto mb-3 text-primary" /><h3 className="font-semibold">Belum ada barang yang cocok</h3><p className="mt-2 text-sm text-muted-foreground">Coba kata kunci, kategori, atau lokasi lain.</p></div>}
      </section>
    </div>
  );
}
