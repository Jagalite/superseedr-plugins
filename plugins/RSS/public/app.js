const API_URL = '/api';

// UI Elements
const manualForm = document.getElementById('manualForm');
const manualLink = document.getElementById('manualLink');

const rssFeedList = document.getElementById('rssFeedList');
const addFeedForm = document.getElementById('addFeedForm');
const newRssUrl = document.getElementById('newRssUrl');

const addFilterForm = document.getElementById('addFilterForm');
const newFilterName = document.getElementById('newFilterName');
const newFilterRegex = document.getElementById('newFilterRegex');
const filterList = document.getElementById('filterList');

const refreshFeedBtn = document.getElementById('refreshFeedBtn');
const previewList = document.getElementById('previewList');
const matchCountDisplay = document.getElementById('matchCount');

const watchDirDisplay = document.getElementById('watchDirDisplay');
const historyTableBody = document.querySelector('#historyTable tbody');
const statusBadge = document.getElementById('statusBadge');
const refreshBtn = document.getElementById('refreshBtn');
const toast = document.getElementById('toast');

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

// --- Data Fetching ---

async function init() {
    await fetchSettings(); // Gets WatchDir and Filters
    await fetchFeeds();
    await fetchHistory();
    await fetchFeedPreview(); // Renamed from fetchFeed for clarity
}

async function fetchSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const data = await res.json();

        watchDirDisplay.textContent = data.watchDir;
        renderFilters(data.filters || []);

        updateStatus(true);
    } catch (err) {
        console.error('Failed to fetch settings:', err);
        updateStatus(false);
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
        rssFeedList.innerHTML = '<div style="color:var(--text-secondary); font-style:italic; padding:0.5rem;">No feeds configured.</div>';
        return;
    }

    feeds.forEach(url => {
        const item = document.createElement('div');
        item.className = 'rss-item';
        item.innerHTML = `
            <div class="url">${url}</div>
            <button class="delete-btn" onclick="removeFeed('${url}')">&times;</button>
        `;
        rssFeedList.appendChild(item);
    });
}

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
        filterList.innerHTML = '<p style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem;">No filters active. Nothing will be downloaded.</p>';
        return;
    }

    filters.forEach(filter => {
        const item = document.createElement('div');
        item.className = 'filter-item';
        item.innerHTML = `
            <div class="filter-info">
                <h4>${filter.name}</h4>
                <code>${filter.regex}</code>
            </div>
            <button class="delete-btn" onclick="deleteFilter('${filter.name}')" title="Delete">&times;</button>
        `;
        filterList.appendChild(item);
    });
}

async function addFilter(e) {
    e.preventDefault();
    const name = newFilterName.value.trim();
    const regex = newFilterRegex.value.trim();

    if (!name || !regex) return;

    try {
        const res = await fetch(`${API_URL}/filters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, regex })
        });
        const data = await res.json();

        if (data.success) {
            showToast('Filter Added');
            newFilterName.value = '';
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
window.deleteFilter = async function (name) {
    if (!confirm(`Delete filter "${name}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/filters/${encodeURIComponent(name)}`, {
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

// ... (renderHistory is fine)

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

        div.innerHTML = `
            <span>${item.title}</span>
            ${isDownloaded ? '<span class="badge downloaded">Downloaded</span>' : ''}
        `;
        div.title = item.title;
        previewList.appendChild(div);
    });

    // Run filter immediately
    filterPreview();
}

function filterPreview() {
    const pattern = newFilterRegex.value;
    const items = Array.from(previewList.querySelectorAll('.preview-item'));
    let matchCount = 0;
    let regex = null;

    // Try to compile regex
    if (pattern) {
        try {
            regex = new RegExp(pattern, 'i');
        } catch (e) {
            // Invalid regex, maybe show visual feedback?
        }
    }

    items.forEach(el => {
        if (el.classList.contains('placeholder')) return;

        // Reset display and highlight first
        el.style.display = '';
        el.classList.remove('highlight', 'dim');

        if (!pattern) {
            // No pattern: just show everything normally, no sorting needed here 
            // (or revert to original order? For simplicity, we just leave them)
            matchCount++;
        } else if (regex && regex.test(el.textContent)) {
            el.classList.add('highlight');
            el.dataset.match = "1"; // Mark as match for sorting
            matchCount++;
        } else {
            el.classList.add('dim');
            el.dataset.match = "0"; // Mark as no-match
        }
    });

    // Sort items: Matches first
    if (pattern) {
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
    } else {
        matchCount = items.length;
    }

    matchCountDisplay.textContent = `${matchCount} potential matches`;
}

newFilterRegex.addEventListener('input', filterPreview);
refreshFeedBtn.addEventListener('click', fetchFeedPreview);

// --- Initialization ---

manualForm.addEventListener('submit', manualAdd);
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
