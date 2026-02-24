/**
 * useDashboardData.ts
 *
 * Custom hook managing dashboard data lifecycle:
 * - TimeWindow state
 * - Mock data fetch with loading/error states
 * - Caching per time-window
 * - Auto-refresh every 30s
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { TimeWindow, DashboardData } from '../types/dashboard.types';
import { generateDashboardData } from '../utils/dashboard.mocks';

const REFRESH_INTERVAL = 30_000; // 30 seconds

interface UseDashboardDataReturn {
    data: DashboardData | null;
    loading: boolean;
    error: string | null;
    timeWindow: TimeWindow;
    setTimeWindow: (tw: TimeWindow) => void;
    refresh: () => void;
}

export function useDashboardData(initialWindow: TimeWindow = '7D'): UseDashboardDataReturn {
    const [timeWindow, setTimeWindow] = useState<TimeWindow>(initialWindow);
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cache = useRef<Map<TimeWindow, DashboardData>>(new Map());

    const fetchData = useCallback((tw: TimeWindow) => {
        setLoading(true);
        setError(null);

        // Simulate async fetch
        const timer = setTimeout(() => {
            try {
                // Check cache first
                const cached = cache.current.get(tw);
                if (cached) {
                    setData(cached);
                    setLoading(false);
                    return;
                }

                const result = generateDashboardData(tw);
                cache.current.set(tw, result);
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        }, 300); // small delay for loading state visibility

        return () => clearTimeout(timer);
    }, []);

    const refresh = useCallback(() => {
        // Invalidate cache for current window
        cache.current.delete(timeWindow);
        fetchData(timeWindow);
    }, [timeWindow, fetchData]);

    // Fetch when timeWindow changes
    useEffect(() => {
        const cleanup = fetchData(timeWindow);
        return cleanup;
    }, [timeWindow, fetchData]);

    // Auto-refresh
    useEffect(() => {
        const interval = setInterval(() => {
            cache.current.delete(timeWindow);
            fetchData(timeWindow);
        }, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [timeWindow, fetchData]);

    return { data, loading, error, timeWindow, setTimeWindow, refresh };
}
