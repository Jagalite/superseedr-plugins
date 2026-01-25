const API_URL = '/api';

// UI Elements
const manualForm = document.getElementById('manualForm');
const manualLink = document.getElementById('manualLink');

const rssFeedList = document.getElementById('rssFeedList');
const addFeedForm = document.getElementById('addFeedForm');
const newRssUrl = document.getElementById('newRssUrl');

const addFilterForm = document.getElementById('addFilterForm');
const newFilterRegex = document.getElementById('newFilterRegex');
const filterList = document.getElementById('filterList');

const refreshFeedBtn = document.getElementById('refreshFeedBtn');
const previewList = document.getElementById('previewList');
const matchCountDisplay = document.getElementById('matchCount');

const historyTableBody = document.querySelector('#historyTable tbody');
const statusBadge = document.getElementById('statusBadge');
const refreshBtn = document.getElementById('refreshBtn');
const toast = document.getElementById('toast');
const syncTimer = document.getElementById('syncTimer');

// --- Helper Functions ---

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function updateStatus(connected) {
    const dot = statusBadge.querySelector('.dot');
    if (connected) {
        statusBadge.innerHTML = '<div class="dot"></div> Server Connected';
        statusBadge.querySelector('.dot').style.backgroundColor = 'var(--success)';
        statusBadge.querySelector('.dot').style.boxShadow = '0 0 8px var(--success)';
    } else {
        statusBadge.innerHTML = '<div class="dot"></div> Reconnecting...';
        statusBadge.querySelector('.dot').style.backgroundColor = '#ef4444'; // Red
        statusBadge.querySelector('.dot').style.boxShadow = 'none';
    }
}

// --- Sync Timer ---
let nextSyncTime = 0;

async function fetchSyncStatus() {
    try {
        const res = await fetch(`${API_URL}/status`);
        const data = await res.json();
        nextSyncTime = data.lastSync + data.interval;
    } catch (err) {
        console.error('Failed to fetch sync status:', err);
    }
}

function updateSyncTimer() {
    if (!nextSyncTime) return;

    const now = Date.now();
    const diff = nextSyncTime - now;

    if (diff <= 0) {
        syncTimer.textContent = 'Syncing...';
        // Give it a few seconds then re-fetch
        if (diff < -5000) fetchSyncStatus();
        return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    syncTimer.textContent = `Next sync: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

setInterval(updateSyncTimer, 1000);
setInterval(fetchSyncStatus, 60000); // Re-sync with server every minute

// --- Data Fetching ---

async function init() {
    await fetchSyncStatus();
    await fetchSettings(); // Gets WatchDir and Filters
    await fetchFeeds();
    await fetchHistory();
    await fetchFeedPreview(); // Renamed from fetchFeed for clarity
}

// UI Element for Watch Dir
const watchDirInput = document.getElementById('watchDirInput');
const settingsForm = document.getElementById('settingsForm');

async function fetchSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const data = await res.json();

        watchDirInput.value = data.watchDir || '';
        cachedFilters = data.filters || [];
        renderFilters(cachedFilters);
        if (cachedFeedItems.length > 0) filterPreview();

        updateStatus(true);
    } catch (err) {
        console.error('Failed to fetch settings:', err);
        updateStatus(false);
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const watchDir = watchDirInput.value.trim();
    if (!watchDir) return;

    try {
        const res = await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ watchDir })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Watch Directory Saved');
        } else {
            showToast('Error Saving Settings');
        }
    } catch (err) {
        console.error(err);
        showToast('Error Saving Settings');
    }
}

// --- RSS Feeds ---

async function fetchFeeds() {
    try {
        const res = await fetch(`${API_URL}/feeds`);
        const feeds = await res.json();
        renderFeeds(feeds);
    } catch (err) {
        console.error('Error fetching feeds:', err);
    }
}

function renderFeeds(feeds) {
    rssFeedList.innerHTML = '';
    if (feeds.length === 0) {
        rssFeedList.innerHTML = '<div class="empty-list-message">No feeds configured.</div>';
        return;
    }

    feeds.forEach(feed => {
        // Handle both string (legacy) and object formats safely
        const url = feed.url || feed;
        const enabled = feed.enabled !== false;

        const item = document.createElement('div');
        item.className = 'rss-item';
        item.innerHTML = `
            <div class="item-content">
                <div class="toggle-switch ${enabled ? 'active' : ''}" onclick="toggleFeed('${url}', ${!enabled})" title="Toggle Feed"></div>
                <div class="url" title="${url}">${url}</div>
            </div>
            <button class="delete-btn" onclick="removeFeed('${url}')">&times;</button>
        `;
        rssFeedList.appendChild(item);
    });
}

window.toggleFeed = async function (url, enabled) {
    try {
        await fetch(`${API_URL}/feeds/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, enabled })
        });
        fetchFeeds();
        // Allow time for server to update cache if needed, or trigger preview refresh
        setTimeout(fetchFeedPreview, 500);
    } catch (err) {
        console.error(err);
        showToast('Error Toggling Feed');
    }
};

async function addFeed(e) {
    e.preventDefault();
    const url = newRssUrl.value.trim();
    if (!url) return;

    try {
        const res = await fetch(`${API_URL}/feeds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Feed Added');
            newRssUrl.value = '';
            fetchFeeds();
            fetchFeedPreview(); // Update preview
        }
    } catch (err) {
        console.error(err);
        showToast('Error Adding Feed');
    }
}

window.removeFeed = async function (url) {
    if (!confirm(`Remove feed? ${url}`)) return;

    try {
        const res = await fetch(`${API_URL}/feeds`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Feed Removed');
            fetchFeeds();
            fetchFeedPreview(); // Update preview
        }
    } catch (err) {
        console.error(err);
        showToast('Error Removing Feed');
    }
};

// --- Filters ---

function renderFilters(filters) {
    filterList.innerHTML = '';
    if (filters.length === 0) {
        filterList.innerHTML = '<div class="empty-list-message">No filters active. Nothing will be downloaded.</div>';
        return;
    }

    filters.forEach(filter => {
        const item = document.createElement('div');
        item.className = 'filter-item';
        item.innerHTML = `
            <div class="filter-info">
                <code>${filter.regex}</code>
            </div>
            <button class="delete-btn" onclick="deleteFilter('${encodeURIComponent(filter.regex)}')" title="Delete">&times;</button>
        `;
        filterList.appendChild(item);
    });
}

async function addFilter(e) {
    e.preventDefault();
    const regex = newFilterRegex.value.trim();

    if (!regex) return;

    try {
        const res = await fetch(`${API_URL}/filters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regex })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Filter Added');
            newFilterRegex.value = '';
            fetchSettings(); // Re-fetch to update list
        } else {
            showToast(data.error || 'Error Adding Filter');
        }
    } catch (err) {
        console.error(err);
        showToast('Error Adding Filter');
    }
}

// Global scope for onclick
window.deleteFilter = async function (regex) {
    if (!confirm(`Delete filter pattern: ${regex}?`)) return;

    try {
        const res = await fetch(`${API_URL}/filters/${encodeURIComponent(regex)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            showToast('Filter Deleted');
            fetchSettings();
        }
    } catch (err) {
        console.error(err);
        showToast('Error Deleting Filter');
    }
};

async function manualAdd(e) {
    e.preventDefault();
    const link = manualLink.value.trim();
    if (!link) return;

    try {
        const res = await fetch(`${API_URL}/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Link Added Successfully');
            manualLink.value = '';
            fetchHistory();
        }
    } catch (err) {
        console.error('Failed to add link:', err);
        showToast('Error Adding Link');
    }
}

// --- Global State ---
let cachedFeedItems = [];
let cachedHistory = []; // Store history for cross-referencing
let cachedFilters = [];

// ... (fetchHistory update)

async function fetchHistory() {
    try {
        const res = await fetch(`${API_URL}/history`);
        cachedHistory = await res.json(); // Store in global
        renderHistory(cachedHistory);
        // Also re-render preview to update badges if feed exists
        if (cachedFeedItems.length > 0) renderPreview();
    } catch (err) {
        console.error('Failed to fetch history:', err);
    }
}

function renderHistory(history) {
    historyTableBody.innerHTML = '';
    if (history.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="2" class="empty-state">No history yet.</td></tr>';
        return;
    }

    history.forEach(item => {
        const row = document.createElement('tr');
        const date = new Date(item.date).toLocaleString();
        row.innerHTML = `
            <td><div class="item-title" title="${item.title}">${item.title}</div></td>
            <td><span class="date-tag">${date}</span></td>
        `;
        historyTableBody.appendChild(row);
    });
}

// --- Live Feed Preview ---

async function fetchFeedPreview() {
    previewList.innerHTML = '<div class="preview-item placeholder">Loading feed...</div>';
    matchCountDisplay.textContent = 'Updating...';

    try {
        const res = await fetch(`${API_URL}/feed`);
        const data = await res.json();

        cachedFeedItems = data.items || [];
        renderPreview();
    } catch (err) {
        console.error("Failed to fetch feed:", err);
        previewList.innerHTML = '<div class="preview-item placeholder" style="color:red">Failed to load feed.</div>';
    }
}

function renderPreview() {
    previewList.innerHTML = '';

    if (cachedFeedItems.length === 0) {
        previewList.innerHTML = '<div class="preview-item placeholder">No items found in feed.</div>';
        matchCountDisplay.textContent = '0 items';
        return;
    }

    cachedFeedItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'preview-item';

        // Check overlap with history (by title or link)
        const isDownloaded = cachedHistory.some(h => h.guid === item.link || h.title === item.title);
        const isMagnet = item.link.startsWith('magnet:');

        const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`; // Chain/Link Icon for all links

        const downloadIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`; // Download Icon

        div.innerHTML = `
            <div class="item-main">
                <div class="item-title" title="${item.title}">${item.title}</div>
                ${isDownloaded ? '<span class="badge downloaded">Downloaded</span>' : ''}
            </div>
            <div class="item-actions">
                <button class="action-btn ${isMagnet ? 'magnet-btn' : ''}" onclick="copyLink('${item.link}')" title="${isMagnet ? 'Copy Magnet' : 'Copy Link'}">${copyIcon}</button>
                <button class="action-btn download-btn" onclick="downloadItem('${item.link}')" title="Send to Client">${downloadIcon}</button>
            </div>
        `;
        previewList.appendChild(div);
    });

    // Run filter immediately
    filterPreview();
}

window.copyLink = function (link) {
    navigator.clipboard.writeText(link).then(() => {
        showToast("Link Copied!");
    });
};

window.downloadItem = async function (link) {
    showToast("Starting download...");

    // Resurrect manualAdd logic or just call endpoint directly
    try {
        const res = await fetch(`${API_URL}/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Download Started');
            fetchHistory();
            fetchFeedPreview(); // Update badges
        } else {
            showToast('Error: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        showToast('Download Failed');
    }
};

function filterPreview() {
    const items = Array.from(previewList.querySelectorAll('.preview-item'));
    const searchPattern = newFilterRegex.value.trim();
    let matchCount = 0;
    let searchRegex = null;
    if (searchPattern) {
        try { searchRegex = new RegExp(searchPattern, 'i'); } catch (e) { }
    }

    // Prepare regexes for all cached filters
    const activeFilterRegexes = cachedFilters
        .map(f => {
            try { return new RegExp(f.regex, 'i'); } catch (e) { return null; }
        })
        .filter(r => r !== null);

    items.forEach(el => {
        if (el.classList.contains('placeholder')) return;

        const title = el.querySelector('.item-title')?.textContent || '';

        // Reset state
        el.style.display = '';
        el.classList.remove('highlight', 'dim');

        const matchesSearch = searchRegex ? searchRegex.test(title) : false;
        const matchesSavedFilter = activeFilterRegexes.some(r => r.test(title));

        if (matchesSearch || matchesSavedFilter) {
            el.classList.add('highlight');
            el.dataset.match = "1";
            matchCount++;
        } else if (searchPattern || activeFilterRegexes.length > 0) {
            el.classList.add('dim');
            el.dataset.match = "0";
        } else {
            // No search and no filters: everything is normal
            el.dataset.match = "0";
            matchCount++;
        }
    });

    // Sort items: Matches first
    const hasActiveFilters = searchPattern || activeFilterRegexes.length > 0;
    if (hasActiveFilters) {
        items.sort((a, b) => {
            if (a.classList.contains('placeholder')) return -1;
            if (b.classList.contains('placeholder')) return 1;

            const matchA = a.dataset.match === "1";
            const matchB = b.dataset.match === "1";

            if (matchA && !matchB) return -1;
            if (!matchA && matchB) return 1;
            return 0; // Maintain relative order otherwise
        });

        // Re-append to DOM in new order
        const fragment = document.createDocumentFragment();
        items.forEach(el => fragment.appendChild(el));
        previewList.appendChild(fragment);
    }

    matchCountDisplay.textContent = `${matchCount} potential matches`;
}

newFilterRegex.addEventListener('input', filterPreview);
refreshFeedBtn.addEventListener('click', fetchFeedPreview);

// --- Initialization ---

manualForm.addEventListener('submit', manualAdd);
settingsForm.addEventListener('submit', saveSettings);
addFeedForm.addEventListener('submit', addFeed);
addFilterForm.addEventListener('submit', addFilter);

refreshBtn.addEventListener('click', () => {
    fetchHistory();
    const icon = refreshBtn;
    icon.style.transform = 'rotate(360deg)';
    setTimeout(() => icon.style.transform = 'none', 300);
});

// Start everything
init();

// Poll History every 30s
setInterval(fetchHistory, 30000);
