import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { NetworkEntity, networkSelect, mapNetwork } from './entities/network.entity';

@Injectable()
export class NetworkRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient | PrismaService {
    return tx ?? this.prisma;
  }

  async findById(id: string): Promise<NetworkEntity> {
    const network = await this.prisma.network.findUnique({ where: { id }, select: networkSelect });
    if (!network) throw new NotFoundException('Network not found');
    return mapNetwork(network);
  }

  async existsById(id: string): Promise<boolean> {
    const found = await this.prisma.network.findUnique({ where: { id }, select: { id: true } });
    return Boolean(found);
  }

  // `name` tidak unik → ambil row pertama. Dipakai approve event-submission (find-or-create).
  async findByNameInsensitive(name: string, tx?: Prisma.TransactionClient): Promise<NetworkEntity | null> {
    const network = await this.client(tx).network.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: networkSelect,
    });
    return network ? mapNetwork(network) : null;
  }

  async findMany(params: {
    where: Prisma.NetworkWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.NetworkOrderByWithRelationInput;
  }): Promise<{ items: NetworkEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.network.findMany({ ...params, select: networkSelect }),
      this.prisma.network.count({ where: params.where }),
    ]);
    return { items: items.map(mapNetwork), total };
  }

  async create(data: Prisma.NetworkCreateInput, tx?: Prisma.TransactionClient): Promise<NetworkEntity> {
    return mapNetwork(await this.client(tx).network.create({ data, select: networkSelect }));
  }

  async update(id: string, data: Prisma.NetworkUpdateInput): Promise<NetworkEntity> {
    const existing = await this.prisma.network.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Network not found');
    return mapNetwork(await this.prisma.network.update({ where: { id }, data, select: networkSelect }));
  }

  async remove(id: string): Promise<NetworkEntity> {
    const existing = await this.prisma.network.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Network not found');
    return mapNetwork(await this.prisma.network.delete({ where: { id }, select: networkSelect }));
  }
}
