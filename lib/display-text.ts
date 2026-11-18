/**
 * Regex yang menangkap berbagai format nomor telepon Indonesia dan internasional:
 * - 08xx-xxxx-xxxx / 08xxxxxxxxxx
 * - +62 8xx xxxx xxxx
 * - (021) xxxxxxx
 * - Angka ≥10 digit yang terpisah (dengan atau tanpa strip/spasi)
 */
const PHONE_PATTERN =
  /(?:(?:\+|00)?62[\s-]?|0)(?:8\d{2}[\s-]?\d{3,4}[\s-]?\d{3,4}|\d{3,4}[\s-]?\d{3,4}[\s-]?\d{3,4})|(?:\(\d{2,5}\)[\s-]?\d{3,8}(?:[\s-]\d{3,6})?)|(?<!\d)\d{10,13}(?!\d)/g;

const PHONE_MASK = '[nomor disembunyikan]';

/** Menyensor nomor telepon dalam teks pesan chat. */
export function maskPhoneNumbers(text: string): string {
  return text.replace(PHONE_PATTERN, PHONE_MASK);
}

/** Validasi apakah pesan mengandung nomor telepon (untuk warning sebelum kirim). */
export function containsPhoneNumber(text: string): boolean {
  PHONE_PATTERN.lastIndex = 0;
  return PHONE_PATTERN.test(text);
}

export function cancellationNoteForDisplay(note: string | null) {
  if (!note) return 'Menunggu peninjauan pengelola.';
  return note
    .replace(/Refund penuh diterima Midtrans sandbox; status dana nyata tidak berlaku\./gi, 'Pengembalian dana tercatat di Midtrans.')
    .replace(/\s+sandbox\b/gi, '')
    .replace(/; status dana nyata tidak berlaku\.?/gi, '');
}
