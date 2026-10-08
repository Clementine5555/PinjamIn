'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { itemAvailable, type Item } from '@/lib/items';

export default function ItemRentalAction({ item }: { item: Item }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Memeriksa akun...</p>;
  if (user?.app_metadata.seru_role === 'admin') return <p className="text-sm text-muted-foreground">Akun pengelola tidak dapat menyewa barang.</p>;
  if (user?.id === item.owner_id) return <p className="text-sm text-muted-foreground">Ini barang milikmu. <Link href="/lend/items" className="font-semibold text-primary">Kelola barang →</Link></p>;
  if (!itemAvailable(item)) return <p className="text-sm text-muted-foreground">{item.is_rented ? 'Barang ini sedang disewa.' : 'Barang ini belum bisa disewa.'}</p>;
  return <Link href={`/items/${item.id}/checkout`} className="flex justify-center rounded-full bg-primary px-4 py-3 font-semibold text-white hover:bg-primary/90">Sewa Sekarang</Link>;
}
