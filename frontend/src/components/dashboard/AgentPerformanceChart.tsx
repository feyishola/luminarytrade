/**
 * AgentPerformanceChart.tsx
 *
 * Radar chart comparing multiple AI agents across 5 performance metrics.
 * Interactive legend to toggle agents on/off.
 */

import React, { useState } from 'react';
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Legend,
    Tooltip,
} from 'recharts';
import { AgentPerformanceMetric } from '../../types/dashboard.types';
import ChartCard from './ChartCard';

interface Props {
    data: AgentPerformanceMetric[];
    loading?: boolean;
}

const AGENT_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#ef4444', '#22c55e'];

const METRICS = ['accuracy', 'speed', 'throughput', 'errorRate', 'satisfaction'] as const;
const METRIC_LABELS: Record<string, string> = {
    accuracy: 'Accuracy',
    speed: 'Speed',
    throughput: 'Throughput',
    errorRate: 'Error Free',
    satisfaction: 'Satisfaction',
};

const AgentPerformanceChart: React.FC<Props> = ({ data, loading }) => {
    const [hiddenAgents, setHiddenAgents] = useState<Set<string>>(new Set());

    // Reshape data for Recharts radar: one entry per metric
    const radarData = METRICS.map((metric) => {
        const entry: Record<string, string | number> = { metric: METRIC_LABELS[metric] };
        data.forEach((agent) => {
            entry[agent.agentName] = agent[metric];
        });
        return entry;
    });

    const toggleAgent = (agentName: string) => {
        setHiddenAgents((prev) => {
            const next = new Set(prev);
            if (next.has(agentName)) next.delete(agentName);
            else next.add(agentName);
            return next;
        });
    };

    const csvColumns = [
        { key: 'agentName', label: 'Agent' },
        { key: 'accuracy', label: 'Accuracy' },
        { key: 'speed', label: 'Speed' },
        { key: 'throughput', label: 'Throughput' },
        { key: 'errorRate', label: 'Error Free Rate' },
        { key: 'satisfaction', label: 'Satisfaction' },
    ];

    return (
        <ChartCard
            title="Agent Performance"
            subtitle="Multi-metric comparison"
            loading={loading}
            exportData={data as unknown as Record<string, unknown>[]}
            csvColumns={csvColumns}
            exportFilename="agent-performance"
            data-testid="agent-performance-chart"
        >
            <ResponsiveContainer width="100%" height={300}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                    />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: '#64748b' }}
                        axisLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'rgba(30,30,47,0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            fontSize: 12,
                            color: '#e2e8f0',
                        }}
                    />
                    {data.map((agent, i) => (
                        !hiddenAgents.has(agent.agentName) && (
                            <Radar
                                key={agent.agentName}
                                name={agent.agentName}
                                dataKey={agent.agentName}
                                stroke={AGENT_COLORS[i % AGENT_COLORS.length]}
                                fill={AGENT_COLORS[i % AGENT_COLORS.length]}
                                fillOpacity={0.15}
                                strokeWidth={2}
                                animationDuration={800}
                            />
                        )
                    ))}
                </RadarChart>
            </ResponsiveContainer>

            {/* Custom Legend */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 12,
                marginTop: 4,
            }}>
                {data.map((agent, i) => {
                    const isHidden = hiddenAgents.has(agent.agentName);
                    return (
                        <button
                            key={agent.agentName}
                            onClick={() => toggleAgent(agent.agentName)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 6,
                                border: 'none',
                                background: isHidden ? 'transparent' : 'rgba(255,255,255,0.05)',
                                cursor: 'pointer',
                                fontSize: 11,
                                color: isHidden ? '#475569' : '#cbd5e1',
                                textDecoration: isHidden ? 'line-through' : 'none',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: isHidden ? '#475569' : AGENT_COLORS[i % AGENT_COLORS.length],
                            }} />
                            {agent.agentName}
                        </button>
                    );
                })}
            </div>
        </ChartCard>
    );
};

export default AgentPerformanceChart;
