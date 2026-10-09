import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

export default async function OwnerStorefront({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: premium } = await supabase.rpc('owner_has_premium', { p_user_id: id });
  if (!premium) return <div className="page-container"><Link href="/search" className="text-sm font-semibold text-primary">← Kembali ke katalog</Link><p className="mt-6 rounded-2xl bg-white p-6 text-sm text-muted-foreground">Etalase ini tersedia untuk pemilik SERU Premium aktif.</p></div>;
  const { data, error } = await supabase.from('items').select('*').eq('owner_id', id).eq('is_available', true).order('created_at', { ascending: false });
  if (error) return <div className="page-container" role="alert">Etalase belum bisa dimuat.</div>;
  return <div className="page-container"><Link href="/search" className="text-sm font-semibold text-primary">← Kembali ke katalog</Link><h1 className="mt-6 text-2xl font-bold">Etalase pemilik</h1><p className="mt-2 mb-6 text-sm text-muted-foreground">Barang aktif dari pemilik yang sama.</p>{data?.length ? <div className="product-grid">{data.map(item => <ProductCard key={item.id} item={item} />)}</div> : <p className="rounded-2xl bg-white p-6 text-sm text-muted-foreground">Belum ada barang aktif dari pemilik ini.</p>}</div>;
}
