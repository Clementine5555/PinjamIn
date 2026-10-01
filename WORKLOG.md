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
