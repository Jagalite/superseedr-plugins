# Superseedr Web UI

A modern Sidecar Web UI for the Superseedr BitTorrent client. This project provides a real-time dashboard running in a separate container, communicating with Superseedr via the shared file system.

## Features

- **Real-time Monitoring**: Live updates of download/upload speeds, CPU/RAM usage.
- **Modern Interface**: Clean, responsive design built with React, Vite, and Tailwind CSS.
- **Theme Support**: Includes Modern Light, Midnight Dark, and Nord themes.
- **Docker Ready**: Fully containerized backend (Go) and frontend (Nginx).

## Architecture

This plugin follows the **Sidecar Pattern**:
1. **Superseedr** writes its state to `superseedr_output_example.json` (or configured path).
2. **Web UI Backend** (Go/Fiber) reads this file and serves it as a REST API.
3. **Web UI Frontend** (React) polls this API to display the dashboard.

> [!NOTE]
> **Network Isolation & Gluetun**: Superseedr is often deployed behind a VPN container like **gluetun** for network isolation. Because of this, it may not share a network namespace with other containers. This sidecar architecture bypasses that limitation by using **shared volume mounts** to read the state from disk, allowing the Web UI to run in a separate container without needing direct network access to the Superseedr core.

## Quick Start (Docker Compose)

1. Navigate to the plugin directory:
   ```bash
   cd plugins/WebUI/superseedr-webui
   ```

2. Start the services:
   ```bash
   docker-compose up --build
   ```

3. Open your browser to:
   - **Frontend**: http://localhost:3001
   - **Backend API**: http://localhost:8080/api/stats

## Quick Start (Docker Run)

To run the backend sidecar independently:

**🍎 macOS**
```bash
docker run -d \
  --name superseedr-webui-backend \
  --restart unless-stopped \
  -p 8080:8080 \
  -v "$HOME/Library/Application Support/com.github.jagalite.superseedr/status_files:/superseedr-status:ro" \
  -v "$(pwd)/watch_files:/data/watch_files" \
  -e STATUS_FILE=/superseedr-status/app_state.json \
  -e WATCH_DIR=/data/watch_files \
  superseedr-webui-backend
```

**🐧 Linux**
```bash
docker run -d \
  --name superseedr-webui-backend \
  --user $(id -u):$(id -g) \
  --restart unless-stopped \
  -p 8080:8080 \
  -v "$HOME/.local/share/jagalite.superseedr/status_files:/superseedr-status:ro" \
  -v "$(pwd)/watch_files:/data/watch_files" \
  -e STATUS_FILE=/superseedr-status/app_state.json \
  -e WATCH_DIR=/data/watch_files \
  superseedr-webui-backend
```

**🪟 Windows (PowerShell)**
```powershell
docker run -d `
  --name superseedr-webui-backend `
  --restart unless-stopped `
  -p 8080:8080 `
  -v "$env:LOCALAPPDATA\jagalite\superseedr\data\status_files:/superseedr-status:ro" `
  -v "${PWD}\watch_files:/data/watch_files" `
  -e STATUS_FILE=/superseedr-status/app_state.json `
  -e WATCH_DIR=/data/watch_files `
  superseedr-webui-backend
```

## Development Setup

### Backend (Go)
```bash
cd backend
go run main.go
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STATUS_FILE` | Path to the Superseedr status JSON file | `superseedr_output_example.json` |
| `WATCH_DIR` | Path to drop torrent/magnet files | `./watch_files` |
| `PORT` | Port for the backend API | `8080` |
| `VITE_API_URL` | API URL for the frontend | `http://localhost:8080/api/stats` |

## Themes

The UI allows switching between themes via the dropdown in the header. Preferences are saved to your browser's local storage.
