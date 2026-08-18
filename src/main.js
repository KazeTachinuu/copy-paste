import './shared.css';
import './style.css';
import { createIcons, Copy, ArrowRight, Sun, Moon, List, QrCode } from 'lucide';
import { createPaste, getPaste, subscribeToPaste } from './api.js';
import { showToast, formatRateLimitMessage } from './ui.js';
import { PASTE, UI } from '../config/constants.js';
import { initThemeToggle } from './theme.js';
import { trackInteraction, cleanupExpiredPastes } from './storage.js';
import { qrSvg } from './qr.js';
import { generateCode } from './code.js';

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
const qrCodeBtn = document.getElementById('qr-code-btn');
const subtleQrBtn = document.getElementById('subtle-qr-btn');
const qrModal = document.getElementById('qr-modal');
const qrModalSvg = document.getElementById('qr-modal-svg');
const qrModalCode = document.getElementById('qr-modal-code');
const qrModalClose = document.getElementById('qr-modal-close');

// State
let debounceTimer;
let currentMode = 'quick';
let currentSessionCode = null;
let unsubscribeFromPaste = null;
let lastSyncedText = '';
let localDirty = false;
let currentExpiresAt = null;
let expireTickInterval = null;

function renderExpireTime() {
    if (!currentExpiresAt) {
        expireTimeSpan.classList.add('hidden');
        return;
    }

    const timeLeft = currentExpiresAt - Date.now();

    if (timeLeft <= 0) {
        expireTimeSpan.textContent = 'Expired';
        expireTimeSpan.classList.remove('hidden');
        clearInterval(expireTickInterval);
        expireTickInterval = null;
        return;
    }

    const totalSeconds = Math.ceil(timeLeft / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        expireTimeSpan.textContent = `Expires in ${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        expireTimeSpan.textContent = `Expires in ${minutes}m ${seconds}s`;
    } else {
        expireTimeSpan.textContent = `Expires in ${seconds}s`;
    }
    expireTimeSpan.classList.remove('hidden');
}

function updateExpireTime(expiresAt) {
    currentExpiresAt = expiresAt || null;
    renderExpireTime();

    if (expireTickInterval) {
        clearInterval(expireTickInterval);
        expireTickInterval = null;
    }

    if (currentExpiresAt && currentExpiresAt > Date.now()) {
        expireTickInterval = setInterval(renderExpireTime, 1000);
    }
}

initThemeToggle();
cleanupExpiredPastes();
createIcons({
    icons: { Copy, ArrowRight, Sun, Moon, List, QrCode }
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

        if (data.text !== lastSyncedText) {
            if (data.text === mainTextarea.value) {
                // Server echoed a value we already hold locally.
                lastSyncedText = data.text;
            } else if (!localDirty) {
                // Genuine remote edit and we're not mid-edit: apply it, preserving the cursor.
                const cursorPosition = mainTextarea.selectionStart;
                const isAtEnd = cursorPosition === mainTextarea.value.length;
                mainTextarea.value = data.text;
                mainTextarea.selectionStart = mainTextarea.selectionEnd = isAtEnd
                    ? mainTextarea.value.length
                    : Math.min(cursorPosition, mainTextarea.value.length);
                lastSyncedText = data.text;
            }
            // else: local edit in flight; our pending save reconciles it, so don't clobber.
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
        widgetLabel.textContent = 'Join Session';
        codeInput.placeholder = 'Enter code';
        codeInput.maxLength = 5;
        getTextBtn.title = 'Join Session';
        mainTextarea.placeholder = 'Start typing to create a live session...';
        codeDisplayArea.classList.add('hidden');

        if (sessionCode) {
            currentSessionCode = sessionCode;
            codeInput.value = sessionCode;
            subtleCodeSpan.textContent = sessionCode;
            subtleCodeDisplay.classList.remove('hidden');
            localDirty = false;
            startRealtimeSync();
        } else {
            subtleCodeDisplay.classList.add('hidden');
            currentSessionCode = null;
            localDirty = false;
        }
    } else {
        widgetLabel.textContent = 'Retrieve Code';
        codeInput.placeholder = 'Enter Code';
        codeInput.maxLength = 4;
        getTextBtn.title = 'Get Text';
        mainTextarea.placeholder = 'Paste text here...';
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
            showToast('Enter a 5-character session code', 'error');
            return;
        }

        try {
            const data = await getPaste(code);
            currentSessionCode = code;
            mainTextarea.value = data.text || '';
            lastSyncedText = data.text || '';
            localDirty = false;
            subtleCodeSpan.textContent = code;
            subtleCodeDisplay.classList.remove('hidden');
            updateExpireTime(data.expiresAt);
            trackInteraction(code, data.expiresAt, data.createdAt);
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
    navigator.clipboard.writeText(generatedCodeSpan.textContent).then(() => {
        showButtonFeedback(copyCodeBtn, true, 'Copied to clipboard!');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
});

qrCodeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openQrModal(generatedCodeSpan.textContent);
});

subtleQrBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openQrModal(subtleCodeSpan.textContent);
});

qrModalClose.addEventListener('click', closeQrModal);
qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) closeQrModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !qrModal.classList.contains('hidden')) closeQrModal();
});

codeDisplayArea.addEventListener('click', () => {
    codeDisplayArea.classList.add('hidden');
});

subtleCodeDisplay.addEventListener('click', () => {
    const code = subtleCodeSpan.textContent;
    if (code && code !== '----') {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy code: ', err);
            showToast('Failed to copy code', 'error');
        });
    }
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

function openQrModal(code) {
    if (!code || code === '...' || code === '----') return;
    qrModalSvg.innerHTML = qrSvg(`${location.origin}/?code=${code}`);
    qrModalCode.textContent = code;
    qrModal.classList.remove('hidden');
}

function closeQrModal() {
    qrModal.classList.add('hidden');
}

function showCodeDisplay(code, autoHide = true) {
    generatedCodeSpan.textContent = code;
    subtleCodeSpan.textContent = code;
    codeDisplayArea.classList.remove('hidden');
    subtleCodeDisplay.classList.remove('hidden');

    if (autoHide) {
        setTimeout(() => codeDisplayArea.classList.add('hidden'), 5000);
    }
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

    if (currentMode === 'session') localDirty = true;

    // Auto-generate session code if in session mode and no code exists
    if (currentMode === 'session' && !currentSessionCode) {
        currentSessionCode = generateCode(PASTE.SESSION_CODE_LENGTH);
        showCodeDisplay(currentSessionCode);
        showToast(`Session created: ${currentSessionCode}`, 'success');

        // Create paste immediately so others can join right away
        savePaste();
        return; // Don't debounce the initial save
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        savePaste();
    }, UI.DEBOUNCE_DELAY);
}

async function savePaste() {
    const text = mainTextarea.value.trim();
    if (!text) return;

    const isSession = currentMode === 'session';
    const customCode = isSession ? currentSessionCode : null;

    // Prevent saves when session code hasn't been generated yet
    if (isSession && !currentSessionCode) return;

    // Show loading state for quick paste
    if (!isSession) {
        showCodeDisplay('...', false);
    }

    // Record our own write up front so its realtime echo isn't treated as a remote change.
    if (isSession) lastSyncedText = text;

    try {
        const data = await createPaste({ text, customCode });

        if (isSession) {
            // Clean only if nothing new was typed during the round-trip.
            if (mainTextarea.value.trim() === text) localDirty = false;
            if (!unsubscribeFromPaste) {
                startRealtimeSync();
            }
        } else {
            showCodeDisplay(data.code);
        }

        updateExpireTime(data.expiresAt);
        trackInteraction(data.code, data.expiresAt, data.createdAt);
    } catch (err) {
        const message = err.status === 429 ? formatRateLimitMessage(err.retryAfter)
                      : (isSession ? 'Failed to sync' : 'Failed to save');

        // Only log unexpected errors (not rate limits)
        if (err.status !== 429) {
            console.error('Error saving paste:', err);
        }

        showToast(message, 'error');

        if (!isSession) {
            codeDisplayArea.classList.add('hidden');
            subtleCodeDisplay.classList.add('hidden');
        }
    }
}

async function retrieveContent() {
    const code = codeInput.value.trim();
    if (code.length !== PASTE.CODE_LENGTH && code.length !== PASTE.SESSION_CODE_LENGTH) {
        showToast(`Please enter a ${PASTE.CODE_LENGTH} or ${PASTE.SESSION_CODE_LENGTH}-character code`, 'error');
        return;
    }

    const originalBtnContent = getTextBtn.innerHTML;
    getTextBtn.innerHTML = '<div class="spinner"></div>';
    getTextBtn.disabled = true;

    try {
        const data = await getPaste(code);
        updateExpireTime(data.expiresAt);
        trackInteraction(code, data.expiresAt, data.createdAt);

        if (code.length === PASTE.SESSION_CODE_LENGTH) {
            switchMode('session', code);
        } else {
            codeInput.value = '';
        }

        mainTextarea.value = data.text || '';
        lastSyncedText = data.text || '';
        localDirty = false;
        codeDisplayArea.classList.add('hidden');

        if (code.length === PASTE.CODE_LENGTH && data.text) {
            try {
                await navigator.clipboard.writeText(data.text);
                showToast('Retrieved and copied to clipboard!', 'success');
                return;
            } catch {}
        }
        showToast('Content retrieved!', 'success');
    } catch (err) {
        if (err.status === 429) {
            showToast(formatRateLimitMessage(err.retryAfter), 'error');
        } else if (err.message && (err.message.includes('not found') || err.message.includes('expired'))) {
            showToast('Code not found or expired', 'error');
        } else {
            console.error('Error retrieving paste:', err);
            showToast('Failed to retrieve content', 'error');
        }
    } finally {
        getTextBtn.innerHTML = originalBtnContent;
        getTextBtn.disabled = false;
    }
}
