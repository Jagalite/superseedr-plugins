# Superseedr Plugins

This repository is a monorepo containing various **sidecar applications** that extend the functionality of the [superseedr](https://github.com/Jagalite/superseedr) TUI BitTorrent client.

> [!WARNING]
> **Beta Status**: This repository and its plugins are currently in an active testing phase. Architecture, paths, and configurations are subject to change. Use with caution.

## How Plugins Work

The Superseedr plugin ecosystem is built on a **Sidecar Architecture** and a **File-based API**.

- **Decoupled Communication**: Plugins don't talk to Superseedr via complex networking or RPC. Instead, they interact via the physical filesystem. 
- **The Watch Directory**: Every plugin is given access to Superseedr's `watch_files` directory. When a plugin wants Superseedr to download something, it simply drops a `.magnet` (text file containing the magnet link) or `.torrent` (binary torrent file) into that folder. Use `.path` to provide an absolute local path to a torrent file. Create a file named `shutdown.cmd` to initiate a graceful shutdown.
- **Language Agnostic**: Because the interface is just the filesystem, plugins can be written in any language (Node.js, Python, Rust, Go, etc.) and run as standalone containers or local processes.
- **Improved Isolation**: If a plugin or automation worker crashes, it doesn't affect the core Superseedr client.

## Path & Volume Reference

To ensure standard communication, every plugin should be configured to target Superseedr's watch directory.

| Platform | Default Watch Folder Location |
| :--- | :--- |
| **Docker** | `/root/.local/share/jagalite.superseedr/watch_files` |
| **Linux** | `~/.local/share/jagalite.superseedr/watch_files` |
| **macOS** | `~/Library/Application Support/com.github.jagalite.superseedr/watch_files` |
| **Windows** | `C:\Users\{Username}\AppData\Local\jagalite\superseedr\data\watch_files` |

## Docker Setup Instructions

This setup consolidates the VPN and Standalone configurations into a single `docker-compose.yml` file using Docker Profiles.

### 1. Prerequisites
Ensure you have the following installed:
- **Docker Engine**
- **Docker Compose** (v1.28+ is required for profiles support)

### 2. Configuration Files
Before running, ensure you have the following files in the same directory:

#### A. `docker-compose.yml`
Ensure your `docker-compose.yml` is updated with the latest consolidated YAML content (supporting `vpn` and `standalone` profiles).

#### B. `.env` (Environment Variables)
Create a file named `.env` and define your host paths and settings.
**Example:**
```env
CLIENT_PORT=6881
IMAGE_NAME=jagatranvo/superseedr:latest
HOST_SUPERSEEDR_DATA_PATH=./superseedr-data
HOST_SUPERSEEDR_CONFIG_PATH=./superseedr-config
HOST_SUPERSEEDR_SHARE_PATH=./superseedr-share
```

#### C. `.gluetun.env` (VPN Credentials)
Create a file named `.gluetun.env` containing your VPN provider details. This is required only if using the `vpn` profile.
**Example:**
```env
VPN_SERVICE_PROVIDER=custom
VPN_TYPE=wireguard
WIREGUARD_PRIVATE_KEY=wM...
WIREGUARD_ADDRESSES=10.13.x.x/32
```

### 3. Running the Application
You must choose **ONE** mode to run. You cannot run both simultaneously.

#### Option 1: VPN Mode (Secure)
Starts Gluetun, attaches Superseedr to the VPN network, and starts plugins.
```bash
docker compose --profile vpn up -d
```

#### Option 2: Standalone Mode (Direct Connection)
Starts Superseedr with exposed ports directly on the host (no VPN).
```bash
docker compose --profile standalone up -d
```

### 4. Stopping the Application
To stop the application, use the `down` command with the profile you started.

**If running VPN:**
```bash
docker compose --profile vpn down
```

**If running Standalone:**
```bash
docker compose --profile standalone down
```

### 5. Switching Modes
Because both modes use the same container name (`superseedr`) to keep data consistent, you **MUST** stop one mode completely before starting the other.

**Example (Switching from VPN to Standalone):**
1. `docker compose --profile vpn down`
2. `docker compose --profile standalone up -d`

### 6. Accessing the Services
Once running, the services are available at:

- **WebUI Frontend**: [http://localhost:3001](http://localhost:3001)
- **RSS Plugin**: [http://localhost:3000](http://localhost:3000)
- **Notifications**: [http://localhost:5000](http://localhost:5000)
- **WebUI Backend**: [http://localhost:8082](http://localhost:8082)

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
## Contributing & Adding Plugins

We encourage the community to expand the Superseedr ecosystem! Whether you have a brand new idea or want to provide a "duplicate" app (an alternative implementation of an existing plugin in a different language or with different features), your contributions are welcome.

- **Create a New Plugin**: Follow the structure in the `plugins/` directory (e.g., `plugins/RSS/<your-rss-app>`). 
- **Include Documentation**: Every plugin should include its own `README.md` with clear instructions on how to run it.
- **Docker Support**: Built-in Docker support (Dockerfile/Compose instructions) is highly encouraged for sidecar compatibility.
- **Reference Implementations**: Any apps prefixed with `superseedr-*` (like `superseedr-rss`) serve as official reference implementations for structure and logic.
- **Language Agnostic**: Build your plugin in Python, Rust, Node.js, or whatever you prefer.
- **Pull Requests**: Submit a PR to add your plugin to this monorepo!

## Available Plugins

### ⚡ [RSS Plugin](./plugins/RSS/superseedr-rss)
Automate downloads by monitoring RSS feeds and matching titles against custom regex patterns.

```yaml
  superseedr-rss:
    build: ./plugins/RSS/superseedr-rss
    ports:
      - "3000:3000"
    environment:
      - WATCH_DIR=/superseedr-watch/watch_files
      - STATUS_DIR=/superseedr-status/status_files
      - DATA_DIR=/data
      - PORT=3000
    volumes:
      - ${HOST_SUPERSEEDR_SHARE_PATH:-superseedr-share}:/superseedr-watch
      - ${HOST_SUPERSEEDR_DATA_PATH:-superseedr-data}:/superseedr-status:ro
      - rss-plugin-data:/data
```

### 🖥️ [Web UI Plugin](./plugins/WebUI/superseedr-webui)
A modern, real-time dashboard for monitoring Superseedr.

```yaml
  superseedr-webui-frontend:
    ports:
      - "3001:80" # Accessibility via http://localhost:3001
```

### 🔔 [Notifications Plugin](./plugins/Notifications/superseedr-notifications)
Send alerts to Discord, Telegram, or other services on torrent events.

```yaml
  superseedr-notifications:
    ports:
      - "5000:5000"
```

---
*Developed by the Superseedr Contributors.*
