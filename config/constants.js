/**
 * Shared constants for the copy-paste application
 * Consolidates all magic numbers and configuration values
 */

export const PASTE = {
  CODE_LENGTH: 4,
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  EXPIRATION_MS: 10 * 60 * 1000, // 10 minutes
  MAX_STORE_SIZE: 500, // Maximum number of active pastes
};

export const UI = {
  DEBOUNCE_DELAY: 1000, // 1 second
  FEEDBACK_DURATION: 2000, // 2 seconds
  TOAST_DURATION: 3000, // Default toast duration
  TOAST_DURATION_ERROR: 8000, // Error toast duration
  REFRESH_INTERVAL: 10000, // 10 seconds for list page refresh
  ITEMS_PER_PAGE: 50, // Items per page in list view
};

export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 300, // Max requests per IP per window
  CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
};

export const API = {
  TIMEOUT: 30000, // 30 seconds request timeout
};

// Allowed image MIME types
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Regex for validating image data URLs
export const IMAGE_DATA_URL_REGEX = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
