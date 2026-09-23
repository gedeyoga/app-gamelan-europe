import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client?: S3Client;
  private bucketEnsured?: Promise<void>;

  constructor(private readonly config: ConfigService) {}

  // Detail error untuk diagnosa; jangan pernah dipakai sebagai response body.
  private describeError(error: unknown): string {
    const e = error as {
      name?: string;
      message?: string;
      $metadata?: { httpStatusCode?: number };
    };
    const status = e?.$metadata?.httpStatusCode;
    const name = e?.name ?? 'Error';
    const message = e?.message ?? String(error);
    return status ? `${name}: ${message} (HTTP ${status})` : `${name}: ${message}`;
  }

  // Lazy-init: S3Client tidak dibuat saat boot agar dev tanpa env S3 tidak crash.
  private getClient(): { client: S3Client; bucket: string } {
    const region = this.config.get<string>('S3_REGION');
    const bucket = this.config.get<string>('S3_BUCKET');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new BadGatewayException('Storage is not configured');
    }

    let client = this.client;
    if (!client) {
      const endpoint = this.config.get<string>('S3_ENDPOINT');
      // forcePathStyle hanya aktif bila S3_ENDPOINT diisi. MinIO (port API 9000)
      // WAJIB mengisi S3_ENDPOINT, jika kosong SDK memakai virtual-hosted style
      // dan request MinIO akan gagal/mengarah ke DNS yang salah.
      client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
        endpoint: endpoint || undefined,
        forcePathStyle: Boolean(endpoint),
      });
      this.client = client;
      // Sekali saja per instance; aman dipanggil ulang karena flag ini.
      this.bucketEnsured = this.ensureBucket(client, bucket);
    }
    return { client, bucket };
  }

  // Lazy: pastikan bucket ada. Error ditelan + di-log supaya boot tidak crash.
  private async ensureBucket(client: S3Client, bucket: string): Promise<void> {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error: unknown) {
      const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      const missing =
        e?.name === 'NotFound' || e?.name === 'NoSuchBucket' || e?.$metadata?.httpStatusCode === 404;
      if (!missing) {
        this.logger.error(`S3 head bucket failed: ${bucket}`, this.describeError(error));
        return;
      }
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        this.logger.log(`Created missing S3 bucket: ${bucket}`);
      } catch (createError: unknown) {
        this.logger.error(`S3 create bucket failed: ${bucket}`, this.describeError(createError));
      }
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.getClient();
    try {
      await this.bucketEnsured;
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    } catch (error: unknown) {
      // Log detail asli untuk diagnosa; response tetap generik (jangan bocorkan kredensial/endpoint).
      this.logger.error(`S3 put failed: ${key}`, this.describeError(error));
      throw new BadGatewayException('Failed to upload file');
    }
  }

  // Best-effort: pemanggil menangkap + log bila gagal (jangan gagalkan response).
  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const { client, bucket } = this.getClient();
    try {
      await this.bucketEnsured;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
    } catch (error: unknown) {
      this.logger.error(`S3 delete failed: ${keys.length} object(s)`, this.describeError(error));
      throw error;
    }
  }
}
