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

function getDefaultWatchDir() {
    // 1. Env Var has highest priority (if set explicitly by user)
    if (process.env.WATCH_DIR) {
        return expandHomeDir(process.env.WATCH_DIR);
    }

    // 2. OS Specific Defaults
    const platform = process.platform;
    const homedir = os.homedir();

    if (platform === 'darwin') { // MacOS
        return path.join(homedir, 'Library', 'Application Support', 'com.github.jagalite.superseedr', 'watch_files');
    } else if (platform === 'win32') { // Windows
        const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
        return path.join(localAppData, 'jagalite', 'superseedr', 'data', 'watch_files');
    } else { // Linux & Docker
        return path.join(homedir, '.local', 'share', 'jagalite.superseedr', 'watch_files');
    }
}

// Ensure Directory Exists (Helper)
function ensureDirExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`[INFO] Created directory: ${dirPath}`);
        } catch (err) {
            console.error(`[ERROR] Failed to create directory ${dirPath}: ${err.message}`);
        }
    }
}

// Simple JSON DB
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            rssFeeds: [],
            filters: [],
            downloadHistory: [],
            watchDir: getDefaultWatchDir()
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        let db = JSON.parse(data);

        // Migration: Add watchDir if missing
        if (!db.watchDir) {
            console.log("[MIGRATION] Setting default watchDir...");
            db.watchDir = getDefaultWatchDir();
            writeDB(db);
        }

        // Migration: Convert old 'rssUrl' to new 'rssFeeds' array
        if (db.rssUrl && !db.rssFeeds) {
            console.log("[MIGRATION] Converting legacy rssUrl to rssFeeds...");
            db.rssFeeds = [{ url: db.rssUrl, enabled: true }];
            delete db.rssUrl;
            writeDB(db);
        }
        // Ensure rssFeeds exists
        if (!db.rssFeeds) {
            db.rssFeeds = [];
            writeDB(db);
        }

        // Migration: Convert string feeds to objects
        if (db.rssFeeds.length > 0 && typeof db.rssFeeds[0] === 'string') {
            console.log("[MIGRATION] Converting string feeds to objects...");
            db.rssFeeds = db.rssFeeds.map(url => ({ url, enabled: true }));
            writeDB(db);
        }

        // Migration: Convert old 'filterRegex' to new 'filters' array
        if (db.filterRegex && !db.filters) {
            console.log("[MIGRATION] Converting legacy regex to filter...");
            db.filters = [{ name: "Default", regex: db.filterRegex, enabled: true }];
            delete db.filterRegex;
            writeDB(db);
        }
        // Ensure filters exists
        if (!db.filters) {
            db.filters = [];
            writeDB(db);
        }

        // Ensure all filters have enabled flag
        let filtersChanged = false;
        db.filters.forEach(f => {
            if (f.enabled === undefined) {
                f.enabled = true;
                filtersChanged = true;
            }
        });
        if (filtersChanged) writeDB(db);

        return db;
    } catch (err) {
        console.error("Error reading DB:", err);
        return { rssFeeds: [], filters: [], downloadHistory: [], watchDir: getDefaultWatchDir() };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// File Writing Helper (Atomic Write Pattern)
async function saveToWatchDir(item) {
    const db = readDB();
    const watchDir = db.watchDir;

    ensureDirExists(watchDir);

    const safeTitle = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // 1. Handle Magnet Links
    if (item.link && item.link.startsWith('magnet:?')) {
        const finalPath = path.join(watchDir, `${safeTitle}.magnet`);
        const tempPath = finalPath + '.tmp';

        try {
            fs.writeFileSync(tempPath, item.link);
            fs.renameSync(tempPath, finalPath); // Atomic Rename
            console.log(`[SUCCESS] Saved magnet: ${finalPath}`);
            return true;
        } catch (err) {
            console.error(`[ERROR] Failed to save magnet: ${err.message}`);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            return false;
        }
    }
    // 2. Handle Torrent Files (URL ends with .torrent OR /torrent)
    else if (item.link && (item.link.endsWith('.torrent') || item.link.endsWith('/torrent'))) {
        const finalPath = path.join(watchDir, `${safeTitle}.torrent`);
        const tempPath = finalPath + '.tmp';

        try {
            const response = await axios({
                url: item.link,
                method: 'GET',
                responseType: 'arraybuffer'
            });
            const buffer = Buffer.from(response.data);

            fs.writeFileSync(tempPath, buffer);
            fs.renameSync(tempPath, finalPath); // Atomic Rename
            console.log(`[SUCCESS] Downloaded torrent: ${finalPath}`);
            return true;
        } catch (err) {
            console.error(`[ERROR] Failed to download torrent from ${item.link}: ${err.message}`);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            return false;
        }
    }

    console.warn(`[SKIP] Could not process item: ${item.title}`);
    return false;
}

// --- 2. Worker Logic ---
let lastSync = Date.now();

const parser = new Parser();

async function checkRSS() {
    lastSync = Date.now();
    console.log("[WORKER] Checking RSS feeds...");
    const db = readDB();

    const enabledFeeds = db.rssFeeds.filter(f => f.enabled);

    if (enabledFeeds.length === 0) {
        console.log("[WORKER] No enabled RSS feeds.");
        return;
    }

    let allItems = [];

    // Fetch all enabled feeds
    for (const feedObj of enabledFeeds) {
        try {
            console.log(`[WORKER] Fetching ${feedObj.url}...`);
            const feed = await parser.parseURL(feedObj.url);
            // Attach source URL to item just in case we need it later
            feed.items.forEach(item => item._source = feedObj.url);
            allItems = allItems.concat(feed.items);
        } catch (err) {
            console.error(`[WORKER] Failed to fetch ${feedObj.url}: ${err.message}`);
        }
    }

    let newItemsCount = 0;
    const enabledFilters = db.filters.filter(f => f.enabled);

    for (const item of allItems) {
        // Check if already downloaded
        const alreadyDownloaded = db.downloadHistory.some(h => h.guid === (item.guid || item.link));
        if (alreadyDownloaded) continue;

        // Check against Filters
        let matched = false;

        if (enabledFilters.length === 0) {
            // If no filters, do nothing
        } else {
            for (const filter of enabledFilters) {
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
app.get('/api/status', (req, res) => {
    res.json({
        lastSync,
        interval: 15 * 60 * 1000
    });
});

app.get('/api/settings', (req, res) => {
    const db = readDB();
    res.json({
        rssFeeds: db.rssFeeds, // Array
        filters: db.filters,
        watchDir: db.watchDir
    });
});

app.post('/api/settings', (req, res) => {
    const { watchDir } = req.body;
    if (watchDir) {
        const db = readDB();
        db.watchDir = expandHomeDir(watchDir);
        writeDB(db);
        res.json({ success: true, message: "Settings saved" });
    } else {
        res.status(404).json({ error: "Use specific endpoints for feeds/filters" });
    }
});

app.get('/api/feeds', (req, res) => {
    const db = readDB();
    res.json(db.rssFeeds || []);
});

app.post('/api/feeds', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    const db = readDB();
    if (!db.rssFeeds.some(f => f.url === url)) {
        db.rssFeeds.push({ url, enabled: true });
        writeDB(db);
        checkRSS(); // Trigger check
    }
    res.json({ success: true, message: "Feed added" });
});

app.delete('/api/feeds', (req, res) => {
    const { url } = req.body;
    const db = readDB();
    db.rssFeeds = db.rssFeeds.filter(f => f.url !== url);
    writeDB(db);
    res.json({ success: true, message: "Feed removed" });
});

app.post('/api/feeds/toggle', (req, res) => {
    const { url, enabled } = req.body;
    const db = readDB();
    const feed = db.rssFeeds.find(f => f.url === url);
    if (feed) {
        feed.enabled = !!enabled;
        writeDB(db);
        res.json({ success: true, message: "Feed updated" });
    } else {
        res.status(404).json({ error: "Feed not found" });
    }
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

    db.filters.push({ name, regex, enabled: true });
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

app.post('/api/filters/toggle', (req, res) => {
    const { name, enabled } = req.body;
    const db = readDB();
    const filter = db.filters.find(f => f.name === name);
    if (filter) {
        filter.enabled = !!enabled;
        writeDB(db);
        res.json({ success: true, message: "Filter updated" });
    } else {
        res.status(404).json({ error: "Filter not found" });
    }
});

app.get('/api/feed', async (req, res) => {
    const db = readDB();
    const enabledFeeds = db.rssFeeds ? db.rssFeeds.filter(f => f.enabled) : [];

    if (enabledFeeds.length === 0) return res.json({ items: [] });

    let allItems = [];

    try {
        for (const feedObj of enabledFeeds) {
            try {
                const feed = await parser.parseURL(feedObj.url);
                const items = feed.items.map(item => ({
                    title: item.title,
                    link: item.link,
                    date: item.isoDate || item.pubDate,
                    source: feedObj.url
                }));

                // Limit per feed (300 to ensure we find items)
                const limitedItems = items.slice(0, 300);
                allItems = allItems.concat(limitedItems);
            } catch (e) {
                console.error(`Error fetching ${feedObj.url} for preview:`, e.message);
                // Continue to next feed
            }
        }

        // Deduplicate items by title
        const seen = new Set();
        const uniqueItems = [];
        for (const item of allItems) {
            if (!seen.has(item.title)) {
                seen.add(item.title);
                uniqueItems.push(item);
            }
        }
        allItems = uniqueItems;

        // Sort by date desc
        allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Return top 500 aggregated
        res.json({ items: allItems.slice(0, 500) });
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
    const db = readDB();
    console.log(`Current Watch Directory: ${db.watchDir}`);
});
