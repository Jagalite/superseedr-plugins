# Superseedr Plugins

This repository is a monorepo containing various **sidecar applications** that extend the functionality of the [superseedr](https://github.com/Jagalite/superseedr) TUI BitTorrent client.

> [!WARNING]
> **Beta Status**: This repository and its plugins are currently in an active testing phase. Architecture, paths, and configurations are subject to change. Use with caution.

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
    environment:
      - WATCH_DIR=/superseedr-watch
    volumes:
      - superseedr-watch:/superseedr-watch
      - rss-plugin-data:/data
```

---
*Developed by the Superseedr Contributors.*
