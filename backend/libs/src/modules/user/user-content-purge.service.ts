import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ArchiveRepository } from '@app/libs/modules/archive/archive.repository';
import { ArchiveService } from '@app/libs/modules/archive/archive.service';
import { EventRepository } from '@app/libs/modules/event/event.repository';
import { EventService } from '@app/libs/modules/event/event.service';
import { PostRepository } from '@app/libs/modules/post/post.repository';
import { PostService } from '@app/libs/modules/post/post.service';
import { UserService } from './user.service';
import { UserEntity } from './entities/user.entity';

// Orkestrasi delete user (+ opsional cascade konten yang dia author).
// Modul ini meng-import Post/Event/Archive/User; arah dependensi satu arah
// (UserModule tidak meng-import modul ini) → tidak ada cycle.
@Injectable()
export class UserContentPurgeService {
  private readonly logger = new Logger(UserContentPurgeService.name);

  constructor(
    private readonly userService: UserService,
    private readonly postRepository: PostRepository,
    private readonly eventRepository: EventRepository,
    private readonly archiveRepository: ArchiveRepository,
    private readonly postService: PostService,
    private readonly eventService: EventService,
    private readonly archiveService: ArchiveService,
  ) {}

  // Urutan penting: resolve user (404 dulu) → purge konten → hapus user.
  // Bila salah satu delete konten gagal, user TIDAK dihapus → operasi bisa di-retry.
  // Konten yang hanya `createdBy` user (bukan author) TIDAK dihapus (FK onDelete: SetNull).
  async remove(id: string, userId: string, cascadeContent = false): Promise<UserEntity> {
    // Self-delete ditolak SEBELUM purge apa pun — kalau tidak, konten sudah terhapus lalu delete user
    // gagal 403 → partial delete yang tidak bisa di-retry. Guard kedua ada di `UserService.remove`.
    if (id === userId) throw new ForbiddenException('Cannot delete your own account');

    if (!cascadeContent) return this.userService.remove(id, userId);

    await this.userService.findOne(id, userId); // 404 + gerbang admin `admin:access`

    const postIds = await this.postRepository.findIdsByAuthorId(id);
    const eventIds = await this.eventRepository.findIdsByAuthorId(id);
    const archiveIds = await this.archiveRepository.findIdsByAuthorId(id);

    // Bypass scope konten (`skipScopeCheck`) SENGAJA: operasi ini sudah diotorisasi `user:delete` +
    // `admin:access` (`assertAdmin` dijalankan sebelum purge). Scope tulis konten yang lebih sempit
    // (`own`/`network`/`published`) akan membuat operasi destruktif ini berhenti separuh jalan —
    // tidak ada rollback lintas service untuk DB/S3, dan retry akan 403 lagi (tidak konvergen).
    // Sequential + fail-fast: error pertama membatalkan sisa (storage eksternal, bukan transaksi DB).
    for (const postId of postIds) {
      await this.postService.remove(postId, userId, { skipScopeCheck: true });
    }
    for (const eventId of eventIds) {
      await this.eventService.remove(eventId, userId, { skipScopeCheck: true });
    }
    for (const archiveId of archiveIds) {
      await this.archiveService.remove(archiveId, userId, { skipScopeCheck: true });
    }
    this.logger.log(
      `cascadeContent user ${id}: purged ${postIds.length} post(s), ${eventIds.length} event(s), ${archiveIds.length} archive(s)`,
    );

    return this.userService.remove(id, userId);
  }
}
