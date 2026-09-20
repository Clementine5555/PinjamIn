import Link from 'next/link';
import { MapPin } from 'lucide-react';
import ProductImage from './ProductImage';
import { formatRupiah, type Item } from '@/lib/items';

export default function ProductCard({ item }: { item: Item }) {
  return (
    <Link href={`/items/${item.id}`} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-primary/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-primary/5">
        <ProductImage src={item.image_url} alt={item.title} />
        <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-primary sm:left-3 sm:top-3 sm:text-xs">{item.is_available ? 'Tersedia' : 'Tidak tersedia'}</span>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="mb-1 text-[10px] font-medium text-muted-foreground sm:text-xs">{item.category}</p>
        <h3 className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold group-hover:text-primary">{item.title}</h3>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin size={12} className="shrink-0" />{item.location}</p>
      </div>
      <div className="bg-primary/[0.035] px-3 py-3 sm:px-4"><span className="text-sm font-extrabold text-primary sm:text-base">{formatRupiah(item.price_per_day)}</span><span className="text-[11px] text-muted-foreground"> /hari</span></div>
    </Link>
  );
}
