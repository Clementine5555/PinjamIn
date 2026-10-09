# Pembayaran dan monetisasi SERU — draft untuk validasi tim

## Alur yang disiapkan

1. Penyewa mengirim permintaan tanpa membayar.
2. Pemilik menyetujui permintaan dan jadwal dikunci oleh aturan sewa yang sudah ada.
3. Penyewa membayar total sewa yang tersimpan di transaksi. Integrasi saat ini hanya Midtrans sandbox, nonaktif secara bawaan.
4. Status pembayaran berubah dari notifikasi Midtrans yang diverifikasi, bukan dari URL kembali atau input browser.
5. Serah terima baru dapat dikonfirmasi setelah pembayaran sandbox tercatat sebagai Dibayar. Pengembalian dan sengketa tetap mengikuti alur sewa yang sudah ada. Jangan aktifkan pembayaran produksi sebelum aturan refund dan pencairan disepakati.

## Tarif yang ditetapkan dan keputusan yang masih draft

- Harga sewa: `harga per hari × durasi`, dihitung dan divalidasi di database. Pembayaran sandbox tidak menambah biaya lain.
- Biaya platform final untuk pemilik: **10% Standar** atau **5% Premium** dari total sewa. Tarif pemilik dikunci saat pesanan disetujui. Biaya ini bukan tambahan tagihan penyewa; pembagian hasil masih ledger simulasi dan belum memindahkan uang sungguhan.
- Simulasi bagian pemilik hanya dibuat setelah sewa berstatus `Selesai` dan pembayaran sandbox berstatus `Dibayar` dengan nominal cocok. Pengelola dapat menandainya `Tercatat simulasi` hanya jika tidak ada laporan terbuka. Refund atau laporan baru mengubah catatan menjadi `Perlu peninjauan`. Penandaan ini tidak mengirim dana ke rekening pemilik.
- SERU Premium: **Rp20.000 untuk satu bulan**, dibayar lewat Midtrans Sandbox dan aktif hanya setelah status pembayaran terverifikasi. Perpanjangan dilakukan manual; tidak ada penagihan otomatis. Refund Premium menghentikan masa aktif dari pembayaran terakhir, sedangkan pesanan yang telanjur disetujui tetap memakai tarif yang telah dikunci. Mekanisme refund produksi masih perlu keputusan. Boost listing belum diterapkan.
- Pembagian hasil developer adalah kesepakatan internal tim, terpisah dari biaya platform dan tidak masuk perhitungan checkout.
- Aturan uji sandbox sementara: permintaan yang belum disetujui dapat dibatalkan penyewa langsung. Setelah disetujui tetapi sebelum satu pun pihak mengonfirmasi serah terima, penyewa mengajukan alasan pembatalan dan pengelola meninjau. Selama ditinjau, pembayaran baru dan serah terima ditunda.
- Pemilik dapat menolak permintaan yang belum disetujui. Setelah disetujui dan sebelum serah terima, pemilik dapat membatalkan langsung jika belum ada order pembayaran. Jika order pembayaran sudah dibuat, pemilik mengajukan alasan pembatalan; pengelola memeriksa order/refund sandbox sebelum transaksi dinyatakan batal. Penyewa menerima notifikasi.
- Jika pengelola menyetujui pembatalan sebelum pembayaran, transaksi dibatalkan. Jika order Midtrans masih pending/capture, sistem mencoba membatalkan order sandbox. Jika sudah settlement, sistem mencoba refund penuh hanya untuk metode yang didukung Midtrans. Metode lain atau respons tidak pasti ditandai "Perlu manual" dan tidak boleh dianggap telah dikembalikan.
- Setelah serah terima dimulai, pembatalan otomatis tidak tersedia; pengguna memakai laporan/sengketa. Tidak ada refund otomatis untuk transaksi yang sedang disewa atau selesai. Keputusan akhir mengenai tenggat, potongan, biaya gateway, metode manual, dan pencairan harus disepakati tim sebelum pembayaran produksi.
- Pencairan nyata ke pemilik, biaya gateway, pajak, rekening penerima, serta siapa yang menjadi merchant of record belum ditentukan. Jangan menerima pembayaran produksi sebelum aspek ini disepakati dengan penyedia pembayaran dan tim.
- Payout Midtrans yang dijelaskan dalam [dokumentasi resmi](https://docs.midtrans.com/docs/receive-your-fund) ditujukan ke rekening merchant yang dikonfigurasi di portal Midtrans; itu **bukan** fitur transfer otomatis SERU kepada pemilik barang.

## Mengaktifkan pengujian sandbox

1. Jalankan migrasi `20261007_trust_and_reports.sql`, lalu `20261007_admin_moderation.sql` dan `20261007_payment_sandbox.sql` di Supabase SQL Editor.
2. Untuk panel pengelola, tetapkan `seru_role=admin` pada `raw_app_meta_data` akun pengelola di Supabase, lalu masuk ulang agar token diperbarui. Jangan taruh role admin di `user_metadata` yang dapat diubah sendiri oleh pengguna.
3. Buat akun Midtrans sandbox. Simpan `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SANDBOX_SERVER_KEY`, dan `SERU_SITE_URL=https://<domain-seru>` sebagai environment variable server di lokal/Vercel; jangan masukkan kunci ke Git atau variabel `NEXT_PUBLIC_`.
4. Atur Notification URL Midtrans sandbox ke `https://<domain-seru>/api/payments/notification`. Set `NEXT_PUBLIC_PAYMENT_SANDBOX_ENABLED=true` hanya pada lingkungan pengujian. URL akhir pembayaran ditentukan oleh aplikasi saat transaksi dibuat.
5. Jalankan pula migrasi `20261008_payment_handoff_and_admin_summary.sql`, `20261009_sandbox_cancellations.sql`, dan `20261009_owner_cancellations.sql` sesuai urutan. Uji dengan akun penyewa, pemilik, dan admin: pembatalan oleh pemilik sebelum order pembayaran dibuat, pembatalan order pending, kartu sandbox yang sudah dibayar, penolakan pembatalan, dan percobaan serah terima selama pengajuan aktif. Uji juga notifikasi palsu, nominal berbeda, dan pengiriman webhook berulang.
6. Jalankan `20261009_sandbox_payouts.sql` setelah migrasi di atas. Selesaikan satu sewa sandbox sampai kedua pihak mengonfirmasi pengembalian, lalu lihat simulasi bagian pemilik di `/lend/requests` dan panel admin. Coba laporan terbuka sebelum menandai simulasi untuk memastikan pencatatan tertahan.
7. Jalankan `20261009_zz_premium_membership.sql` setelah migrasi payout. Di `/premium`, coba pembayaran Rp20.000 lewat simulator Midtrans Sandbox. Notification URL tetap `/api/payments/notification`; pembayaran sewa dan Premium memakai endpoint yang sama. Setelah status `Dibayar`, setujui pesanan barang milik akun Premium dan periksa komisi 5%. Tanpa Premium aktif, komisi 10%.

Integrasi ini belum menerima uang sungguhan. Kunci Midtrans produksi tidak digunakan oleh kode.
