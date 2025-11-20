import { UI } from '../config/constants.js';

/**
 * Display a toast notification
 * @param {string} message - Message to display
 * @param {'default'|'success'|'error'} type - Toast type for styling
 */
export function showToast(message, type = 'default') {
  let container = document.getElementById('toast-container');

  // Create container if it doesn't exist
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Use longer duration for errors
  const duration = type === 'error' ? UI.TOAST_DURATION_ERROR : UI.TOAST_DURATION;

  // Auto remove after duration
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, duration);
}

/**
 * Format a rate limit error message with retry time
 * @param {number|null} retryAfter - Seconds until retry is allowed
 * @returns {string} Formatted error message
 */
export function formatRateLimitMessage(retryAfter) {
  if (!retryAfter) return 'Rate limited. Please try again later.';

  const resetTime = new Date(Date.now() + retryAfter * 1000).toLocaleTimeString();
  const minutes = Math.floor(retryAfter / 60);
  const seconds = retryAfter % 60;
  const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return `Rate limited. Try again in ${duration} (at ${resetTime}).`;
}
