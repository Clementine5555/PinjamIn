export type Item = {
  id: number;
  title: string;
  description: string;
  price_per_day: number;
  image_url: string;
  category: string;
  location: string;
  is_available: boolean;
};

export function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

export function productImage(url: string) {
  return url?.includes('photo-1606986628253-3a2c4bd8541e')
    ? 'https://images.unsplash.com/photo-1617706534889-ce17f547abc2?auto=format&fit=crop&w=800&q=80'
    : url;
}
