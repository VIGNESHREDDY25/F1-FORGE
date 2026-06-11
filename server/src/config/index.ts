import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5001', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/f1forge',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5001/api/auth/google/callback',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  // Provider-agnostic AI config. Defaults to Groq (free, OpenAI-compatible).
  // The key lives ONLY in your server env (Render/Railway/VPS) — never committed to git.
  ai: {
    // 'groq' (default, free) | 'openai'
    provider: (process.env.AI_PROVIDER ||
      (process.env.GROQ_API_KEY ? 'groq' : process.env.OPENAI_API_KEY ? 'openai' : 'groq')).toLowerCase(),
    groqKey: process.env.GROQ_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    // Optional overrides; sensible per-provider defaults applied when blank.
    model: process.env.AI_MODEL || '',
    baseUrl: process.env.AI_BASE_URL || '',
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@f1forge.io',
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'f1forge-resumes',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  rapidApiKey: process.env.RAPIDAPI_KEY || '',
};
