import { useState, useEffect } from 'react';
import type { StatusResponse } from '../types';

interface UseStatsResult {
    stats: StatusResponse | null;
    loading: boolean;
    error: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/stats';

export const useStats = (): UseStatsResult => {
    const [stats, setStats] = useState<StatusResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch(API_URL);
                if (!response.ok) {
                    throw new Error(`Connection error: ${response.statusText}`);
                }
                const data = await response.json();
                setStats(data);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch stats');
            } finally {
                setLoading(false);
            }
        };

        // Initial fetch
        fetchStats();

        // Poll every 1 second
        const intervalId = setInterval(fetchStats, 1000);

        return () => clearInterval(intervalId);
    }, []);

    return { stats, loading, error };
};
