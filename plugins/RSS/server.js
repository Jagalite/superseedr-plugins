const express = require('express');
const Parser = require('rss-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// --- 1. Configuration & Helper Functions ---

function expandHomeDir(filepath) {
    if (filepath[0] === '~') {
        return path.join(os.homedir(), filepath.slice(1));
    }
    return filepath;
}

let WATCH_DIR = process.env.WATCH_DIR ? expandHomeDir(process.env.WATCH_DIR) : path.join(os.homedir(), 'Downloads'); // Default for safety

// Ensure Watch Directory Exists
if (!fs.existsSync(WATCH_DIR)) {
    console.warn(`[WARN] Watch directory ${WATCH_DIR} does not exist. Attempting to create it...`);
    try {
        fs.mkdirSync(WATCH_DIR, { recursive: true });
    } catch (err) {
        console.error(`[ERROR] Failed to create watch directory: ${err.message}`);
    }
} else {
    console.log(`[INFO] Watching directory: ${WATCH_DIR}`);
}

// Simple JSON DB
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { rssFeeds: [], filters: [], downloadHistory: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        let db = JSON.parse(data);

        // Migration: Convert old 'rssUrl' to new 'rssFeeds' array
        if (db.rssUrl && !db.rssFeeds) {
            console.log("[MIGRATION] Converting legacy rssUrl to rssFeeds...");
            db.rssFeeds = [db.rssUrl];
            delete db.rssUrl;
            writeDB(db);
        }
        // Ensure rssFeeds exists
        if (!db.rssFeeds) {
            db.rssFeeds = [];
            writeDB(db);
        }

        // Migration: Convert old 'filterRegex' to new 'filters' array
        if (db.filterRegex && !db.filters) {
            console.log("[MIGRATION] Converting legacy regex to filter...");
            db.filters = [{ name: "Default", regex: db.filterRegex }];
            delete db.filterRegex;
            writeDB(db);
        }
        // Ensure filters exists
        if (!db.filters) {
            db.filters = [];
            writeDB(db);
        }

        return db;
    } catch (err) {
        console.error("Error reading DB:", err);
        return { rssFeeds: [], filters: [], downloadHistory: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// File Writing Helper
async function saveToWatchDir(item) {
    const safeTitle = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Check if it's a magnet link
    if (item.link && item.link.startsWith('magnet:?')) {
        const filePath = path.join(WATCH_DIR, `${safeTitle}.magnet`);
        fs.writeFileSync(filePath, item.link);
        console.log(`[SUCCESS] Saved magnet: ${filePath}`);
        return true;
    }
    // Check if it's a torrent file URL
    else if (item.link && item.link.endsWith('.torrent')) {
        try {
            const response = await axios({
                url: item.link,
                method: 'GET',
                responseType: 'arraybuffer'
            });
            const filePath = path.join(WATCH_DIR, `${safeTitle}.torrent`);
            fs.writeFileSync(filePath, response.data);
            console.log(`[SUCCESS] Downloaded torrent: ${filePath}`);
            return true;
        } catch (err) {
            console.error(`[ERROR] Failed to download torrent: ${err.message}`);
            return false;
        }
    }

    console.warn(`[SKIP] Could not process item: ${item.title}`);
    return false;
}

// --- 2. Worker Logic ---

const parser = new Parser();

async function checkRSS() {
    console.log("[WORKER] Checking RSS feeds...");
    const db = readDB();

    if (!db.rssFeeds || db.rssFeeds.length === 0) {
        console.log("[WORKER] No RSS feeds configured.");
        return;
    }

    let allItems = [];

    // Fetch all feeds
    for (const url of db.rssFeeds) {
        try {
            console.log(`[WORKER] Fetching ${url}...`);
            const feed = await parser.parseURL(url);
            // Attach source URL to item just in case we need it later
            feed.items.forEach(item => item._source = url);
            allItems = allItems.concat(feed.items);
        } catch (err) {
            console.error(`[WORKER] Failed to fetch ${url}: ${err.message}`);
        }
    }

    let newItemsCount = 0;

    for (const item of allItems) {
        // Check if already downloaded
        const alreadyDownloaded = db.downloadHistory.some(h => h.guid === (item.guid || item.link));
        if (alreadyDownloaded) continue;

        // Check against Filters
        let matched = false;

        if (db.filters.length === 0) {
            // If no filters, do nothing (User must add a filter)
        } else {
            for (const filter of db.filters) {
                try {
                    const regex = new RegExp(filter.regex, 'i');
                    if (regex.test(item.title)) {
                        console.log(`[MATCH] Item '${item.title}' matched filter '${filter.name}'`);
                        matched = true;
                        break; // download it
                    }
                } catch (e) {
                    console.error(`[WORKER] Invalid Regex in filter '${filter.name}':`, e.message);
                }
            }
        }

        if (!matched) continue;

        // Save to Watch Dir
        const success = await saveToWatchDir(item);

        if (success) {
            db.downloadHistory.unshift({
                title: item.title,
                date: new Date().toISOString(),
                guid: item.guid || item.link,
                source: item._source
            });
            // Keep history size manageable (e.g., last 50 items)
            if (db.downloadHistory.length > 50) db.downloadHistory.pop();
            newItemsCount++;
        }
    }

    if (newItemsCount > 0) {
        writeDB(db);
        console.log(`[WORKER] Processed ${newItemsCount} new items.`);
    } else {
        console.log("[WORKER] No new matching items found.");
    }
}

// Run Worker Every 15 Minutes
setInterval(checkRSS, 15 * 60 * 1000);
// Initial check on startup (delay slightly to ensure DB is ready)
setTimeout(checkRSS, 5000);

// --- 3. Express Server ---

app.use(express.static('public'));
app.use(bodyParser.json());

// API Routes
app.get('/api/settings', (req, res) => {
    const db = readDB();
    res.json({
        rssFeeds: db.rssFeeds, // Array
        filters: db.filters,
        watchDir: WATCH_DIR
    });
});

app.post('/api/settings', (req, res) => {
    // This might be used to override all settings, but let's encourage specific endpoints? 
    // Actually, keeping it for bulk update is fine, but we'll focus on add/remove feed likely.
    // Let's support full replace for now for simplicity of the "Save" button if needed, 
    // OR we can add specific endpoints for feeds like /api/feeds.

    // Changing to /api/feeds endpoints below. 
    // But keeping this compatible with frontend full-save if needed. 
    // For now, let's assume we want granular control or full save.
    // Let's implement /api/feeds endpoints.
    res.status(404).json({ error: "Use specific endpoints" });
});

app.get('/api/feeds', (req, res) => {
    const db = readDB();
    res.json(db.rssFeeds || []);
});

app.post('/api/feeds', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    const db = readDB();
    if (!db.rssFeeds.includes(url)) {
        db.rssFeeds.push(url);
        writeDB(db);
        checkRSS(); // Trigger check
    }
    res.json({ success: true, message: "Feed added" });
});

app.delete('/api/feeds', (req, res) => {
    const { url } = req.body;
    const db = readDB();
    db.rssFeeds = db.rssFeeds.filter(f => f !== url);
    writeDB(db);
    res.json({ success: true, message: "Feed removed" });
});

app.post('/api/filters', (req, res) => {
    const { name, regex } = req.body;
    if (!name || !regex) return res.status(400).json({ error: "Name and Regex are required" });

    const db = readDB();
    // Check for duplicate name
    if (db.filters.some(f => f.name === name)) {
        return res.status(400).json({ error: "Filter with this name already exists" });
    }

    // Validate Regex
    try {
        new RegExp(regex);
    } catch (e) {
        return res.status(400).json({ error: "Invalid Regex" });
    }

    db.filters.push({ name, regex });
    writeDB(db);

    checkRSS(); // Trigger check with new filter
    res.json({ success: true, message: "Filter added" });
});

app.delete('/api/filters/:name', (req, res) => {
    const db = readDB();
    const originalLength = db.filters.length;
    db.filters = db.filters.filter(f => f.name !== req.params.name);

    if (db.filters.length === originalLength) {
        return res.status(404).json({ error: "Filter not found" });
    }

    writeDB(db);
    res.json({ success: true, message: "Filter deleted" });
});

app.get('/api/feed', async (req, res) => {
    const db = readDB();
    if (!db.rssFeeds || db.rssFeeds.length === 0) return res.json({ items: [] });

    let allItems = [];

    try {
        for (const url of db.rssFeeds) {
            try {
                const feed = await parser.parseURL(url);
                const items = feed.items.map(item => ({
                    title: item.title,
                    link: item.link,
                    date: item.isoDate || item.pubDate,
                    source: url
                })).slice(0, 300); // Limit per feed (Increased to 300)

                console.log(`[DEBUG] Fetched ${items.length} items from ${url}. First: "${items[0]?.title}"`);
                allItems = allItems.concat(items);
            } catch (e) {
                console.error(`Error fetching ${url} for preview:`, e.message);
                // Continue to next feed
            }
        }

        // Sort by date desc
        allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log(`[DEBUG] Sending ${allItems.length} total items to frontend.`);
        res.json({ items: allItems.slice(0, 500) }); // Return top 500 aggregated
    } catch (err) {
        console.error("Error fetching feed for preview:", err);
        res.status(500).json({ error: "Failed to fetch feeds" });
    }
});

app.get('/api/history', (req, res) => {
    const db = readDB();
    res.json(db.downloadHistory);
});

app.post('/api/manual', async (req, res) => {
    const { link } = req.body;
    if (!link) return res.status(400).json({ error: "No link provided" });

    // Create a dummy item object for the helper
    const dummyItem = {
        title: `Manual_Add_${Date.now()}`,
        link: link
    };

    const success = await saveToWatchDir(dummyItem);

    if (success) {
        const db = readDB();
        db.downloadHistory.unshift({
            title: "Manual Add",
            date: new Date().toISOString(),
            guid: link
        });
        if (db.downloadHistory.length > 50) db.downloadHistory.pop();
        writeDB(db);
        res.json({ success: true, message: "Link added to Watch Directory" });
    } else {
        res.status(500).json({ error: "Failed to write file. Check server logs." });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Watch Directory: ${WATCH_DIR}`);
});
