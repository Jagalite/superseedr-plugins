import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from threading import Lock

from flask import Flask, render_template, request, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
import apprise

# Try to import plyer for desktop notifications, but don't fail if unavailable
try:
    from plyer import notification as desktop_notification
    # On macOS, plyer requires pyobjus which might be missing
    import platform
    if platform.system() == 'Darwin':
        try:
            import pyobjus
        except ImportError:
            app.logger.info("pyobjus not found, disabling desktop notifications on macOS")
            DESKTOP_NOTIFICATIONS_AVAILABLE = False
        else:
            DESKTOP_NOTIFICATIONS_AVAILABLE = True
    else:
        DESKTOP_NOTIFICATIONS_AVAILABLE = True
except (ImportError, Exception):
    DESKTOP_NOTIFICATIONS_AVAILABLE = False

# Configuration
STATUS_FILE = os.getenv('STATUS_FILE', '/data/status_files/app_state.json')
DATA_DIR = os.getenv('DATA_DIR', '/data')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')
POLL_INTERVAL = 5  # seconds

# Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'superseedr-notification-plugin'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
app.logger.setLevel(logging.INFO)

# Global state
notification_urls = []
torrent_states = {}  # Cache of torrent state history
state_lock = Lock()


def load_settings():
    """Load notification URLs and poll interval from settings.json"""
    global notification_urls, POLL_INTERVAL
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
                notification_urls = data.get('notification_urls', [])
                POLL_INTERVAL = data.get('poll_interval', 5)
                app.logger.info(f"Loaded settings: {len(notification_urls)} URLs, POLL_INTERVAL={POLL_INTERVAL}s")
        else:
            notification_urls = []
            POLL_INTERVAL = 5
            app.logger.info("No settings file found, using defaults")
    except Exception as e:
        app.logger.error(f"Error loading settings: {e}")
        notification_urls = []
        POLL_INTERVAL = 5


def save_settings():
    """Save notification URLs and poll interval to settings.json"""
    try:
        # Ensure data directory exists
        os.makedirs(DATA_DIR, exist_ok=True)
        
        with open(SETTINGS_FILE, 'w') as f:
            json.dump({
                'notification_urls': notification_urls,
                'poll_interval': POLL_INTERVAL
            }, f, indent=2)
        app.logger.info(f"Saved settings: {len(notification_urls)} URLs, POLL_INTERVAL={POLL_INTERVAL}s")
    except Exception as e:
        app.logger.error(f"Error saving settings: {e}")


def send_notification(title, message, torrent_hash=None):
    """Send notifications via Apprise and desktop"""
    app.logger.info(f"Sending notification: {title} - {message}")
    
    # Send via Apprise to configured URLs
    if notification_urls:
        apobj = apprise.Apprise()
        for url in notification_urls:
            apobj.add(url)
        
        try:
            apobj.notify(
                title=title,
                body=message,
            )
            app.logger.info(f"Sent notification to {len(notification_urls)} services")
        except Exception as e:
            app.logger.error(f"Error sending Apprise notification: {e}")
    
    # Send desktop notification if available (will fail gracefully in Docker)
    if DESKTOP_NOTIFICATIONS_AVAILABLE:
        try:
            desktop_notification.notify(
                title=title,
                message=message,
                app_name='Superseedr',
                timeout=10
            )
            app.logger.info("Sent desktop notification")
        except Exception as e:
            app.logger.debug(f"Desktop notification not available (expected in Docker): {e}")


def check_torrents():
    """Poll the status file and check for completed torrents"""
    global torrent_states
    
    try:
        # Check if status file exists
        if not os.path.exists(STATUS_FILE):
            app.logger.debug(f"Status file not found: {STATUS_FILE}")
            return
        
        # Read and parse the status file
        try:
            with open(STATUS_FILE, 'r') as f:
                data = json.load(f)
        except Exception:
            # File might be being written to, skip this poll
            return
        
        torrents = data.get('torrents', {})
        current_hashes = set(torrents.keys())
        
        with state_lock:
            # CHECK FOR DELETED TORRENTS
            # Identify torrents that were in our state but are no longer in the status file
            deleted_hashes = [h for h in torrent_states if h not in current_hashes]
            for h in deleted_hashes:
                state_data = torrent_states[h]
                torrent_name = state_data.get('name', 'Unknown Torrent')
                
                send_notification(
                    title='Superseedr - Torrent Deleted',
                    message=f'"{torrent_name}" has been removed.',
                    torrent_hash=h
                )
                app.logger.info(f"Detected deletion: {torrent_name}")
                del torrent_states[h]

            # PROCESS CURRENT TORRENTS
            for torrent_hash, torrent_data in torrents.items():
                torrent_name = torrent_data.get('torrent_name', 'Unknown Torrent')
                current_state = torrent_data.get('torrent_control_state', '')
                
                # Calculate progress
                pieces_total = torrent_data.get('number_of_pieces_total', 0)
                pieces_completed = torrent_data.get('number_of_pieces_completed', 0)
                progress = (pieces_completed / pieces_total * 100) if pieces_total > 0 else 0
                
                download_speed = torrent_data.get('download_speed_bps', 0)
                connected_peers = torrent_data.get('number_of_successfully_connected_peers', 0)

                # Initialize state if new
                if torrent_hash not in torrent_states:
                    torrent_states[torrent_hash] = {
                        'name': torrent_name,
                        'last_state': current_state,
                        'last_progress': progress,
                        'stalled_counter': 0,
                        'notified_complete': False,
                        'notified_50': False
                    }
                    continue

                cached = torrent_states[torrent_hash]
                
                # 1. CHECK COMPLETION
                if current_state == 'Completed' and not cached['notified_complete']:
                    send_notification(
                        title='Superseedr - Download Complete',
                        message=f'"{torrent_name}" has finished downloading!',
                        torrent_hash=torrent_hash
                    )
                    cached['notified_complete'] = True
                    app.logger.info(f"Notified completion: {torrent_name}")

                # 2. CHECK 50% PROGRESS
                if progress >= 50 and not cached['notified_50'] and progress < 100:
                    send_notification(
                        title='Superseedr - 50% Downloaded',
                        message=f'"{torrent_name}" is halfway done ({int(progress)}%).',
                        torrent_hash=torrent_hash
                    )
                    cached['notified_50'] = True
                    app.logger.info(f"Notified 50%: {torrent_name}")
                
                # 3. CHECK PAUSED
                # If state changed TO Paused/Stopped from something else
                if current_state in ['Paused', 'Stopped'] and cached['last_state'] not in ['Paused', 'Stopped']:
                    send_notification(
                        title='Superseedr - Torrent Paused',
                        message=f'"{torrent_name}" has been paused.',
                        torrent_hash=torrent_hash
                    )
                    app.logger.info(f"Notified paused: {torrent_name}")

                # 4. CHECK STALLED (Running but 0 speed)
                is_running = current_state == 'Running' or current_state == 'Seeding'
                if is_running and progress < 100:
                    if download_speed == 0:
                        cached['stalled_counter'] += 1
                        # Notify if stalled for 3 consecutive polls (approx 15 seconds)
                        if cached['stalled_counter'] == 3:
                            send_notification(
                                title='Superseedr - Torrent Stalled',
                                message=f'"{torrent_name}" has stalled (0 B/s).',
                                torrent_hash=torrent_hash
                            )
                            app.logger.info(f"Notified stalled: {torrent_name}")
                    else:
                        # Reset counter if speed returns
                        cached['stalled_counter'] = 0

                # 5. CHECK RESUMED
                # Was previously stalled (>3 checks) or Paused, and now running with speed
                was_stalled = cached.get('stalled_counter', 0) >= 3
                was_paused = cached['last_state'] in ['Paused', 'Stopped']
                
                is_active_now = is_running and download_speed > 0 and connected_peers > 0
                
                if (was_stalled or was_paused) and is_active_now:
                     send_notification(
                        title='Superseedr - Torrent Resumed',
                        message=f'"{torrent_name}" is downloading again ({connected_peers} peers).',
                        torrent_hash=torrent_hash
                    )
                     # Reset stalled state so we don't notify loop
                     cached['stalled_counter'] = 0
                     app.logger.info(f"Notified resumed: {torrent_name}")

                # Update cache for next poll
                cached['last_state'] = current_state
                cached['last_progress'] = progress
                cached['name'] = torrent_name
        
    except json.JSONDecodeError as e:
        app.logger.error(f"Error parsing status file: {e}")
    except Exception as e:
        app.logger.error(f"Error checking torrents: {e}")


# Flask routes
@app.route('/')
def index():
    """Render the main dashboard"""
    return render_template('index.html', urls=notification_urls)


@app.route('/api/urls', methods=['GET'])
def get_urls():
    """Get current notification URLs"""
    return jsonify({'urls': notification_urls})


@app.route('/api/urls', methods=['POST'])
def add_url():
    """Add a new notification URL"""
    data = request.get_json()
    url = data.get('url', '').strip()
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    if url in notification_urls:
        return jsonify({'error': 'URL already exists'}), 400
    
    with state_lock:
        notification_urls.append(url)
        save_settings()
    
    return jsonify({'success': True, 'urls': notification_urls})


@app.route('/api/urls/<int:index>', methods=['DELETE'])
def remove_url(index):
    """Remove a notification URL by index"""
    with state_lock:
        if 0 <= index < len(notification_urls):
            removed = notification_urls.pop(index)
            save_settings()
            return jsonify({'success': True, 'removed': removed, 'urls': notification_urls})
        else:
            return jsonify({'error': 'Invalid index'}), 400


@app.route('/api/test', methods=['POST'])
def test_notification():
    """Send a test notification"""
    send_notification(
        title='Superseedr - Test Notification',
        message=f'Test notification sent at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
    )
    return jsonify({'success': True, 'message': 'Test notification sent'})


@app.route('/api/status', methods=['GET'])
def get_status():
    """Get plugin status including torrent stats"""
    status_file_exists = os.path.exists(STATUS_FILE)
    
    pending_count = 0
    done_count = 0
    total_count = 0
    
    if status_file_exists:
        try:
            with open(STATUS_FILE, 'r') as f:
                data = json.load(f)
                torrents = data.get('torrents', {})
                total_count = len(torrents)
                for torrent_data in torrents.values():
                    state = torrent_data.get('torrent_control_state', '')
                    if state == 'Completed':
                        done_count += 1
                    else:
                        pending_count += 1
        except Exception as e:
            app.logger.error(f"Error calculating stats for status API: {e}")

    status = {
        'status_file': STATUS_FILE,
        'status_file_exists': status_file_exists,
        'notification_urls_count': len(notification_urls),
        'tracked_torrents_count': len(torrent_states),
        'desktop_notifications_available': DESKTOP_NOTIFICATIONS_AVAILABLE,
        'poll_interval': POLL_INTERVAL,
        'stats': {
            'total': total_count,
            'pending': pending_count,
            'done': done_count
        }
    }
    
    return jsonify(status)


@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Update general settings like poll interval"""
    global POLL_INTERVAL
    data = request.get_json()
    
    new_interval = data.get('poll_interval')
    if new_interval is not None:
        try:
            new_interval = int(new_interval)
            if new_interval < 1:
                return jsonify({'error': 'Interval must be at least 1 second'}), 400
            
            with state_lock:
                POLL_INTERVAL = new_interval
                save_settings()
                
                # Reschedule the background job
                scheduler.reschedule_job('check_torrents_job', trigger='interval', seconds=POLL_INTERVAL)
                app.logger.info(f"Updated poll interval to {POLL_INTERVAL}s and rescheduled job")
                
        except ValueError:
            return jsonify({'error': 'Invalid interval value'}), 400
            
    return jsonify({'success': True, 'poll_interval': POLL_INTERVAL})


if __name__ == '__main__':
    # Load settings on startup
    load_settings()
    
    # Start background scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=check_torrents, trigger="interval", seconds=POLL_INTERVAL, id='check_torrents_job')
    scheduler.start()
    
    app.logger.info(f"Starting Superseedr Notification Plugin")
    app.logger.info(f"Monitoring: {STATUS_FILE}")
    app.logger.info(f"Settings file: {SETTINGS_FILE}")
    app.logger.info(f"Poll interval: {POLL_INTERVAL} seconds")
    app.logger.info(f"Desktop notifications: {'Available' if DESKTOP_NOTIFICATIONS_AVAILABLE else 'Not available'}")
    
    # Run Flask app
    port = int(os.getenv('PORT', 5000))
    try:
        app.run(host='0.0.0.0', port=port, debug=False)
    finally:
        scheduler.shutdown()
