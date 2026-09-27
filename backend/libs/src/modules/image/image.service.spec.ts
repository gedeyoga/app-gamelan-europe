import { ConfigService } from '@nestjs/config';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { ImageProcessor } from '@app/libs/integrations/storage/image-processor';
import { ImageRepository } from './image.repository';
import { ImageService } from './image.service';

const BASE = 'https://cdn.example.com';
const UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('ImageService.isTrustedUnboundUrl', () => {
  let service: ImageService;
  let findUnboundById: jest.Mock;

  beforeEach(() => {
    findUnboundById = jest.fn();
    service = new ImageService(
      { findUnboundById } as unknown as ImageRepository,
      {} as ImageProcessor,
      {} as StorageService,
      { getOrThrow: jest.fn().mockReturnValue(BASE) } as unknown as ConfigService,
    );
  });

  it('URL di luar prefix S3 → false, tanpa query', async () => {
    await expect(service.isTrustedUnboundUrl('https://evil.test/posts/original/x.png', 'event-submission')).resolves.toBe(false);
    expect(findUnboundById).not.toHaveBeenCalled();
  });

  it('key tanpa uuid → false, tanpa query', async () => {
    await expect(service.isTrustedUnboundUrl(`${BASE}/posts/original/nope.png`, 'event-submission')).resolves.toBe(false);
    expect(findUnboundById).not.toHaveBeenCalled();
  });

  it('row tidak ada / sudah terikat → false', async () => {
    findUnboundById.mockResolvedValue(null);
    await expect(service.isTrustedUnboundUrl(`${BASE}/posts/original/${UUID}.png`, 'event-submission')).resolves.toBe(false);
    expect(findUnboundById).toHaveBeenCalledWith(UUID, 'event-submission');
  });

  it('key original cocok → true', async () => {
    findUnboundById.mockResolvedValue({ id: UUID, key: `posts/original/${UUID}.png`, variants: [] });
    await expect(service.isTrustedUnboundUrl(`${BASE}/posts/original/${UUID}.png`, 'event-submission')).resolves.toBe(true);
  });

  it('key varian cocok → true', async () => {
    findUnboundById.mockResolvedValue({
      id: UUID,
      key: `posts/original/${UUID}.png`,
      variants: [{ name: 'large', key: `posts/${UUID}-large.webp` }],
    });
    await expect(service.isTrustedUnboundUrl(`${BASE}/posts/${UUID}-large.webp`, 'event-submission')).resolves.toBe(true);
  });

  it('row ada tapi key/variants tidak cocok → false', async () => {
    findUnboundById.mockResolvedValue({
      id: UUID,
      key: `posts/original/${UUID}.png`,
      variants: [{ name: 'large', key: `posts/${UUID}-large.webp` }],
    });
    await expect(service.isTrustedUnboundUrl(`${BASE}/posts/original/other-${UUID}.png`, 'event-submission')).resolves.toBe(false);
  });
});
