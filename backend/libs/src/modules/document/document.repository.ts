import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { documentSelect, DocumentEntity } from './entities/document.entity';

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient | PrismaService {
    return tx ?? this.prisma;
  }

  async create(data: Prisma.DocumentUncheckedCreateInput): Promise<DocumentEntity> {
    return this.prisma.document.create({ data, select: documentSelect });
  }

  async findByIds(ids: string[], tx?: Prisma.TransactionClient): Promise<DocumentEntity[]> {
    if (ids.length === 0) return [];
    return this.client(tx).document.findMany({ where: { id: { in: ids } }, select: documentSelect });
  }

  async findByEntity(entityType: string, entityId: string): Promise<DocumentEntity[]> {
    return this.prisma.document.findMany({
      where: { entityType, entityId },
      select: documentSelect,
    });
  }

  async deleteByEntity(
    entityType: string,
    entityId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.client(tx).document.deleteMany({ where: { entityType, entityId } });
  }

  // Bind: hanya row dengan `entityId=null` ATAU sudah milik entity ini (jangan bajak milik entity lain).
  async bind(
    ids: string[],
    entityType: string,
    entityId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (ids.length === 0) return;
    await this.client(tx).document.updateMany({
      where: {
        id: { in: ids },
        entityType,
        OR: [{ entityId: null }, { entityId }],
      },
      data: { entityId },
    });
  }

  // Unbind: lepas hanya row milik entity ini (entityId → null).
  async unbind(
    ids: string[],
    entityType: string,
    entityId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (ids.length === 0) return;
    await this.client(tx).document.updateMany({
      where: { id: { in: ids }, entityType, entityId },
      data: { entityId: null },
    });
  }

  // Pindahkan ownership baris dokumen yang belum ter-bind dari satu `entityType` ke `entityType` lain.
  // Dipakai approve archive-submission: attachment ber-`entityType='archive-submission'`/`entityId=null`
  // dipindah menjadi `entityType='archive'` (entityId tetap null) agar `bind()` berikutnya menyukseskan.
  async reassignEntityType(
    ids: string[],
    fromEntityType: string,
    toEntityType: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (ids.length === 0) return;
    await this.client(tx).document.updateMany({
      where: { id: { in: ids }, entityType: fromEntityType, entityId: null },
      data: { entityType: toEntityType },
    });
  }
}
