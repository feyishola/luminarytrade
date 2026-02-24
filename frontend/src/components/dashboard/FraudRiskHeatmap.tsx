/**
 * FraudRiskHeatmap.tsx
 *
 * Custom heatmap showing fraud activity by hour-of-day × day-of-week.
 * Built with custom SVG for pixel-perfect control.
 */

import React, { useState } from 'react';
import { FraudHeatmapCell } from '../../types/dashboard.types';
import ChartCard from './ChartCard';

interface Props {
    data: FraudHeatmapCell[];
    loading?: boolean;
    onCellClick?: (cell: FraudHeatmapCell) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_SIZE = 28;
const CELL_GAP = 3;
const LABEL_WIDTH = 36;
const HEADER_HEIGHT = 24;

function getColor(count: number, maxCount: number): string {
    if (count === 0) return 'rgba(255,255,255,0.03)';
    const intensity = Math.min(count / Math.max(maxCount, 1), 1);
    if (intensity > 0.75) return '#ef4444';
    if (intensity > 0.5) return '#f97316';
    if (intensity > 0.25) return '#f59e0b';
    return '#6366f1';
}

const FraudRiskHeatmap: React.FC<Props> = ({ data, loading, onCellClick }) => {
    const [hoveredCell, setHoveredCell] = useState<FraudHeatmapCell | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const maxCount = Math.max(...data.map((c) => c.count), 1);

    // Show 6 hour labels: 0, 4, 8, 12, 16, 20
    const hourLabels = [0, 4, 8, 12, 16, 20];

    const svgWidth = LABEL_WIDTH + 24 * (CELL_SIZE + CELL_GAP);
    const svgHeight = HEADER_HEIGHT + 7 * (CELL_SIZE + CELL_GAP) + 10;

    const csvColumns = [
        { key: 'dayLabel', label: 'Day' },
        { key: 'hour', label: 'Hour' },
        { key: 'count', label: 'Fraud Count' },
        { key: 'severity', label: 'Severity' },
    ];

    return (
        <ChartCard
            title="Fraud Risk Heatmap"
            subtitle="Activity by hour & day of week"
            loading={loading}
            exportData={data as unknown as Record<string, unknown>[]}
            csvColumns={csvColumns}
            exportFilename="fraud-heatmap"
            height="auto"
            data-testid="fraud-risk-heatmap"
        >
            <div style={{ overflowX: 'auto', position: 'relative' }}>
                <svg
                    width={svgWidth}
                    height={svgHeight}
                    style={{ display: 'block', margin: '0 auto' }}
                    data-testid="heatmap-svg"
                >
                    {/* Hour labels */}
                    {hourLabels.map((h) => (
                        <text
                            key={`h-${h}`}
                            x={LABEL_WIDTH + h * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2}
                            y={16}
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize={10}
                        >
                            {String(h).padStart(2, '0')}
                        </text>
                    ))}

                    {/* Day labels + cells */}
                    {DAYS.map((day, di) => (
                        <g key={day}>
                            <text
                                x={LABEL_WIDTH - 6}
                                y={HEADER_HEIGHT + di * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + 4}
                                textAnchor="end"
                                fill="#64748b"
                                fontSize={11}
                            >
                                {day}
                            </text>
                            {Array.from({ length: 24 }, (_, h) => {
                                const cell = data.find((c) => c.dayOfWeek === di && c.hour === h);
                                const count = cell?.count ?? 0;
                                const x = LABEL_WIDTH + h * (CELL_SIZE + CELL_GAP);
                                const y = HEADER_HEIGHT + di * (CELL_SIZE + CELL_GAP);

                                return (
                                    <rect
                                        key={`${di}-${h}`}
                                        x={x}
                                        y={y}
                                        width={CELL_SIZE}
                                        height={CELL_SIZE}
                                        rx={4}
                                        fill={getColor(count, maxCount)}
                                        opacity={hoveredCell && hoveredCell.dayOfWeek === di && hoveredCell.hour === h ? 1 : 0.85}
                                        style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                                        onMouseEnter={(e) => {
                                            if (cell) {
                                                setHoveredCell(cell);
                                                const rect = (e.target as SVGRectElement).getBoundingClientRect();
                                                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                            }
                                        }}
                                        onMouseLeave={() => setHoveredCell(null)}
                                        onClick={() => cell && onCellClick?.(cell)}
                                    />
                                );
                            })}
                        </g>
                    ))}
                </svg>

                {/* Tooltip */}
                {hoveredCell && (
                    <div
                        style={{
                            position: 'fixed',
                            left: tooltipPos.x,
                            top: tooltipPos.y - 8,
                            transform: 'translate(-50%, -100%)',
                            background: 'rgba(30,30,47,0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                            zIndex: 100,
                            pointerEvents: 'none',
                        }}
                    >
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                            {hoveredCell.dayLabel} · {String(hoveredCell.hour).padStart(2, '0')}:00
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>
                            {hoveredCell.count} alerts
                        </div>
                        <div style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: hoveredCell.severity === 'critical' ? '#ef4444'
                                : hoveredCell.severity === 'high' ? '#f97316'
                                    : hoveredCell.severity === 'medium' ? '#f59e0b'
                                        : '#22c55e',
                            textTransform: 'uppercase',
                            marginTop: 2,
                        }}>
                            {hoveredCell.severity}
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                    marginTop: 12,
                    fontSize: 11,
                    color: '#64748b',
                }}>
                    {[
                        { label: 'Low', color: '#6366f1' },
                        { label: 'Medium', color: '#f59e0b' },
                        { label: 'High', color: '#f97316' },
                        { label: 'Critical', color: '#ef4444' },
                    ].map((item) => (
                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                backgroundColor: item.color,
                            }} />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>
        </ChartCard>
    );
};

export default FraudRiskHeatmap;
