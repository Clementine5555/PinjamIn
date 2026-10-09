import { createHash, timingSafeEqual } from 'node:crypto';
import { paymentConfig } from '@/lib/payment-server';

export const runtime = 'nodejs';

type MidtransNotice = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
};

export async function POST(request: Request) {
  const config = paymentConfig();
  if (!config) return new Response(null, { status: 503 });
  let notice: MidtransNotice;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return new Response(null, { status: 413 });
    notice = JSON.parse(raw) as MidtransNotice;
  }
  catch { return new Response(null, { status: 400 }); }
  if (typeof notice.order_id !== 'string' || typeof notice.status_code !== 'string' || typeof notice.gross_amount !== 'string' || typeof notice.signature_key !== 'string' || typeof notice.transaction_status !== 'string') return new Response(null, { status: 400 });

  const expected = createHash('sha512').update(`${notice.order_id}${notice.status_code}${notice.gross_amount}${config.midtransKey}`).digest('hex');
  const actual = notice.signature_key.toLowerCase();
  if (actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return new Response(null, { status: 401 });

  const { data: rentalPayment, error: lookupError } = await config.admin.from('rental_payments')
    .select('id,amount,status').eq('order_id', notice.order_id).maybeSingle();
  if (lookupError) return new Response(null, { status: 500 });
  const { data: premiumPayment, error: premiumError } = rentalPayment ? { data: null, error: null } :
    await config.admin.from('premium_payments').select('id,amount,status').eq('order_id', notice.order_id).maybeSingle();
  if (premiumError) return new Response(null, { status: 500 });
  const payment = rentalPayment ?? premiumPayment;
  if (!payment) return new Response(null, { status: 404 });
  const table = rentalPayment ? 'rental_payments' : 'premium_payments';
  const amount = Number(notice.gross_amount);
  if (!Number.isSafeInteger(amount) || amount !== payment.amount) return new Response(null, { status: 400 });

  let nextStatus: string | null = null;
  if (notice.transaction_status === 'settlement' || (notice.transaction_status === 'capture' && notice.fraud_status === 'accept')) nextStatus = 'Dibayar';
  else if (notice.transaction_status === 'pending') nextStatus = 'Menunggu';
  else if (notice.transaction_status === 'expire') nextStatus = 'Kedaluwarsa';
  else if (notice.transaction_status === 'cancel' || notice.transaction_status === 'deny') nextStatus = 'Gagal';
  else if (notice.transaction_status === 'refund') nextStatus = 'Dikembalikan';
  if (!nextStatus || nextStatus === payment.status) return new Response(null, { status: 200 });
  if (payment.status === 'Dikembalikan') return new Response(null, { status: 200 });
  if (payment.status === 'Dibayar' && nextStatus !== 'Dikembalikan') return new Response(null, { status: 200 });
  if (payment.status === 'Kedaluwarsa' || payment.status === 'Gagal') {
    if (nextStatus !== 'Dibayar' && nextStatus !== 'Dikembalikan') return new Response(null, { status: 200 });
  }

  const { error: updateError } = await config.admin.from(table).update({
    status: nextStatus,
    paid_at: nextStatus === 'Dibayar' ? new Date().toISOString() : undefined,
    updated_at: new Date().toISOString(),
  }).eq('id', payment.id).eq('status', payment.status);
  if (updateError) return new Response(null, { status: 500 });
  return new Response(null, { status: 200 });
}
