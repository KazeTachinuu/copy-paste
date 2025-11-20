import { kv } from '@vercel/kv';
import { PASTE } from '../config/constants.js';

/**
 * Generate a random numeric code of specified length
 * @param {number} length - Length of the code to generate
 * @returns {string} Random numeric code
 */
function generateCode(length) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

/**
 * Create a new paste and return the code
 * @param {Object} data - Paste data containing text and/or image
 * @param {string} [data.text] - Text content
 * @param {string} [data.image] - Base64 encoded image
 * @returns {Promise<{code: string, expiresAt: number}>} Generated code and expiration timestamp
 */
export async function createPaste(data) {
  let code;
  let attempts = 0;
  const maxAttempts = 100;

  // Generate unique code
  do {
    code = generateCode(PASTE.CODE_LENGTH);
    const exists = await kv.exists(code);
    if (!exists) break;
    attempts++;
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique code after 100 attempts');
  }

  const expiresAt = Date.now() + PASTE.EXPIRATION_MS;
  const paste = {
    text: data.text || '',
    image: data.image || null,
    createdAt: Date.now(),
    expiresAt
  };

  // Store in Redis with TTL (Time To Live) in seconds
  const ttlSeconds = Math.ceil(PASTE.EXPIRATION_MS / 1000);
  await kv.set(code, JSON.stringify(paste), { ex: ttlSeconds });

  return { code, expiresAt };
}

/**
 * Retrieve a paste by code
 * @param {string} code - The paste code
 * @returns {Promise<Object|null>} Paste object or null if not found/expired
 */
export async function getPaste(code) {
  const data = await kv.get(code);

  if (!data) {
    return null;
  }

  try {
    const paste = typeof data === 'string' ? JSON.parse(data) : data;

    // Double-check expiration (Redis TTL should handle this, but be safe)
    if (paste.expiresAt && Date.now() > paste.expiresAt) {
      await kv.del(code);
      return null;
    }

    return paste;
  } catch (error) {
    console.error('Error parsing paste data:', error);
    return null;
  }
}
