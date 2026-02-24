/**
 * HeavyChart.tsx
 *
 * Re-exports the CreditScoreTrendChart as the "heavy" lazy-loaded chart.
 * Kept for backward-compatibility with lazy-import in App.tsx.
 */

import React from 'react';
import CreditScoreTrendChart from './dashboard/CreditScoreTrendChart';
import { generateDashboardData } from '../utils/dashboard.mocks';

const data = generateDashboardData('7D');

const HeavyChart: React.FC = () => {
    return (
        <CreditScoreTrendChart data={data.creditScoreTrend} />
    );
};

export default HeavyChart;
