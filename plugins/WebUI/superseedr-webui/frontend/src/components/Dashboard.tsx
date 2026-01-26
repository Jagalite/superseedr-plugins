import React from 'react';
import { useStats } from '../hooks/useStats';
import { GlobalStats } from './GlobalStats';
import { TorrentCard } from './TorrentCard';

export const Dashboard: React.FC = () => {
    const { stats, loading, error } = useStats();

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="bg-status-error/10 text-status-error p-6 rounded-xl border border-status-error/20 max-w-md text-center">
                    <h3 className="text-lg font-bold mb-2">Connection Error</h3>
                    <p>{error}</p>
                    <p className="text-sm mt-4 text-text-muted">Is the backend server running?</p>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const torrentsList = Object.values(stats.torrents || {});

    return (
        <main className="container mx-auto px-4 py-8">
            {/* Global Status Bar */}
            <GlobalStats stats={stats} />

            {/* Main Content */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-text-primary">
                        Active Torrents <span className="text-text-muted text-lg font-normal">({torrentsList.length})</span>
                    </h2>
                    {/* Filters could go here later */}
                </div>

                {torrentsList.length === 0 ? (
                    <div className="text-center py-20 bg-bg-secondary/30 rounded-3xl border border-dashed border-border">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-card mb-4 shadow-sm">
                            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-medium text-text-primary mb-2">No Active Torrents</h3>
                        <p className="text-text-muted">Add a torrent to the watch folder to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {torrentsList.map((torrent, index) => (
                            // Use info_hash as key if available (it's an array of numbers, convert to string)
                            // Or index as fallback
                            <TorrentCard
                                key={torrent.info_hash ? torrent.info_hash.join('-') : index}
                                info={torrent}
                            />
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
};
