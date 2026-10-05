import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { RegisterUserDto } from './dto/register-user.dto';

function makeService() {
  const userRepository = {
    findById: jest.fn().mockResolvedValue({ id: 'target' }),
    remove: jest.fn().mockResolvedValue({ id: 'target' }),
  };
  const permissionService = {
    getPermissionCodesByUserId: jest.fn().mockResolvedValue(['admin:access']),
  };
  const service = new UserService(
    userRepository as never,
    {} as never,
    permissionService as never,
    {} as never,
  );
  return { service, userRepository, permissionService };
}

describe('UserService.remove', () => {
  it('hapus user lain oleh admin → sukses', async () => {
    const { service, userRepository } = makeService();
    await service.remove('target', 'admin');
    expect(userRepository.remove).toHaveBeenCalledWith('target');
  });

  it('self-delete → 403, delete tidak dijalankan', async () => {
    const { service, userRepository } = makeService();
    await expect(service.remove('admin', 'admin')).rejects.toBeInstanceOf(ForbiddenException);
    expect(userRepository.remove).not.toHaveBeenCalled();
  });

  it('user tidak ada → 404 menang atas 403 self-delete, delete tidak dijalankan', async () => {
    const { service, userRepository } = makeService();
    userRepository.findById.mockRejectedValue(new NotFoundException('User not found'));
    await expect(service.remove('admin', 'admin')).rejects.toBeInstanceOf(NotFoundException);
    expect(userRepository.remove).not.toHaveBeenCalled();
  });
});

describe('email case-insensitive', () => {
  it('RegisterUserDto menormalkan email ke lowercase', () => {
    expect(plainToInstance(RegisterUserDto, { email: ' BUDI@x.com ' }).email).toBe('budi@x.com');
  });

  it('submit publik "BUDI@x.com" memakai ulang user "budi@x.com", tanpa baris baru', async () => {
    const stored = { id: 'existing', email: 'budi@x.com' };
    // findFirst meniru Prisma `mode: 'insensitive'` (Postgres): cocok tanpa peduli casing.
    const prisma = {
      user: {
        findFirst: jest.fn(({ where }: { where: { email: { equals: string } } }) =>
          Promise.resolve(where.email.equals.toLowerCase() === stored.email ? stored : null),
        ),
        create: jest.fn(),
      },
    };
    const repository = new UserRepository(prisma as never);
    const service = new UserService(repository as never, {} as never, {} as never, {} as never);

    const user = await service.findOrCreatePublicUser({ fullName: 'Budi', email: 'BUDI@x.com' });

    expect(user).toBe(stored);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'budi@x.com', mode: 'insensitive' } },
      }),
    );
  });
});
