import { supabase } from '@/lib/supabase';
import HomeContent from '@/components/HomeContent';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data, error } = await supabase.from('items').select('*').eq('is_available', true).order('id');
  return <HomeContent items={data ?? []} error={error ? 'Katalog belum berhasil dimuat. Periksa koneksi dan coba lagi.' : undefined} />;
}
