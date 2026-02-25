/**
 * TimeWindowSelector.tsx
 *
 * Toggle-button group for selecting time windows: 1D | 7D | 30D | YTD
 */

import React from 'react';
import { TimeWindow } from '../../types/dashboard.types';

interface TimeWindowSelectorProps {
    value: TimeWindow;
    onChange: (tw: TimeWindow) => void;
}

const WINDOWS: TimeWindow[] = ['1D', '7D', '30D', 'YTD'];

const TimeWindowSelector: React.FC<TimeWindowSelectorProps> = ({ value, onChange }) => {
    return (
        <div
            data-testid="time-window-selector"
            style={{
                display: 'inline-flex',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                padding: 3,
                gap: 2,
                border: '1px solid rgba(255,255,255,0.06)',
            }}
        >
            {WINDOWS.map((tw) => {
                const isActive = tw === value;
                return (
                    <button
                        key={tw}
                        data-testid={`tw-${tw}`}
                        onClick={() => onChange(tw)}
                        style={{
                            padding: '8px 18px',
                            borderRadius: 10,
                            border: 'none',
                            fontSize: 13,
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: isActive
                                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                : 'transparent',
                            color: isActive ? '#fff' : '#94a3b8',
                            boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) {
                                (e.target as HTMLButtonElement).style.color = '#e2e8f0';
                                (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                (e.target as HTMLButtonElement).style.color = '#94a3b8';
                                (e.target as HTMLButtonElement).style.background = 'transparent';
                            }
                        }}
                    >
                        {tw}
                    </button>
                );
            })}
        </div>
    );
};

export default TimeWindowSelector;
