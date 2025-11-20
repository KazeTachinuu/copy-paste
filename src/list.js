import './style.css';
import './list.css';
import { listPastes } from './api.js';
import { showToast } from './ui.js';

const ITEMS_PER_PAGE = 50;
let currentPage = 1;
let allPastes = [];
let refreshInterval;
const REFRESH_INTERVAL_MS = 10000; // 10 seconds

// DOM Elements
const subtitle = document.getElementById('subtitle');
const tableBody = document.getElementById('table-body');
const pagination = document.getElementById('pagination');
const pageInfo = document.getElementById('page-info');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

async function loadCodes() {
    try {
        const data = await listPastes();

        allPastes = data.pastes;
        subtitle.textContent = `${data.count} active ${data.count === 1 ? 'code' : 'codes'}`;

        renderTable();
    } catch (error) {
        console.error('Error loading codes:', error);

        if (error.status === 429) {
            console.warn('Rate limited, waiting for next refresh...');

            // Stop auto-refresh while rate limited
            stopRefresh();

            let msg = 'Rate limited.';
            if (error.retryAfter) {
                const resetTime = new Date(Date.now() + error.retryAfter * 1000).toLocaleTimeString();
                const minutes = Math.floor(error.retryAfter / 60);
                const seconds = error.retryAfter % 60;
                const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                msg = `Rate limit active. Pausing refresh until ${resetTime} (${duration}).`;

                // Resume auto-refresh after rate limit expires
                setTimeout(() => {
                    console.log('Rate limit expired, resuming auto-refresh...');
                    loadCodes(); // Immediately fetch
                    if (!document.hidden) {
                        startRefresh(); // Resume interval
                    }
                }, error.retryAfter * 1000);
            }

            showToast(msg, 'error');
            return;
        }

        // On error, show empty state rather than crashing
        allPastes = [];
        subtitle.textContent = 'Error loading codes';
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="empty">
                    <div class="empty-message">Unable to load codes</div>
                    <div class="empty-hint">Please refresh the page or try again later</div>
                </td>
            </tr>
        `;
    }
}

function renderTable() {
    if (allPastes.length === 0) {
        subtitle.textContent = 'No active codes';
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="empty">
                    <div class="empty-message">No active pastes right now</div>
                    <div class="empty-hint">Create a paste on the home page to get started</div>
                </td>
            </tr>
        `;
        pagination.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(allPastes.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pagePastes = allPastes.slice(startIdx, endIdx);

    tableBody.innerHTML = pagePastes.map(paste => {
        const types = [];
        if (paste.hasText) types.push('Text');
        if (paste.hasImage) types.push('Image');

        return `
            <tr>
                <td><span class="code" data-code="${paste.code}">${paste.code}</span></td>
                <td class="type">${types.join(', ') || 'Empty'}</td>
                <td class="expires">${formatTime(paste.expiresIn)}</td>
            </tr>
        `;
    }).join('');

    // Add event listeners to new code elements
    document.querySelectorAll('.code').forEach(el => {
        el.addEventListener('click', () => {
            navigateToCode(el.dataset.code);
        });
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

// Pagination controls
prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});

nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(allPastes.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
});

// Smart refresh logic
function startRefresh() {
    if (refreshInterval) return; // Already running
    refreshInterval = setInterval(loadCodes, REFRESH_INTERVAL_MS);
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
