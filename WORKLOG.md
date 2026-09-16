# PinjamIn Worklog

## 16 September 2026

### Repository

- Membuat folder proyek di `C:\PinjamIn`.
- Menghubungkan folder ke repository `https://github.com/Clementine5555/PinjamIn.git`.
- Branch aktif: `main`.
- Tidak melakukan commit atau push.

### Flutter

- Membuat proyek Flutter untuk Android dan iOS.
- Project name: `pinjamin`.
- Application organization: `id.ac.usu.tribyte`.
- Memasang package:
  - `supabase_flutter`
  - `flutter_riverpod`
  - `go_router`

### Supabase

- Menginisialisasi Supabase ketika aplikasi dimulai.
- Menambahkan project URL dan publishable key ke konfigurasi aplikasi.
- Menambahkan izin internet pada aplikasi Android.

### Struktur aplikasi

- Membuat konfigurasi tema dan warna PinjamIn.
- Membuat routing menggunakan GoRouter.
- Membuat bottom navigation dengan empat menu:
  - Home
  - Cari
  - Transaksi
  - Profil
- Membuat reusable product card.

### Layar awal

- Home dan daftar barang.
- Search dan filter kategori.
- Daftar serta status transaksi.
- Profil dan pengaturan akun.

### Flow penyewaan dan database

- Membuat tabel Supabase `items` dan `rentals`.
- Mengaktifkan Row Level Security pada kedua tabel.
- Membatasi akses transaksi agar pengguna hanya dapat membaca dan membuat transaksi miliknya sendiri.
- Mengaktifkan Anonymous Sign-Ins untuk flow MVP tanpa halaman login.
- Menambahkan delapan data barang awal ke database.
- Membuat seed database yang aman dijalankan ulang tanpa data duplikat.
- Menghubungkan daftar barang pada Home dan Search ke Supabase.
- Membuat halaman Detail Barang.
- Membuat halaman Checkout dengan pilihan durasi sewa satu sampai tiga hari.
- Menyimpan permintaan sewa dari Checkout ke Supabase.
- Menghubungkan halaman Transaksi ke data penyewaan pengguna dari Supabase.
- Membuat card barang dapat ditekan untuk membuka Detail Barang.

### Pengujian perangkat Android

- Mendeteksi perangkat Android `23049PCD8G` melalui USB debugging.
- Berhasil membangun dan memasang APK debug pada perangkat Android.
- Menyelesaikan pembatasan instalasi USB pada perangkat.

### Validasi

- `dart format`: berhasil.
- `flutter analyze`: tidak ditemukan masalah.
- `flutter test`: seluruh test berhasil.

## Menjalankan aplikasi

1. Buka terminal di folder proyek:

   ```powershell
   cd C:\PinjamIn
   ```

2. Pastikan instalasi Flutter siap:

   ```powershell
   flutter doctor
   ```

3. Ambil dependency:

   ```powershell
   flutter pub get
   ```

4. Nyalakan emulator Android dari Android Studio atau hubungkan ponsel dengan USB debugging.

5. Periksa perangkat:

   ```powershell
   flutter devices
   ```

6. Jalankan aplikasi:

   ```powershell
   flutter run
   ```

Jika ada lebih dari satu perangkat:

```powershell
flutter run -d <device-id>
```
