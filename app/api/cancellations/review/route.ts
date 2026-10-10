import { paymentConfig } from '@/lib/payment-server';

export const runtime = 'nodejs';

type GatewayStatus = {
  order_id?: string;
  gross_amount?: string;
  transaction_status?: string;
  payment_type?: string;
};

export async function POST(request: Request) {
  const config = paymentConfig();
  if (!config) return Response.json({ error: 'Pembayaran saat ini tidak tersedia.' }, { status: 503 });
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 });
  const { data: identity, error: authError } = await config.auth.auth.getUser(token);
  if (authError || !identity.user || identity.user.app_metadata.seru_role !== 'admin') {
    return Response.json({ error: 'Hanya pengelola yang dapat memproses pembatalan.' }, { status: 403 });
  }

  let rentalId: number;
  let action: string;
  try {
    const body = await request.json() as { rentalId?: unknown; action?: unknown };
    rentalId = typeof body.rentalId === 'number' ? body.rentalId : NaN;
    action = typeof body.action === 'string' ? body.action : '';
  } catch {
    return Response.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
  if (!Number.isSafeInteger(rentalId) || rentalId <= 0 || !['approve', 'reject', 'check'].includes(action)) {
    return Response.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const { data: cancellation, error: cancellationError } = await config.admin.from('rental_cancellations')
    .select('rental_id,renter_id,requested_by,status').eq('rental_id', rentalId).maybeSingle();
  if (cancellationError) return Response.json({ error: 'Pengajuan gagal dimuat.' }, { status: 500 });
  if (!cancellation) return Response.json({ error: 'Pengajuan tidak ditemukan.' }, { status: 404 });
  if (cancellation.status === 'Selesai' || cancellation.status === 'Ditolak') {
    return Response.json({ status: cancellation.status });
  }

  if (action === 'reject') {
    if (cancellation.status !== 'Menunggu') return Response.json({ error: 'Pengajuan sudah diproses.' }, { status: 409 });
    if (cancellation.requested_by === 'owner') return Response.json({ error: 'Pembatalan pemilik harus diselesaikan setelah status pembayaran diperiksa.' }, { status: 409 });
    const { data, error } = await config.admin.from('rental_cancellations').update({
      status: 'Ditolak', resolution_note: 'Pembatalan ditolak pengelola.', resolved_at: new Date().toISOString(),
    }).eq('rental_id', rentalId).eq('status', 'Menunggu').select('status,resolution_note').maybeSingle();
    if (error || !data) return Response.json({ error: 'Status pengajuan berubah. Muat ulang halaman.' }, { status: 409 });
    await config.admin.from('notifications').insert({
      user_id: cancellation.renter_id, rental_id: rentalId, kind: 'cancellation_rejected',
      title: 'Pembatalan ditolak', message: 'Pengajuan pembatalan ditolak. Hubungi pengelola jika perlu bantuan.', href: '/transactions',
    });
    return Response.json(data);
  }
  if (action === 'approve' && !['Menunggu', 'Perlu manual'].includes(cancellation.status)) {
    return Response.json({ error: 'Pengembalian sedang diproses. Gunakan Periksa status.' }, { status: 409 });
  }
  if (action === 'check' && cancellation.status !== 'Diproses') {
    return Response.json({ error: 'Belum ada pengembalian yang sedang diproses.' }, { status: 409 });
  }
  if (action === 'approve') {
    const { data, error } = await config.admin.from('rental_cancellations').update({
      status: 'Diproses', resolution_note: 'Pengelola sedang memeriksa status pembayaran.',
    }).eq('rental_id', rentalId).eq('status', cancellation.status).select('rental_id').maybeSingle();
    if (error || !data) return Response.json({ error: 'Pengajuan sedang diproses. Muat ulang halaman.' }, { status: 409 });
  }

  const { data: rental, error: rentalError } = await config.admin.from('rentals')
    .select('status,total_price,handoff_renter_confirmed_at,handoff_owner_confirmed_at').eq('id', rentalId).maybeSingle();
  if (rentalError || !rental) return Response.json({ error: 'Transaksi gagal dimuat.' }, { status: 500 });
  if (rental.status !== 'Disetujui' || rental.handoff_renter_confirmed_at || rental.handoff_owner_confirmed_at) {
    return Response.json({ error: 'Serah terima sudah dimulai atau transaksi berubah. Perlu peninjauan manual.' }, { status: 409 });
  }

  const { data: payment, error: paymentError } = await config.admin.from('rental_payments')
    .select('id,order_id,amount,status,redirect_url').eq('rental_id', rentalId).maybeSingle();
  if (paymentError) return Response.json({ error: 'Pembayaran gagal dimuat.' }, { status: 500 });

  async function manual(note: string) {
    const { data, error } = await config!.admin.from('rental_cancellations')
      .update({ status: 'Perlu manual', resolution_note: note })
      .eq('rental_id', rentalId).eq('status', 'Diproses').select('status,resolution_note').maybeSingle();
    if (error) return Response.json({ error: 'Pengajuan perlu ditinjau manual, tetapi status gagal disimpan.' }, { status: 500 });
    if (data) return Response.json(data);
    const { data: latest } = await config!.admin.from('rental_cancellations')
      .select('status,resolution_note').eq('rental_id', rentalId).maybeSingle();
    return Response.json(latest ?? { error: 'Status pengajuan berubah. Muat ulang halaman.' }, { status: latest ? 200 : 409 });
  }

  async function complete(paymentStatus: 'Gagal' | 'Dikembalikan' | null, note: string) {
    if (payment && paymentStatus) {
      const { error } = await config!.admin.from('rental_payments').update({
        status: paymentStatus, updated_at: new Date().toISOString(),
      }).eq('id', payment.id);
      if (error) throw error;
    }
    const { data: latestRental, error: lookupError } = await config!.admin.from('rentals')
      .select('status').eq('id', rentalId).single();
    if (lookupError) throw lookupError;
    if (latestRental.status === 'Disetujui') {
      const { data, error } = await config!.admin.from('rentals').update({ status: 'Dibatalkan' })
        .eq('id', rentalId).eq('status', 'Disetujui')
        .is('handoff_renter_confirmed_at', null).is('handoff_owner_confirmed_at', null)
        .select('id').maybeSingle();
      if (error || !data) throw new Error('Transaksi tidak dapat dibatalkan.');
    } else if (latestRental.status !== 'Dibatalkan') throw new Error('Transaksi tidak dapat dibatalkan.');
    const { error: finishError } = await config!.admin.from('rental_cancellations').update({
      status: 'Selesai', resolution_note: note, resolved_at: new Date().toISOString(),
    }).eq('rental_id', rentalId);
    if (finishError) throw finishError;
    return Response.json({ status: 'Selesai', resolution_note: note });
  }

  try {
    if (!payment) return await complete(null, 'Belum ada pembayaran; transaksi dibatalkan.');
    if (payment.amount !== rental.total_price) return await manual('Nominal pembayaran tidak cocok. Periksa transaksi di Midtrans.');
    if (payment.status === 'Dikembalikan') return await complete(null, 'Pengembalian dana sudah tercatat.');
    if (payment.status === 'Mempersiapkan' && !payment.redirect_url) {
      return await manual('Pembayaran masih disiapkan. Periksa status order di Midtrans sebelum membatalkan.');
    }

    const credentials = `Basic ${Buffer.from(`${config.midtransKey}:`).toString('base64')}`;
    const endpoint = `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(payment.order_id)}`;
    const statusResponse = await fetch(`${endpoint}/status`, {
      headers: { Accept: 'application/json', Authorization: credentials }, cache: 'no-store',
    });
    if (!statusResponse.ok) return await manual('Status pembayaran belum dapat diverifikasi. Periksa ulang di dashboard Midtrans.');
    const gateway = await statusResponse.json() as GatewayStatus;
    const amount = Number(gateway.gross_amount);
    if (gateway.order_id !== payment.order_id || !Number.isSafeInteger(amount) || amount !== payment.amount) {
      return await manual('Data order Midtrans tidak cocok. Jangan proses otomatis.');
    }
    if (gateway.transaction_status === 'refund') return await complete('Dikembalikan', 'Pengembalian dana tercatat di Midtrans.');
    if (['cancel', 'expire', 'deny', 'failure'].includes(gateway.transaction_status ?? '')) {
      return await complete('Gagal', 'Pembayaran tidak jadi; transaksi dibatalkan.');
    }
    if (action === 'check') return Response.json({ status: 'Diproses', resolution_note: 'Midtrans belum mengonfirmasi refund. Periksa lagi nanti.' });

    if (gateway.transaction_status === 'pending' || gateway.transaction_status === 'capture') {
      const cancelResponse = await fetch(`${endpoint}/cancel`, {
        method: 'POST', headers: { Accept: 'application/json', Authorization: credentials }, cache: 'no-store',
      });
      const result = await cancelResponse.json() as GatewayStatus;
      if (cancelResponse.ok && result.order_id === payment.order_id && result.transaction_status === 'cancel') {
        return await complete('Gagal', 'Pesanan dibatalkan di Midtrans.');
      }
      return await manual('Midtrans tidak menerima pembatalan otomatis. Periksa pesanan di dashboard Midtrans.');
    }

    if (gateway.transaction_status !== 'settlement') return await manual('Status pembayaran belum mendukung refund otomatis.');
    if (!['credit_card', 'gopay', 'shopeepay', 'dana', 'ovo', 'qris', 'kredivo', 'akulaku'].includes((gateway.payment_type ?? '').toLowerCase())) {
      return await manual('Metode pembayaran ini perlu penanganan refund manual di luar alur otomatis.');
    }
    const refundResponse = await fetch(`${endpoint}/refund`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: credentials },
      body: JSON.stringify({ refund_key: `seru-cancel-${rentalId}`, amount: payment.amount, reason: 'Pembatalan sebelum serah terima' }),
      cache: 'no-store',
    });
    const result = await refundResponse.json() as GatewayStatus;
    if (refundResponse.ok && result.order_id === payment.order_id && result.transaction_status === 'refund') {
      return await complete('Dikembalikan', 'Pengembalian dana penuh tercatat di Midtrans.');
    }
    if (refundResponse.ok && result.order_id === payment.order_id) {
      const { error } = await config.admin.from('rental_cancellations').update({
        status: 'Diproses', resolution_note: 'Pengembalian dana diajukan ke Midtrans; menunggu konfirmasi.',
      }).eq('rental_id', rentalId);
      if (error) throw error;
      return Response.json({ status: 'Diproses', resolution_note: 'Pengembalian dana diajukan ke Midtrans; menunggu konfirmasi.' });
    }
    return await manual('Refund otomatis belum diterima Midtrans. Periksa di dashboard Midtrans.');
  } catch {
    return await manual('Proses Midtrans belum pasti. Periksa pesanan di dashboard Midtrans sebelum mencoba lagi.');
  }
}
