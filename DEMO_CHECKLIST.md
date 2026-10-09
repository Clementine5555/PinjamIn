# SERU — checklist uji dan demo

Dokumen ini memisahkan uji kode dari uji langsung. Centang hanya setelah langkah benar-benar dicoba di lingkungan sandbox. Gunakan akun penyewa, pemilik, dan admin yang berbeda; jangan gunakan pembayaran produksi.

## Persiapan

- [ ] Migrasi di `supabase/migrations` sudah dijalankan berurutan, termasuk `20261009_sandbox_payouts.sql` lalu `20261009_zz_premium_membership.sql`.
- [ ] Environment variable Supabase dan Midtrans sandbox tersedia di Vercel; tidak ada kunci server di `NEXT_PUBLIC_` atau Git.
- [ ] Domain dan URL notifikasi Midtrans sandbox mengarah ke deployment terbaru.
- [ ] Tiga akun uji tersedia: penyewa, pemilik barang, dan admin.

## Alur inti untuk demo

1. Pemilik menambahkan barang di `/lend/new`; barang muncul di katalog dan `/lend/items`.
2. Penyewa mencari barang, membuka detail, mengajukan sewa, lalu melihat pesanan di `/transactions`.
3. Pemilik menyetujui di `/lend/requests`. Coba permintaan kedua dengan tanggal bentrok; seharusnya tidak bisa disetujui bersamaan.
4. Penyewa membayar di Midtrans sandbox. Pastikan status di SERU berubah menjadi `Dibayar` sebelum serah terima. Jangan menganggap halaman sukses Midtrans saja sebagai bukti pembayaran.
5. Kedua pihak mengonfirmasi serah terima; status menjadi `Sedang disewa` dan barang tidak tersedia. Penyewa mengonfirmasi pengembalian lebih dulu, lalu pemilik; status menjadi `Selesai`.
6. Pemilik melihat bagian hasil simulasi di `/lend/requests`. Admin melihat komisi 10% Standar atau 5% Premium di `/admin`, lalu mencatat pencairan **simulasi**. Tidak ada transfer dana nyata.
7. Penyewa memberi ulasan; pengguna lain dapat melihat ulasan yang sudah disetujui admin. Coba laporan masalah dan periksa bahwa laporan terbuka menahan pencatatan simulasi.

## Kasus yang harus diuji sebelum dinyatakan siap demo

- [ ] Tamu diarahkan ke login saat checkout.
- [ ] Pemilik tidak dapat menyewa barangnya sendiri; admin tidak dapat bertindak sebagai penyewa/pemilik.
- [ ] Pesanan pending dapat dibatalkan penyewa; pesanan disetujui memerlukan alur pembatalan/refund sandbox sesuai `PAYMENT_POLICY_DRAFT.md`.
- [ ] Pembayaran belum `Dibayar` tidak bisa melewati serah terima, termasuk lewat panggilan API langsung.
- [ ] Satu barang tidak bisa disetujui untuk dua sewa bertanggal bentrok.
- [ ] Kedua konfirmasi diperlukan saat serah terima dan pengembalian; pemilik tidak bisa mengonfirmasi pengembalian sebelum penyewa.
- [ ] Pembayaran yang dikembalikan atau laporan terbuka tidak tercatat sebagai pencairan siap.
- [ ] Pengguna lain tidak dapat membaca chat, pesanan, atau simulasi pembagian hasil milik orang lain.
- [ ] Pemilik membeli Premium Rp20.000 di Midtrans Sandbox; keanggotaan aktif setelah status `Dibayar`, perpanjangan menambah satu bulan sekali, dan tarif 5% terkunci hanya untuk pesanan yang disetujui saat aktif.
- [ ] Tampilan dan tombol utama dicoba di layar ponsel dan desktop.

## Batas demo

Yang ditunjukkan adalah marketplace, tarif final 10%/5%, dan Premium Rp20.000/bulan di lingkungan sandbox. Verifikasi mahasiswa, transfer ke pemilik, pajak, refund Premium produksi, dan prosedur sengketa nyata masih perlu keputusan tim serta integrasi lebih lanjut. Jangan menyebut saldo simulasi sebagai pendapatan atau pencairan nyata.
