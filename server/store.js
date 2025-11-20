import { PASTE } from '../config/constants.js';

const store = new Map();

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
 * @returns {{code: string, expiresAt: number}} Generated code and expiration timestamp
 */
export function createPaste(data) {
  let code;
  let attempts = 0;

  do {
    code = generateCode(PASTE.CODE_LENGTH);
    attempts++;
  } while (store.has(code) && attempts < 100);

  if (store.has(code)) {
    throw new Error('Failed to generate unique code. Storage full?');
  }

  if (store.size >= PASTE.MAX_STORE_SIZE) {
    const oldestKey = store.keys().next().value;
    store.delete(oldestKey);
  }

  const paste = {
    text: data.text || '',
    image: data.image || null,
    createdAt: Date.now(),
    expiresAt: Date.now() + PASTE.EXPIRATION_MS
  };

  store.set(code, paste);

  setTimeout(() => {
    const current = store.get(code);
    if (current && current.createdAt === paste.createdAt) {
      store.delete(code);
    }
  }, PASTE.EXPIRATION_MS);

  return { code, expiresAt: paste.expiresAt };
}

/**
 * Retrieve a paste by code
 * @param {string} code - The paste code
 * @returns {Object|null} Paste object or null if not found/expired
 */
export function getPaste(code) {
  const paste = store.get(code);

  if (!paste) {
    return null;
  }

  if (Date.now() > paste.expiresAt) {
    store.delete(code);
    return null;
  }

  return paste;
}
