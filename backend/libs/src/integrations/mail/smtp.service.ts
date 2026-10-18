import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

// Pemakaian:
//   const ok = smtp.isConfigured();
//   await smtp.send({ to: 'a@b.c', subject: 'Halo', text: 'Isi' });
@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);
  private transporter?: ReturnType<typeof createTransport>;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST') && this.config.get<string>('SMTP_FROM'));
  }

  // Lazy-init: transporter baru dibuat saat send() dipanggil, jadi dev tanpa SMTP
  // tetap boot. Tidak ada koneksi/verify saat konstruksi.
  private getTransporter(): ReturnType<typeof createTransport> {
    const host = this.config.get<string>('SMTP_HOST');
    const from = this.buildFrom();
    if (!host || !from) throw new BadGatewayException('Mail is not configured');

    if (!this.transporter) {
      const user = this.config.get<string>('SMTP_USER');
      const pass = this.config.get<string>('SMTP_PASSWORD');
      this.transporter = createTransport({
        host,
        port: Number(this.config.get<number | string>('SMTP_PORT') ?? 587),
        secure: String(this.config.get<boolean | string>('SMTP_SECURE') ?? 'false') === 'true',
        // Auth opsional: SMTP lokal (MailHog/Mailpit) biasanya tanpa kredensial.
        auth: user && pass ? { user, pass } : undefined,
      });
    }
    return this.transporter;
  }

  private buildFrom(): string {
    const address = this.config.get<string>('SMTP_FROM');
    if (!address) return '';
    const name = this.config.get<string>('SMTP_FROM_NAME')?.replace(/"/g, '');
    return name ? `"${name}" <${address}>` : address;
  }

  // Detail error hanya untuk log; response tetap generik.
  private describeError(error: unknown): string {
    const e = error as { name?: string; message?: string; code?: string; responseCode?: number };
    const name = e?.name ?? 'Error';
    const message = e?.message ?? String(error);
    const code = e?.code ?? e?.responseCode;
    return code ? `${name}: ${message} (${code})` : `${name}: ${message}`;
  }

  async send(input: SendMailInput): Promise<void> {
    // Lempar 'Mail is not configured' di luar try agar tidak tertukar dengan error kirim.
    const transporter = this.getTransporter();
    try {
      await transporter.sendMail({ from: this.buildFrom(), ...input });
    } catch (error: unknown) {
      this.logger.error('SMTP send failed', this.describeError(error));
      throw new BadGatewayException('Failed to send email');
    }
  }
}
