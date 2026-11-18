# Rencana Migrasi Pembayaran: Midtrans Sandbox → iPaymu

> Status: **RENCANA** (belum dieksekusi). Dibaca ulang tiap sesi sebelum lanjut.
> Dibuat: 12 November 2026.
> Tujuan: pindah semua titik pembayaran dari Midtrans sandbox ke iPaymu API v2.

## Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Tipe integrasi | **Redirect payment** (hosted checkout iPaymu), analog snap Midtrans, pola `order_id + redirect_url + notifyUrl` dipertahankan |
| `feeDirection` | **MERCHANT** — biaya gateway iPaymu ditanggung SERU. Nominal pembeli tetap `rental.total_price`, komisi/payout tidak berubah. Biaya gateway TIDAK dicatat di schema (sama seperti era Midtrans). |
| Refund otomatis | **TIDAK ADA** di iPaymu (beda dari Midtrans `/cancel` + `/refund`) |
| Penutup loop refund | **Webhook refund** (callback status `3` / Refund). Tanpa tombol "tandai refund manual" di admin. |
| Komisi/payout platform | Tidak berubah — dihitung DB dari `rental_payments.amount`, gateway tidak terlibat |
| Schema DB | Status enum & kolom lama TETAP (generik). Hanya tambah 2 kolom gateway baru. |

## Risiko / poin verifikasi

1. **Callback refund belum terjamin.** Docs callback iPaymu hanya menjamin `berhasil/pending/expired`. Kemungkinan refund manual tidak memicu webhook → loop tidak nutup otomatis. Non-blocking: saat uji sandbox, kalau tidak ada callback refund, tambah tombol admin fallback belakangan (kerja kecil, terisolasi).
2. **Signature callback memakai secret = nomor VA**, bukan API key. Wajib benar atau callback ditolak.
3. **Status hanya bisa dicek via `transactionId` iPaymu** (`trx_id` dari callback), bukan `referenceId`. Karena itu `gateway_transaction_id` wajib disimpan.

## Kredensial & kunci (per environment)

| Kunci | Dipakai untuk |
|---|---|
| `IPAYMU_SANDBOX_VA` | header `va` request; **secret verifikasi callback** |
| `IPAYMU_SANDBOX_API_KEY` | key HMAC pembuatan signature request |

- Base sandbox: `https://sandbox.ipaymu.com/api/v2`
- Base production: `https://my.ipaymu.com/api/v2`
- Halaman pembayaran redirect: `https://sandbox.ipaymu.com/payment/{SessionID}` (sandbox)

---

# DAFTAR TAHAPAN (dikerjakan SATU PER SATU, tidak sekaligus)

## Tahap 1 — Migrasi schema DB

File baru: `supabase/migrations/20261112_ipaymu_payment_gateway.sql` (nomor tanggal sesuaikan saat eksekusi).

Tambahkan kolom ke `rental_payments` dan `premium_payments`:
- `session_id text` — SessionID dari response create payment.
- `gateway_transaction_id text` — `trx_id` dari callback (TransactionId iPaymu), untuk cek status.

Perbarui teks hardcode trigger `finish_refunded_rental` di `20261009_sandbox_cancellations.sql`-analog: ganti *"Refund tercatat di Midtrans sandbox."* menjadi teks iPaymu (mis. *"Refund tercatat di iPaymu."*).

## Tahap 2 — Helper signature (baru)

Lokasi: `lib/payment-server.ts` (atau modul baru `lib/ipaymu.ts`).

- **Signature request** (buat order & cek status):
  ```
  jsonBody      = JSON.stringify(body)            // tanpa escape slash (pilih salah satu std, konfirmasi sample PHP)
  requestBody   = sha256(jsonBody) hex lowercase
  stringToSign  = "METHOD" + ":" + VA + ":" + requestBody + ":" + API_KEY
  signature     = HMAC-SHA256(stringToSign, API_KEY) hex
  timestamp     = YYYYMMDDHHmmss (14 digit)
  ```
  Header: `Accept`, `Content-Type: application/json`, `va`, `signature`, `timestamp`.

- **Signature callback** (verifikasi `X-Signature`):
  - Normalisasi tipe: `trx_id, status_code, transaction_status_code, paid_off` → int; `is_escrow` → bool; `additional_info` → `[]`; hapus field `signature` bila ada.
  - Urutkan key A–Z (case-sensitive, seperti `ksort()`).
  - `JSON.stringify` + escape `/` → `\/`.
  - `HMAC-SHA256(json, VA)` hex; bandingkan `crypto.timingSafeEqual`.

- Ubah return `paymentConfig()` dari `midtransKey` → `{ va, apiKey, site, ... }`. Tetap gate `NEXT_PUBLIC_PAYMENT_SANDBOX_ENABLED === 'true'`.

## Tahap 3 — Route buat order (rental)

`app/api/payments/create/route.ts`:
- `POST https://sandbox.ipaymu.com/api/v2/payment`
- Body: `product[]`, `qty[]`, `price[]`, `description[]`, `returnUrl`, `notifyUrl`, `cancelUrl`, `referenceId` (= `order_id`), `feeDirection = MERCHANT`, buyer name/email/phone, `expired` jam.
- Simpan `session_id` dari `Data.SessionID`; return `Data.Url` sebagai `redirect_url`.
- `order_id` format saat ini dipertahankan: `seru-{rentalId}-{uuid}`.

## Tahap 4 — Route buat order Premium

`app/api/premium/create/route.ts`: sama seperti Tahap 3, `amount = 20000`, `order_id = seru-premium-{uuid}`.

## Tahap 5 — Route cek status (rental & premium)

`app/api/payments/status/route.ts` + `app/api/premium/status/route.ts`:
- `POST https://sandbox.ipaymu.com/api/v2/transaction`, body `{ transactionId }` dari `gateway_transaction_id`.
- Mapping status iPaymu → enum DB (lihat tabel mapping).

## Tahap 6 — Webhook notification (rental & premium)

`app/api/payments/notification/route.ts`:
- Verifikasi `X-Signature` (headers `X-Signature`, `X-Timestamp`) pakai helper Tahap 2.
- Idempotensi: cek status DB dulu (iPaymu retry sampai 200).
- Mapping status → enum DB (lihat tabel mapping).
- Response `200 OK` agar retry berhenti; `400` bila signature invalid.

## Tahap 7 — Refund manual

`app/api/cancellations/review/route.ts`:
- Hapus cabang refund otomatis Midtrans (`/cancel`, `/refund`, `payment_type` whitelist).
- Cek status iPaymu via `POST /api/v2/transaction`:
  - Belum bayar (`0` pending / `-2` expired) → tutup lokal: pembayaran `Gagal`/`Kedaluwarsa`, transaksi `Dibatalkan`, pembatalan `Selesai`.
  - Sudah bayar (`1` sukses / `6` unsettled) → pembatalan `Perlu manual`, `resolution_note` berisi `referenceId`/`trx_id`; transaksi tetap diblokir.
- Trigger `finish_refunded_rental` menutup saat status pembayaran jadi `Dikembalikan` (dari webhook refund).

## Tahap 8 — Validasi redirect + env + docs + teks

- Ganti whitelist hostname `app.sandbox.midtrans.com` → `sandbox.ipaymu.com` di 4 tempat:
  - `app/api/payments/create/route.ts`
  - `app/api/premium/create/route.ts`
  - `app/transactions/[id]/payment/page.tsx`
  - `app/premium/page.tsx`
- `.env.example`: ganti `MIDTRANS_SANDBOX_SERVER_KEY` → `IPAYMU_SANDBOX_VA` + `IPAYMU_SANDBOX_API_KEY`.
- Docs: `README.md`, `PAYMENT_POLICY_DRAFT.md`, `DEMO_CHECKLIST.md`, `WORKLOG.md`.
- `lib/display-text.ts` + `app/admin/page.tsx`: ganti string `"Refund penuh diterima Midtrans sandbox..."` dan teks UI terkait.

---

# PETA MIDTRANS SAAT INI (referensi, semua titik wajib diganti)

## Config sentral

`lib/payment-server.ts`:
- Gate `NEXT_PUBLIC_PAYMENT_SANDBOX_ENABLED !== 'true'` → return `null`.
- Key `MIDTRANS_SANDBOX_SERVER_KEY`, `SERU_SITE_URL`, `SUPABASE_*`.
- Return `{ auth, admin, midtransKey, site }`. Semua route pakai `config.midtransKey`.

## Route API pembayaran (semua `export const runtime = 'nodejs'`)

| File | Fungsi | Endpoint Midtrans |
|---|---|---|
| `payments/create/route.ts` | buat order sewa | `POST app.sandbox.midtrans.com/snap/v1/transactions` (Basic auth) |
| `payments/status/route.ts` | cek status sewa | `GET api.sandbox.midtrans.com/v2/{order_id}/status` |
| `payments/notification/route.ts` | webhook | verifikasi `signature_key = SHA512(order_id+status_code+gross_amount+serverKey)` |
| `premium/create/route.ts` | buat order Premium | Snap |
| `premium/status/route.ts` | cek status Premium | `GET /v2/{order_id}/status` |
| `cancellations/review/route.ts` | refund/cancel admin | `/status`, `/cancel`, `/refund` |

## Validasi hostname redirect (hardcode `app.sandbox.midtrans.com`)

Pola sama di 4 tempat (server & client):
```ts
const redirect = new URL(result.redirect_url);
if (redirect.protocol !== 'https:' || redirect.hostname !== 'app.sandbox.midtrans.com')
  throw new Error('Alamat pembayaran tidak valid.');
```

## Mapping status Midtrans → enum DB (dipakai notification + status)

```
settlement / (capture && fraud_status==='accept') → 'Dibayar'
pending → 'Menunggu'
expire  → 'Kedaluwarsa'
cancel / deny → 'Gagal'
refund  → 'Dikembalikan'
```

## Mapping status iPaymu → enum DB (TARGET)

```
status_code 1  / transaction_status_code 1 → 'Dibayar'
status_code 1  / transaction_status_code 6 → 'Dibayar' (unsettled)
status_code 0  / status 'pending'          → 'Menunggu'
status_code -2 / status 'expired'          → 'Kedaluwarsa'
status transaksi 2 (Cancelled) / 5 (Failed)→ 'Gagal'
status transaksi 3 (Refund)                → 'Dikembalikan'
```

Kode status transaksi iPaymu (dari `POST /api/v2/transaction`):
```
0 pending, 1 success, 2 cancelled, 3 refund, 4 error, 5 failed,
6 success-unsettled, 7 escrow, -2 expired
```

## Refund logic Midtrans (dihapus)

`cancellations/review/route.ts:152` refund otomatis hanya untuk `['credit_card','gopay','shopeepay','dana','ovo','qris','kredivo','akulaku']`; status check via `payment_type`. Refund key `seru-cancel-{rentalId}`.

## Docs & teks yang menyebut Midtrans

- `README.md`, `PAYMENT_POLICY_DRAFT.md`, `DEMO_CHECKLIST.md`, `WORKLOG.md`
- `lib/display-text.ts` baris 4: regex `Refund penuh diterima Midtrans sandbox...`
- `app/admin/page.tsx`: teks UI refund.

## Schema DB (dipertahankan, tidak gateway-spesifik)

- `rental_payments`: `rental_id` (unique FK), `order_id` (unique), `amount int`, `status` enum (`Mempersiapkan|Menunggu|Dibayar|Gagal|Kedaluwarsa|Dikembalikan`), `redirect_url`, `created_at`, `updated_at`, `paid_at`.
- `premium_payments`: `user_id`, `order_id` (unique), `amount=20000`, `status` enum sama, `redirect_url`, `membership_applied_at`.
- `order_id` prefix: `seru-{rentalId}-{uuid}` (rental), `seru-premium-{uuid}`.

---

# Fakta iPaymu API v2 (referensi cepat)

## Redirect payment — `POST /api/v2/payment`

Headers: `Content-Type`, `va`, `signature`, `timestamp` (14 digit).

Body wajib: `product[]`, `qty[]`, `price[]`, `description[]`, `returnUrl`, `notifyUrl`, `cancelUrl`.
Opsional: `referenceId`, `buyerName/Email/Phone`, `expired` (jam), `feeDirection`, `paymentMethod`, `account`.

Response sukses:
```json
{ "Status": 200, "Message": "success",
  "Data": { "SessionID": "91538218-...", "Url": "https://sandbox.ipaymu.com/payment/{SessionID}" } }
```

## Cek transaksi — `POST /api/v2/transaction`

Body: `{ transactionId }`. Response `Data.TransactionId`, `Data.Status`, `Data.StatusDesc`, dsb.

## Callback — webhook `notifyUrl`

- Headers: `X-Signature`, `X-Timestamp`, `X-External-ID`.
- Secret = **nomor VA** (bukan API key).
- Field penting: `status` (`berhasil|pending|expired`), `status_code` (1/0/-2), `transaction_status_code` (1/6), `total`/`amount`/`sub_total` (string), `paid_off` (int), `reference_id`, `trx_id` (TransactionId), `fee`.
- `total - paid_off = fee` (biaya gateway; dengan `MERCHANT` ditanggung SERU, tidak dicatat).