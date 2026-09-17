import * as Joi from 'joi';

const internalBase = {
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  INTERNAL_API_SECRET: Joi.string().required(),
  API_PORT: Joi.number().required(),
  WORKER_PORT: Joi.number().required(),
};

export const appEnvValidationSchema = Joi.object({
  ...internalBase,
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),
}).unknown(true);

export const workerEnvValidationSchema = Joi.object(internalBase).unknown(true);