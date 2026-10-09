# SERU

Website sewa barang antarmahasiswa. Proyek ini menggunakan Next.js, Supabase, dan Midtrans **sandbox** untuk demonstrasi pembayaran. Tidak ada transfer uang nyata ke pemilik melalui aplikasi.

## Menjalankan lokal

1. Salin nilai yang dibutuhkan dari `.env.example` ke `.env.local`. Jangan unggah `.env.local` atau kunci server ke Git.
2. Jalankan `npm install` lalu `npm run dev`.
3. Buka `http://localhost:3000`.

Untuk web yang sudah dideploy di Vercel, tidak perlu menjalankan server lokal. Push dan redeploy tetap dikerjakan pemilik repositori.

## Database dan pembayaran

- Jalankan migrasi SQL di `supabase/migrations` sesuai urutan nama file. Yang terbaru untuk simulasi pembagian hasil adalah `20261009_sandbox_payouts.sql`.
- Langkah konfigurasi akun admin dan Midtrans sandbox ada di `PAYMENT_POLICY_DRAFT.md`.
- Komisi 10% dan bagian pemilik 90% saat ini hanya **angka draft simulasi** untuk demo. Premium, boost listing, biaya gateway, pajak, dan pencairan sungguhan belum diterapkan.

## Pemeriksaan dan demo

- `npm run build` untuk memeriksa build produksi.
- `npm run lint` untuk pemeriksaan kode.
- `supabase/tests/rental_flow.test.sql` berisi uji aturan database berbasis pgTAP; jalankan hanya pada database pengujian yang sudah menerima seluruh migrasi.
- Urutan uji pengguna dan alur demo ada di `DEMO_CHECKLIST.md`. Hasil build tidak menggantikan pengujian langsung dengan akun penyewa, pemilik, dan admin.
