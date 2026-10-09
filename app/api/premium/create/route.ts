import { randomUUID } from 'node:crypto';
import { paymentConfig } from '@/lib/payment-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const config = paymentConfig();
  if (!config) return Response.json({ error: 'Pembayaran sandbox belum dikonfigurasi.' }, { status: 503 });
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 });
  const { data: identity, error: authError } = await config.auth.auth.getUser(token);
  if (authError || !identity.user || identity.user.is_anonymous) return Response.json({ error: 'Sesi tidak valid.' }, { status: 401 });
  if (identity.user.app_metadata.seru_role === 'admin') return Response.json({ error: 'Akun pengelola tidak dapat membeli Premium.' }, { status: 403 });

  const { data: pending, error: pendingError } = await config.admin.from('premium_payments')
    .select('id,status,redirect_url,created_at').eq('user_id', identity.user.id)
    .in('status', ['Mempersiapkan', 'Menunggu']).maybeSingle();
  if (pendingError) return Response.json({ error: 'Status pembayaran gagal diperiksa.' }, { status: 500 });
  if (pending?.status === 'Menunggu' && pending.redirect_url) return Response.json({ redirect_url: pending.redirect_url });
  if (pending && Date.now() - new Date(pending.created_at).getTime() < 120000) {
    return Response.json({ error: 'Pembayaran sedang disiapkan. Coba lagi sebentar.' }, { status: 409 });
  }
  if (pending) {
    const { data: closed, error: staleError } = await config.admin.from('premium_payments').update({ status: 'Gagal', updated_at: new Date().toISOString() })
      .eq('id', pending.id).eq('status', pending.status).select('id');
    if (staleError || !closed?.length) return Response.json({ error: 'Status pembayaran berubah. Muat ulang halaman lalu coba lagi.' }, { status: 409 });
  }

  const orderId = `seru-premium-${randomUUID().replace(/-/g, '')}`;
  const { data: payment, error: insertError } = await config.admin.from('premium_payments')
    .insert({ user_id: identity.user.id, order_id: orderId, amount: 20000 })
    .select('id').single();
  if (insertError || !payment) return Response.json({ error: 'Pembayaran sedang diproses atau gagal dibuat. Coba lagi.' }, { status: 409 });

  try {
    const finishUrl = new URL('/premium', config.site).toString();
    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.midtransKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: 20000 },
        callbacks: { finish: finishUrl, error: finishUrl },
      }),
      cache: 'no-store',
    });
    const result = await response.json() as { redirect_url?: string };
    if (!response.ok || !result.redirect_url) throw new Error('Gateway tidak menerima permintaan.');
    const redirect = new URL(result.redirect_url);
    if (redirect.protocol !== 'https:' || redirect.hostname !== 'app.sandbox.midtrans.com') throw new Error('Alamat pembayaran tidak valid.');
    const { error: saveError } = await config.admin.from('premium_payments').update({
      redirect_url: redirect.toString(), status: 'Menunggu', updated_at: new Date().toISOString(),
    }).eq('id', payment.id).eq('status', 'Mempersiapkan');
    if (saveError) throw saveError;
    return Response.json({ redirect_url: redirect.toString() });
  } catch {
    await config.admin.from('premium_payments').update({ status: 'Gagal', updated_at: new Date().toISOString() })
      .eq('id', payment.id).eq('status', 'Mempersiapkan');
    return Response.json({ error: 'Gateway sandbox belum dapat membuat pembayaran. Coba lagi nanti.' }, { status: 502 });
  }
}
