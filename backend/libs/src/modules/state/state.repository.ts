import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { stateSelect, stateWithCountrySelect, StateEntity, StateWithCountryEntity } from './entities/state.entity';

@Injectable()
export class StateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<StateWithCountryEntity> {
    const state = await this.prisma.state.findUnique({ where: { id }, select: stateWithCountrySelect });
    if (!state) throw new NotFoundException('State not found');
    return state;
  }

  // Non-throwing lookup (validasi body trust boundary, mis. event-submission).
  async findByIdOrNull(id: number): Promise<StateWithCountryEntity | null> {
    return this.prisma.state.findUnique({ where: { id }, select: stateWithCountrySelect });
  }

  async findMany(params: {
    where: Prisma.StateWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.StateOrderByWithRelationInput;
  }): Promise<{ items: StateEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.state.findMany({ ...params, select: stateSelect }),
      this.prisma.state.count({ where: params.where }),
    ]);
    return { items, total };
  }
}
