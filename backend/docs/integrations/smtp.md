# SMTP — Transport Email

Menu: [RULES.md](../RULES.md) · [auth.md](../modules/auth.md)

---

## 1. Tujuan & Scope

`SmtpService` adalah **transport email mentah** di `libs/src/integrations/mail/`. Scope iterasi ini:

- Membungkus `nodemailer` dengan lazy-init + error mapping ke `BadGatewayException`.
- Menyediakan `isConfigured()` dan `send()` untuk dipakai modul lain.

**Di luar scope (belum dibuat):** notifikasi per event, notifikasi member, template HTML, queue, retry, tracking/bounce, log riwayat kirim, dan tabel/entity terkait. Schema notifikasi **belum ada** di `schema.prisma`. Semua itu masuk backlog (§9).

### Lokasi file

```
libs/src/integrations/mail/
├── smtp.service.ts       ← SmtpService (transport)
├── smtp.module.ts        ← SmtpModule (@Global)
└── smtp.service.spec.ts  ← spec (tanpa network)
```

Klien pihak ketiga → `integrations/` sesuai RULES §2.

---

## 2. Environment

| Variabel | Wajib | Default | Contoh | Catatan |
| --- | --- | --- | --- | --- |
| `SMTP_HOST` | opsional* | — | `sandbox.smtp.mailtrap.io` | *Wajib agar `send()` bisa jalan. |
| `SMTP_PORT` | opsional | `587` | `587` / `465` | Joi: integer 1–65535. |
| `SMTP_SECURE` | opsional | `false` | `false` | `'true'` = TLS langsung (port 465); `false` = STARTTLS (587). |
| `SMTP_USER` | opsional | — | `smtp-user` | Auth dipakai hanya bila `SMTP_USER` **dan** `SMTP_PASSWORD` terisi. |
| `SMTP_PASSWORD` | opsional | — | `smtp-pass` | **Jangan pernah** di-commit / di-log. |
| `SMTP_FROM` | opsional* | — | `noreply@gamelan.eu` | *Wajib agar `send()` bisa jalan. |
| `SMTP_FROM_NAME` | opsional | — | `Gamelan Europe` | Bila diisi, `from` menjadi `"Nama" <alamat>`. |

\* Semua `optional` di Joi agar dev tanpa SMTP tetap boot. `isConfigured()` bernilai `true` hanya bila `SMTP_HOST` **dan** `SMTP_FROM` terisi.

Schema ada di `libs/src/common/config/env.validation.ts` sebagai `smtpBase`, dipakai oleh `appEnvValidationSchema` **dan** `workerEnvValidationSchema`.

Contoh `.env` (lihat juga `.env.example`):

```dotenv
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<user-dari-mailtrap>
SMTP_PASSWORD=<pass-dari-mailtrap>
SMTP_FROM=noreply@example.com
SMTP_FROM_NAME=Gamelan Europe
```

---

## 3. Cara Kerja

### Lazy-init

- Transport **tidak dibuat saat boot**. `createTransport()` dipanggil pertama kali `send()` dieksekusi.
- Dev tanpa SMTP tetap boot normal; kegagalan konfigurasi hanya muncul saat kirim.
- Transporter disimpan di field `private transporter` dan **dipakai ulang** antar panggilan; dibuat ulang hanya bila masih kosong.
- Tidak ada `verify()` otomatis saat init — verifikasi koneksi terjadi implisit saat `sendMail`.

### Error mapping

| Kondisi | Perilaku |
| --- | --- |
| `SMTP_HOST` / `SMTP_FROM` kosong | `BadGatewayException('Mail is not configured')` — **tanpa** membocorkan host/kredensial. |
| `sendMail` gagal (auth, koneksi, timeout, dll.) | Detail asli di-log via `Logger.error('SMTP send failed', ...)`; response `BadGatewayException('Failed to send email')`. |

Detail error (`name`, `message`, `code`/`responseCode`) hanya untuk log server. Jangan dikembalikan ke client.

### From

```text
SMTP_FROM_NAME ada  → "Gamelan Europe" <noreply@example.com>
SMTP_FROM_NAME kosong → noreply@example.com
```

Karakter `"` pada nama di-strip agar header tetap valid.

---

## 4. API

```typescript
export interface SendMailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}
```

| Method | Signature | Keterangan |
| --- | --- | --- |
| `isConfigured` | `(): boolean` | `true` bila `SMTP_HOST` + `SMTP_FROM` terisi. Tidak melakukan I/O. |
| `send` | `(input: SendMailInput): Promise<void>` | Kirim satu email. Lempar `BadGatewayException` bila belum dikonfigurasi atau gagal kirim. |

Contoh pemakaian:

```typescript
import { Injectable } from '@nestjs/common';
import { SmtpService } from '@app/libs';

@Injectable()
export class ContohService {
  constructor(private readonly smtp: SmtpService) {}

  async kirimSapaan(email: string): Promise<void> {
    if (!this.smtp.isConfigured()) return; // opsional: lewati diam-diam di dev

    await this.smtp.send({
      to: email,
      subject: 'Selamat datang',
      text: 'Terima kasih sudah mendaftar.',
      html: '<p>Terima kasih sudah mendaftar.</p>',
      replyTo: 'halo@gamelan.eu',
    });
  }
}
```

Catatan: `send()` **tidak** menangkap error untuk pemanggil — modul pemanggil yang memutuskan mau fail-fast atau best-effort (`try/catch` + log), sama seperti pola `StorageService.deleteObjects`.

### Wiring module

`SmtpModule` bersifat `@Global()`, di-import dan di-export oleh `LibsModule`, sehingga cukup inject `SmtpService` tanpa import modul tambahan:

```typescript
@Global()
@Module({ providers: [SmtpService], exports: [SmtpService] })
export class SmtpModule {}
```

`libs/src/index.ts` mengekspor `./integrations/mail/smtp.module` dan `./integrations/mail/smtp.service`.

---

## 5. Setup Dev

### MailHog (lokal, tanpa kredensial)

```bash
docker run -d --name mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

```dotenv
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=dev@localhost
```

UI inbox: <http://localhost:8025>.

### Mailtrap (sandbox)

1. Buat inbox sandbox di Mailtrap → tab **SMTP Settings**.
2. Salin host/port/username/password ke `.env` (`SMTP_SECURE=false`, port 587).
3. Semua email masuk ke inbox sandbox, tidak terkirim ke penerima nyata.

### Cek cepat

```bash
pnpm exec jest libs/src/integrations/mail --runInBand
```

Spec tidak melakukan koneksi jaringan; ia hanya memverifikasi guard konfigurasi dan `isConfigured()`.

---

## 6. Catatan Keamanan

- Kredensial **hanya** dari env. Jangan hardcode, jangan simpan di DB/repo, jangan kirim ke client.
- Jangan log password, isi email, atau header `Authorization`. `Logger` hanya mencatat nama error, message, dan code.
- **Port 465** → `SMTP_SECURE=true` (TLS langsung). **Port 587** → `SMTP_SECURE=false` (STARTTLS; nodemailer menaikkan koneksi ke TLS bila server mendukung). Jangan set `SMTP_SECURE=true` di port 587 — koneksi gagal/hang.
- Tolak `SMTP_*` yang menunjuk ke host internal tak terpercaya bila nilainya bisa diubah non-admin (SSRF lewat konfigurasi).
- Sanitasi/escape konten dinamis sebelum masuk `html` (pola `sanitize-html` yang sudah dipakai untuk input publik), terutama bila nanti memakai template notifikasi.
- Rate-limit / throttle pengiriman di sisi pemanggil bila dipicu endpoint publik.

---

## 7. Backlog (belum dibuat)

- Queue + retry/backoff (Bull/Redis) — jangan blok request HTTP menunggu SMTP.
- Template email (HTML + teks fallback) dan i18n.
- Notifikasi per event (registrasi, subscription request disetujui, pembayaran, dsb.) dan notifikasi per member.
- Schema/entity notifikasi + riwayat status kirim di `schema.prisma`.
- Preferensi notifikasi user (opt-out), unsubscribe.
- Bounce/complaint handling dan provider transaksional (SES/Resend/SendGrid) bila volume naik.
