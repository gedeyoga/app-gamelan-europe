import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { OrganizationEntity, organizationSelect, mapOrganization } from './entities/organization.entity';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient | PrismaService {
    return tx ?? this.prisma;
  }

  async findById(id: string): Promise<OrganizationEntity> {
    const organization = await this.prisma.organization.findUnique({ where: { id }, select: organizationSelect });
    if (!organization) throw new NotFoundException('Organization not found');
    return mapOrganization(organization);
  }

  async existsById(id: string): Promise<boolean> {
    const found = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    return Boolean(found);
  }

  // `name` tidak unik → ambil row pertama. Dipakai approve event-submission (find-or-create).
  async findByNameInsensitive(name: string, tx?: Prisma.TransactionClient): Promise<OrganizationEntity | null> {
    const organization = await this.client(tx).organization.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: organizationSelect,
    });
    return organization ? mapOrganization(organization) : null;
  }

  async findMany(params: {
    where: Prisma.OrganizationWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.OrganizationOrderByWithRelationInput;
  }): Promise<{ items: OrganizationEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({ ...params, select: organizationSelect }),
      this.prisma.organization.count({ where: params.where }),
    ]);
    return { items: items.map(mapOrganization), total };
  }

  async create(data: Prisma.OrganizationCreateInput, tx?: Prisma.TransactionClient): Promise<OrganizationEntity> {
    return mapOrganization(await this.client(tx).organization.create({ data, select: organizationSelect }));
  }

  async update(id: string, data: Prisma.OrganizationUpdateInput): Promise<OrganizationEntity> {
    const existing = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Organization not found');
    return mapOrganization(await this.prisma.organization.update({ where: { id }, data, select: organizationSelect }));
  }

  async remove(id: string): Promise<OrganizationEntity> {
    const existing = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Organization not found');
    return mapOrganization(await this.prisma.organization.delete({ where: { id }, select: organizationSelect }));
  }
}
