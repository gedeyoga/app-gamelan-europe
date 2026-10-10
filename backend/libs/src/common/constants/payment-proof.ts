// Sumber kebenaran tunggal tipe file bukti bayar billing, dipakai bersama oleh
// `PaymentProofUploadInterceptor` (validasi upload) & `BillingService` (normalisasi + key storage).
export const PAYMENT_PROOF_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// Ekstensi nama file → mime, diturunkan dari MIME_EXT (+ alias `jpeg`) agar tak bisa divergen.
export const PAYMENT_PROOF_EXT_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(PAYMENT_PROOF_MIME_EXT).flatMap(([mime, ext]) =>
    (ext === 'jpg' ? ['jpg', 'jpeg'] : [ext]).map((e) => [e, mime]),
  ),
);

export const PAYMENT_PROOF_ALLOWED_MIME = Object.keys(PAYMENT_PROOF_MIME_EXT);

// MIME generik/tak terpercaya → resolusi lewat ekstensi nama file.
export const PAYMENT_PROOF_GENERIC_MIME = ['', 'application/octet-stream'];
