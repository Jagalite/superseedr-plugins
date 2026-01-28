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

The Superseedr plugin ecosystem leverages a **Sidecar Architecture** and a **File-based API** for seamless integration.

- **Docker-First Architecture**: Docker is our **platform of choice**. Plugins are designed to run as standalone containers (sidecars) alongside the core Superseedr client, ensuring a unified and portable environment.
- **File-Based Communication**: We avoid complex networking or RPC dependencies. Plugins control Superseedr by reading from and writing to shared Docker volumes using our File-based API.
- **The Watch Directory**: Plugins trigger downloads by simply dropping `.magnet` (magnet URI text) or `.torrent` (binary files) into Superseedr's `watch_files` directory.
- **Network Isolation & Security**: In VPN mode, Superseedr runs inside a `gluetun` container, isolating its traffic. Plugins interact with the client via shared volumes while remaining outside the VPN tunnel, preserving both performance and security.
- **Universal Compatibility**: Since the interface is the filesystem, plugins can be written in any language (Go, Python, Node.js, Rust, etc.) and remain completely decoupled from the core client's lifecycle.


## Docker Setup Instructions

This repository uses **Docker Profiles** to support granular deployment. You can choose to run the core client, all plugins, or a specific combination.

### 🚀 Deployment Scenarios

#### 1. Full Stack (Standard)
Launch the core client and all available plugins together.
```bash
# Standalone Mode
docker compose --profile standalone --profile plugins up -d

# VPN Mode
docker compose --profile vpn --profile plugins up -d
```

#### 2. Core App Only
Launch only the Superseedr client without any sidecar plugins.
```bash
# Standalone Mode
docker compose --profile standalone up -d

# VPN Mode
docker compose --profile vpn up -d
```

#### 3. Plugins Only
Launch only the plugin stack (useful if you are running the core client on a different machine or as a native app).
```bash
# Launch ALL plugins
docker compose --profile plugins up -d

# Launch a SPECIFIC plugin (e.g., RSS only)
docker compose --profile rss up -d
```

#### 4. Custom Mix
You can mix and match profiles to suit your needs.
```bash
# VPN Mode + RSS only
docker compose --profile vpn --profile rss up -d
```

### ⚙️ Configuration (.env)
Customize host paths and ports by creating a `.env` file in the project root. You can also define your default profiles here using `COMPOSE_PROFILES`.

**Example (.env):**
```env
# Define default profiles to load when running 'docker compose up'
COMPOSE_PROFILES=standalone,plugins

# Custom Ports
RSS_PORT=19554
WEBUI_PORT=19557
```

---

### 🛑 Stopping the stack
To stop everything regardless of profiles:
```bash
docker compose down
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
