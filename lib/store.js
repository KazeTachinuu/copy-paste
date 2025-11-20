import { kv } from '@vercel/kv';
import { PASTE } from '../config/constants.js';

function generateCode(length) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

export async function createPaste(data) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error('Vercel KV not configured');
  }

  let code, attempts = 0;
  const maxAttempts = 100;

  // Generate unique code (negligible race condition risk with 10k codes + 10min TTL)
  do {
    code = generateCode(PASTE.CODE_LENGTH);
    if (!await kv.exists(code)) break;
    attempts++;
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique code');
  }

  const expiresAt = Date.now() + PASTE.EXPIRATION_MS;
  const paste = {
    text: data.text || '',
    image: data.image || null,
    createdAt: Date.now(),
    expiresAt
  };

  const ttlSeconds = Math.ceil(PASTE.EXPIRATION_MS / 1000);
  await kv.set(code, JSON.stringify(paste), { ex: ttlSeconds });

  return { code, expiresAt };
}

export async function getPaste(code) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error('Vercel KV not configured');
  }

  const data = await kv.get(code);
  if (!data) return null;

  const paste = typeof data === 'string' ? JSON.parse(data) : data;

  if (paste.expiresAt && Date.now() > paste.expiresAt) {
    await kv.del(code);
    return null;
  }

  return paste;
}
