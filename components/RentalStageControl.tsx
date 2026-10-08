import Link from 'next/link';

export type RentalStage = {
  id: number;
  status: string;
  handoff_renter_confirmed_at: string | null;
  handoff_owner_confirmed_at: string | null;
  return_renter_confirmed_at: string | null;
  return_owner_confirmed_at: string | null;
};

export default function RentalStageControl({ rental, role, paymentStatus, busy, onConfirm }: {
  rental: RentalStage;
  role: 'renter' | 'owner';
  paymentStatus: string | null;
  busy: boolean;
  onConfirm: (rentalId: number, stage: 'handoff' | 'return') => void;
}) {
  const stage = rental.status === 'Disetujui' ? 'handoff' : rental.status === 'Sedang disewa' ? 'return' : null;
  if (!stage) return null;
  const renterConfirmed = stage === 'handoff' ? rental.handoff_renter_confirmed_at : rental.return_renter_confirmed_at;
  const ownerConfirmed = stage === 'handoff' ? rental.handoff_owner_confirmed_at : rental.return_owner_confirmed_at;
  const ownConfirmed = role === 'renter' ? renterConfirmed : ownerConfirmed;
  const title = stage === 'handoff' ? 'Serah terima barang' : 'Pengembalian barang';

  if (stage === 'handoff' && paymentStatus !== 'Dibayar') return <div className="mt-4 rounded-xl bg-mint/20 p-4 text-sm">
    <p className="font-semibold text-primary">Serah terima barang</p>
    <p className="mt-1 text-muted-foreground">Serah terima tersedia setelah pembayaran berhasil.</p>
    {role === 'renter' ? <Link href={`/transactions/${rental.id}/payment`} className="mt-2 inline-block font-semibold text-primary">{paymentStatus === 'Menunggu' ? 'Periksa pembayaran →' : 'Bayar sewa →'}</Link> : <p className="mt-2 text-muted-foreground">Menunggu pembayaran penyewa.</p>}
  </div>;

  return <div className="mt-4 rounded-xl bg-mint/20 p-4 text-sm">
    <p className="font-semibold text-primary">{title}</p>
    <p className="mt-1 text-muted-foreground">Penyewa: {renterConfirmed ? 'sudah konfirmasi' : 'menunggu'} · Pemilik: {ownerConfirmed ? 'sudah konfirmasi' : 'menunggu'}</p>
    {ownConfirmed ? <p className="mt-2 text-primary">Konfirmasimu tersimpan. Menunggu pihak lain.</p> : role === 'owner' && stage === 'return' && !renterConfirmed ? <p className="mt-2 text-muted-foreground">Menunggu penyewa mengonfirmasi pengembalian.</p> : <button type="button" disabled={busy} onClick={() => onConfirm(rental.id, stage)} className="mt-3 rounded-full bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Menyimpan...' : `Konfirmasi ${stage === 'handoff' ? 'serah terima' : 'pengembalian'}`}</button>}
  </div>;
}
