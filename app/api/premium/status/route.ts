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

  const { data: payment, error: paymentError } = await config.admin.from('premium_payments')
    .select('id,order_id,amount,status').eq('user_id', identity.user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
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
    if (result.order_id !== payment.order_id || !Number.isSafeInteger(amount) || amount !== 20000 || amount !== payment.amount) {
      throw new Error('Data pembayaran tidak cocok.');
    }
    let nextStatus: string | null = null;
    if (result.transaction_status === 'settlement' || (result.transaction_status === 'capture' && result.fraud_status === 'accept')) nextStatus = 'Dibayar';
    else if (result.transaction_status === 'pending') nextStatus = 'Menunggu';
    else if (result.transaction_status === 'expire') nextStatus = 'Kedaluwarsa';
    else if (result.transaction_status === 'cancel' || result.transaction_status === 'deny') nextStatus = 'Gagal';
    else if (result.transaction_status === 'refund') nextStatus = 'Dikembalikan';
    if (nextStatus && nextStatus !== payment.status && payment.status !== 'Dikembalikan' &&
      (payment.status !== 'Dibayar' || nextStatus === 'Dikembalikan') &&
      (!['Kedaluwarsa', 'Gagal'].includes(payment.status) || ['Dibayar', 'Dikembalikan'].includes(nextStatus))) {
      const { error: updateError } = await config.admin.from('premium_payments').update({
        status: nextStatus,
        paid_at: nextStatus === 'Dibayar' ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id).eq('status', payment.status);
      if (updateError) throw updateError;
    }
    const { data: latest, error: latestError } = await config.admin.from('premium_payments')
      .select('status').eq('id', payment.id).single();
    if (latestError) throw latestError;
    return Response.json({ status: latest.status });
  } catch {
    return Response.json({ error: 'Status Midtrans belum dapat diperiksa. Coba lagi sebentar.' }, { status: 502 });
  }
}
