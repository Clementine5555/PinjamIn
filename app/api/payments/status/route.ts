import { paymentConfig } from '@/lib/payment-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const config = paymentConfig();
  if (!config) return Response.json({ error: 'Pembayaran sandbox belum dikonfigurasi.' }, { status: 503 });
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 });
  const { data: identity, error: authError } = await config.auth.auth.getUser(token);
  if (authError || !identity.user || identity.user.is_anonymous) return Response.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  let rentalId: number;
  try {
    const body = await request.json() as { rentalId?: unknown };
    rentalId = typeof body.rentalId === 'number' ? body.rentalId : NaN;
  } catch {
    return Response.json({ error: 'Transaksi tidak valid.' }, { status: 400 });
  }
  if (!Number.isSafeInteger(rentalId) || rentalId <= 0) return Response.json({ error: 'Transaksi tidak valid.' }, { status: 400 });

  const { data: rental, error: rentalError } = await config.admin.from('rentals')
    .select('renter_id,total_price').eq('id', rentalId).maybeSingle();
  if (rentalError) return Response.json({ error: 'Transaksi gagal dimuat.' }, { status: 500 });
  if (!rental || rental.renter_id !== identity.user.id) return Response.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });

  const { data: payment, error: paymentError } = await config.admin.from('rental_payments')
    .select('id,order_id,amount,status').eq('rental_id', rentalId).maybeSingle();
  if (paymentError) return Response.json({ error: 'Pembayaran gagal dimuat.' }, { status: 500 });
  if (!payment) return Response.json({ status: null });
  if (payment.status === 'Dikembalikan') return Response.json({ status: payment.status });

  try {
    const response = await fetch(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(payment.order_id)}/status`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.midtransKey}:`).toString('base64')}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Gateway tidak dapat memeriksa transaksi.');
    const result = await response.json() as { order_id?: string; gross_amount?: string; transaction_status?: string; fraud_status?: string };
    const amount = Number(result.gross_amount);
    if (result.order_id !== payment.order_id || !Number.isSafeInteger(amount) || amount !== payment.amount || amount !== rental.total_price) {
      throw new Error('Data pembayaran tidak cocok.');
    }
    const paid = result.transaction_status === 'settlement' ||
      (result.transaction_status === 'capture' && result.fraud_status === 'accept');
    const refunded = result.transaction_status === 'refund';
    if ((paid && payment.status !== 'Dibayar') || refunded) {
      const { error: updateError } = await config.admin.from('rental_payments').update({
        status: refunded ? 'Dikembalikan' : 'Dibayar',
        paid_at: paid ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id).eq('status', payment.status);
      if (updateError) throw updateError;
    }
    const { data: latest, error: latestError } = await config.admin.from('rental_payments')
      .select('status').eq('id', payment.id).single();
    if (latestError) throw latestError;
    return Response.json({ status: latest.status });
  } catch {
    return Response.json({ error: 'Status Midtrans belum dapat diperiksa. Coba lagi sebentar.' }, { status: 502 });
  }
}
