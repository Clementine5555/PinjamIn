import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Kebijakan Pengembalian Dana dan Barang | SERU',
  description: 'Aturan pembatalan, pengembalian dana, dan pengembalian barang sewaan di SERU.',
};

export default function RefundPolicyPage() {
  return <div className="page-container">
    <article className="mx-auto max-w-3xl space-y-6 rounded-2xl bg-white p-6 text-sm leading-7 sm:p-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Kebijakan Pengembalian Dana dan Barang</h1>
        <p className="mt-2 text-muted-foreground">Terakhir diperbarui: 10 Oktober 2026</p>
      </div>

      <section>
        <h2 className="text-lg font-bold">Pembatalan sebelum serah terima</h2>
        <p>Permintaan sewa yang masih menunggu persetujuan dapat dibatalkan penyewa melalui halaman Pesanan. Pada tahap ini belum ada pembayaran sewa yang perlu dikembalikan. Setelah pemilik menyetujui, penyewa atau pemilik dapat mengajukan pembatalan sebelum salah satu pihak mengonfirmasi serah terima. Jika pembayaran sudah dibuat, pengelola memeriksa status pembayaran sebelum menyelesaikan pembatalan; selama pemeriksaan, serah terima ditunda.</p>
        <p className="mt-2">Bila pembatalan sebelum serah terima disetujui dan pembayaran sewa sudah berhasil, jumlah sewa yang dibayar diajukan untuk pengembalian penuh. Pengembalian tidak dinyatakan selesai sampai status penyedia pembayaran atau bukti transfer manual terkonfirmasi.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Cara dan waktu pengembalian dana</h2>
        <p>Pengembalian dapat diproses melalui metode pembayaran semula jika didukung penyedia pembayaran. Untuk metode yang tidak mendukung refund otomatis atau bila proses otomatis gagal, pengelola akan menghubungi penyewa untuk memeriksa dan menindaklanjuti pengembalian secara manual. Waktu dana diterima bergantung pada metode pembayaran, bank, dan hasil pemeriksaan; SERU tidak menjanjikan dana masuk seketika.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Setelah barang diserahkan</h2>
        <p>Setelah serah terima dimulai, pembatalan dan refund otomatis tidak tersedia. Jika barang tidak sesuai deskripsi, rusak saat diterima, tidak dapat digunakan sebagaimana disepakati, atau terjadi masalah lain, segera laporkan melalui fitur laporan pada transaksi dengan foto, percakapan, atau bukti pendukung. Pengelola meninjau keadaan dan tanggapan kedua pihak sebelum menentukan penyelesaian yang sesuai. Jangan menganggap pengajuan laporan sebagai persetujuan refund.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Pengembalian barang sewaan</h2>
        <p>SERU menyediakan sewa sementara, bukan pembelian barang. Penyewa mengembalikan barang fisik kepada pemilik paling lambat pada tanggal akhir sewa, dengan kelengkapan dan kondisi yang disepakati. Penyewa mengonfirmasi pengembalian di SERU, lalu pemilik memeriksa dan mengonfirmasinya. Jika kondisi barang diperselisihkan, kedua pihak dapat mengajukan laporan beserta bukti. Keterlambatan dicatat sebagai denda 15% dari tarif sewa harian untuk setiap hari lewat dari tanggal akhir sewa; denda ini tidak ditarik otomatis.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Pembayaran Premium</h2>
        <p>Jika pembayaran Premium terpotong tetapi keanggotaan tidak aktif, atau ada dugaan pembayaran ganda, hubungi SERU agar status transaksi diperiksa. Pengembalian pembayaran Premium ditinjau berdasarkan hasil pemeriksaan; tidak ada pembatalan atau refund otomatis untuk masa keanggotaan yang telah aktif.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Ajukan bantuan</h2>
        <p>Sertakan nomor pesanan, alasan, dan bukti relevan melalui fitur laporan atau email <a href="mailto:seru.officialy@gmail.com" className="font-semibold text-primary underline">seru.officialy@gmail.com</a>. Baca juga <Link href="/terms" className="font-semibold text-primary underline">Syarat dan Ketentuan SERU</Link>.</p>
      </section>
    </article>
  </div>;
}
