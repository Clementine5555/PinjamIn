# PinjamIn Web Worklog

## 27 September 2026 - Login dan register

- Menambahkan login, register, konfirmasi email, lupa kata sandi, pengaturan ulang kata sandi, dan logout dengan Supabase Auth.
- Mendukung peningkatan sesi tamu menjadi akun email tanpa mengganti ID pengguna.
- Menghubungkan profil dan indikator akun di header dengan sesi pengguna.
- Mengharuskan akun terdaftar sebelum checkout dan menambahkan kebijakan RLS untuk menolak transaksi baru dari sesi anonim.
- Mengarahkan pengguna yang belum login dari transaksi dan checkout ke halaman login, lalu kembali ke tujuan semula.
- Tampilan role belum dibuat karena dijadwalkan untuk tahap berikutnya.

## 27 September 2026 - Perbaikan form autentikasi

- Menambahkan validasi nama, email, kata sandi, dan konfirmasi kata sandi secara realtime di bawah masing-masing kolom.
- Menampilkan penyebab khusus ketika SMTP bawaan Supabase menolak alamat email di luar anggota tim proyek.
- Mendokumentasikan lokasi akun Auth dan pemeriksaan log email Supabase.

## 27 September 2026 - Foto profil dan notifikasi

- Menambahkan upload foto profil JPG, PNG, atau WebP maksimal 2 MB ke Supabase Storage.
- Menampilkan foto profil di halaman profil dan avatar header.
- Menambahkan tabel notifikasi dengan RLS per pengguna dan trigger untuk transaksi baru serta perubahan status.
- Menambahkan badge notifikasi belum dibaca, ringkasan pada lonceng, pembaruan Realtime, dan halaman /notifications.
- Menambahkan migrasi database supabase/migrations/20260927_profile_and_notifications.sql.

## 1 Oktober 2026 - Pemilik barang dan chat

- Menambahkan halaman /lend untuk upload foto barang, membuat listing, melihat permintaan masuk, serta menyetujui atau menolak sewa.
- Menambahkan chat per transaksi antara penyewa dan pemilik barang dengan pembaruan Supabase Realtime.
- Membatasi akses pesan dan keputusan sewa di database berdasarkan akun penyewa dan pemilik, serta mengirim notifikasi untuk permintaan dan pesan baru.
- Menambahkan migrasi supabase/migrations/20261001_owner_chat.sql. Migrasi perlu dijalankan di Supabase sebelum fitur baru dipakai.
- Barang contoh lama tidak memiliki pemilik akun sehingga tidak menyediakan chat pemilik.
- Menambahkan pembatalan permintaan sewa yang masih menunggu persetujuan dari halaman transaksi. Database memastikan hanya penyewa dapat membatalkan permintaannya sendiri; pemilik mendapat notifikasi bila barang mempunyai akun pemilik.
- Menambahkan migrasi supabase/migrations/20261001_cancel_rental.sql untuk fungsi pembatalan yang perlu dijalankan setelah migrasi pemilik dan chat.

## 2 Oktober 2026 - Siklus sewa dan serah terima

- Menambahkan konfirmasi serah terima dua arah lewat `confirm_rental_stage(p_rental_id, p_stage)`: penyewa dan pemilik sama-sama mengonfirmasi penerimaan serta pengembalian sebelum status berpindah `Menunggu persetujuan → Disetujui → Sedang disewa → Selesai`.
- Mewajibkan penyewa mengonfirmasi pengembalian lebih dulu sebelum pemilik boleh menyelesaikan sewa.
- Menambahkan kendala tanggal sewa yang tumpang tindih (ekstensi `btree_gist`) agar barang tidak disewa dua kali pada rentang tanggal yang sama; tanggal sewa yang sudah `Selesai` dilepas dari kendala sehingga barang bisa disewa kembali.
- Menambahkan kolom `items.is_rented` dengan trigger `sync_item_rented` agar sewa hanya bisa diajukan untuk barang yang tersedia.
- Menambahkan kemampuan pemilik mengedit listing (judul, deskripsi, harga, foto, kategori, lokasi, ketersediaan) dan pemeriksaan kelayakan listing sebelum persetujuan.
- Migrasi: `20261002_rental_lifecycle_and_schedule.sql`, `20261002_zz_owner_listing.sql`, `20261002_z_item_rental_availability.sql`, `20261002_zzz_release_completed_rental_dates.sql`, dan `20261002_zzzz_renter_first_return.sql`.

## 7 Oktober 2026 - Integritas permintaan, ulasan, dan laporan

- Menambahkan trigger `validate_rental_request` untuk memvalidasi status awal, tanggal, durasi (maksimal 7 hari), dan total harga agar sesuai tarif harian.
- Menambahkan ulasan penyewa (`rental_reviews`) dan laporan masalah (`rental_reports`), beserta view `item_rating_summary` dan `published_item_reviews`.
- Menambahkan moderasi ulasan (`moderation_status`) dan peninjauan laporan oleh admin.
- Melarang akun admin membuat listing atau melakukan transaksi sewa.
- Migrasi: `20261007_rental_request_integrity.sql`, `20261007_trust_and_reports.sql`, `20261007_admin_moderation.sql`, dan `20261007_admin_marketplace_restrictions.sql`.

## 7-8 Oktober 2026 - Uji coba pembayaran sandbox

- Sistem uji coba pembayaran sandbox berhasil dijalankan; status pembayaran tercatat dan serah terima hanya bisa dimulai setelah pembayaran terverifikasi.
- Implementasi pembayaran ini direncanakan diganti pada tahap berikutnya.

## 9 Oktober 2026 - Simulasi pembagian hasil SERU

- Menambahkan ledger simulasi setelah transaksi berstatus Selesai dan pembayaran sandbox berstatus Dibayar. Draft demo menggunakan komisi platform 10% dan bagian pemilik 90%; tidak ada transfer dana nyata.
- Menampilkan nominal simulasi di halaman permintaan pemilik dan panel admin. Admin dapat mencatat pencairan simulasi setelah laporan diselesaikan.
- Refund atau laporan baru menandai catatan untuk peninjauan. Migrasi `supabase/migrations/20261009_sandbox_payouts.sql` harus dijalankan sebelum tampilan baru dipakai.
- Memperluas tes SQL untuk komisi, akses antar-akun, peran admin, laporan terbuka, dan laporan yang dibuka kembali. Tes SQL belum dijalankan di database; pemeriksaan TypeScript, lint file terkait, dan build produksi lulus.
- Memperbarui README, kebijakan pembayaran draft, dan `DEMO_CHECKLIST.md`. Uji langsung lintas akun serta keputusan biaya/pencairan produksi masih menunggu tim.

## 9 Oktober 2026 - Tarif final dan SERU Premium sandbox

- Menetapkan tarif komisi pemilik 10% Standar atau 5% Premium, dikunci saat pesanan disetujui; ledger pembagian hasil tetap simulasi.
- Menambahkan SERU Premium Rp20.000 per bulan melalui Midtrans Sandbox. Status aktif hanya setelah pembayaran diverifikasi lewat webhook atau pemeriksaan status gateway, dan perpanjangan dilakukan manual tanpa auto-debit.
- Menambahkan halaman `/premium`, status keanggotaan, ringkasan pembayaran di panel admin, serta notifikasi aktivasi/refund.
- Migrasi `supabase/migrations/20261009_zz_premium_membership.sql` perlu dijalankan setelah migrasi payout. Pengujian langsung di web dan pembayaran sandbox dilakukan pemilik repositori.

## 9 Oktober 2026 - Fitur kepercayaan dan fitur marketplace

- Menambahkan favorit barang (`item_favorites`, halaman `/favorites`).
- Menambahkan verifikasi mahasiswa (`student_verifications`, halaman `/verification`, upload KTM/KTP, `is_verified_student`) yang ditinjau admin.
- Menambahkan boost listing (`item_boosts`, `boost_my_item`) untuk pemilik Premium, terbatas pada barang tersedia dan belum disewa.
- Menambahkan antrean barang (`item_waitlist`, `notify_waitlist_available`) untuk barang yang sedang disewa.
- Menambahkan laporan kondisi barang (`rental_condition_reports`, halaman `/transactions/[id]/condition`) sebagai bukti kondisi saat serah terima dan pengembalian.
- Menambahkan pembatalan oleh penyewa dengan review admin (`rental_cancellations`, `request_rental_cancellation`, `finish_refunded_rental`) serta pembatalan oleh pemilik (`cancel_owner_rental`).
- Memperbarui `validate_rental_request` untuk batas durasi sewa 7 hari (Premium) dan 3 hari (Standar).
- Migrasi: `20261009_zzz_figjam_features.sql`, `20261009_zzzz_boost_available_only.sql`, `20261009_sandbox_cancellations.sql`, dan `20261009_owner_cancellations.sql`.

## 10 Oktober 2026 - Antrean trust, denda keterlambatan, dan metrik pasar

- Mewajibkan verifikasi mahasiswa sebelum listing atau menyewa (gating marketplace).
- Menambahkan prioritas antrean (Premium didahulukan) serta `advance_item_waitlist`, `item_waitlist_state`, dan `guard_waitlist_rental_request`.
- Menambahkan penyelesaian laporan oleh admin (`admin_handle_report`, `resolution_outcome`).
- Menambahkan metrik marketplace admin (`admin_marketplace_metrics`) dan pelacakan `was_approved`.
- Menambahkan denda keterlambatan (`rentals.late_days`, `late_fee_amount`, `assess_rental_late_fee` 15% per hari) serta notifikasi denda.
- Migrasi: `20261010_marketplace_trust_queue_metrics.sql` dan `20261010_zz_late_fee_and_queue_priority.sql`.
