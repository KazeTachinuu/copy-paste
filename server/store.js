// In-memory storage
const store = new Map();

// Configuration Constants
const CODE_LENGTH = 4;
const EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SIZE = 500; // Maximum number of active pastes

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

  // Ensure uniqueness (simple retry logic)
  do {
    code = generateCode(CODE_LENGTH);
    attempts++;
  } while (store.has(code) && attempts < 100);

  if (store.has(code)) {
    throw new Error('Failed to generate unique code. Storage full?');
  }

  // Capacity check: Evict oldest if full
  if (store.size >= MAX_SIZE) {
    const oldestKey = store.keys().next().value;
    store.delete(oldestKey);
  }

  const paste = {
    text: data.text || '',
    image: data.image || null,
    createdAt: Date.now(),
    expiresAt: Date.now() + EXPIRATION_MS
  };

  store.set(code, paste);

  // Set timeout to auto-delete
  setTimeout(() => {
    const current = store.get(code);
    if (current && current.createdAt === paste.createdAt) {
      store.delete(code);
    }
  }, EXPIRATION_MS);

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

/**
 * List all active paste codes with metadata
 * @returns {Array} Array of paste metadata objects
 */
export function listPastes() {
  const now = Date.now();
  const activePastes = [];

  for (const [code, paste] of store.entries()) {
    // Skip expired pastes
    if (now > paste.expiresAt) {
      continue;
    }

    activePastes.push({
      code,
      hasText: !!paste.text,
      hasImage: !!paste.image,
      expiresAt: paste.expiresAt,
      expiresIn: Math.max(0, Math.floor((paste.expiresAt - now) / 1000)) // seconds remaining
    });
  }

  return activePastes;
}


