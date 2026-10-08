# Pembayaran dan monetisasi SERU — draft untuk validasi tim

## Alur yang disiapkan

1. Penyewa mengirim permintaan tanpa membayar.
2. Pemilik menyetujui permintaan dan jadwal dikunci oleh aturan sewa yang sudah ada.
3. Penyewa membayar total sewa yang tersimpan di transaksi. Integrasi saat ini hanya Midtrans sandbox, nonaktif secara bawaan.
4. Status pembayaran berubah dari notifikasi Midtrans yang diverifikasi, bukan dari URL kembali atau input browser.
5. Serah terima baru dapat dikonfirmasi setelah pembayaran sandbox tercatat sebagai Dibayar. Pengembalian dan sengketa tetap mengikuti alur sewa yang sudah ada. Jangan aktifkan pembayaran produksi sebelum aturan refund dan pencairan disepakati.

## Keputusan produk yang masih draft

- Harga sewa: `harga per hari × durasi`, dihitung dan divalidasi di database. Pembayaran sandbox tidak menambah biaya lain.
- Biaya platform untuk pemilik: standar **10–15%**, premium sekitar **5%** menurut BMC. Rentang ini belum menjadi tarif final, belum ditagihkan, dan belum dipotong otomatis.
- Langganan premium dan boost listing: manfaat, harga, masa berlaku, dan mekanisme pengembalian belum ditetapkan. Belum ada pembelian kedua produk ini.
- Pembagian hasil developer adalah kesepakatan internal tim, terpisah dari biaya platform dan tidak masuk perhitungan checkout.
- Pembatalan sebelum pemilik menyetujui permintaan tidak menimbulkan pembayaran. Pembatalan setelah disetujui, setelah dibayar, dan refund memerlukan aturan tenggat, bukti, serta persetujuan tim sebelum otomatisasi. Sengketa ditangani pengelola; tidak ada tombol refund otomatis.
- Pencairan ke pemilik, biaya gateway, pajak, serta siapa yang menjadi merchant of record belum ditentukan. Jangan menerima pembayaran produksi sebelum aspek ini disepakati dengan penyedia pembayaran dan tim.

## Mengaktifkan pengujian sandbox

1. Jalankan migrasi `20261007_trust_and_reports.sql`, lalu `20261007_admin_moderation.sql` dan `20261007_payment_sandbox.sql` di Supabase SQL Editor.
2. Untuk panel pengelola, tetapkan `seru_role=admin` pada `raw_app_meta_data` akun pengelola di Supabase, lalu masuk ulang agar token diperbarui. Jangan taruh role admin di `user_metadata` yang dapat diubah sendiri oleh pengguna.
3. Buat akun Midtrans sandbox. Simpan `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SANDBOX_SERVER_KEY`, dan `SERU_SITE_URL=https://<domain-seru>` sebagai environment variable server di lokal/Vercel; jangan masukkan kunci ke Git atau variabel `NEXT_PUBLIC_`.
4. Atur Notification URL Midtrans sandbox ke `https://<domain-seru>/api/payments/notification`. Set `NEXT_PUBLIC_PAYMENT_SANDBOX_ENABLED=true` hanya pada lingkungan pengujian. URL akhir pembayaran ditentukan oleh aplikasi saat transaksi dibuat.
5. Uji dengan dua akun: pemilik menyetujui sewa, penyewa membuka pembayaran uji coba, lalu pastikan status berubah lewat webhook. Uji juga notifikasi palsu, nominal berbeda, dan pengiriman webhook berulang.

Integrasi ini belum menerima uang sungguhan. Kunci Midtrans produksi tidak digunakan oleh kode.
