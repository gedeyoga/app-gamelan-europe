import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { NotificationService } from '@app/libs/modules/notification/notification.service';
import { SubscribeBillingDto } from './dto/subscribe-billing.dto';
import { CreateBillingDto } from './dto/create-billing.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';
import { BillingEntity } from './entities/billing.entity';

const BASE = 'http://localhost:9000/europe-gamelan';
const USER = '0bdf78ae-83ed-47cf-b115-52d1c1e16c51';
const SUB = '2233aaed-1199-4184-8913-b3cd43401551';
const baseDto: SubscribeBillingDto = { userId: USER, subscriptionId: SUB };

function billing(overrides: Partial<BillingEntity> = {}): BillingEntity {
  return {
    id: 'b1',
    userId: USER,
    status: 'PAID',
    expiryDate: new Date('2026-12-31T00:00:00.000Z'),
    subscription: { name: 'Gold' },
    ...overrides,
  } as unknown as BillingEntity;
}

function makeService(s3BaseUrl: string | undefined) {
  const repo = {
    findSubscription: jest.fn().mockResolvedValue({
      subscriptionType: 'MONTHLY',
      currency: 'IDR',
      price: 1,
      durationInDays: 30,
    }),
    findUser: jest.fn().mockResolvedValue({}),
    findById: jest.fn().mockResolvedValue(billing()),
    subscribe: jest.fn().mockResolvedValue(billing()),
    create: jest.fn().mockResolvedValue(billing()),
    update: jest.fn().mockResolvedValue(billing()),
    cancel: jest.fn().mockResolvedValue(billing({ status: 'CANCELED' })),
  };
  const notification = {
    notifySubscriptionActive: jest.fn().mockResolvedValue(undefined),
    notifySubscriptionCanceled: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: () => s3BaseUrl } as unknown as ConfigService;
  const service = new BillingService(
    repo as unknown as BillingRepository,
    {} as StorageService,
    config,
    notification as unknown as NotificationService,
  );
  return { service, repo, notification };
}

const createDto = {
  userId: USER,
  subscriptionId: SUB,
  code: 'INV-1',
  subscriptionType: 'MONTHLY',
  currency: 'IDR',
  total: 1,
  lines: [],
} as unknown as CreateBillingDto;

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

describe('BillingService SUBSCRIPTION_ACTIVE emission', () => {
  it('subscribe (PAID) → notify once', async () => {
    const { service, notification } = makeService(BASE);
    await service.subscribe(baseDto);
    expect(notification.notifySubscriptionActive).toHaveBeenCalledTimes(1);
    expect(notification.notifySubscriptionActive).toHaveBeenCalledWith(billing());
  });

  it('create PAID → notify once', async () => {
    const { service, notification } = makeService(BASE);
    await service.create({ ...createDto, status: 'PAID' });
    expect(notification.notifySubscriptionActive).toHaveBeenCalledTimes(1);
  });

  it('create PENDING → no notify', async () => {
    const { service, repo, notification } = makeService(BASE);
    repo.create.mockResolvedValue(billing({ status: 'PENDING' }));
    await service.create(createDto);
    expect(notification.notifySubscriptionActive).not.toHaveBeenCalled();
  });

  it('create PAID without expiryDate → no notify', async () => {
    const { service, repo, notification } = makeService(BASE);
    repo.create.mockResolvedValue(billing({ expiryDate: null }));
    await service.create({ ...createDto, status: 'PAID' });
    expect(notification.notifySubscriptionActive).not.toHaveBeenCalled();
  });

  it('update to PAID → notify once', async () => {
    const { service, notification } = makeService(BASE);
    await service.update('b1', { status: 'PAID' } as UpdateBillingDto);
    expect(notification.notifySubscriptionActive).toHaveBeenCalledTimes(1);
  });

  it('update PAID→PAID → masih memanggil notify (dedupe di DB: unique key + skipDuplicates)', async () => {
    const { service, repo, notification } = makeService(BASE);
    repo.update.mockResolvedValue(billing());
    await service.update('b1', { status: 'PAID' } as UpdateBillingDto);
    expect(notification.notifySubscriptionActive).toHaveBeenCalledTimes(1);
  });

  it('notification throws → billing tetap tersimpan (best-effort)', async () => {
    const { service, repo, notification } = makeService(BASE);
    notification.notifySubscriptionActive.mockRejectedValue(new Error('queue down'));
    await expect(service.subscribe(baseDto)).resolves.toMatchObject({ id: 'b1' });
    expect(repo.subscribe).toHaveBeenCalled();
  });

  it('subscribe tidak mengirim SUBSCRIPTION_CANCELED (auto-cancel billing PAID lama)', async () => {
    const { service, notification } = makeService(BASE);
    await service.subscribe(baseDto);
    expect(notification.notifySubscriptionCanceled).not.toHaveBeenCalled();
  });
});

describe('BillingService.cancel SUBSCRIPTION_CANCELED emission', () => {
  it('cancel → emit sekali dengan billing hasil cancel', async () => {
    const { service, repo, notification } = makeService(BASE);
    await service.cancel('b1');
    expect(repo.cancel).toHaveBeenCalledWith('b1');
    expect(notification.notifySubscriptionCanceled).toHaveBeenCalledTimes(1);
    expect(notification.notifySubscriptionCanceled).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', status: 'CANCELED' }),
    );
  });

  it('notification throws → cancel tetap sukses', async () => {
    const { service, repo, notification } = makeService(BASE);
    notification.notifySubscriptionCanceled.mockRejectedValue(new Error('queue down'));
    await expect(service.cancel('b1')).resolves.toMatchObject({ id: 'b1' });
    expect(repo.cancel).toHaveBeenCalled();
  });
});
