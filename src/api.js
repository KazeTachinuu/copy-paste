const API_URL = 'http://localhost:3000/api';

/**
 * Create a new paste
 * @param {Object} data - { text, image }
 * @returns {Promise<Object>} - { code, expiresAt }
 */
export async function createPaste(data) {
    const response = await fetch(`${API_URL}/paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const error = new Error(result.error || 'Failed to create paste');
            error.status = response.status;
            error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : null;
            throw error;
        }
        const error = new Error(result.error || 'Failed to create paste');
        error.status = response.status;
        throw error;
    }

    return result;
}

/**
 * Get a paste by code
 * @param {string} code
 * @returns {Promise<Object>} - { text, image }
 */
export async function getPaste(code) {
    const response = await fetch(`${API_URL}/paste/${code}`);
    const result = await response.json();

    if (!response.ok) {
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const error = new Error(result.error || 'Failed to get paste');
            error.status = response.status;
            error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : null;
            throw error;
        }
        const error = new Error(result.error || 'Failed to get paste');
        error.status = response.status;
        throw error;
    }

    return result;
}

/**
 * List all active pastes
 * @returns {Promise<Object>} - { count, pastes: [] }
 */
export async function listPastes() {
    const response = await fetch(`${API_URL}/list`);

    if (!response.ok) {
        // Handle rate limiting specifically if needed, or just throw generic error
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const error = new Error('Rate limited');
            error.status = 429;
            error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : null;
            throw error;
        }
        const error = new Error(`API error: ${response.status}`);
        error.status = response.status;
        throw error;
    }

    const result = await response.json();
    return result;
}
