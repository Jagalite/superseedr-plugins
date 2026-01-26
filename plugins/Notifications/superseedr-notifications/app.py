import json
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

# Global state
notification_urls = []
completed_torrents = set()  # Cache of torrent hashes we've already notified about
state_lock = Lock()


def load_settings():
    """Load notification URLs from settings.json"""
    global notification_urls
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
                notification_urls = data.get('notification_urls', [])
                app.logger.info(f"Loaded {len(notification_urls)} notification URLs from settings")
        else:
            notification_urls = []
            app.logger.info("No settings file found, starting with empty notification URLs")
    except Exception as e:
        app.logger.error(f"Error loading settings: {e}")
        notification_urls = []


def save_settings():
    """Save notification URLs to settings.json"""
    try:
        # Ensure data directory exists
        os.makedirs(DATA_DIR, exist_ok=True)
        
        with open(SETTINGS_FILE, 'w') as f:
            json.dump({'notification_urls': notification_urls}, f, indent=2)
        app.logger.info(f"Saved {len(notification_urls)} notification URLs to settings")
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
    global completed_torrents
    
    try:
        # Check if status file exists
        if not os.path.exists(STATUS_FILE):
            app.logger.debug(f"Status file not found: {STATUS_FILE}")
            return
        
        # Read and parse the status file
        with open(STATUS_FILE, 'r') as f:
            data = json.load(f)
        
        torrents = data.get('torrents', {})
        
        # Check each torrent for completion
        with state_lock:
            for torrent_hash, torrent_data in torrents.items():
                # Skip if we've already notified about this torrent
                if torrent_hash in completed_torrents:
                    continue
                
                # Check if torrent is completed
                state = torrent_data.get('torrent_control_state', '')
                
                # Detect completion - either state is "Completed" or we could check progress
                # Note: Based on the example JSON, there's no 'progress' field visible,
                # so we primarily check torrent_control_state
                if state == 'Completed':
                    torrent_name = torrent_data.get('torrent_name', 'Unknown Torrent')
                    
                    # Mark as notified
                    completed_torrents.add(torrent_hash)
                    
                    # Send notification
                    send_notification(
                        title='Superseedr - Download Complete',
                        message=f'"{torrent_name}" has finished downloading!',
                        torrent_hash=torrent_hash
                    )
                    
                    app.logger.info(f"Detected and notified completion: {torrent_name} ({torrent_hash})")
        
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
    """Get plugin status"""
    status_file_exists = os.path.exists(STATUS_FILE)
    
    status = {
        'status_file': STATUS_FILE,
        'status_file_exists': status_file_exists,
        'notification_urls_count': len(notification_urls),
        'completed_torrents_count': len(completed_torrents),
        'desktop_notifications_available': DESKTOP_NOTIFICATIONS_AVAILABLE
    }
    
    return jsonify(status)


if __name__ == '__main__':
    # Load settings on startup
    load_settings()
    
    # Start background scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=check_torrents, trigger="interval", seconds=POLL_INTERVAL)
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
