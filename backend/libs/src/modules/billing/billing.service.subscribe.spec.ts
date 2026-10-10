import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { SubscribeBillingDto } from './dto/subscribe-billing.dto';

const BASE = 'http://localhost:9000/europe-gamelan';
const USER = '0bdf78ae-83ed-47cf-b115-52d1c1e16c51';
const SUB = '2233aaed-1199-4184-8913-b3cd43401551';
const baseDto: SubscribeBillingDto = { userId: USER, subscriptionId: SUB };

function makeService(s3BaseUrl: string | undefined) {
  const repo = {
    findSubscription: jest.fn().mockResolvedValue({
      subscriptionType: 'MONTHLY',
      currency: 'IDR',
      price: 1,
      durationInDays: 30,
    }),
    findUser: jest.fn().mockResolvedValue({}),
    subscribe: jest.fn().mockResolvedValue({ id: 'b1' }),
  };
  const config = { get: () => s3BaseUrl } as unknown as ConfigService;
  const service = new BillingService(repo as unknown as BillingRepository, {} as StorageService, config);
  return { service, repo };
}

describe('SubscribeBillingDto.paymentProofUrl', () => {
  it('accepts a http://localhost URL (no TLD)', () => {
    const dto = plainToInstance(SubscribeBillingDto, {
      ...baseDto,
      paymentProofUrl: `${BASE}/billing/payment-proof/x.png`,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });
});

describe('BillingService.subscribe paymentProofUrl trust boundary', () => {
  it('accepts a URL hosted on S3_PUBLIC_BASE_URL', async () => {
    const { service, repo } = makeService(BASE);
    await service.subscribe({ ...baseDto, paymentProofUrl: `${BASE}/billing/payment-proof/x.png` });
    expect(repo.subscribe).toHaveBeenCalled();
  });

  it('rejects an external URL with a field-scoped 422', async () => {
    const { service, repo } = makeService(BASE);
    await expect(
      service.subscribe({ ...baseDto, paymentProofUrl: 'https://evil.example.com/x.png' }),
    ).rejects.toMatchObject({ response: { errors: [{ field: 'paymentProofUrl' }] } });
    expect(repo.subscribe).not.toHaveBeenCalled();
  });

  it('skips the prefix check when S3_PUBLIC_BASE_URL is unset (dev)', async () => {
    const { service, repo } = makeService(undefined);
    await service.subscribe({ ...baseDto, paymentProofUrl: 'http://localhost:9000/anything.png' });
    expect(repo.subscribe).toHaveBeenCalled();
  });
});
