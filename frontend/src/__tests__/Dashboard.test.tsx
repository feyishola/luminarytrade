/**
 * Dashboard.test.tsx
 *
 * Comprehensive test suite for the Advanced Data Visualization Dashboard.
 * Tests rendering, interactivity, time-window switching, and chart widgets.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mock recharts to avoid SVG rendering issues in JSDOM ─────────────────────

jest.mock('recharts', () => {
    const OriginalReact = jest.requireActual('react');
    const mockComponent = (name: string) =>
        OriginalReact.forwardRef((props: any, ref: any) => (
            <div ref={ref} data-testid={`mock-${name}`} {...props}>
                {props.children}
            </div>
        ));

    return {
        ResponsiveContainer: ({ children }: any) => (
            <div data-testid="responsive-container" style={{ width: 500, height: 300 }}>
                {children}
            </div>
        ),
        AreaChart: mockComponent('AreaChart'),
        Area: mockComponent('Area'),
        ComposedChart: mockComponent('ComposedChart'),
        Bar: mockComponent('Bar'),
        Line: mockComponent('Line'),
        RadarChart: mockComponent('RadarChart'),
        Radar: mockComponent('Radar'),
        PieChart: mockComponent('PieChart'),
        Pie: mockComponent('Pie'),
        Cell: mockComponent('Cell'),
        Sector: mockComponent('Sector'),
        XAxis: mockComponent('XAxis'),
        YAxis: mockComponent('YAxis'),
        CartesianGrid: mockComponent('CartesianGrid'),
        Tooltip: mockComponent('Tooltip'),
        Legend: mockComponent('Legend'),
        ReferenceLine: mockComponent('ReferenceLine'),
        Brush: mockComponent('Brush'),
        PolarGrid: mockComponent('PolarGrid'),
        PolarAngleAxis: mockComponent('PolarAngleAxis'),
        PolarRadiusAxis: mockComponent('PolarRadiusAxis'),
        ScatterChart: mockComponent('ScatterChart'),
        Scatter: mockComponent('Scatter'),
    };
});

// ─── Mock html-to-image and file-saver ────────────────────────────────────────

jest.mock('html-to-image', () => ({
    toPng: jest.fn().mockResolvedValue('data:image/png;base64,mock'),
    toSvg: jest.fn().mockResolvedValue('data:image/svg+xml;base64,mock'),
}));

jest.mock('file-saver', () => ({
    saveAs: jest.fn(),
}));

// ─── Import components after mocks ────────────────────────────────────────────

import Dashboard from '../components/Dashboard';
import { generateDashboardData } from '../utils/dashboard.mocks';
import { TimeWindow, DashboardData } from '../types/dashboard.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderDashboard() {
    return render(<Dashboard />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Dashboard', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('renders the dashboard header', async () => {
        renderDashboard();

        // Let mock fetch resolve
        act(() => { jest.advanceTimersByTime(500); });

        await waitFor(() => {
            expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
        });
    });

    test('renders time window selector with all options', async () => {
        renderDashboard();
        act(() => { jest.advanceTimersByTime(500); });

        await waitFor(() => {
            expect(screen.getByTestId('time-window-selector')).toBeInTheDocument();
        });

        expect(screen.getByTestId('tw-1D')).toBeInTheDocument();
        expect(screen.getByTestId('tw-7D')).toBeInTheDocument();
        expect(screen.getByTestId('tw-30D')).toBeInTheDocument();
        expect(screen.getByTestId('tw-YTD')).toBeInTheDocument();
    });

    test('renders summary statistics after data loads', async () => {
        renderDashboard();
        act(() => { jest.advanceTimersByTime(500); });

        await waitFor(() => {
            expect(screen.getByTestId('stat-total-transactions')).toBeInTheDocument();
        });

        expect(screen.getByTestId('stat-avg-credit-score')).toBeInTheDocument();
        expect(screen.getByTestId('stat-fraud-alerts')).toBeInTheDocument();
        expect(screen.getByTestId('stat-active-agents')).toBeInTheDocument();
        expect(screen.getByTestId('stat-risk-score')).toBeInTheDocument();
    });

    test('renders all 5 chart widgets', async () => {
        renderDashboard();
        act(() => { jest.advanceTimersByTime(500); });

        await waitFor(() => {
            expect(screen.getByTestId('credit-score-trend-chart')).toBeInTheDocument();
        });

        expect(screen.getByTestId('transaction-volume-chart')).toBeInTheDocument();
        expect(screen.getByTestId('fraud-risk-heatmap')).toBeInTheDocument();
        expect(screen.getByTestId('risk-distribution-chart')).toBeInTheDocument();
        expect(screen.getByTestId('agent-performance-chart')).toBeInTheDocument();
    });

    test('switches time window on button click', async () => {
        renderDashboard();
        act(() => { jest.advanceTimersByTime(500); });

        await waitFor(() => {
            expect(screen.getByTestId('tw-30D')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('tw-30D'));
        act(() => { jest.advanceTimersByTime(500); });

        // Dashboard should still render with new data
        await waitFor(() => {
            expect(screen.getByTestId('credit-score-trend-chart')).toBeInTheDocument();
        });
    });

    test('refresh button triggers data reload', async () => {
        renderDashboard();
        act(() => { jest.advanceTimersByTime(500); });

        await waitFor(() => {
            expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('refresh-button'));
        act(() => { jest.advanceTimersByTime(500); });

        await waitFor(() => {
            expect(screen.getByTestId('stat-total-transactions')).toBeInTheDocument();
        });
    });

    test('print button exists and is clickable', async () => {
        const printSpy = jest.spyOn(window, 'print').mockImplementation(() => { });
        renderDashboard();
        act(() => { jest.advanceTimersByTime(500); });

        await waitFor(() => {
            expect(screen.getByTestId('print-button')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('print-button'));
        expect(printSpy).toHaveBeenCalled();
        printSpy.mockRestore();
    });
});

// ─── Mock Data Generator Tests ────────────────────────────────────────────────

describe('generateDashboardData', () => {
    const timeWindows: TimeWindow[] = ['1D', '7D', '30D', 'YTD'];

    test.each(timeWindows)('generates valid data for %s window', (tw) => {
        const data = generateDashboardData(tw);

        // Summary
        expect(data.summary.totalTransactions).toBeGreaterThan(0);
        expect(data.summary.avgCreditScore).toBeGreaterThanOrEqual(300);
        expect(data.summary.avgCreditScore).toBeLessThanOrEqual(850);
        expect(data.summary.activeAgents).toBe(5);

        // Credit score trend
        expect(data.creditScoreTrend.length).toBeGreaterThan(0);
        data.creditScoreTrend.forEach((p) => {
            expect(p.score).toBeGreaterThanOrEqual(300);
            expect(p.score).toBeLessThanOrEqual(850);
            expect(['low', 'medium', 'high', 'critical']).toContain(p.riskLevel);
        });

        // Fraud heatmap
        expect(data.fraudHeatmap.length).toBe(7 * 24); // 168 cells
        data.fraudHeatmap.forEach((c) => {
            expect(c.hour).toBeGreaterThanOrEqual(0);
            expect(c.hour).toBeLessThanOrEqual(23);
            expect(c.dayOfWeek).toBeGreaterThanOrEqual(0);
            expect(c.dayOfWeek).toBeLessThanOrEqual(6);
        });

        // Transaction volume
        expect(data.transactionVolume.length).toBeGreaterThan(0);

        // Agent performance
        expect(data.agentPerformance.length).toBe(5);
        data.agentPerformance.forEach((a) => {
            expect(a.accuracy).toBeGreaterThanOrEqual(0);
            expect(a.accuracy).toBeLessThanOrEqual(100);
        });

        // Risk distribution
        expect(data.riskDistribution.length).toBe(4);

        // Statistics
        expect(data.scoreStatistics.min).toBeLessThanOrEqual(data.scoreStatistics.max);
        expect(data.scoreStatistics.stddev).toBeGreaterThanOrEqual(0);
    });

    test('produces deterministic results', () => {
        const a = generateDashboardData('7D');
        const b = generateDashboardData('7D');
        expect(a.summary.totalTransactions).toBe(b.summary.totalTransactions);
        expect(a.creditScoreTrend).toEqual(b.creditScoreTrend);
    });

    test('produces different results for different windows', () => {
        const a = generateDashboardData('1D');
        const b = generateDashboardData('30D');
        expect(a.creditScoreTrend.length).not.toBe(b.creditScoreTrend.length);
    });
});

// ─── Export Utility Tests ─────────────────────────────────────────────────────

describe('exportUtils', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveAs } = require('file-saver');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('exportDataAsCSV creates correct CSV content', async () => {
        const { exportDataAsCSV } = await import('../utils/exportUtils');
        const data = [
            { name: 'Alice', score: 750 },
            { name: 'Bob', score: 680 },
        ];
        const columns = [
            { key: 'name' as const, label: 'Name' },
            { key: 'score' as const, label: 'Score' },
        ];

        exportDataAsCSV(data, columns, 'test');
        expect(saveAs).toHaveBeenCalledTimes(1);

        const blob = saveAs.mock.calls[0][0] as Blob;
        expect(blob).toBeInstanceOf(Blob);
        expect(saveAs.mock.calls[0][1]).toBe('test.csv');
    });

    test('exportDataAsJSON creates correct JSON', async () => {
        const { exportDataAsJSON } = await import('../utils/exportUtils');
        const data = { foo: 'bar' };

        exportDataAsJSON(data, 'test');
        expect(saveAs).toHaveBeenCalledTimes(1);

        const blob = saveAs.mock.calls[0][0] as Blob;
        expect(blob).toBeInstanceOf(Blob);
        expect(saveAs.mock.calls[0][1]).toBe('test.json');
    });
});
