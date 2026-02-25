/**
 * RiskDistributionChart.tsx
 *
 * Animated pie chart showing risk level distribution
 * with custom labels, active-sector enlargement, and legend.
 */

import React from 'react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Sector,
} from 'recharts';
import { RiskDistributionSlice } from '../../types/dashboard.types';
import ChartCard from './ChartCard';

interface Props {
    data: RiskDistributionSlice[];
    loading?: boolean;
}

const renderActiveShape = (props: any) => {
    const {
        cx, cy, innerRadius, outerRadius, startAngle, endAngle,
        fill, payload, percent, value,
    } = props;

    return (
        <g>
            <text x={cx} y={cy - 8} textAnchor="middle" fill="#e2e8f0" fontSize={20} fontWeight={700}>
                {value}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize={12}>
                {payload.name} ({(percent * 100).toFixed(0)}%)
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 12}
                outerRadius={outerRadius + 16}
                fill={fill}
            />
        </g>
    );
};

const RiskDistributionChart: React.FC<Props> = ({ data, loading }) => {
    const csvColumns = [
        { key: 'name', label: 'Risk Level' },
        { key: 'value', label: 'Count' },
    ];

    const total = data.reduce((s, d) => s + d.value, 0);

    return (
        <ChartCard
            title="Risk Distribution"
            subtitle="Breakdown by risk level"
            loading={loading}
            exportData={data as unknown as Record<string, unknown>[]}
            csvColumns={csvColumns}
            exportFilename="risk-distribution"
            data-testid="risk-distribution-chart"
        >
            <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1000}
                        animationEasing="ease-out"
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                strokeWidth={0}
                            />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 20,
                marginTop: 4,
            }}>
                {data.map((entry) => (
                    <div key={entry.name} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: '#94a3b8',
                    }}>
                        <div style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            backgroundColor: entry.color,
                        }} />
                        <span>{entry.name}</span>
                        <span style={{ fontWeight: 600, color: '#cbd5e1' }}>
                            {total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                ))}
            </div>
        </ChartCard>
    );
};

export default RiskDistributionChart;
