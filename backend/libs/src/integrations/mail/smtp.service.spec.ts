import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmtpService } from './smtp.service';

function makeService(env: Record<string, unknown> = {}) {
  const config = { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
  return new SmtpService(config);
}

describe('SmtpService', () => {
  it('tanpa SMTP_HOST/SMTP_FROM → isConfigured false', () => {
    expect(makeService().isConfigured()).toBe(false);
  });

  it('tanpa SMTP_HOST/SMTP_FROM → send menolak BadGatewayException, tanpa network', async () => {
    const service = makeService();
    await expect(
      service.send({ to: 'a@b.c', subject: 'Tes', text: 'Isi' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('SMTP_HOST+SMTP_FROM terisi → isConfigured true', () => {
    const service = makeService({ SMTP_HOST: 'localhost', SMTP_FROM: 'noreply@example.test' });
    expect(service.isConfigured()).toBe(true);
  });
});
