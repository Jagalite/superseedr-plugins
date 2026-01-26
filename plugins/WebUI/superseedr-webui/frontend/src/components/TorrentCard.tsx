import React from 'react';
import type { TorrentInfo } from '../types';

interface TorrentCardProps {
    info: TorrentInfo;
}

const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatSpeed = (bps: number): string => {
    if (bps === 0) return '0 KB/s';
    const kbps = bps / 1024;
    if (kbps > 1024) {
        return `${(kbps / 1024).toFixed(2)} MB/s`;
    }
    return `${kbps.toFixed(0)} KB/s`;
};

const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
        case 'downloading':
        case 'running':
            return 'bg-status-info text-white';
        case 'seeding':
        case 'uploading':
            return 'bg-status-success text-white';
        case 'paused':
        case 'stopped':
            return 'bg-status-warning text-white';
        case 'error':
            return 'bg-status-error text-white';
        default:
            return 'bg-bg-hover text-text-secondary';
    }
};

const calculateProgress = (info: TorrentInfo): number => {
    if (info.total_size === 0) return 0;
    // Calculate verified pieces vs total pieces if exact bytes aren't reliable
    if (info.number_of_pieces_total > 0) {
        return (info.number_of_pieces_completed / info.number_of_pieces_total) * 100;
    }
    // Fallback to bytes
    // Note: bytes_written vs total_size might be more accurate depending on client impl
    return 0;
};

export const TorrentCard: React.FC<TorrentCardProps> = ({ info }) => {
    const progress = calculateProgress(info);
    const isComplete = progress >= 100;

    return (
        <div className="bg-bg-card rounded-xl shadow-sm border border-border p-5 hover:border-accent-primary/30 transition-colors duration-300">
            {/* Header */}
            <div className="flex justify-between items-start mb-4 gap-4">
                <h3 className="font-semibold text-text-primary text-lg truncate flex-1" title={info.torrent_name}>
                    {info.torrent_name || 'Unknown Torrent'}
                </h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${getStatusColor(info.torrent_control_state)}`}>
                    {info.torrent_control_state}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                    <span>{progress.toFixed(1)}%</span>
                    <span>{formatSize(info.total_size)}</span>
                </div>
                <div className="h-2.5 bg-bg-secondary rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-status-success' : 'bg-gradient-to-r from-accent-primary to-accent-secondary'}`}
                        style={{ width: `${Math.max(progress, 2)}%` }}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-sm mt-4">
                <div className="flex flex-col">
                    <span className="text-text-muted text-xs uppercase">Down</span>
                    <span className="font-medium text-text-primary truncate">{formatSpeed(info.download_speed_bps)}</span>
                </div>
                <div className="flex flex-col border-l border-border pl-3">
                    <span className="text-text-muted text-xs uppercase">Up</span>
                    <span className="font-medium text-text-primary truncate">{formatSpeed(info.upload_speed_bps)}</span>
                </div>
                <div className="flex flex-col border-l border-border pl-3">
                    <span className="text-text-muted text-xs uppercase">Peers</span>
                    <span className="font-medium text-text-primary">{info.number_of_successfully_connected_peers}</span>
                </div>
            </div>

            {/* ETA - Only show if downloading */}
            {!isComplete && info.eta.secs > 0 && (
                <div className="mt-4 pt-3 border-t border-border flex items-center text-xs text-text-muted">
                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                        ETA: {Math.floor(info.eta.secs / 60)}m {info.eta.secs % 60}s
                    </span>
                </div>
            )}
        </div>
    );
};
