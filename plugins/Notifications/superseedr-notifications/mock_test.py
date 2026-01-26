import json
import time
import os
from datetime import datetime

STATUS_FILE = os.path.expanduser("~/Library/Application Support/com.github.jagalite.superseedr/status_files/app_state.json")

def write_state(torrents):
    state = {
        "run_time": 100,
        "torrents": torrents
    }
    with open(STATUS_FILE, 'w') as f:
        json.dump(state, f, indent=2)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] State updated")

def create_torrent(name, hash_val, state, progress_pct, speed=1000, peers=5):
    total_pieces = 100
    completed_pieces = int(total_pieces * (progress_pct / 100))
    
    return {
        "torrent_name": name,
        "torrent_control_state": state,
        "number_of_pieces_total": total_pieces,
        "number_of_pieces_completed": completed_pieces,
        "download_speed_bps": speed,
        "number_of_successfully_connected_peers": peers
    }

# Hash for our test torrent
HASH = "1111222233334444555566667777888899990000"

print("--- Starting Simulation ---")

# 1. INITIAL STATE: Running at 10%
print("\n1. Initial State: Running 10%")
torrents = {
    HASH: create_torrent("Test Movie.mkv", HASH, "Running", 10)
}
write_state(torrents)
time.sleep(6)  # Wait for poll

# 2. TRIGGER 50%
print("\n2. Trigger 50% Progress")
torrents[HASH] = create_torrent("Test Movie.mkv", HASH, "Running", 50)
write_state(torrents)
time.sleep(6)

# 3. TRIGGER STALLED (0 Speed)
print("\n3. Trigger Stalled (0 speed for >15s)")
# Needs 3 polls (approx 15s)
for i in range(4):
    torrents[HASH] = create_torrent("Test Movie.mkv", HASH, "Running", 60, speed=0)
    write_state(torrents)
    time.sleep(5)

# 4. TRIGGER RESUMED
print("\n4. Trigger Resumed (Speed returns)")
torrents[HASH] = create_torrent("Test Movie.mkv", HASH, "Running", 65, speed=5000, peers=10)
write_state(torrents)
time.sleep(6)

# 5. TRIGGER PAUSED
print("\n5. Trigger Paused")
torrents[HASH] = create_torrent("Test Movie.mkv", HASH, "Paused", 65, speed=0, peers=0)
write_state(torrents)
time.sleep(6)

# 6. TRIGGER RESUMED (Again, from Paused)
print("\n6. Trigger Resumed (From Paused)")
torrents[HASH] = create_torrent("Test Movie.mkv", HASH, "Running", 70, speed=2000, peers=5)
write_state(torrents)
time.sleep(6)

# 7. TRIGGER DELETED
print("\n7. Trigger Deleted")
write_state({}) # Empty torrent list
time.sleep(6)

# 8. TRIGGER COMPLETED
print("\n8. Trigger Completed")
# Add it back first as running near end
torrents[HASH] = create_torrent("Test Movie.mkv", HASH, "Running", 99)
write_state(torrents)
time.sleep(6)
# Complete it
torrents[HASH] = create_torrent("Test Movie.mkv", HASH, "Completed", 100)
write_state(torrents)
time.sleep(6)

print("\n--- Simulation Complete ---")
