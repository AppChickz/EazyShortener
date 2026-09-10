export type NodeEnvironment = 'development' | 'test' | 'production';

export interface RuntimeEnvironment {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  APP_BASE_URL: string;
  LOG_LEVEL: string;
  TRUST_PROXY: boolean;
  CORS_ORIGINS: string;
  BODY_LIMIT_BYTES: number;
  APP_SECRET: string;
  DATABASE_URL: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_COOKIE_NAME: string;
  EMAIL_VERIFICATION_TTL_SECONDS: number;
  VERIFICATION_RESEND_COOLDOWN_SECONDS: number;
  VERIFICATION_RESEND_MAX_PER_HOUR: number;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  MAIL_FROM: string;
  API_TOKEN_PREFIX: string;
  API_TOKEN_BYTES: number;
  INITIAL_API_TOKEN_TTL_DAYS: number;
  API_MAX_URLS_PER_REQUEST: number;
  SHORT_CODE_LENGTH: number;
  SHORT_CODE_MAX_RETRIES: number;
  REDIS_URL: string;
  REDIRECT_CACHE_MAX_TTL_SECONDS: number;
  GUEST_RATE_LIMIT_WINDOW_SECONDS: number;
  GUEST_RATE_LIMIT_MAX_REQUESTS: number;
  AUTH_RATE_LIMIT_WINDOW_SECONDS: number;
  AUTH_RATE_LIMIT_MAX_REQUESTS: number;
  API_RATE_LIMIT_WINDOW_SECONDS: number;
  API_RATE_LIMIT_MAX_REQUESTS: number;
  ANALYTICS_RETENTION_DAYS: number;
}

function stringValue(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new Error('Environment variable values must be strings, numbers, or booleans');
}

function required(config: Record<string, unknown>, key: string): string {
  const value = stringValue(config[key]).trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(config: Record<string, unknown>, key: string, fallback = ''): string {
  return stringValue(config[key], fallback).trim();
}

function integer(config: Record<string, unknown>, key: string, fallback: number): number {
  const raw = optional(config, key, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Environment variable ${key} must be a non-negative integer`);
  }
  return value;
}

function booleanValue(config: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const raw = optional(config, key, String(fallback)).toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`Environment variable ${key} must be true or false`);
}

function url(config: Record<string, unknown>, key: string): string {
  const value = required(config, key);
  try {
    new URL(value);
  } catch {
    throw new Error(`Environment variable ${key} must be a valid URL`);
  }
  return value;
}

export function validateEnvironment(config: Record<string, unknown>): RuntimeEnvironment {
  const nodeEnv = optional(config, 'NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const appSecret = required(config, 'APP_SECRET');
  if (Buffer.byteLength(appSecret, 'utf8') < 32) {
    throw new Error('APP_SECRET must be at least 32 bytes');
  }

  if (nodeEnv === 'production') {
    for (const key of ['APP_BASE_URL', 'DATABASE_URL', 'SMTP_HOST', 'MAIL_FROM', 'REDIS_URL']) {
      required(config, key);
    }
  }

  return {
    NODE_ENV: nodeEnv as NodeEnvironment,
    PORT: integer(config, 'PORT', 3000),
    APP_BASE_URL: url(config, 'APP_BASE_URL'),
    LOG_LEVEL: optional(config, 'LOG_LEVEL', 'info'),
    TRUST_PROXY: booleanValue(config, 'TRUST_PROXY', false),
    CORS_ORIGINS: optional(config, 'CORS_ORIGINS'),
    BODY_LIMIT_BYTES: integer(config, 'BODY_LIMIT_BYTES', 1_048_576),
    APP_SECRET: appSecret,
    DATABASE_URL: required(config, 'DATABASE_URL'),
    POSTGRES_USER: required(config, 'POSTGRES_USER'),
    POSTGRES_PASSWORD: required(config, 'POSTGRES_PASSWORD'),
    POSTGRES_DB: required(config, 'POSTGRES_DB'),
    JWT_ACCESS_TTL_SECONDS: integer(config, 'JWT_ACCESS_TTL_SECONDS', 3600),
    JWT_COOKIE_NAME: required(config, 'JWT_COOKIE_NAME'),
    EMAIL_VERIFICATION_TTL_SECONDS: integer(config, 'EMAIL_VERIFICATION_TTL_SECONDS', 86400),
    VERIFICATION_RESEND_COOLDOWN_SECONDS: integer(config, 'VERIFICATION_RESEND_COOLDOWN_SECONDS', 60),
    VERIFICATION_RESEND_MAX_PER_HOUR: integer(config, 'VERIFICATION_RESEND_MAX_PER_HOUR', 5),
    SMTP_HOST: required(config, 'SMTP_HOST'),
    SMTP_PORT: integer(config, 'SMTP_PORT', 1125),
    SMTP_SECURE: booleanValue(config, 'SMTP_SECURE', false),
    SMTP_USER: optional(config, 'SMTP_USER'),
    SMTP_PASSWORD: optional(config, 'SMTP_PASSWORD'),
    MAIL_FROM: required(config, 'MAIL_FROM'),
    API_TOKEN_PREFIX: required(config, 'API_TOKEN_PREFIX'),
    API_TOKEN_BYTES: integer(config, 'API_TOKEN_BYTES', 32),
    INITIAL_API_TOKEN_TTL_DAYS: integer(config, 'INITIAL_API_TOKEN_TTL_DAYS', 30),
    API_MAX_URLS_PER_REQUEST: integer(config, 'API_MAX_URLS_PER_REQUEST', 10),
    SHORT_CODE_LENGTH: integer(config, 'SHORT_CODE_LENGTH', 7),
    SHORT_CODE_MAX_RETRIES: integer(config, 'SHORT_CODE_MAX_RETRIES', 5),
    REDIS_URL: url(config, 'REDIS_URL'),
    REDIRECT_CACHE_MAX_TTL_SECONDS: integer(config, 'REDIRECT_CACHE_MAX_TTL_SECONDS', 3600),
    GUEST_RATE_LIMIT_WINDOW_SECONDS: integer(config, 'GUEST_RATE_LIMIT_WINDOW_SECONDS', 3600),
    GUEST_RATE_LIMIT_MAX_REQUESTS: integer(config, 'GUEST_RATE_LIMIT_MAX_REQUESTS', 30),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: integer(config, 'AUTH_RATE_LIMIT_WINDOW_SECONDS', 900),
    AUTH_RATE_LIMIT_MAX_REQUESTS: integer(config, 'AUTH_RATE_LIMIT_MAX_REQUESTS', 10),
    API_RATE_LIMIT_WINDOW_SECONDS: integer(config, 'API_RATE_LIMIT_WINDOW_SECONDS', 60),
    API_RATE_LIMIT_MAX_REQUESTS: integer(config, 'API_RATE_LIMIT_MAX_REQUESTS', 30),
    ANALYTICS_RETENTION_DAYS: integer(config, 'ANALYTICS_RETENTION_DAYS', 90),
  };
}
