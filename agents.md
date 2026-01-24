This repository is an extension of the TUI BitTorrent client superseedr found here: https://github.com/Jagalite/superseedr

This is intended to be a mono-repo of various docker sidecar apps that are superseedr's plugin ecosystem.

These apps will interact with superseedr via a file based API. Docker volumes will link containers together.

Every docker container will have the `superseedr-watch` volumed mounted.

Magnet and Torrent files should go here.
