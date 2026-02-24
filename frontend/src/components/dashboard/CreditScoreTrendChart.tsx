/**
 * CreditScoreTrendChart.tsx
 *
 * Area chart showing credit score over time with gradient fill,
 * reference threshold lines, and custom tooltips.
 */

import React from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
} from 'recharts';
import { CreditScoreTrendPoint } from '../../types/dashboard.types';
import ChartCard from './ChartCard';

interface Props {
    data: CreditScoreTrendPoint[];
    loading?: boolean;
}

const RISK_THRESHOLDS = [
    { value: 750, label: 'Excellent', color: '#22c55e' },
    { value: 650, label: 'Good', color: '#f59e0b' },
    { value: 550, label: 'Fair', color: '#f97316' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload as CreditScoreTrendPoint;
    const riskColors: Record<string, string> = {
        low: '#22c55e',
        medium: '#f59e0b',
        high: '#f97316',
        critical: '#ef4444',
    };

    return (
        <div style={{
            background: 'rgba(30,30,47,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '12px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#e2e8f0' }}>{point.score}</div>
            <div style={{
                marginTop: 4,
                fontSize: 11,
                fontWeight: 600,
                color: riskColors[point.riskLevel],
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
            }}>
                {point.riskLevel} risk
            </div>
        </div>
    );
};

const CreditScoreTrendChart: React.FC<Props> = ({ data, loading }) => {
    const csvColumns = [
        { key: 'date', label: 'Date' },
        { key: 'score', label: 'Score' },
        { key: 'riskLevel', label: 'Risk Level' },
    ];

    return (
        <ChartCard
            title="Credit Score Trend"
            subtitle="Score progression over time"
            loading={loading}
            exportData={data as unknown as Record<string, unknown>[]}
            csvColumns={csvColumns}
            exportFilename="credit-score-trend"
            data-testid="credit-score-trend-chart"
        >
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
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
                        domain={[300, 850]}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {RISK_THRESHOLDS.map((t) => (
                        <ReferenceLine
                            key={t.value}
                            y={t.value}
                            stroke={t.color}
                            strokeDasharray="6 4"
                            strokeOpacity={0.3}
                            label={{
                                value: t.label,
                                position: 'right',
                                fill: t.color,
                                fontSize: 10,
                                opacity: 0.6,
                            }}
                        />
                    ))}
                    <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#scoreGradient)"
                        animationDuration={1200}
                        animationEasing="ease-out"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default CreditScoreTrendChart;
