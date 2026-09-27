export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && (/^\/items\/\d+\/checkout$/.test(value) || ['/profile', '/transactions', '/notifications'].includes(value)) ? value : '/profile';
}

export function authError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    invalid_credentials: 'Email atau kata sandi salah.',
    email_not_confirmed: 'Konfirmasi email terlebih dahulu. Kamu bisa meminta email konfirmasi baru di bawah.',
    user_already_exists: 'Email ini sudah digunakan. Silakan masuk.',
    email_exists: 'Email ini sudah digunakan. Silakan masuk.',
    weak_password: 'Kata sandi terlalu lemah. Gunakan kombinasi yang lebih kuat.',
    same_password: 'Gunakan kata sandi yang berbeda dari sebelumnya.',
    over_email_send_rate_limit: 'Terlalu banyak permintaan email. Tunggu beberapa menit lalu coba lagi.',
    over_request_rate_limit: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    manual_linking_disabled: 'Peningkatan akun tamu belum diaktifkan di Supabase. Sesi dan riwayat tamu tetap dipertahankan.',
    signup_disabled: 'Pendaftaran sementara dinonaktifkan.',
    email_address_not_authorized: 'Supabase menolak email ini karena SMTP bawaan hanya mengirim ke anggota tim proyek. Tambahkan email ke tim Supabase atau aktifkan Custom SMTP.',
    email_address_invalid: 'Alamat email tidak valid.',
  };
  return messages[code] ?? 'Permintaan gagal. Periksa koneksi dan coba lagi.';
}
