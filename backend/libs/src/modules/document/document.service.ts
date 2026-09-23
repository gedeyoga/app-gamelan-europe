import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { StorageService } from '@app/libs/integrations/storage/storage.service';
import { DocumentRepository } from './document.repository';
import { DocumentEntity } from './entities/document.entity';

const ALLOWED_MIME = ['application/pdf'];
const GENERIC_MIME = ['', 'application/octet-stream'];
const PDF_MAGIC = '%PDF-';

// Kontrak publik response dokumen. `url` dihitung dari `key` + `S3_PUBLIC_BASE_URL`,
// bukan disimpan di DB. Tanpa `width`/`height`/`variants` (PDF).
export interface DocumentResponse {
  id: string;
  url: string;
  key: string;
  filename: string;
  mimeType: string | null;
  size: number | null;
}

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private invalid(message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field: 'file', message }],
    });
  }

  private toDocumentUrl(key: string): string {
    const base = this.config.getOrThrow<string>('S3_PUBLIC_BASE_URL').replace(/\/+$/, '');
    return `${base}/${key}`;
  }

  toDocumentResponse(document: DocumentEntity): DocumentResponse {
    return {
      id: document.id,
      url: this.toDocumentUrl(document.key),
      key: document.key,
      filename: document.filename,
      mimeType: document.mimeType,
      size: document.size,
    };
  }

  // Upload PDF: tanpa sharp, tanpa varian. Buffer di-put apa adanya.
  async upload(file: Express.Multer.File | undefined, entityType = 'archive'): Promise<DocumentResponse> {
    if (!file) throw this.invalid('file is required');

    const normalizedMime = GENERIC_MIME.includes(file.mimetype.toLowerCase())
      ? 'application/pdf'
      : file.mimetype;
    if (!ALLOWED_MIME.includes(normalizedMime)) throw this.invalid('unsupported mime type');

    const maxMb = Number(this.config.get('UPLOAD_DOCUMENT_MAX_SIZE_MB') ?? 10);
    if (file.size > maxMb * 1024 * 1024) throw this.invalid('file too large');

    if (file.buffer.subarray(0, 5).toString('latin1') !== PDF_MAGIC) {
      throw this.invalid('file is not a valid PDF');
    }

    const key = `documents/${randomUUID()}.pdf`;
    await this.storage.upload(key, file.buffer, normalizedMime);

    const document = await this.documentRepository.create({
      entityType,
      entityId: null,
      key,
      filename: file.originalname,
      mimeType: normalizedMime,
      size: file.size,
    });

    return this.toDocumentResponse(document);
  }
}
