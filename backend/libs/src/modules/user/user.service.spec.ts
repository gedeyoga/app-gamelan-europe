import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';

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
