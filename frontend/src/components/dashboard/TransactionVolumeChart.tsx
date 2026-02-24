/**
 * TransactionVolumeChart.tsx
 *
 * Composed chart with bars (count) and line (volume) overlay.
 * Includes brush for zoom/pan and crosshair cursor.
 */

import React from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Brush,
    Legend,
} from 'recharts';
import { TransactionVolumePoint } from '../../types/dashboard.types';
import ChartCard from './ChartCard';

interface Props {
    data: TransactionVolumePoint[];
    loading?: boolean;
}

const formatNumber = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
        <div style={{
            background: 'rgba(30,30,47,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '12px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{label}</div>
            {payload.map((entry: any, i: number) => (
                <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                    fontSize: 13,
                }}>
                    <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: entry.color,
                    }} />
                    <span style={{ color: '#94a3b8' }}>{entry.name}:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {formatNumber(entry.value)}
                    </span>
                </div>
            ))}
        </div>
    );
};

const TransactionVolumeChart: React.FC<Props> = ({ data, loading }) => {
    const csvColumns = [
        { key: 'date', label: 'Date' },
        { key: 'count', label: 'Transaction Count' },
        { key: 'volume', label: 'Volume ($)' },
        { key: 'avgAmount', label: 'Avg Amount ($)' },
    ];

    return (
        <ChartCard
            title="Transaction Volume"
            subtitle="Count & value over time"
            loading={loading}
            exportData={data as unknown as Record<string, unknown>[]}
            csvColumns={csvColumns}
            exportFilename="transaction-volume"
            data-testid="transaction-volume-chart"
        >
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        tickLine={false}
                    />
                    <YAxis
                        yAxisId="count"
                        orientation="left"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatNumber}
                    />
                    <YAxis
                        yAxisId="volume"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatNumber}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                    <Legend
                        wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
                    />
                    <Bar
                        yAxisId="count"
                        dataKey="count"
                        name="Transactions"
                        fill="url(#barGradient)"
                        radius={[4, 4, 0, 0]}
                        animationDuration={1000}
                    />
                    <Line
                        yAxisId="volume"
                        dataKey="volume"
                        name="Volume ($)"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5, fill: '#22d3ee' }}
                        animationDuration={1200}
                    />
                    {data.length > 10 && (
                        <Brush
                            dataKey="date"
                            height={24}
                            stroke="rgba(99,102,241,0.4)"
                            fill="rgba(30,30,47,0.8)"
                            travellerWidth={10}
                        />
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default TransactionVolumeChart;
