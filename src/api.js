import { API } from '../config/constants.js';

// Use environment variable with fallback to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Create fetch request with timeout
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = API.TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server not responding');
    }
    throw error;
  }
}

/**
 * Handle API response and extract errors
 * @param {Response} response - Fetch response object
 * @param {string} defaultMessage - Default error message
 * @returns {Promise<Object>} Parsed JSON result
 */
async function handleResponse(response, defaultMessage = 'Request failed') {
  if (!response.ok) {
    let errorMessage = defaultMessage;

    // Try to parse JSON error response
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        errorMessage = result.error || result.details || defaultMessage;
      } else {
        // Non-JSON response, try to get text
        const text = await response.text();
        if (text) {
          errorMessage = text.substring(0, 200); // Limit error message length
        }
      }
    } catch (parseError) {
      // Failed to parse error response, use default message
      console.warn('Failed to parse error response:', parseError);
    }

    const error = new Error(errorMessage);
    error.status = response.status;

    if (response.status === 429) {
      const parsed = parseInt(response.headers.get('Retry-After'), 10);
      error.retryAfter = !isNaN(parsed) ? parsed : null;
    }

    throw error;
  }

  // Parse successful response
  return await response.json();
}

/**
 * Create a new paste
 * @param {Object} data - { text, image }
 * @returns {Promise<Object>} - { code, expiresAt }
 */
export async function createPaste(data) {
  const response = await fetchWithTimeout(`${API_URL}/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  return handleResponse(response, 'Failed to create paste');
}

/**
 * Get a paste by code
 * @param {string} code
 * @returns {Promise<Object>} - { text, image }
 */
export async function getPaste(code) {
  const response = await fetchWithTimeout(`${API_URL}/paste/${code}`);
  return handleResponse(response, 'Failed to get paste');
}
