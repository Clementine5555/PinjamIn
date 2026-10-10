export function cancellationNoteForDisplay(note: string | null) {
  if (!note) return 'Menunggu peninjauan pengelola.';
  return note
    .replace(/Refund penuh diterima Midtrans sandbox; status dana nyata tidak berlaku\./gi, 'Pengembalian dana tercatat di Midtrans.')
    .replace(/\s+sandbox\b/gi, '')
    .replace(/; status dana nyata tidak berlaku\.?/gi, '');
}
