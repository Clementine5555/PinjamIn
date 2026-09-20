import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatRupiah, type Item } from '@/lib/items';
import ProductImage from '@/components/ProductImage';

export const dynamic = 'force-dynamic';

export default async function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { data, error } = await supabase.from('items').select('*').eq('id', Number(id)).maybeSingle();
  if (error) return <div className="page-container"><p role="alert">Barang gagal dimuat. Coba buka kembali halaman ini.</p><Link href="/" className="text-primary">Kembali ke Home</Link></div>;
  if (!data) notFound();
  const item: Item = data;
  return <div className="page-container">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={18} />Kembali ke katalog</Link>
    <div className="grid items-start gap-6 md:grid-cols-2 md:gap-10">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white"><ProductImage src={item.image_url} alt={item.title} sizes="(max-width: 767px) 100vw, 560px" /></div>
      <div className="rounded-2xl bg-white p-6 sm:p-8">
        <span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{item.is_available ? 'Tersedia' : 'Tidak tersedia'}</span>
        <p className="mt-5 text-sm text-muted-foreground">{item.category}</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{item.title}</h1>
        <p className="mt-4 text-2xl font-bold text-primary">{formatRupiah(item.price_per_day)}<span className="text-sm font-normal text-muted-foreground"> /hari</span></p>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={16} />{item.location}</p>
        <div className="my-6 border-t border-primary/10 pt-5"><h2 className="font-semibold">Tentang barang</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p></div>
        {item.is_available ? <Link href={`/items/${item.id}/checkout`} className="flex justify-center rounded-full bg-primary px-4 py-3 font-semibold text-white hover:bg-primary/90">Sewa Sekarang</Link> : <p className="text-sm text-muted-foreground">Barang ini belum bisa disewa.</p>}
      </div>
    </div>
  </div>;
}
