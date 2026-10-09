import { supabase } from '@/lib/supabase';
import HomeContent from '@/components/HomeContent';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [{ data, error }, { data: boosts }] = await Promise.all([
    supabase.from('items').select('*').eq('is_available', true).order('id'),
    supabase.from('item_boosts').select('item_id,boosted_until').gt('boosted_until', new Date().toISOString()),
  ]);
  const byItem = new Map((boosts ?? []).map(boost => [boost.item_id, boost.boosted_until]));
  return <HomeContent items={(data ?? []).map(item => ({ ...item, boosted_until: byItem.get(item.id) ?? null }))} error={error ? 'Katalog belum berhasil dimuat. Periksa koneksi dan coba lagi.' : undefined} />;
}
