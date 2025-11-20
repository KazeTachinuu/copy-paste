const STORAGE_KEY = 'copy-paste-interactions';
const MAX_STORED_CODES = 100;

/**
 * Get all stored pastes (including expired)
 * @returns {Array<{code: string, expiresAt: number}>}
 */
function getAllStoredPastes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read stored pastes:', error);
    return [];
  }
}

/**
 * Clean up expired pastes from localStorage
 * @returns {number} Number of expired pastes removed
 */
export function cleanupExpiredPastes() {
  try {
    const now = Date.now();
    let pastes = getAllStoredPastes();
    const initialLength = pastes.length;

    // Filter out expired pastes
    pastes = pastes.filter(p => p.expiresAt > now);

    const removedCount = initialLength - pastes.length;

    if (removedCount > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pastes));
    }

    return removedCount;
  } catch (error) {
    console.error('Failed to cleanup expired pastes:', error);
    return 0;
  }
}

/**
 * Get active (non-expired) pastes with metadata
 * @returns {Array<{code: string, expiresAt: number, expiresIn: number, createdAt: number|null}>}
 */
export function getActivePastes() {
  // Cleanup expired pastes first
  cleanupExpiredPastes();

  const now = Date.now();
  return getAllStoredPastes()
    .filter(p => p.expiresAt > now)
    .map(p => ({
      code: p.code,
      expiresAt: p.expiresAt,
      expiresIn: Math.max(0, Math.floor((p.expiresAt - now) / 1000)),
      createdAt: p.createdAt || null
    }));
}

/**
 * Add paste with expiration timestamp
 * @param {string} code
 * @param {number} expiresAt - Unix timestamp in milliseconds
 * @param {number} createdAt - Unix timestamp in milliseconds
 */
export function trackInteraction(code, expiresAt, createdAt) {
  if (!code || typeof code !== 'string') return;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt < 0) return;
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt < 0) return;

  try {
    let pastes = getAllStoredPastes();
    pastes = pastes.filter(p => p.code !== code);
    pastes.unshift({ code, expiresAt, createdAt });
    const trimmed = pastes.slice(0, MAX_STORED_CODES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to track interaction:', error);
  }
}

/**
 * Delete a specific paste from storage
 * @param {string} code - The paste code to delete
 * @returns {boolean} True if deleted, false if not found
 */
export function deletePaste(code) {
  if (!code || typeof code !== 'string') return false;

  try {
    let pastes = getAllStoredPastes();
    const initialLength = pastes.length;
    pastes = pastes.filter(p => p.code !== code);

    if (pastes.length === initialLength) {
      return false; // Code not found
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pastes));
    return true;
  } catch (error) {
    console.error('Failed to delete paste:', error);
    return false;
  }
}

