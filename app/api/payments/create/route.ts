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
  if (identity.user.app_metadata.seru_role === 'admin') return Response.json({ error: 'Akun pengelola tidak dapat membuat pembayaran sewa.' }, { status: 403 });

  let rentalId: number;
  try {
    const body = await request.json() as { rentalId?: unknown };
    rentalId = typeof body.rentalId === 'number' ? body.rentalId : NaN;
  } catch {
    return Response.json({ error: 'Data pembayaran tidak valid.' }, { status: 400 });
  }
  if (!Number.isSafeInteger(rentalId) || rentalId <= 0) return Response.json({ error: 'Transaksi tidak valid.' }, { status: 400 });

  const { data: rental, error: rentalError } = await config.admin.from('rentals')
    .select('id,renter_id,status,total_price').eq('id', rentalId).maybeSingle();
  if (rentalError) return Response.json({ error: 'Transaksi gagal dimuat.' }, { status: 500 });
  if (!rental || rental.renter_id !== identity.user.id) return Response.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });
  if (rental.status !== 'Disetujui') return Response.json({ error: 'Pembayaran hanya tersedia setelah pemilik menyetujui sewa.' }, { status: 409 });

  const { data: previous, error: previousError } = await config.admin.from('rental_payments')
    .select('id,order_id,amount,status,redirect_url,created_at').eq('rental_id', rentalId).maybeSingle();
  if (previousError) return Response.json({ error: 'Pembayaran gagal diperiksa.' }, { status: 500 });
  if (previous?.status === 'Dibayar') return Response.json({ error: 'Pembayaran sudah tercatat.' }, { status: 409 });
  if (previous?.redirect_url && previous.status === 'Menunggu') return Response.json({ redirect_url: previous.redirect_url });
  if (previous && previous.status !== 'Mempersiapkan') return Response.json({ error: 'Pembayaran sebelumnya perlu ditinjau pengelola.' }, { status: 409 });
  if (previous && Date.now() - new Date(previous.created_at).getTime() < 120000) return Response.json({ error: 'Pembayaran sedang dipersiapkan. Coba lagi sebentar.' }, { status: 409 });

  const orderId = previous?.order_id ?? `seru-${rentalId}-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const amount = previous?.amount ?? rental.total_price;
  if (!previous) {
    const { error: insertError } = await config.admin.from('rental_payments').insert({ rental_id: rentalId, order_id: orderId, amount });
    if (insertError) return Response.json({ error: 'Pembayaran sedang dipersiapkan atau gagal dibuat. Coba lagi.' }, { status: 409 });
  }

  try {
    const finishUrl = new URL(`/transactions/${rentalId}/payment`, config.site).toString();
    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.midtransKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        callbacks: { finish: finishUrl, error: finishUrl },
      }),
      cache: 'no-store',
    });
    const result = await response.json() as { redirect_url?: string };
    if (!response.ok || !result.redirect_url) throw new Error('Gateway tidak menerima permintaan.');
    const redirect = new URL(result.redirect_url);
    if (redirect.protocol !== 'https:' || redirect.hostname !== 'app.sandbox.midtrans.com') throw new Error('Alamat pembayaran tidak valid.');
    const { error: saveError } = await config.admin.from('rental_payments').update({
      redirect_url: redirect.toString(), status: 'Menunggu', updated_at: new Date().toISOString(),
    }).eq('order_id', orderId).eq('status', 'Mempersiapkan');
    if (saveError) throw saveError;
    return Response.json({ redirect_url: redirect.toString() });
  } catch {
    return Response.json({ error: 'Gateway sandbox belum dapat membuat pembayaran. Coba lagi nanti.' }, { status: 502 });
  }
}
