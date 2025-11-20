/**
 * Client ID management for rate limiting
 * Generates and persists a unique anonymous ID per browser
 * Note: This is for client-side UX only. Server must enforce real rate limits.
 */

const CLIENT_ID_KEY = 'copy-paste-client-id';
let memoryClientId = null;

/**
 * Generate a cryptographically secure client ID
 * @returns {string} UUID v4
 */
function generateClientId() {
  try {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback for older browsers or insecure contexts
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get or create a persistent client ID for this browser
 * @returns {string} Client ID
 */
export function getClientId() {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored) return stored;
  } catch (e) {
    // localStorage unavailable (private mode, disabled, etc.)
  }

  if (!memoryClientId) {
    memoryClientId = generateClientId();
    try {
      localStorage.setItem(CLIENT_ID_KEY, memoryClientId);
    } catch (e) {
      // Can't persist, but that's OK - will use memory for this session
    }
  }

  return memoryClientId;
}
