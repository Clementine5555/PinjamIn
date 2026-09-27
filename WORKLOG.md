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
