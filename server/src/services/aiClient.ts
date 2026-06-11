import OpenAI from 'openai';
import { config } from '../config';

/**
 * Provider-agnostic AI client.
 *
 * Defaults to Groq — a FREE, OpenAI-compatible inference API (Llama 3.3 70B).
 * Because Groq speaks the OpenAI wire protocol, the entire codebase keeps using
 * the `openai` SDK unchanged; we just swap the `baseURL` + `model`.
 *
 * Deployment note: set GROQ_API_KEY in your host's environment variables
 * (Render / Railway / Fly / VPS). It is NEVER committed to git — `.env` is
 * gitignored — so the public GitHub repo stays key-free while the deployed app
 * runs real AI. If no key is present at all, callers gracefully fall back to the
 * curated answer bank.
 */

type Provider = 'groq' | 'openai';

const PRESETS: Record<Provider, { baseURL?: string; defaultModel: string }> = {
  groq: { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  openai: { baseURL: undefined, defaultModel: 'gpt-4o-mini' },
};

const provider: Provider = config.ai.provider === 'openai' ? 'openai' : 'groq';

const rawKey = provider === 'openai' ? config.ai.openaiKey : config.ai.groqKey;
const PLACEHOLDERS = ['', 'your_openai_api_key', 'your_groq_api_key', 'sk-...', 'gsk_...'];

export const aiProvider = provider;
export const hasAI = !!rawKey && !PLACEHOLDERS.includes(rawKey.trim());
export const AI_MODEL = config.ai.model || PRESETS[provider].defaultModel;

export const aiClient = hasAI
  ? new OpenAI({
      apiKey: rawKey,
      baseURL: config.ai.baseUrl || PRESETS[provider].baseURL,
    })
  : null;

export const aiStatus = () => ({
  enabled: hasAI,
  provider: hasAI ? provider : 'fallback',
  model: hasAI ? AI_MODEL : null,
});
