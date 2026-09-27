# Login dan profil PinjamIn

## Menjalankan

Dari C:\PinjamIn jalankan `npm run dev`, lalu buka http://localhost:3000/profile.

## Pengaturan Supabase

Tidak perlu tabel profil baru untuk tahap ini. Nama disimpan di metadata milik pengguna Supabase Auth, bukan sebagai role atau izin. Riwayat sewa tetap memakai renter_id dan kebijakan RLS yang ada.

Di dashboard Supabase:

1. Authentication > Providers / Sign In: pastikan Email dan pendaftaran aktif. Biarkan Confirm email aktif.
2. Authentication > URL Configuration: gunakan URL website sebagai Site URL. Untuk lokal, gunakan http://localhost:3000.
3. Tambahkan http://localhost:3000/auth/confirm pada Redirect URLs. Tambahkan URL yang sama dengan origin production dan port pengujian bila diperlukan. Gunakan domain milik proyek sendiri.
4. Aktifkan Allow manual linking untuk meningkatkan akun anonim menjadi akun email. Jika belum aktif, aplikasi menampilkan kegagalan tanpa menghapus sesi tamu.
5. Jalankan supabase/migrations/20260927_require_registered_renters.sql satu kali melalui SQL Editor agar sesi anonim tidak dapat membuat transaksi lewat API.
6. SMTP bawaan Supabase hanya mengirim ke alamat anggota tim proyek dan dibatasi 2 email per jam. Untuk menguji alamat lain, tambahkan alamat tersebut sebagai anggota tim atau aktifkan Custom SMTP melalui Authentication > Emails > SMTP Settings. Jangan menonaktifkan konfirmasi hanya untuk melewati kendala pengiriman.
7. Jalankan supabase/migrations/20260927_profile_and_notifications.sql satu kali melalui SQL Editor. Migrasi ini membuat bucket avatar, aturan akses per pengguna, tabel notifikasi, trigger transaksi, data notifikasi untuk transaksi lama, dan mengaktifkan Realtime untuk tabel notifikasi.

Akun tidak muncul di schema public. Buka Authentication > Users untuk melihat akun, atau pilih schema auth lalu tabel users di Table Editor. Gunakan Authentication > Logs untuk melihat kegagalan pengiriman email.

Ikuti template bawaan ConfirmationURL untuk konfirmasi signup, perubahan email, dan pemulihan kata sandi. Client ini menggunakan alur browser Supabase (implicit); tidak menggunakan callback PKCE server. Jangan mengganti email template menjadi endpoint token_hash server tanpa implementasi tambahan.

## Alur

- Pengguna baru: /register → email konfirmasi → /auth/confirm → profil.
- Pengguna tamu: /register → tautkan email ke user yang sama → verifikasi → buat kata sandi. ID pengguna dan riwayat sewanya tidak diganti.
- Login ke akun yang sudah ada dari sesi tamu: ada persetujuan eksplisit; riwayat tamu tidak digabung otomatis. Untuk menjaga riwayat, daftarkan sesi tamu menggunakan email baru.
- Login: /login → profil, atau kembali ke checkout/transaksi melalui tujuan internal yang diizinkan.
- Lupa sandi: /forgot-password → email reset → /auth/password.
- Profil: edit nama dan logout perangkat/browser ini. Nama bukan hak akses; tidak ada pilihan role di tahap ini.
- Foto profil: akun terdaftar dapat mengunggah JPG, PNG, atau WebP maksimal 2 MB. File disimpan di bucket public avatars, sedangkan upload dan perubahan dibatasi ke folder milik pengguna melalui RLS.
- Notifikasi: permintaan sewa baru dan perubahan status menghasilkan notifikasi milik penyewa. Lonceng menampilkan jumlah belum dibaca dan halaman /notifications menampilkan riwayat lengkap.
- Checkout meminta akun non-anonim. Migrasi RLS juga menolak pembuatan sewa oleh sesi anonim lewat API. Akses antar pengguna tetap dibatasi renter_id.

## Checklist uji email nyata

- Daftar menggunakan email yang dimiliki, buka tautannya, lalu login ulang.
- Login akun yang sama dari browser lain; periksa nama dan transaksi.
- Uji lupa sandi dan tautan kedaluwarsa.
- Uji peningkatan sesi tamu yang mempunyai transaksi; periksa ID/riwayat tetap sama.
- Pastikan akun lain tidak bisa membaca transaksi pengguna pertama.

Tidak ada email, akun, atau transaksi nyata yang dibuat oleh pengujian browser otomatis. Respons auth dalam pengujian disimulasikan; pengiriman SMTP dan konfigurasi dashboard belum diverifikasi end-to-end.

Referensi: https://supabase.com/docs/guides/auth/auth-anonymous dan https://supabase.com/docs/guides/auth/redirect-urls
