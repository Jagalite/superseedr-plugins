# Superseedr Notification Plugin

A notification sidecar for the Superseedr BitTorrent client. This plugin monitors torrent downloads and sends alerts to Discord, Slack, Email, and 100+ services when downloads complete.

## Features
- **Multi-Service Notifications**: Send alerts via Discord, Slack, Email, and [100+ services](https://github.com/caronc/apprise) using Apprise.
- **Sidecar Architecture**: Designed to run alongside Superseedr in Docker or locally.
- **Web UI**: Clean, modern interface to manage notification endpoints.
- **Smart Caching**: Prevents duplicate notifications for the same torrent.

## Quick Start (Local)

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set Environment Variables** (choose your OS):

   **🍎 macOS**
   ```bash
   export STATUS_FILE="$HOME/Library/Application Support/com.github.jagalite.superseedr/status_files/app_state.json"
   export DATA_DIR="./data"
   ```

   **🐧 Linux**
   ```bash
   export STATUS_FILE="$HOME/.local/share/jagalite.superseedr/status_files/app_state.json"
   export DATA_DIR="./data"
   ```

   **🪟 Windows (PowerShell)**
   ```powershell
   $env:STATUS_FILE="$env:LOCALAPPDATA\jagalite\superseedr\data\status_files\app_state.json"
   $env:DATA_DIR=".\data"
   ```

3. **Start the Server**:
   ```bash
   python app.py
   ```

The UI will be available at `http://localhost:5000`.

## Quick Start (Docker Run)

**1. Build the image locally:**
From inside the `plugins/Notifications/superseedr-notifications` directory:
```bash
docker build -t superseedr-notifications .
```

**2. Launch the plugin matching your OS:**

**🍎 macOS**
```bash
docker run -d \
  --name superseedr-notifications \
  --restart unless-stopped \
  -p 5000:5000 \
  -v "$HOME/Library/Application Support/com.github.jagalite.superseedr/status_files:/superseedr-status:ro" \
  -v "$(pwd)/data:/data" \
  -e STATUS_FILE=/superseedr-status/app_state.json \
  -e DATA_DIR=/data \
  superseedr-notifications
```

**🐧 Linux**
```bash
docker run -d \
  --name superseedr-notifications \
  --user $(id -u):$(id -g) \
  --restart unless-stopped \
  -p 5000:5000 \
  -v "$HOME/.local/share/jagalite.superseedr/status_files:/superseedr-status:ro" \
  -v "$(pwd)/data:/data" \
  -e STATUS_FILE=/superseedr-status/app_state.json \
  -e DATA_DIR=/data \
  superseedr-notifications
```

**🪟 Windows (PowerShell)**
```powershell
docker run -d `
  --name superseedr-notifications `
  --restart unless-stopped `
  -p 5000:5000 `
  -v "$env:LOCALAPPDATA\jagalite\superseedr\data\status_files:/superseedr-status:ro" `
  -v "${PWD}\data:/data" `
  -e STATUS_FILE=/superseedr-status/app_state.json `
  -e DATA_DIR=/data `
  superseedr-notifications
```

## Persistent Setup (Docker Compose)

This plugin is designed to run as a **sidecar** to the main `superseedr` service. It should share the `superseedr-status` volume.

### Adding to your Docker Compose

Add the following service definition to your `docker-compose.yml`:

```yaml
services:
  # ... existing services (superseedr, gluetun)

  superseedr-notifications:
    build: ./plugins/Notifications/superseedr-notifications
    container_name: superseedr-notifications
    environment:
      - STATUS_FILE=/superseedr-status/app_state.json
      - DATA_DIR=/data
    volumes:
      # Mount the shared status volume (read-only)
      - superseedr-status:/superseedr-status:ro
      # Mount a volume for persistent settings
      - notification-plugin-data:/data
    ports:
      - "5000:5000"
    depends_on:
      - superseedr
    restart: unless-stopped

volumes:
  superseedr-status:
  notification-plugin-data:
```

### Path Mapping Note
Regardless of your host operating system (Linux, Windows, or macOS), the Docker container uses internal paths.
1. The `STATUS_FILE` environment variable must point to the **container side** path (e.g., `/superseedr-status/app_state.json`).
2. Superseedr must be configured to write status files to the shared volume.

## Environment Variables

| Variable | Description | Local Default | Docker Default |
| :--- | :--- | :--- | :--- |
| `STATUS_FILE` | Path to Superseedr's status JSON file. | OS-Specific | `/superseedr-status/app_state.json` |
| `DATA_DIR` | Path to store settings and cache. | `./data` | `/data` |
| `PORT` | Port for the web interface. | `5000` | `5000` |

## Adding Notification URLs

Access the web UI at http://localhost:5000 and add notification URLs. Examples:

- **Discord**: `discord://webhook_id/webhook_token`
- **Slack**: `slack://TokenA/TokenB/TokenC`
- **Email**: `mailto://user:password@smtp.gmail.com`
- **Telegram**: `tgram://bot_token/chat_id`

See [Apprise documentation](https://github.com/caronc/apprise) for all supported formats.

## How It Works
1. **Background Polling**: Every 5 seconds, the app reads `app_state.json`.
2. **Completion Detection**: Checks if `torrent_control_state` equals "Completed".
3. **Smart Notifications**: Sends alerts only once per torrent (using hash cache).
4. **Multi-Channel**: Distributes notifications to all configured services.

## API Endpoints

- `GET /` - Web UI dashboard
- `GET /api/urls` - List notification URLs
- `POST /api/urls` - Add new URL
- `DELETE /api/urls/<index>` - Remove URL
- `POST /api/test` - Send test notification
- `GET /api/status` - Plugin status

## Troubleshooting

### Desktop notifications not working in Docker
This is expected. Desktop notifications require a display server, which isn't available in containers. The app will gracefully skip this and continue using configured services.

### Status file not found
Make sure the volume mount points to the correct directory and that Superseedr has started and created the status file.

### No notifications received
1. Verify URLs are correctly formatted (check Apprise docs)
2. Use the "Send Test Notification" button to verify connectivity
3. Check Docker logs: `docker logs superseedr-notifications`

---
Part of the [superseedr-plugins](https://github.com/Jagalite/superseedr-plugins) ecosystem.
