# Superseedr RSS Plugin

An RSS automation sidecar for the Superseedr BitTorrent client. This plugin monitors RSS feeds, matches titles against regex patterns, and automatically drops magnet/torrent files into Superseedr's watch directory.

## Features
- **Regex Automation**: Automatically download items matching your custom patterns.
- **Sidecar Architecture**: Designed to run alongside Superseedr in Docker or locally.
- **Live Explorer**: Real-time feed preview with highlighting for matches and history.
- **Smart Deduplication**: Aggregates multiple feeds without duplicate entries.

## Quick Start (Local)

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start the Server**:
   ```bash
   npm start
   ```
   *For development with auto-reload:* `npm run dev`

The UI will be available at `http://localhost:3000`.

## Docker Deployment (Sidecar Container)

This plugin is designed to run as a **sidecar** to the main `superseedr` service. It should share the `superseedr-watch` volume and use the same VPN network (if applicable).

### Adding to your Docker Compose

Add the following service definition to your `docker-compose.yml`:

```yaml
services:
  # ... existing services (superseedr, gluetun)

  superseedr-rss:
    build: ./plugins/RSS
    container_name: superseedr-rss
    environment:
      # Map the internal container path to the environment variable
      - WATCH_DIR=/superseedr-watch
      - DATA_DIR=/data
    volumes:
      # Mount the shared watch volume
      - superseedr-watch:/superseedr-watch
      # Mount a volume for persistent settings and history
      - rss-plugin-data:/data
    # Attach to the VPN network if using gluetun
    network_mode: "service:gluetun"
    depends_on:
      - superseedr
    restart: unless-stopped

volumes:
  superseedr-watch:
  rss-plugin-data:
```

### Path Mapping Note
Regardless of your host operating system (Linux, Windows, or macOS), the Docker container uses internal paths.
1. The `WATCH_DIR` in the environment variable must match the **container side** of your volume mount (e.g., `/superseedr-watch`).
2. Superseedr must also be configured to watch that same shared volume.

### Hybrid Mode (Local Superseedr + Container Plugin)

If you are running Superseedr directly on your laptop (non-Docker) but want to run the RSS plugin in a container, you can link them by mounting your local watch folder into the container.

#### For macOS users:
```yaml
  superseedr-rss:
    build: ./plugins/RSS
    environment:
      - WATCH_DIR=/superseedr-watch
    volumes:
      # Map your LOCAL macOS path to the container
      - "~/Library/Application Support/com.github.jagalite.superseedr/watch_files:/superseedr-watch"
      - rss-plugin-data:/data
```

## Environment Variables

| Variable | Description | Local Default | Docker Default |
| :--- | :--- | :--- | :--- |
| `WATCH_DIR` | Path to drop torrent/magnet files. | OS-Specific Defaults | `/superseedr-watch` |
| `DATA_DIR` | Path to store `db.json` (settings/history). | Script Directory | `/data` |
| `PORT` | Port for the web interface. | `3000` | `3000` |

## How it Works
1. **File-based API**: The plugin interacts with Superseedr by saving files into the common `WATCH_DIR`. Superseedr monitors this folder and picks up the new downloads.
2. **Automatic Sync**: A background worker checks your enabled feeds every 15 minutes.
3. **Regex Logic**: If an item's title matches one of your regex patterns, it is downloaded. Items are deduplicated by title and matched against your download history to prevent double-downloads.

---
Part of the [superseedr-plugins](https://github.com/Jagalite/superseedr-plugins) ecosystem.
