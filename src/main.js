import './style.css';
import { createIcons, Copy, Download, X, ArrowRight, Check } from 'lucide';
import { createPaste, getPaste } from './api.js';
import { showToast } from './ui.js';

// Constants
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const DEBOUNCE_DELAY = 1000; // 1 second
const FEEDBACK_DURATION = 2000; // 2 seconds
const CODE_LENGTH = 4;

// DOM Elements
const mainTextarea = document.getElementById('main-textarea');
const codeDisplayArea = document.getElementById('code-display-area');
const generatedCodeSpan = document.getElementById('generated-code');
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
// toastContainer is handled in ui.js

// State
let debounceTimer;
let currentImage = null; // Base64 string

// Initialize Lucide icons
createIcons({
    icons: { Copy, Download, X, ArrowRight, Check }
});

// Handle URL parameter for code (from list page)
const urlParams = new URLSearchParams(window.location.search);
const codeFromUrl = urlParams.get('code');
if (codeFromUrl && codeFromUrl.length === CODE_LENGTH) {
    codeInput.value = codeFromUrl;
    // Auto-retrieve after a short delay to let the page load
    setTimeout(() => retrieveContent(), 100);
}

// --- Event Listeners ---

// Text Input
mainTextarea.addEventListener('input', () => {
    // Allow text input even if image is present
    handleInput();
});

// Paste Event (Text & Image)
window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;

    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob.size > MAX_IMAGE_SIZE) {
                showToast('Image too large (max 10MB)', 'error');
                return;
            }
            processImage(blob);
            return;
        }
    }
});

// Drag & Drop
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
            if (file.size > MAX_IMAGE_SIZE) {
                showToast('Image too large (max 10MB)', 'error');
                return;
            }
            processImage(file);
        }
    }
});

// Clear Image
clearImageBtn.addEventListener('click', () => {
    clearImage();
    mainTextarea.focus();
});

// Download Image
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

// Copy Text
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

// Get Text/Image
getTextBtn.addEventListener('click', retrieveContent);
codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') retrieveContent();
});

// Copy Code
copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(generatedCodeSpan.textContent);
    showButtonFeedback(copyCodeBtn, true, 'Copied to clipboard!');
});




/**
 * Show visual feedback on a button by temporarily replacing it with a checkmark
 * @param {HTMLElement} button - Button element to show feedback on
 * @param {boolean} showToastMessage - Whether to also show a toast message
 * @param {string} toastMessage - Toast message to display if showToastMessage is true
 */
function showButtonFeedback(button, showToastMessage = false, toastMessage = '') {
    // Prevent multiple clicks from corrupting the original icon
    if (button.dataset.feedbackActive) return;

    const originalIcon = button.innerHTML;
    button.dataset.feedbackActive = 'true';

    // Replace with checkmark icon using Lucide
    button.innerHTML = '<i data-lucide="check" width="20" height="20"></i>';
    createIcons({
        icons: { Check },
        attrs: { width: '20', height: '20' },
        nameAttr: 'data-lucide' // Ensure it targets the new element
    });

    if (showToastMessage && toastMessage) {
        showToast(toastMessage, 'success');
    }

    setTimeout(() => {
        button.innerHTML = originalIcon;
        // No need to re-create icons as the original HTML is restored
        delete button.dataset.feedbackActive;
    }, FEEDBACK_DURATION);
}

function handleInput() {
    const text = mainTextarea.value.trim();

    // Generate if there is text OR an image
    if (!text && !currentImage) {
        codeDisplayArea.classList.add('hidden');
        return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        generateCode();
    }, DEBOUNCE_DELAY);
}

/**
 * Process an image file and convert it to base64
 * @param {Blob} blob - Image file blob
 */
function processImage(blob) {
    const reader = new FileReader();
    reader.onload = (event) => {
        currentImage = event.target.result;
        showImagePreview(currentImage);
        generateCode();
    };
    reader.readAsDataURL(blob);
}

function showImagePreview(base64) {
    imagePreview.src = base64;
    imagePreviewContainer.classList.remove('hidden');
    // Do NOT clear text or disable textarea
    mainTextarea.placeholder = 'Add a caption...';
}

function clearImage() {
    currentImage = null;
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
    mainTextarea.placeholder = 'Paste text or image here...';
    // If text is empty, hide code
    if (!mainTextarea.value.trim()) {
        codeDisplayArea.classList.add('hidden');
    } else {
        // If text remains, regenerate code for text only
        generateCode();
    }
}

/**
 * Generate a unique code for the current content (text and/or image)
 */
async function generateCode() {
    const text = mainTextarea.value.trim();

    if (!text && !currentImage) return;

    // Show loading state
    generatedCodeSpan.textContent = '...';
    codeDisplayArea.classList.remove('hidden');

    const payload = {
        text: text,
        image: currentImage
    };

    try {
        const data = await createPaste(payload);
        generatedCodeSpan.textContent = data.code;
    } catch (err) {
        console.error('Error generating code:', err);
        if (err.status === 413) {
            showToast('Image is too large to upload.', 'error');
        } else if (err.status === 429) {
            let msg = 'Rate limited.';
            if (err.retryAfter) {
                const resetTime = new Date(Date.now() + err.retryAfter * 1000).toLocaleTimeString();
                const minutes = Math.floor(err.retryAfter / 60);
                const seconds = err.retryAfter % 60;
                const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                msg = `Rate limited. Try again in ${duration} (at ${resetTime}).`;
            }
            showToast(msg, 'error');
        } else {
            showToast('Error generating code: ' + (err.message || 'Unknown error'), 'error');
        }
    }
}

/**
 * Retrieve content from the server using a code
 */
async function retrieveContent() {
    const code = codeInput.value.trim();
    if (code.length !== CODE_LENGTH) {
        showToast(`Please enter a ${CODE_LENGTH}-digit code`, 'error');
        return;
    }

    const originalBtnContent = getTextBtn.innerHTML;
    getTextBtn.innerHTML = '<div class="spinner"></div>';
    getTextBtn.disabled = true;

    try {
        const data = await getPaste(code);

        // Handle Image
        if (data.image) {
            currentImage = data.image;
            showImagePreview(data.image);
        } else {
            clearImage();
        }

        // Handle Text
        mainTextarea.value = data.text || '';

        codeDisplayArea.classList.add('hidden');
        codeInput.value = '';
        showToast('Content retrieved!', 'success');
    } catch (err) {
        console.error(err);
        if (err.status === 429) {
            let msg = 'Rate limited.';
            if (err.retryAfter) {
                const resetTime = new Date(Date.now() + err.retryAfter * 1000).toLocaleTimeString();
                const minutes = Math.floor(err.retryAfter / 60);
                const seconds = err.retryAfter % 60;
                const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                msg = `Rate limited. Try again in ${duration} (at ${resetTime}).`;
            }
            showToast(msg, 'error');
        } else {
            showToast(err.message || 'Failed to connect to server', 'error');
        }
    } finally {
        getTextBtn.innerHTML = originalBtnContent;
        getTextBtn.disabled = false;
    }
}


