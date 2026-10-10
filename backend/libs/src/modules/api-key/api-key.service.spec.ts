import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiKeyRepository } from './api-key.repository';
import { ApiKeyService } from './api-key.service';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('ApiKeyService.authenticate', () => {
  let service: ApiKeyService;
  let findByHash: jest.Mock;
  let touchLastUsed: jest.Mock;

  beforeEach(() => {
    findByHash = jest.fn();
    touchLastUsed = jest.fn().mockResolvedValue(undefined);
    service = new ApiKeyService({ findByHash, touchLastUsed } as unknown as ApiKeyRepository);
  });

  it('unknown raw key → 401 Unauthorized', async () => {
    findByHash.mockResolvedValue(null);
    await expect(service.authenticate('gke_unknown')).rejects.toThrow(
      new UnauthorizedException('Invalid API key'),
    );
    expect(findByHash).toHaveBeenCalledWith(sha256('gke_unknown'));
    expect(touchLastUsed).not.toHaveBeenCalled();
  });

  it('valid raw key → principal (creator) + flattened permission codes', async () => {
    findByHash.mockResolvedValue({
      id: 'key-1',
      createdBy: 'user-1',
      creator: { id: 'user-1', email: 'admin@example.com', status: 'ACTIVE' },
      permissions: [{ permission: { code: 'user:read' } }, { permission: { code: 'role:read' } }],
    });

    await expect(service.authenticate('gke_valid')).resolves.toEqual({
      id: 'user-1',
      email: 'admin@example.com',
      jti: '',
      exp: 0,
      isMember: false,
      apiKeyId: 'key-1',
      permissions: ['user:read', 'role:read'],
    });
    expect(findByHash).toHaveBeenCalledWith(sha256('gke_valid'));
    expect(touchLastUsed).toHaveBeenCalledWith('key-1');
  });

  it.each(['INACTIVE', 'BLOCKED'])(
    'creator %s → 401 Unauthorized (key tidak boleh dipakai)',
    async (status) => {
      findByHash.mockResolvedValue({
        id: 'key-1',
        createdBy: 'user-1',
        creator: { id: 'user-1', email: 'admin@example.com', status },
        permissions: [{ permission: { code: 'user:read' } }],
      });

      await expect(service.authenticate('gke_valid')).rejects.toThrow(
        new UnauthorizedException('Invalid API key'),
      );
      expect(touchLastUsed).not.toHaveBeenCalled();
    },
  );
});
