const TOAST_DURATION = 3000; // 3 seconds
const TOAST_DURATION_ERROR = 8000; // 8 seconds for errors - longer to read

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
    const duration = type === 'error' ? TOAST_DURATION_ERROR : TOAST_DURATION;

    // Auto remove after duration
    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, duration);
}
