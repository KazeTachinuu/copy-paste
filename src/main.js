import './shared.css';
import './style.css';
import { createIcons, Copy, ArrowRight, Sun, Moon, List } from 'lucide';
import { createPaste, getPaste, subscribeToPaste } from './api.js';
import { showToast, formatRateLimitMessage } from './ui.js';
import { PASTE, UI } from '../config/constants.js';
import { initThemeToggle } from './theme.js';
import { trackInteraction, cleanupExpiredPastes } from './storage.js';

// DOM Elements
const mainTextarea = document.getElementById('main-textarea');
const codeDisplayArea = document.getElementById('code-display-area');
const generatedCodeSpan = document.getElementById('generated-code');
const subtleCodeDisplay = document.getElementById('subtle-code-display');
const subtleCodeSpan = document.getElementById('subtle-code');
const copyCodeBtn = document.getElementById('copy-code-btn');
const codeInput = document.getElementById('code-input');
const getTextBtn = document.getElementById('get-text-btn');
const copyTextBtn = document.getElementById('copy-text-btn');
const modeButtons = document.querySelectorAll('.mode-btn');
const widgetLabel = document.getElementById('widget-label');
const expireTimeSpan = document.getElementById('expire-time');
const syncStatusSpan = document.getElementById('sync-status');

// State
let debounceTimer;
let currentMode = 'quick';
let currentSessionCode = null;
let unsubscribeFromPaste = null;
let lastSyncedText = '';
let isSyncing = false;

function updateExpireTime(expiresAt) {
    if (!expiresAt) {
        expireTimeSpan.classList.add('hidden');
        return;
    }

    const now = Date.now();
    const timeLeft = expiresAt - now;

    if (timeLeft <= 0) {
        expireTimeSpan.textContent = 'Expired';
        expireTimeSpan.classList.remove('hidden');
        return;
    }

    const minutes = Math.floor(timeLeft / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        expireTimeSpan.textContent = `Expires in ${hours}h ${minutes % 60}m`;
    } else {
        expireTimeSpan.textContent = `Expires in ${minutes}m`;
    }
    expireTimeSpan.classList.remove('hidden');
}

initThemeToggle();
cleanupExpiredPastes();
createIcons({
    icons: { Copy, ArrowRight, Sun, Moon, List }
});

// Check icon SVG for button feedback
const checkIconHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

// Handle URL parameter for code (from list page)
const urlParams = new URLSearchParams(window.location.search);
const codeFromUrl = urlParams.get('code');
if (codeFromUrl && (codeFromUrl.length === PASTE.CODE_LENGTH || codeFromUrl.length === PASTE.SESSION_CODE_LENGTH)) {
    codeInput.value = codeFromUrl;
    setTimeout(() => retrieveContent(), 100);
}

// Generate session code with cryptographically secure random
// Using safe character set (no confusing 0/O, 1/I/L, B/8)
function generateSessionCode() {
    const chars = '23456789ACDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';

    // Use crypto.getRandomValues for cryptographically secure random
    const randomValues = new Uint32Array(PASTE.SESSION_CODE_LENGTH);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < PASTE.SESSION_CODE_LENGTH; i++) {
        // Use modulo to map random value to character index
        code += chars[randomValues[i] % chars.length];
    }
    return code;
}

function startRealtimeSync() {
    if (unsubscribeFromPaste) return; // Already subscribed

    // Show sync indicator
    if (syncStatusSpan) {
        syncStatusSpan.textContent = 'Live';
        syncStatusSpan.classList.remove('hidden');
    }

    // Subscribe to real-time updates
    unsubscribeFromPaste = subscribeToPaste(currentSessionCode, (data) => {
        // Ignore if we're not in the right mode or if data is null (paste doesn't exist yet)
        if (!data || currentMode !== 'session' || !currentSessionCode) return;

        // Update UI if text changed
        if (data.text !== lastSyncedText) {
            lastSyncedText = data.text;

            if (data.text !== mainTextarea.value) {
                const cursorPosition = mainTextarea.selectionStart;
                const isAtEnd = cursorPosition === mainTextarea.value.length;

                mainTextarea.value = data.text;

                // Restore cursor position
                if (isAtEnd) {
                    mainTextarea.selectionStart = mainTextarea.selectionEnd = mainTextarea.value.length;
                } else {
                    mainTextarea.selectionStart = mainTextarea.selectionEnd = Math.min(cursorPosition, mainTextarea.value.length);
                }
            }
        }

        updateExpireTime(data.expiresAt);
    });
}

function stopRealtimeSync() {
    if (unsubscribeFromPaste) {
        unsubscribeFromPaste();
        unsubscribeFromPaste = null;
    }

    // Hide sync indicator
    if (syncStatusSpan) {
        syncStatusSpan.classList.add('hidden');
    }
}

function switchMode(mode, sessionCode = null) {
    currentMode = mode;
    modeButtons.forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    // Stop real-time sync when leaving session mode
    if (mode !== 'session') {
        stopRealtimeSync();
    }

    if (mode === 'session') {
        widgetLabel.textContent = 'Session Code';
        codeInput.placeholder = 'Optional';
        codeInput.maxLength = 5;
        getTextBtn.title = 'Join Session';
        mainTextarea.placeholder = 'Start typing to create a session...';
        codeDisplayArea.classList.add('hidden');

        if (sessionCode) {
            currentSessionCode = sessionCode;
            codeInput.value = sessionCode;
            subtleCodeSpan.textContent = sessionCode;
            subtleCodeDisplay.classList.remove('hidden');
            startRealtimeSync();
        } else {
            codeInput.value = '';
            subtleCodeDisplay.classList.add('hidden');
            currentSessionCode = null;
        }
    } else {
        widgetLabel.textContent = 'Retrieve Code';
        codeInput.placeholder = 'Enter Code';
        codeInput.maxLength = 4;
        getTextBtn.title = 'Get Text';
        mainTextarea.placeholder = 'Paste text here...';
        codeInput.value = '';
        codeDisplayArea.classList.add('hidden');
        subtleCodeDisplay.classList.add('hidden');
        currentSessionCode = null;
    }
}

// Event Listeners
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.mode !== currentMode) {
            switchMode(btn.dataset.mode);
        }
    });
});

codeInput.addEventListener('input', (e) => {
    // Allow alphanumeric from safe set, convert to uppercase
    e.target.value = e.target.value
        .toUpperCase()
        .replace(/[^23456789ACDEFGHJKLMNPQRSTUVWXYZ]/g, '');
});

mainTextarea.addEventListener('input', () => {
    handleInput();
});

copyTextBtn.addEventListener('click', () => {
    const text = mainTextarea.value;
    if (text) {
        navigator.clipboard.writeText(text).then(() => {
            showButtonFeedback(copyTextBtn, true, 'Text copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy text', 'error');
        });
    } else {
        showToast('No text to copy', 'default');
    }
});

getTextBtn.addEventListener('click', async () => {
    if (currentMode === 'session') {
        // Join a session by code
        const code = codeInput.value.trim();
        if (code.length !== PASTE.SESSION_CODE_LENGTH) {
            showToast('Enter a 5-digit session code', 'error');
            return;
        }

        try {
            const data = await getPaste(code);
            currentSessionCode = code;
            mainTextarea.value = data.text || '';
            lastSyncedText = data.text || '';
            subtleCodeSpan.textContent = code;
            subtleCodeDisplay.classList.remove('hidden');
            updateExpireTime(data.expiresAt);
            trackInteraction(code, data.expiresAt);
            startRealtimeSync();
            showToast('Joined session!', 'success');
            codeInput.value = '';
        } catch (err) {
            showToast('Session not found', 'error');
        }
    } else {
        retrieveContent();
    }
});

codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        getTextBtn.click();
    }
});

copyCodeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(generatedCodeSpan.textContent);
    showButtonFeedback(copyCodeBtn, true, 'Copied to clipboard!');
});

codeDisplayArea.addEventListener('click', () => {
    codeDisplayArea.classList.add('hidden');
});




function showButtonFeedback(button, showToastMessage = false, toastMessage = '') {
    if (button.dataset.feedbackActive) return;

    const originalIcon = button.innerHTML;
    button.dataset.feedbackActive = 'true';

    button.innerHTML = checkIconHTML;

    if (showToastMessage && toastMessage) {
        showToast(toastMessage, 'success');
    }

    setTimeout(() => {
        button.innerHTML = originalIcon;
        delete button.dataset.feedbackActive;
    }, UI.FEEDBACK_DURATION);
}

function handleInput() {
    const text = mainTextarea.value.trim();

    if (!text) {
        codeDisplayArea.classList.add('hidden');
        if (currentMode === 'quick') {
            subtleCodeDisplay.classList.add('hidden');
        }
        return;
    }

    // Auto-generate session code if in session mode and no code exists
    if (currentMode === 'session' && !currentSessionCode) {
        currentSessionCode = generateSessionCode();
        subtleCodeSpan.textContent = currentSessionCode;
        subtleCodeDisplay.classList.remove('hidden');
        showToast(`Session created: ${currentSessionCode}`, 'success');

        // Create paste immediately so others can join right away
        saveSessionContent();
        return; // Don't debounce the initial save
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        saveSessionContent();
    }, UI.DEBOUNCE_DELAY);
}

async function saveSessionContent() {
    const text = mainTextarea.value.trim();

    if (currentMode === 'session') {
        if (!currentSessionCode) return;
        if (!text && unsubscribeFromPaste) return; // Only skip empty saves after initial creation

        isSyncing = true;
        try {
            const payload = { text, customCode: currentSessionCode };
            const data = await createPaste(payload);

            lastSyncedText = text;
            updateExpireTime(data.expiresAt);
            trackInteraction(data.code, data.expiresAt);

            // Start real-time sync after first successful save
            if (!unsubscribeFromPaste) {
                startRealtimeSync();
            }
        } catch (err) {
            console.error('Error saving session:', err);
            const message = err.status === 429 ? formatRateLimitMessage(err.retryAfter)
                          : 'Failed to sync';
            showToast(message, 'error');
        } finally {
            isSyncing = false;
        }
    } else {
        // Quick mode
        if (!text) return;

        generatedCodeSpan.textContent = '...';
        codeDisplayArea.classList.remove('hidden');
        subtleCodeDisplay.classList.remove('hidden');

        try {
            const data = await createPaste({ text, customCode: null });

            generatedCodeSpan.textContent = data.code;
            subtleCodeSpan.textContent = data.code;
            setTimeout(() => codeDisplayArea.classList.add('hidden'), 5000);

            updateExpireTime(data.expiresAt);
            trackInteraction(data.code, data.expiresAt);
        } catch (err) {
            console.error('Error:', err);
            const message = err.status === 429 ? formatRateLimitMessage(err.retryAfter)
                          : err.message || 'Failed to save';
            showToast(message, 'error');
            codeDisplayArea.classList.add('hidden');
        }
    }
}

async function retrieveContent() {
    const code = codeInput.value.trim();
    if (code.length !== PASTE.CODE_LENGTH && code.length !== PASTE.SESSION_CODE_LENGTH) {
        showToast(`Please enter a ${PASTE.CODE_LENGTH} or ${PASTE.SESSION_CODE_LENGTH}-digit code`, 'error');
        return;
    }

    const originalBtnContent = getTextBtn.innerHTML;
    getTextBtn.innerHTML = '<div class="spinner"></div>';
    getTextBtn.disabled = true;

    try {
        const data = await getPaste(code);
        updateExpireTime(data.expiresAt);
        trackInteraction(code, data.expiresAt);

        if (code.length === PASTE.SESSION_CODE_LENGTH) {
            switchMode('session', code);
        } else {
            codeInput.value = '';
        }

        mainTextarea.value = data.text || '';
        codeDisplayArea.classList.add('hidden');
        showToast('Content retrieved!', 'success');
    } catch (err) {
        console.error(err);
        if (err.status === 429) {
            showToast(formatRateLimitMessage(err.retryAfter), 'error');
        } else {
            showToast(err.message || 'Failed to connect to server', 'error');
        }
    } finally {
        getTextBtn.innerHTML = originalBtnContent;
        getTextBtn.disabled = false;
    }
}
