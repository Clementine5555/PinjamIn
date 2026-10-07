import Link from 'next/link';
import { ArrowLeft, MapPin, Star } from 'lucide-react';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatRupiah, itemAvailable, type Item } from '@/lib/items';
import ProductImage from '@/components/ProductImage';
import ItemRentalAction from '@/components/ItemRentalAction';

export const dynamic = 'force-dynamic';

export default async function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { data, error } = await supabase.from('items').select('*').eq('id', Number(id)).maybeSingle();
  if (error) return <div className="page-container"><p role="alert">Barang gagal dimuat. Coba buka kembali halaman ini.</p><Link href="/" className="text-primary">Kembali ke Home</Link></div>;
  if (!data) notFound();
  const item: Item = data;
  const [ratingResult, reviewsResult] = await Promise.all([
    supabase.from('item_rating_summary').select('rating_count,rating_average').eq('item_id', item.id).maybeSingle(),
    supabase.from('published_item_reviews').select('id,rating,comment').eq('item_id', item.id).order('created_at', { ascending: false }).limit(5),
  ]);
  const rating = ratingResult.data;
  const reviews = reviewsResult.data ?? [];
  return <div className="page-container">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={18} />Kembali ke katalog</Link>
    <div className="grid items-start gap-6 md:grid-cols-2 md:gap-10">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white"><ProductImage src={item.image_url} alt={item.title} sizes="(max-width: 767px) 100vw, 560px" /></div>
      <div className="rounded-2xl bg-white p-6 sm:p-8">
        <span className="rounded-full bg-mint/40 px-3 py-1 text-xs font-semibold text-primary">{itemAvailable(item) ? 'Tersedia' : 'Tidak tersedia'}</span>
        <p className="mt-5 text-sm text-muted-foreground">{item.category}</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{item.title}</h1>
        {rating && <p className="mt-3 flex items-center gap-2 text-sm text-primary"><Star size={16} fill="currentColor" />{rating.rating_average} / 5 · {rating.rating_count} ulasan</p>}
        <p className="mt-4 text-2xl font-bold text-primary">{formatRupiah(item.price_per_day)}<span className="text-sm font-normal text-muted-foreground"> /hari</span></p>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={16} />{item.location}</p>
        <div className="my-6 border-t border-primary/10 pt-5"><h2 className="font-semibold">Tentang barang</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p></div>
        <ItemRentalAction item={item} />
      </div>
    </div>
    {reviews.length > 0 && <section className="mt-6 rounded-2xl bg-white p-6 sm:p-8"><h2 className="text-lg font-bold">Ulasan penyewa</h2><div className="mt-4 space-y-4">{reviews.map(review => <article key={review.id} className="border-t border-primary/10 pt-4"><p className="text-sm font-semibold text-primary">{review.rating} / 5 bintang</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{review.comment}</p></article>)}</div></section>}
  </div>;
}
