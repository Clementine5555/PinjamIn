'use client';

import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { productImage } from '@/lib/items';

export default function ProductImage({ src, alt, sizes = '(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 280px' }: { src: string; alt: string; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-primary/5 p-4 text-center text-xs text-muted-foreground"><ImageOff size={28} /><span>Foto belum tersedia</span></div>;
  return <Image src={productImage(src)} alt={alt} fill sizes={sizes} className="object-cover" onError={() => setFailed(true)} />;
}
