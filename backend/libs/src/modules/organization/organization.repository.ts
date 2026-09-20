import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { OrganizationEntity, organizationSelect, mapOrganization } from './entities/organization.entity';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrganizationEntity> {
    const organization = await this.prisma.organization.findUnique({ where: { id }, select: organizationSelect });
    if (!organization) throw new NotFoundException('Organization not found');
    return mapOrganization(organization);
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

  async create(data: Prisma.OrganizationCreateInput): Promise<OrganizationEntity> {
    return mapOrganization(await this.prisma.organization.create({ data, select: organizationSelect }));
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
