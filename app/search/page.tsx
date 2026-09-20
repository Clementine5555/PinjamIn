import { supabase } from '@/lib/supabase';
import HomeContent from '@/components/HomeContent';

export const dynamic = 'force-dynamic';

export default async function Search() {
  const { data, error } = await supabase.from('items').select('*').eq('is_available', true).order('id');
  return <HomeContent search items={data ?? []} error={error ? 'Pencarian belum berhasil dimuat. Periksa koneksi dan coba lagi.' : undefined} />;
}
