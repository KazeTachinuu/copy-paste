import { convex } from './convex.js';
import { api } from '../convex/_generated/api.js';
import { getClientId } from './clientId.js';

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
      clientId: getClientId(),
    });
    return result;
  } catch (error) {
    // Parse ConvexError data
    let errorData = null;
    try {
      const match = error.message?.match(/\{.*\}/);
      if (match) {
        errorData = JSON.parse(match[0]);
      }
    } catch {}

    // Handle rate limit errors
    if (errorData?.kind === 'RateLimited') {
      const err = new Error('Rate limited');
      err.status = 429;
      const retryMs = (errorData.retryAt || Date.now()) - Date.now();
      err.retryAfter = Math.max(0, Math.ceil(retryMs / 1000));
      throw err;
    }

    // Transform other Convex errors
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
    // Parse ConvexError data
    let errorData = null;
    try {
      const match = error.message?.match(/\{.*\}/);
      if (match) {
        errorData = JSON.parse(match[0]);
      }
    } catch {}

    // Handle rate limit errors
    if (errorData?.kind === 'RateLimited') {
      const err = new Error('Rate limited');
      err.status = 429;
      const retryMs = (errorData.retryAt || Date.now()) - Date.now();
      err.retryAfter = Math.max(0, Math.ceil(retryMs / 1000));
      throw err;
    }

    // Transform other Convex errors
    const err = new Error(error.message || 'Failed to get paste');
    err.status = error.message?.includes('not found') ? 404 : 500;
    throw err;
  }
}

/**
 * Subscribe to paste updates (reactive query)
 * @param {string} code
 * @param {Function} callback - Called with updated data (null if not found/expired)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToPaste(code, callback) {
  return convex.onUpdate(api.pastes.watchPaste, { code }, (data) => {
    callback(data);
  });
}
