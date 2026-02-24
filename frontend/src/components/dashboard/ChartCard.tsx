/**
 * ChartCard.tsx
 *
 * Reusable wrapper for dashboard chart widgets.
 * Provides consistent card styling, title, export menu, and loading state.
 */

import React, { useRef, useState, forwardRef, ReactNode } from 'react';
import { exportChartAsImage, exportDataAsCSV, exportDataAsJSON } from '../../utils/exportUtils';
import { ChartExportFormat } from '../../types/dashboard.types';

interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    loading?: boolean;
    /** Data for CSV/JSON export — pass the raw array */
    exportData?: Record<string, unknown>[];
    /** Column definitions for CSV export */
    csvColumns?: { key: string; label: string }[];
    exportFilename?: string;
    height?: number | string;
    'data-testid'?: string;
}

const ChartCard = forwardRef<HTMLDivElement, ChartCardProps>(({
    title,
    subtitle,
    children,
    loading = false,
    exportData,
    csvColumns,
    exportFilename = 'chart-data',
    height = 320,
    'data-testid': testId,
}, ref) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    const handleExport = async (format: ChartExportFormat) => {
        setMenuOpen(false);
        const el = chartRef.current;

        if ((format === 'PNG' || format === 'SVG') && el) {
            await exportChartAsImage(el, format, exportFilename);
        } else if (format === 'CSV' && exportData && csvColumns) {
            exportDataAsCSV(exportData, csvColumns as { key: never; label: string }[], exportFilename);
        } else if (format === 'JSON' && exportData) {
            exportDataAsJSON(exportData, exportFilename);
        }
    };

    return (
        <div
            ref={ref}
            data-testid={testId || 'chart-card'}
            style={{
                background: 'linear-gradient(135deg, #1e1e2f 0%, #252540 100%)',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
            }}
        >
            {/* Header */}
            <div style={{
                padding: '16px 20px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
            }}>
                <div>
                    <h3 style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#e2e8f0',
                        letterSpacing: '0.02em',
                    }}>
                        {title}
                    </h3>
                    {subtitle && (
                        <p style={{
                            margin: '4px 0 0',
                            fontSize: 12,
                            color: '#64748b',
                        }}>
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Export Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        data-testid="export-button"
                        onClick={() => setMenuOpen(!menuOpen)}
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            color: '#94a3b8',
                            padding: '6px 10px',
                            fontSize: 12,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                        }}
                    >
                        ↓ Export
                    </button>
                    {menuOpen && (
                        <div style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: 4,
                            background: '#2a2a45',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            zIndex: 50,
                            minWidth: 130,
                            overflow: 'hidden',
                        }}>
                            {(['PNG', 'SVG', 'CSV', 'JSON'] as ChartExportFormat[]).map((fmt) => (
                                <button
                                    key={fmt}
                                    data-testid={`export-${fmt.toLowerCase()}`}
                                    onClick={() => handleExport(fmt)}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '10px 16px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#cbd5e1',
                                        fontSize: 13,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.target as HTMLButtonElement).style.background = 'rgba(99,102,241,0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.target as HTMLButtonElement).style.background = 'transparent';
                                    }}
                                >
                                    Export as {fmt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Chart content */}
            <div
                ref={chartRef}
                style={{
                    padding: '0 16px 20px',
                    height: typeof height === 'number' ? height : undefined,
                    minHeight: typeof height === 'string' ? height : undefined,
                    position: 'relative',
                }}
            >
                {loading ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        minHeight: 200,
                    }}>
                        <div style={{
                            width: 36,
                            height: 36,
                            border: '3px solid rgba(99,102,241,0.2)',
                            borderTopColor: '#6366f1',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
});

ChartCard.displayName = 'ChartCard';

export default ChartCard;
