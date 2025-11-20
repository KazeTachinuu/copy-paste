import './shared.css';
import './list.css';
import { createIcons, Sun, Moon, Trash2, Home } from 'lucide';
import { showToast } from './ui.js';
import { UI } from '../config/constants.js';
import { initThemeToggle } from './theme.js';
import { getActivePastes, deletePaste } from './storage.js';

// HTML escaping function to prevent XSS attacks
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize theme
initThemeToggle();

// Initialize Lucide icons
createIcons({
    icons: { Sun, Moon, Trash2, Home }
});

let currentPage = 1;
let allPastes = [];
let refreshInterval;
let countdownInterval;
let deleteConfirmTimeout;

// DOM Elements
const subtitle = document.getElementById('subtitle');
const tableBody = document.getElementById('table-body');
const pagination = document.getElementById('pagination');
const pageInfo = document.getElementById('page-info');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const selectAllCheckbox = document.getElementById('select-all');
const batchActions = document.getElementById('batch-actions');
const selectedCountSpan = document.getElementById('selected-count');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');

let selectedCodes = new Set();

function loadCodes() {
    try {
        allPastes = getActivePastes();
        const count = allPastes.length;
        subtitle.textContent = `${count} active ${count === 1 ? 'code' : 'codes'}`;
        renderTable();
    } catch (error) {
        console.error('Error loading codes:', error);
        allPastes = [];
        subtitle.textContent = 'Error loading codes';
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="empty">
                    <div class="empty-message">Unable to load codes</div>
                    <div class="empty-hint">Please refresh the page</div>
                </td>
            </tr>
        `;
    }
}

function updateBatchActionsUI() {
    const count = selectedCodes.size;
    if (count > 0) {
        batchActions.style.display = 'flex';
        selectedCountSpan.textContent = `${count} selected`;
    } else {
        batchActions.style.display = 'none';
    }

    // Update select-all checkbox state
    const currentPageCodes = Array.from(document.querySelectorAll('.row-checkbox')).map(cb => cb.dataset.code);
    const allCurrentSelected = currentPageCodes.length > 0 && currentPageCodes.every(code => selectedCodes.has(code));
    selectAllCheckbox.checked = allCurrentSelected;
    selectAllCheckbox.indeterminate = !allCurrentSelected && currentPageCodes.some(code => selectedCodes.has(code));
}

function renderTable() {
    if (allPastes.length === 0) {
        subtitle.textContent = 'No active codes';
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    <div class="empty-message">No active pastes right now</div>
                    <div class="empty-hint">Create a paste on the home page to get started</div>
                </td>
            </tr>
        `;
        pagination.style.display = 'none';
        batchActions.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(allPastes.length / UI.ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * UI.ITEMS_PER_PAGE;
    const endIdx = startIdx + UI.ITEMS_PER_PAGE;
    const pagePastes = allPastes.slice(startIdx, endIdx);

    tableBody.innerHTML = pagePastes.map(paste => `
        <tr>
            <td><input type="checkbox" class="row-checkbox" data-code="${escapeHtml(paste.code)}" ${selectedCodes.has(paste.code) ? 'checked' : ''} aria-label="Select ${escapeHtml(paste.code)}"></td>
            <td data-label="Code"><span class="code" data-code="${escapeHtml(paste.code)}" tabindex="0">${escapeHtml(paste.code)}</span></td>
            <td data-label="Created" class="created-time">${formatRelativeTime(paste.createdAt)}</td>
            <td data-label="Expires In" class="expires" data-expires-at="${paste.expiresAt}">${formatTime(paste.expiresIn)}</td>
            <td data-label="Actions" class="actions">
                <button class="delete-btn" data-code="${escapeHtml(paste.code)}" title="Delete from list" aria-label="Delete ${escapeHtml(paste.code)} from list">
                    <i data-lucide="trash-2" width="16" height="16"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Row checkboxes
    document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const code = e.target.dataset.code;
            if (e.target.checked) {
                selectedCodes.add(code);
            } else {
                selectedCodes.delete(code);
            }
            updateBatchActionsUI();
        });
    });

    document.querySelectorAll('.code').forEach(el => {
        el.addEventListener('click', () => {
            navigateToCode(el.dataset.code);
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateToCode(el.dataset.code);
            }
        });
    });

    // Add delete button event listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (btn.classList.contains('confirm')) {
                // Second click - actually delete
                const code = btn.dataset.code;
                await handleDelete(code);
            } else {
                // First click - show confirmation
                btn.classList.add('confirm');
                btn.innerHTML = 'Sure?';

                // Reset after 3 seconds
                if (deleteConfirmTimeout) clearTimeout(deleteConfirmTimeout);
                deleteConfirmTimeout = setTimeout(() => {
                    btn.classList.remove('confirm');
                    btn.innerHTML = '<i data-lucide="trash-2" width="16" height="16"></i>';
                    createIcons({ icons: { Trash2 } });
                }, 3000);
            }
        });
    });

    // Re-initialize icons after DOM update
    createIcons({
        icons: { Sun, Moon, Trash2, Home }
    });

    // Show pagination if needed
    if (totalPages > 1) {
        pagination.style.display = 'flex';
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
    } else {
        pagination.style.display = 'none';
    }

    // Start countdown timer
    startCountdown();

    // Update batch actions UI
    updateBatchActionsUI();
}

function updateCountdowns() {
    const now = Date.now();
    let hasExpired = false;

    document.querySelectorAll('.expires[data-expires-at]').forEach(cell => {
        const expiresAt = parseInt(cell.dataset.expiresAt, 10);
        const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));

        if (remainingSeconds === 0) hasExpired = true;
        cell.textContent = formatTime(remainingSeconds);
    });

    if (hasExpired) loadCodes();
}

function startCountdown() {
    stopCountdown();
    countdownInterval = setInterval(updateCountdowns, 1000);
}

function stopCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

async function handleDelete(code) {
    try {
        const success = deletePaste(code);
        if (success) {
            showToast(`${code} removed from list`, 'success');
            loadCodes(); // Reload the list
        } else {
            showToast('Failed to remove code', 'error');
        }
    } catch (error) {
        console.error('Error deleting paste:', error);
        showToast('Failed to remove code', 'error');
    }
}

function navigateToCode(code) {
    window.location.href = `/?code=${code}`;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    if (isToday) {
        return timeStr;
    } else {
        const dateStr = date.toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
        });
        return `${dateStr}, ${timeStr}`;
    }
}

// Select all checkbox
selectAllCheckbox.addEventListener('change', (e) => {
    const currentPageCodes = Array.from(document.querySelectorAll('.row-checkbox')).map(cb => cb.dataset.code);
    if (e.target.checked) {
        currentPageCodes.forEach(code => selectedCodes.add(code));
    } else {
        currentPageCodes.forEach(code => selectedCodes.delete(code));
    }
    renderTable();
});

// Delete selected button
deleteSelectedBtn.addEventListener('click', async () => {
    if (selectedCodes.size === 0) return;

    if (deleteSelectedBtn.classList.contains('confirm')) {
        // Second click - actually delete
        const count = selectedCodes.size;
        const codes = Array.from(selectedCodes);

        for (const code of codes) {
            deletePaste(code);
        }

        selectedCodes.clear();
        showToast(`${count} code${count > 1 ? 's' : ''} removed from list`, 'success');
        loadCodes();

        // Reset button
        deleteSelectedBtn.classList.remove('confirm');
        deleteSelectedBtn.textContent = 'Delete Selected';
    } else {
        // First click - show confirmation
        deleteSelectedBtn.classList.add('confirm');
        deleteSelectedBtn.textContent = 'Sure?';

        // Reset after 3 seconds
        if (deleteConfirmTimeout) clearTimeout(deleteConfirmTimeout);
        deleteConfirmTimeout = setTimeout(() => {
            deleteSelectedBtn.classList.remove('confirm');
            deleteSelectedBtn.textContent = 'Delete Selected';
        }, 3000);
    }
});

// Pagination controls
prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});

nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(allPastes.length / UI.ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
});

// Smart refresh logic
function startRefresh() {
    if (refreshInterval) return; // Already running
    refreshInterval = setInterval(loadCodes, UI.REFRESH_INTERVAL);
}

function stopRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Only refresh when tab is visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopRefresh();
        stopCountdown();
    } else {
        loadCodes();
        startRefresh();
    }
});

// Initial load
loadCodes();

if (!document.hidden) {
    startRefresh();
}
