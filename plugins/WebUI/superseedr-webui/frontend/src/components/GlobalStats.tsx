import React from 'react';
import type { StatusResponse } from '../types';

interface GlobalStatsProps {
    stats: StatusResponse;
}

const formatSpeed = (bps: number): string => {
    const mbps = bps / 1024 / 1024;
    return `${mbps.toFixed(2)} MB/s`;
};

const formatTime = (secs: number): string => {
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export const GlobalStats: React.FC<GlobalStatsProps> = ({ stats }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Download Speed */}
            <div className="bg-bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="text-text-muted text-sm font-medium mb-1 uppercase tracking-wide">Down Speed</div>
                <div className="text-2xl font-bold text-accent-primary flex items-baseline gap-1">
                    {formatSpeed(stats.total_download_bps)}
                    <span className="text-sm font-normal text-text-secondary">Total</span>
                </div>
            </div>

            {/* Upload Speed */}
            <div className="bg-bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="text-text-muted text-sm font-medium mb-1 uppercase tracking-wide">Up Speed</div>
                <div className="text-2xl font-bold text-status-info flex items-baseline gap-1">
                    {formatSpeed(stats.total_upload_bps)}
                    <span className="text-sm font-normal text-text-secondary">Total</span>
                </div>
            </div>

            {/* CPU Usage */}
            <div className="bg-bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="text-text-muted text-sm font-medium mb-1 uppercase tracking-wide">CPU Usage</div>
                <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-text-primary">{stats.cpu_usage.toFixed(1)}%</div>
                    <div className="flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent-secondary transition-all duration-500"
                            style={{ width: `${Math.min(stats.cpu_usage, 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* RAM Usage */}
            <div className="bg-bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="text-text-muted text-sm font-medium mb-1 uppercase tracking-wide">RAM Usage</div>
                <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-text-primary">{stats.ram_usage_percent.toFixed(1)}%</div>
                    <div className="flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${stats.ram_usage_percent > 80 ? 'bg-status-warning' : 'bg-status-success'}`}
                            style={{ width: `${Math.min(stats.ram_usage_percent, 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Runtime */}
            <div className="bg-bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="text-text-muted text-sm font-medium mb-1 uppercase tracking-wide">Runtime</div>
                <div className="text-2xl font-bold text-text-primary">{formatTime(stats.run_time)}</div>
            </div>
        </div>
    );
};
