import { ConflictException } from '@nestjs/common';
import { BillingService } from '@app/libs/modules/billing/billing.service';
import { UserService } from '@app/libs/modules/user/user.service';
import { SubscriptionRequestRepository } from './subscription-request.repository';
import { SubscriptionRequestService } from './subscription-request.service';

const REQUEST_ID = '0bdf78ae-83ed-47cf-b115-52d1c1e16c51';
const USER_ID = '2233aaed-1199-4184-8913-b3cd43401551';
const REVIEWER_ID = '9fbc48d1-2f35-4a44-9d0a-5c2e6f7a8b90';

const reviewRow = {
  id: REQUEST_ID,
  status: 'PENDING',
  userId: USER_ID,
  subscriptionId: 'sub-1',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
};

function makeService(overrides: Record<string, unknown> = {}) {
  const repo = {
    findForReview: jest.fn().mockResolvedValue(reviewRow),
    claimPending: jest.fn().mockResolvedValue({ count: 1 }),
    claimRejected: jest.fn().mockResolvedValue({ count: 1 }),
    findById: jest.fn().mockResolvedValue({ id: REQUEST_ID, status: 'APPROVED', billingId: 'b1' }),
    findActiveSubscription: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    findUserContact: jest.fn().mockResolvedValue({
      id: USER_ID,
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: null,
      address: null,
      roleId: null,
    }),
    findRoleIdByCode: jest.fn().mockResolvedValue({ id: 'role-member' }),
    setUserRole: jest.fn().mockResolvedValue({ id: USER_ID }),
    setBillingId: jest.fn().mockResolvedValue({ id: REQUEST_ID, status: 'APPROVED', billingId: 'b1' }),
    revertPending: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const billing = { subscribe: jest.fn().mockResolvedValue({ id: 'b1' }) };
  const user = { findOrCreatePublicUser: jest.fn() };
  const notification = {
    notifyAdmins: jest.fn().mockResolvedValue(undefined),
    notifySubscriptionActive: jest.fn().mockResolvedValue(undefined),
  };
  const service = new SubscriptionRequestService(
    repo as unknown as SubscriptionRequestRepository,
    billing as unknown as BillingService,
    user as unknown as UserService,
    notification as never,
  );
  return { service, repo, billing, user, notification };
}

describe('SubscriptionRequestService.approve', () => {
  it('claims PENDING atomically, creates a PAID billing, and stamps billingId', async () => {
    const { service, repo, billing } = makeService();
    const result = await service.approve(REQUEST_ID, REVIEWER_ID);

    expect(repo.claimPending).toHaveBeenCalledWith(REQUEST_ID, expect.objectContaining({ reviewedById: REVIEWER_ID }));
    expect(billing.subscribe).toHaveBeenCalledWith({ userId: USER_ID, subscriptionId: 'sub-1' });
    expect(repo.setBillingId).toHaveBeenCalledWith(REQUEST_ID, 'b1');
    expect(result).toMatchObject({ status: 'APPROVED', billingId: 'b1' });
  });

  it('forwards the optional payment proof to billing', async () => {
    const { service, billing } = makeService();
    await service.approve(REQUEST_ID, REVIEWER_ID, {
      paymentProofUrl: 'http://localhost:9000/billing/payment-proof/x.png',
      paymentProofName: 'x.png',
    });

    expect(billing.subscribe).toHaveBeenCalledWith({
      userId: USER_ID,
      subscriptionId: 'sub-1',
      paymentProofUrl: 'http://localhost:9000/billing/payment-proof/x.png',
      paymentProofName: 'x.png',
    });
  });

  it('rejects a second approve on an already-APPROVED request with 409 and never bills', async () => {
    const { service, billing } = makeService({
      findForReview: jest.fn().mockResolvedValue({ ...reviewRow, status: 'APPROVED' }),
      claimPending: jest.fn().mockResolvedValue({ count: 0 }),
    });

    await expect(service.approve(REQUEST_ID, REVIEWER_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(billing.subscribe).not.toHaveBeenCalled();
  });

  it('rolls the request back to PENDING when billing creation fails', async () => {
    const { service, repo, billing } = makeService();
    billing.subscribe.mockRejectedValue(new Error('billing boom'));

    await expect(service.approve(REQUEST_ID, REVIEWER_ID)).rejects.toThrow('billing boom');
    expect(repo.revertPending).toHaveBeenCalledWith(REQUEST_ID);
    expect(repo.setBillingId).not.toHaveBeenCalled();
  });

  it('emits SUBSCRIPTION_ACTIVE once, via BillingService.subscribe', async () => {
    const { service, billing, notification } = makeService();
    await service.approve(REQUEST_ID, REVIEWER_ID);

    expect(billing.subscribe).toHaveBeenCalledTimes(1);
    expect(notification.notifySubscriptionActive).not.toHaveBeenCalled();
  });

  it('still approves when the ACTIVE notification path fails inside billing (no PENDING revert)', async () => {
    const { service, repo, notification } = makeService();
    notification.notifySubscriptionActive.mockRejectedValue(new Error('queue down'));

    await expect(service.approve(REQUEST_ID, REVIEWER_ID)).resolves.toMatchObject({
      status: 'APPROVED',
      billingId: 'b1',
    });
    expect(repo.revertPending).not.toHaveBeenCalled();
  });
});
