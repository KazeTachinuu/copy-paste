import { convex } from './convex.js';
import { api } from '../convex/_generated/api.js';

/**
 * Create a new paste
 * @param {Object} data - { text, customCode }
 * @returns {Promise<Object>} - { code, text, expiresAt }
 */
export async function createPaste(data) {
  try {
    const result = await convex.mutation(api.pastes.createPaste, {
      text: data.text,
      customCode: data.customCode || undefined,
    });
    return result;
  } catch (error) {
    // Transform Convex errors to match old API format
    const err = new Error(error.message || 'Failed to create paste');
    err.status = 500;
    throw err;
  }
}

/**
 * Get a paste by code (one-time query)
 * @param {string} code
 * @returns {Promise<Object>} - { text, expiresAt }
 */
export async function getPaste(code) {
  try {
    const result = await convex.query(api.pastes.getPaste, { code });
    return result;
  } catch (error) {
    // Transform Convex errors to match old API format
    const err = new Error(error.message || 'Failed to get paste');
    err.status = error.message.includes('not found') ? 404 : 500;
    throw err;
  }
}

/**
 * Subscribe to paste updates (reactive query)
 * @param {string} code
 * @param {Function} callback - Called with updated data
 * @returns {Function} Unsubscribe function
 */
export function subscribeToPaste(code, callback) {
  const unsubscribe = convex.watchQuery(api.pastes.getPaste, { code }, {
    onUpdate: (result) => {
      if (result.type === 'success') {
        callback(result.value);
      } else if (result.type === 'error') {
        callback(null, result.error);
      }
    },
  });

  return unsubscribe;
}
