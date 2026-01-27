# Superseedr Plugins: Agent Context

This repository is an extension of the TUI BitTorrent client [Superseedr](https://github.com/Jagalite/superseedr). It serves as a monorepo for various Docker sidecar applications that form the Superseedr plugin ecosystem.

## Core Architecture: File-Based API

Superseedr uses a **File-Based API** for plugin communication. There is no REST API or RPC. Plugins interact with Superseedr solely by manipulating the filesystem within a shared "Watch Directory".

Future agents building plugins must strictly adhere to the following technical specifications to ensure reliability and data integrity.

### 1. The Watch Directory
All plugins share a common volume with Superseedr.
- **Docker Volume Name:** `superseedr-watch` (Standard convention)
- **Container Mount Point:** `/superseedr-watch` (Standard convention for plugins)

**Environment Variable:**
Plugins should accept a `WATCH_DIR` environment variable to allow users to override the path.
- Default (Docker): `/superseedr-watch`
- Default (Local/Dev): OS-specific paths (see below)

### 2. Supported Actions

To trigger a download in Superseedr, a plugin must create a file in the `WATCH_DIR`.

#### A. Magnet Links
- **File Extension:** `.magnet`
- **Content:** A plain text string containing the magnet URI (e.g., `magnet:?xt=urn:btih:...`).
- **Filename:** A descriptive, safe filename (e.g., `linux_iso.magnet`).

#### B. Torrent Files
- **File Extension:** `.torrent`
- **Content:** The binary content of the `.torrent` file.

#### C. Path to Torrent
- **File Extension:** `.path`
- **Content:** A plain text string containing the absolute local path to a `.torrent` file.

#### D. Graceful Shutdown
- **Filename:** `shutdown.cmd`
- **Content:** Any (or empty). Presence of this file triggers a graceful shutdown.

### 3. Critical: Atomic Write Pattern
Superseedr monitors the directory for *new* files. If a plugin writes a file slowly or in chunks, Superseedr might attempt to read it before it is complete, causing corruption.

**Agents MUST implement atomic writes:**
1.  Write the data to a temporary file in the same directory (e.g., `filename.magnet.tmp`).
2.  Once the write is fully complete and flushed, **rename** the file to the final target extension (e.g., `filename.magnet`).
3.  The `rename` operation is atomic on POSIX filesystems, ensuring Superseedr sees only the complete file.

**Example Implementation (Node.js):**
```javascript
const fs = require('fs');
const path = require('path');

function saveMagnet(watchDir, filename, magnetLink) {
    const finalPath = path.join(watchDir, `${filename}.magnet`);
    const tempPath = finalPath + '.tmp';

    try {
        // 1. Write to temp file
        fs.writeFileSync(tempPath, magnetLink);
        
        // 2. Atomic Rename
        fs.renameSync(tempPath, finalPath); 
        console.log(`Successfully added: ${filename}`);
    } catch (err) {
        // Clean up temp file on error
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw err;
    }
}
```

### 4. Standard Paths (Reference)
When running outside of Docker (e.g., for testing), agents should attempt to detect the OS default watch directory:

| OS | Path |
| :--- | :--- |
| **Linux** | `~/.local/share/jagalite.superseedr/watch_files` |
| **macOS** | `~/Library/Application Support/com.github.jagalite.superseedr/watch_files` |
| **Windows** | `%LOCALAPPDATA%\jagalite\superseedr\data\watch_files` |

### 5. Status Monitoring

Superseedr periodically dumps its internal state to a JSON file. Agents can read this file to monitor download progress, health, and system resource usage.

- **File Path:** `status_files/app_state.json` (inside the data directory)

**Usage for Agents:**
Agents should treat this file as read-only. It provides a snapshot of all active torrents, including:
- `name`: Torrent name
- `progress`: Completion percentage
- `download_speed` / `upload_speed`: Current throughput
- `eta`: Estimated time to completion

### 6. Docker-First Integration (Primary Mode)

Docker is the **primary** method for running and integrating Superseedr plugins. While local/native execution is supported, it is reserved for **testing and development environments only**.

**Requirements for Agents:**
1.  **Root Integration:** Any new plugin or application **MUST** be added as a service definition in the root `docker-compose.yml`.
2.  **Volume Alignment:** Ensure volume mounts strictly align with the core Superseedr service (e.g., mounting `superseedr-share` for the watch folder and `superseedr-data` for status monitoring).
3.  **Network Isolation Awareness:** Plugins should be designed to operate independently of Superseedr's network tunnel. When Superseedr is in VPN mode (Gluetun), plugins remain on the standard network but control the client via the File-Based API over shared volumes.
4.  **Configuration:** Use environment variables (like `WATCH_DIR` and `STATUS_FILE`) to allow the root Docker Compose to easily configure the containerized plugin.

By following this Docker-first approach, users can manage the entire Superseedr ecosystem as a single, cohesive stack.