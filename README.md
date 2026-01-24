# Superseedr Plugins

## Watch folder locations

**Docker:** /root/.local/share/jagalite.superseedr
**Linux:** ~/.local/share/jagalite.superseedr/watch_files
**MacOS:** ~/Library/Application Support/com.github.jagalite.superseedr/watch_files
**Windows:** C:\Users\{Username}\AppData\Local\jagalite\superseedr\data\watch_files

```
services:
  superseedr:
    volumes:
      - superseedr-share:/root/.local/share/jagalite.superseedr

  my-sidecar-plugin:
    image: python:3.9-slim
    volumes:
      # Mount the SAME volume to the sidecar
      - superseedr-share:/superseedr_data
    environment:
      # Tell the plugin where to drop files
      - WATCH_DIR=/superseedr_data/watch_files
```
