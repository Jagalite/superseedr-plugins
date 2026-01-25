# Superseedr Plugins

This repository is a monorepo containing various **sidecar applications** that extend the functionality of the [superseedr](https://github.com/Jagalite/superseedr) TUI BitTorrent client.

## How Plugins Work

The Superseedr plugin ecosystem is built on a **Sidecar Architecture** and a **File-based API**.

- **Decoupled Communication**: Plugins don't talk to Superseedr via complex networking or RPC. Instead, they interact via the physical filesystem. 
- **The Watch Directory**: Every plugin is given access to Superseedr's `watch_files` directory. When a plugin wants Superseedr to download something, it simply drops a `.magnet` (text file containing the magnet link) or `.torrent` (binary torrent file) into that folder.
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

### Integration Example (Docker Compose)

```yaml
services:
  superseedr:
    # ... existing superseedr config
    volumes:
      - superseedr-share:/root/.local/share/jagalite.superseedr

  my-sidecar-plugin:
    image: my-plugin:latest
    volumes:
      # Mount the SAME share volume to the sidecar
      - superseedr-share:/superseedr_data
    environment:
      # Tell the plugin where to drop files (must point to subfolder)
      - WATCH_DIR=/superseedr_data/watch_files
```

## Available Plugins

### ⚡ [RSS Plugin](./plugins/RSS)
Automate downloads by monitoring RSS feeds and matching titles against custom regex patterns.

```yaml
  superseedr-rss:
    build: ./plugins/RSS
    environment:
      - WATCH_DIR=/superseedr-watch
    volumes:
      - superseedr-watch:/superseedr-watch
      - rss-plugin-data:/data
```

---
*Developed by the Superseedr Contributors.*
