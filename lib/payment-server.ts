import { createClient } from '@supabase/supabase-js';

export function paymentConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const midtransKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY;
  const siteUrl = process.env.SERU_SITE_URL;
  if (process.env.NEXT_PUBLIC_PAYMENT_SANDBOX_ENABLED !== 'true' || !url || !anonKey || !serviceKey || !midtransKey || !siteUrl) return null;
  let site: URL;
  try { site = new URL(siteUrl); }
  catch { return null; }
  if (site.protocol !== 'https:') return null;
  return {
    auth: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    midtransKey,
    site,
  };
}
