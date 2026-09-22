import * as Joi from 'joi';

const internalBase = {
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  INTERNAL_API_SECRET: Joi.string().required(),
  API_PORT: Joi.number().required(),
  WORKER_PORT: Joi.number().required(),
};

// S3/upload. Kredensial S3 sengaja `optional` agar dev tanpa S3 tetap boot
// (StorageService lazy-init + guard saat upload). Isi di .env untuk upload nyata.
const storageBase = {
  S3_REGION: Joi.string().optional(),
  S3_BUCKET: Joi.string().optional(),
  S3_ACCESS_KEY_ID: Joi.string().optional(),
  S3_SECRET_ACCESS_KEY: Joi.string().optional(),
  S3_PUBLIC_BASE_URL: Joi.string().uri().optional(),
  S3_ENDPOINT: Joi.string().uri().optional(),
  UPLOAD_MAX_SIZE_MB: Joi.number().integer().min(1).default(5),
  IMAGE_WEBP_QUALITY: Joi.number().integer().min(1).max(100).default(82),
  IMAGE_LARGE_WIDTH: Joi.number().integer().min(1).default(1920),
  IMAGE_MEDIUM_WIDTH: Joi.number().integer().min(1).default(1024),
  IMAGE_THUMB_WIDTH: Joi.number().integer().min(1).default(1280),
  IMAGE_THUMB_HEIGHT: Joi.number().integer().min(1).default(720),
};

export const appEnvValidationSchema = Joi.object({
  ...internalBase,
  ...storageBase,
  CORS_ORIGINS: Joi.string().allow('').optional(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),
}).unknown(true);

export const workerEnvValidationSchema = Joi.object(internalBase).unknown(true);