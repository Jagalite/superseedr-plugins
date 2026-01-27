# Superseedr Plugins

This repository is a monorepo containing various **sidecar applications** that extend the functionality of the [superseedr](https://github.com/Jagalite/superseedr) TUI BitTorrent client.

> [!WARNING]
> **Beta Status**: This repository and its plugins are currently in an active testing phase. Architecture, paths, and configurations are subject to change. Use with caution.

## Available Plugins

### ⚡ [RSS Plugin](./plugins/RSS/superseedr-rss)
Automate downloads by monitoring RSS feeds and matching titles against custom regex patterns.

### 🖥️ [Web UI Plugin](./plugins/WebUI/superseedr-webui)
A modern, real-time dashboard for monitoring Superseedr transfers and usage.

### 🔔 [Notifications Plugin](./plugins/Notifications/superseedr-notifications)
Send alerts to Discord, Telegram, or other services on torrent events.

## Contributing & Adding Plugins

We welcome contributions to expand the Superseedr plugin ecosystem! **AI-developed plugins are highly encouraged!**

- **Technical Specifications**: For detailed implementation requirements (File-based API, Atomic Writes, Docker integration), please refer to **[AGENTS.md](./AGENTS.md)**.
- **Reference Implementations**: Any apps prefixed with `superseedr-*` (like `superseedr-rss`) serve as official reference implementations for structure and logic.
- **Submitting**: Build your plugin in any language, ensure it follows the Docker-first standards in [AGENTS.md](./AGENTS.md), and submit a Pull Request!

## How Plugins Work

The Superseedr plugin ecosystem is built on a **Sidecar Architecture** and a **File-based API**.

- **Decoupled Communication**: Plugins don't talk to Superseedr via complex networking or RPC. Instead, they interact via the physical filesystem. 
- **The Watch Directory**: Every plugin is given access to Superseedr's `watch_files` directory. When a plugin wants Superseedr to download something, it simply drops a `.magnet` (text file containing the magnet link) or `.torrent` (binary torrent file) into that folder. Use `.path` to provide an absolute local path to a torrent file. Create a file named `shutdown.cmd` to initiate a graceful shutdown.
- **Language Agnostic**: Because the interface is just the filesystem, plugins can be written in any language (Node.js, Python, Rust, Go, etc.) and run as standalone containers or local processes.
- **Improved Isolation**: If a plugin or automation worker crashes, it doesn't affect the core Superseedr client.
- **Network Isolation & Volume Interactivity**: In VPN mode, Superseedr runs inside a `gluetun` container, isolating its network traffic. Plugins interact with or control Superseedr via shared Docker volumes (using the File-based API) rather than through the network, allowing them to remain outside the VPN tunnel while still communicating effectively.


## Docker Setup Instructions

This repository uses **Docker Profiles** to support different networking modes. Choose the one that fits your needs.

### ⚡ Quick Start (Standalone Mode)
Use this if you want to run Superseedr directly on your host network. **No configuration files are required.**

1. **Launch the stack:**
   ```bash
   docker compose --profile standalone up -d
   ```

4. **Access your services:**
   - **WebUI Dashboard**: [http://localhost:19557](http://localhost:19557)
   - **RSS Manager**: [http://localhost:19554](http://localhost:19554)
   - **Notifications**: [http://localhost:19555](http://localhost:19555)

   - **Terminal Interface (TUI)**: `docker compose attach superseedr-standalone`

   > To **detach** from the TUI while keeping it running, press `Ctrl+P` then `Ctrl+Q`. To **quit** the app, press `Q`.

---

### 🔒 Advanced: VPN Mode
Use this to route all Superseedr traffic through a VPN using [Gluetun](https://github.com/qdm12/gluetun).

1. **Prerequisite**: Create a `.gluetun.env` file with your VPN provider details.
   **Example (.gluetun.env):**
   ```env
   VPN_SERVICE_PROVIDER=custom
   VPN_TYPE=wireguard
   WIREGUARD_PRIVATE_KEY=wM...
   WIREGUARD_ADDRESSES=10.13.x.x/32
   ```
   *See [.gluetun.env.example](./.gluetun.env.example) for more options.*

2. **Launch the stack:**
   ```bash
   docker compose --profile vpn up -d
   ```

### ⚙️ Configuration (.env)
You can customize host paths and ports by creating a `.env` file in the project root.

**Example (.env):**
```env
# Custom Host Paths
HOST_SUPERSEEDR_DATA_PATH=./superseedr-data
HOST_SUPERSEEDR_SHARE_PATH=./superseedr-share

# Custom Ports
RSS_PORT=19554
NOTIFICATIONS_PORT=19555
WEBUI_PORT=19557
```
*See [.env.example](./.env.example) for all available variables.*

---


### 🛑 Stopping the Application
```bash
# Standalone
docker compose --profile standalone down

# VPN
docker compose --profile vpn down
```

## CLI Control

You can control the running daemon using the built-in CLI commands. These commands write to the watch folder, allowing you to control the app from scripts or other containers.

```bash
# Add a magnet link
superseedr add "magnet:?xt=urn:btih:..."

# Add a torrent file by path
superseedr add "/path/to/linux.iso.torrent"

# Stop the client gracefully
superseedr stop-client
```

## Monitoring & Status API

Superseedr periodically dumps its full internal state to a JSON file for external monitoring dashboards or health checks.

- **Output Location**: `status_files/app_state.json` (inside your data directory)
- **Content**: CPU/RAM usage, total transfer stats, and detailed metrics for every active torrent.
- **Example Data**: See [superseedr_output_example.json](./superseedr_output_example.json) for a sample of the JSON structure.



## Path & Volume Reference

To ensure standard communication, every plugin should be configured to target Superseedr's watch directory.

| Platform | Default Watch Folder Location |
| :--- | :--- |
| **Docker** | `/root/.local/share/jagalite.superseedr/watch_files` |
| **Linux** | `~/.local/share/jagalite.superseedr/watch_files` |
| **macOS** | `~/Library/Application Support/com.github.jagalite.superseedr/watch_files` |
| **Windows** | `C:\Users\{Username}\AppData\Local\jagalite\superseedr\data\watch_files` |

---
*Developed by the Superseedr Contributors.*
