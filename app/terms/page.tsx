import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Syarat dan Ketentuan | SERU',
  description: 'Syarat penggunaan marketplace sewa barang SERU.',
};

export default function TermsPage() {
  return <div className="page-container">
    <article className="mx-auto max-w-3xl space-y-6 rounded-2xl bg-white p-6 text-sm leading-7 sm:p-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Syarat dan Ketentuan SERU</h1>
        <p className="mt-2 text-muted-foreground">Terakhir diperbarui: 10 Oktober 2026</p>
      </div>

      <section>
        <h2 className="text-lg font-bold">1. Layanan dan akun</h2>
        <p>SERU mempertemukan pengguna yang ingin menyewa barang dengan pengguna yang menawarkan barang untuk disewa. Barang tetap menjadi milik pemiliknya; SERU bukan penjual barang tersebut. Pengguna bertanggung jawab memberikan informasi akun yang benar dan menjaga akses akunnya. Verifikasi email tidak berarti identitas atau status mahasiswa telah diverifikasi.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">2. Barang dan pesanan</h2>
        <p>Pemilik hanya boleh memasang barang yang berhak ia sewakan, dengan foto, kondisi, harga, dan lokasi serah terima yang sesuai kenyataan. Barang ilegal, berbahaya, atau melanggar hak pihak lain tidak boleh ditawarkan. Penyewa wajib membaca detail dan tanggal sewa sebelum mengajukan pesanan. Pesanan bergantung pada persetujuan pemilik dan ketersediaan barang.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">3. Harga dan pembayaran</h2>
        <p>Harga dan total sewa ditampilkan sebelum pembayaran. Biaya platform tidak ditambahkan ke total penyewa; biaya tersebut dipotong dari bagian pemilik barang saat pembagian hasil, sebesar 10% untuk akun Standar atau 5% bila status Premium pemilik berlaku ketika pesanan disetujui. SERU tidak meminta deposit untuk pesanan sewa. Pembayaran online dilakukan melalui metode yang tersedia di halaman pembayaran; pesanan hanya dianggap dibayar setelah status pembayaran terverifikasi.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">4. Serah terima dan pengembalian</h2>
        <p>Para pihak menyepakati tempat serah terima sesuai detail pesanan. Periksa kondisi dan kelengkapan barang bersama sebelum mengonfirmasi penerimaan. Penyewa wajib mengembalikan barang paling lambat pada tanggal akhir sewa dalam kondisi yang disepakati, dengan mempertimbangkan pemakaian wajar. Konfirmasi pengembalian dilakukan oleh penyewa lebih dulu, lalu pemilik. Jika ada kerusakan, kehilangan, atau perbedaan kondisi, gunakan fitur laporan dan sertakan bukti yang relevan.</p>
        <p className="mt-2">Keterlambatan pengembalian dicatat dengan denda 15% dari tarif sewa harian per hari keterlambatan. Denda yang tampil di SERU merupakan tagihan tercatat, bukan pembayaran yang otomatis ditarik.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">5. Pembatalan dan sengketa</h2>
        <p>Penyewa dapat membatalkan permintaan yang belum disetujui. Setelah disetujui, pembatalan hanya diajukan sebelum serah terima dan dapat memerlukan peninjauan pengelola, terutama bila pembayaran sudah dibuat. Setelah serah terima, persoalan barang atau transaksi ditangani melalui laporan, bukan pembatalan otomatis. Rincian pengembalian dana dan barang ada di <Link href="/refund-policy" className="font-semibold text-primary underline">Kebijakan Pengembalian</Link>.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">6. SERU Premium</h2>
        <p>Premium berharga Rp20.000 untuk satu bulan dan aktif setelah pembayaran terverifikasi. Perpanjangan dilakukan secara manual, tanpa penagihan otomatis. Manfaat yang berlaku ditampilkan di <Link href="/premium" className="font-semibold text-primary underline">halaman Premium</Link>. Perubahan status Premium tidak mengubah biaya platform pada pesanan yang sudah disetujui.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">7. Bantuan dan perubahan ketentuan</h2>
        <p>Untuk bantuan, laporan, atau pertanyaan tentang transaksi, gunakan fitur laporan di SERU atau email <a href="mailto:seru.officialy@gmail.com" className="font-semibold text-primary underline">seru.officialy@gmail.com</a>. SERU dapat memperbarui ketentuan ini; perubahan akan ditampilkan di halaman ini dan tidak mengubah hak atas transaksi yang telah terjadi secara sepihak.</p>
      </section>
    </article>
  </div>;
}
