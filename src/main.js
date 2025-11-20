import './shared.css';
import './style.css';
import { createIcons, Copy, Download, X, ArrowRight, Sun, Moon, List } from 'lucide';
import DOMPurify from 'isomorphic-dompurify';
import { createPaste, getPaste } from './api.js';
import { showToast, formatRateLimitMessage } from './ui.js';
import { PASTE, UI, ALLOWED_IMAGE_TYPES } from '../config/constants.js';
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
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const clearImageBtn = document.getElementById('clear-image-btn');
const downloadImageBtn = document.getElementById('download-image-btn');
const copyTextBtn = document.getElementById('copy-text-btn');
const dropOverlay = document.getElementById('drop-overlay');
const inputWrapper = document.querySelector('.input-wrapper');

// State
let debounceTimer;
let currentImage = null;

initThemeToggle();
cleanupExpiredPastes();
createIcons({
    icons: { Copy, Download, X, ArrowRight, Sun, Moon, List }
});

// Check icon SVG for button feedback
const checkIconHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

// Handle URL parameter for code (from list page)
const urlParams = new URLSearchParams(window.location.search);
const codeFromUrl = urlParams.get('code');
if (codeFromUrl && codeFromUrl.length === PASTE.CODE_LENGTH) {
    codeInput.value = codeFromUrl;
    setTimeout(() => retrieveContent(), 100);
}

// Event Listeners
mainTextarea.addEventListener('input', () => {
    handleInput();
});

window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;

    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob.size > PASTE.MAX_IMAGE_SIZE) {
                const maxMB = PASTE.MAX_IMAGE_SIZE / 1024 / 1024;
                showToast(`Image too large (max ${maxMB}MB)`, 'error');
                return;
            }
            processImage(blob);
            return;
        }
    }
});

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.relatedTarget === null || !inputWrapper.contains(e.relatedTarget)) {
        dropOverlay.classList.remove('active');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('active');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
            if (file.size > PASTE.MAX_IMAGE_SIZE) {
                const maxMB = PASTE.MAX_IMAGE_SIZE / 1024 / 1024;
                showToast(`Image too large (max ${maxMB}MB)`, 'error');
                return;
            }
            processImage(file);
        }
    }
});

clearImageBtn.addEventListener('click', () => {
    clearImage();
    mainTextarea.focus();
});

downloadImageBtn.addEventListener('click', () => {
    if (currentImage) {
        const link = document.createElement('a');
        link.href = currentImage;
        link.download = `pasted-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showButtonFeedback(downloadImageBtn, true, 'Image downloaded!');
    }
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

getTextBtn.addEventListener('click', retrieveContent);
codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') retrieveContent();
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

    if (!text && !currentImage) {
        codeDisplayArea.classList.add('hidden');
        subtleCodeDisplay.classList.add('hidden');
        return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        generateCode();
    }, UI.DEBOUNCE_DELAY);
}

function isValidImageDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  if (!dataUrl.startsWith('data:image/')) return false;

  const mimeMatch = dataUrl.match(/^data:(image\/[^;]+);base64,/);
  if (!mimeMatch) return false;

  const mimeType = mimeMatch[1];
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) return false;

  const base64Part = dataUrl.split(',')[1];
  if (!base64Part || !/^[A-Za-z0-9+/=]+$/.test(base64Part)) return false;

  return true;
}

function processImage(blob) {
  if (!blob.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }

  if (blob.type === 'image/svg+xml') {
    showToast('SVG images are not supported for security reasons', 'error');
    return;
  }

  if (blob.size > PASTE.MAX_IMAGE_SIZE) {
    const maxMB = PASTE.MAX_IMAGE_SIZE / 1024 / 1024;
    showToast(`Image must be smaller than ${maxMB}MB`, 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;

    if (!isValidImageDataUrl(dataUrl)) {
      showToast('Invalid or unsupported image format', 'error');
      return;
    }

    currentImage = dataUrl;
    showImagePreview(dataUrl);
    generateCode();
  };

  reader.onerror = () => {
    showToast('Failed to read image file', 'error');
  };

  reader.readAsDataURL(blob);
}

function showImagePreview(base64) {
  if (!isValidImageDataUrl(base64)) {
    showToast('Invalid or unsafe image data', 'error');
    clearImage();
    return;
  }

  const sanitized = DOMPurify.sanitize(base64);
  imagePreview.src = sanitized;
  imagePreviewContainer.classList.remove('hidden');
  mainTextarea.placeholder = 'Add a caption...';
}

function clearImage() {
    currentImage = null;
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
    mainTextarea.placeholder = 'Paste text or image here...';
    if (!mainTextarea.value.trim()) {
        codeDisplayArea.classList.add('hidden');
        subtleCodeDisplay.classList.add('hidden');
    } else {
        generateCode();
    }
}

async function generateCode() {
    const text = mainTextarea.value.trim();

    if (!text && !currentImage) return;

    generatedCodeSpan.textContent = '...';
    subtleCodeSpan.textContent = '...';
    codeDisplayArea.classList.remove('hidden');
    subtleCodeDisplay.classList.remove('hidden');

    const payload = {};
    if (text) payload.text = text;
    if (currentImage) payload.image = currentImage;

    try {
        const data = await createPaste(payload);
        generatedCodeSpan.textContent = data.code;
        subtleCodeSpan.textContent = data.code;
        trackInteraction(data.code, data.expiresAt);

        setTimeout(() => {
            codeDisplayArea.classList.add('hidden');
        }, 5000);
    } catch (err) {
        console.error('Error generating code:', err);
        if (err.status === 413) {
            showToast('Image is too large to upload.', 'error');
        } else if (err.status === 429) {
            showToast(formatRateLimitMessage(err.retryAfter), 'error');
        } else {
            showToast('Error generating code: ' + (err.message || 'Unknown error'), 'error');
        }
    }
}

async function retrieveContent() {
    const code = codeInput.value.trim();
    if (code.length !== PASTE.CODE_LENGTH) {
        showToast(`Please enter a ${PASTE.CODE_LENGTH}-digit code`, 'error');
        return;
    }

    const originalBtnContent = getTextBtn.innerHTML;
    getTextBtn.innerHTML = '<div class="spinner"></div>';
    getTextBtn.disabled = true;

    try {
        const data = await getPaste(code);

        trackInteraction(code, data.expiresAt);

        if (data.image) {
            currentImage = data.image;
            showImagePreview(data.image);
        } else {
            clearImage();
        }

        mainTextarea.value = data.text || '';

        codeDisplayArea.classList.add('hidden');
        codeInput.value = '';
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


