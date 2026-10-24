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

  // Non-throwing lookup (validasi body trust boundary).
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

  // Inline-add state: name sama (case-insensitive) + countryId → kembalikan existing (bukan 409).
  // ponytail: custom row pakai id negatif (`Math.min(_min.id, 0) - 1`) supaya import dataset GeoDB
  // (id positif) tidak pernah tabrakan; kalau nanti butuh urutan id manual, tambah kolom
  // sequence/autoincrement khusus saat itu.
  async createIdempotent(data: {
    name: string;
    countryId: number;
    countryCode: string;
  }): Promise<StateEntity> {
    const existing = await this.prisma.state.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        countryId: data.countryId,
      },
      select: stateSelect,
    });
    if (existing) return existing;
    const { _min } = await this.prisma.state.aggregate({ _min: { id: true } });
    const id = Math.min(_min.id ?? 0, 0) - 1;
    try {
      return await this.prisma.state.create({ data: { ...data, id }, select: stateSelect });
    } catch (error) {
      // Dua inline-create paralel bisa menghitung id negatif yang sama → P2002 pada PK.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const { _min: recomputed } = await this.prisma.state.aggregate({ _min: { id: true } });
      return this.prisma.state.create({
        data: { ...data, id: Math.min(recomputed.id ?? 0, 0) - 1 },
        select: stateSelect,
      });
    }
  }
}
