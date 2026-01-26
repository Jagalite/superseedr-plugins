export interface Duration {
    secs: number;
    nanos: number;
}

export interface TorrentInfo {
    torrent_control_state: string;
    info_hash: number[];
    torrent_or_magnet: string;
    torrent_name: string;
    download_path: string;
    container_name: string;
    file_priorities: Record<string, unknown>;
    number_of_successfully_connected_peers: number;
    number_of_pieces_total: number;
    number_of_pieces_completed: number;
    download_speed_bps: number;
    upload_speed_bps: number;
    bytes_downloaded_this_tick: number;
    bytes_uploaded_this_tick: number;
    eta: Duration;
    activity_message: string;
    next_announce_in: Duration;
    total_size: number;
    bytes_written: number;
    blocks_in_this_tick: number;
    blocks_out_this_tick: number;
}

export interface SettingsTorrent {
    torrent_or_magnet: string;
    name: string;
    validation_status: boolean;
    download_path: string;
    container_name: string;
    torrent_control_state: string;
    file_priorities: Record<string, unknown>;
}

export interface Settings {
    client_id: string;
    client_port: number;
    torrents: SettingsTorrent[];
    lifetime_downloaded: number;
    lifetime_uploaded: number;
    private_client: boolean;
    torrent_sort_column: string;
    torrent_sort_direction: string;
    peer_sort_column: string;
    peer_sort_direction: string;
    watch_folder: string | null;
    default_download_folder: string;
    max_connected_peers: number;
    bootstrap_nodes: string[];
    global_download_limit_bps: number;
    global_upload_limit_bps: number;
    max_concurrent_validations: number;
    connection_attempt_permits: number;
    resource_limit_override: number | null;
    upload_slots: number;
    peer_upload_in_flight_limit: number;
    tracker_fallback_interval_secs: number;
    client_leeching_fallback_interval_secs: number;
    output_status_interval: number;
}

export interface StatusResponse {
    run_time: number;
    cpu_usage: number;
    ram_usage_percent: number;
    total_download_bps: number;
    total_upload_bps: number;
    torrents: Record<string, TorrentInfo>;
    settings: Settings;
}
