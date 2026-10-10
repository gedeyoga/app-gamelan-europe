import { mapMemberSubscription, MemberPayload } from './billing.entity';

function row(billings: MemberPayload['billings']): MemberPayload {
  return { id: 'u1', fullName: 'Andi', email: 'andi@example.com', avatar: null, createdAt: new Date(), billings };
}

const now = new Date('2026-10-07T00:00:00Z');
const sub = { id: 's1', name: 'Monthly', slug: 'monthly' };

describe('mapMemberSubscription', () => {
  it('tanpa billing → NONE + null', () => {
    const m = mapMemberSubscription(row([]), now);
    expect(m.status).toBe('NONE');
    expect(m.billingId).toBeNull();
    expect(m.expiryDate).toBeNull();
  });

  it('PAID + expiryDate future → ACTIVE (ISO)', () => {
    const m = mapMemberSubscription(
      row([{ id: 'b1', status: 'PAID', startDate: now, expiryDate: new Date('2026-11-07T00:00:00Z'), subscription: sub }]),
      now,
    );
    expect(m.status).toBe('ACTIVE');
    expect(m.expiryDate).toBe('2026-11-07T00:00:00.000Z');
  });

  it('PAID tapi expiryDate lewat → INACTIVE', () => {
    const m = mapMemberSubscription(
      row([{ id: 'b1', status: 'PAID', startDate: now, expiryDate: new Date('2026-10-01T00:00:00Z'), subscription: sub }]),
      now,
    );
    expect(m.status).toBe('INACTIVE');
  });

  it('PAID tanpa expiryDate → INACTIVE', () => {
    const m = mapMemberSubscription(row([{ id: 'b1', status: 'PAID', startDate: now, expiryDate: null, subscription: sub }]), now);
    expect(m.status).toBe('INACTIVE');
  });

  it('CANCELED → INACTIVE walau expiryDate future', () => {
    const m = mapMemberSubscription(
      row([{ id: 'b1', status: 'CANCELED', startDate: now, expiryDate: new Date('2026-11-07T00:00:00Z'), subscription: sub }]),
      now,
    );
    expect(m.status).toBe('INACTIVE');
  });

  it('CANCELED + expiryDate null → INACTIVE + expiryDate null', () => {
    const m = mapMemberSubscription(
      row([{ id: 'b1', status: 'CANCELED', startDate: now, expiryDate: null, subscription: sub }]),
      now,
    );
    expect(m.status).toBe('INACTIVE');
    expect(m.expiryDate).toBeNull();
  });
});
