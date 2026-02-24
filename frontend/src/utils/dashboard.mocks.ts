/**
 * dashboard.mocks.ts
 *
 * Deterministic mock-data generator for all dashboard widgets.
 * Uses a seeded pseudo-random number generator so outputs are repeatable
 * per TimeWindow, but still look realistic.
 */

import {
    TimeWindow,
    DashboardData,
    CreditScoreTrendPoint,
    FraudHeatmapCell,
    TransactionVolumePoint,
    AgentPerformanceMetric,
    RiskDistributionSlice,
    DataStatistics,
    DashboardSummary,
} from '../types/dashboard.types';

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed: number) {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function seedForWindow(tw: TimeWindow): number {
    const map: Record<TimeWindow, number> = { '1D': 101, '7D': 707, '30D': 3030, YTD: 9999 };
    return map[tw];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pointCount(tw: TimeWindow): number {
    switch (tw) {
        case '1D': return 24;   // hourly
        case '7D': return 7;    // daily
        case '30D': return 30;  // daily
        case 'YTD': return 12;  // monthly
    }
}

function dateLabels(tw: TimeWindow): string[] {
    const n = pointCount(tw);
    const now = new Date(2026, 1, 23); // fixed reference

    if (tw === '1D') {
        return Array.from({ length: n }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    }
    if (tw === 'YTD') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.slice(0, n);
    }
    // daily labels
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (n - 1 - i));
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });
}

function calcStats(values: number[]): DataStatistics {
    const total = values.reduce((s, v) => s + v, 0);
    const avg = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
    return { avg: Math.round(avg * 100) / 100, min, max, stddev: Math.round(Math.sqrt(variance) * 100) / 100, total: Math.round(total * 100) / 100 };
}

function riskLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 750) return 'low';
    if (score >= 650) return 'medium';
    if (score >= 550) return 'high';
    return 'critical';
}

// ─── Generators ───────────────────────────────────────────────────────────────

function genCreditScoreTrend(tw: TimeWindow, rng: () => number): CreditScoreTrendPoint[] {
    const labels = dateLabels(tw);
    let score = 680 + Math.floor(rng() * 60);
    return labels.map((date) => {
        score = Math.max(300, Math.min(850, score + Math.floor((rng() - 0.45) * 30)));
        return { date, score, riskLevel: riskLevelFromScore(score) };
    });
}

function genFraudHeatmap(rng: () => number): FraudHeatmapCell[] {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cells: FraudHeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            // Fraud peaks at night (22–04) and midweek
            const nightBoost = (h >= 22 || h <= 4) ? 3 : 1;
            const weekdayBoost = (d >= 1 && d <= 5) ? 1.5 : 1;
            const count = Math.max(0, Math.floor(rng() * 10 * nightBoost * weekdayBoost));
            const severity: FraudHeatmapCell['severity'] =
                count > 20 ? 'critical' : count > 12 ? 'high' : count > 5 ? 'medium' : 'low';
            cells.push({ hour: h, dayOfWeek: d, dayLabel: days[d], count, severity });
        }
    }
    return cells;
}

function genTransactionVolume(tw: TimeWindow, rng: () => number): TransactionVolumePoint[] {
    const labels = dateLabels(tw);
    return labels.map((date) => {
        const count = 50 + Math.floor(rng() * 450);
        const avgAmount = 100 + Math.floor(rng() * 900);
        return { date, count, volume: count * avgAmount, avgAmount };
    });
}

function genAgentPerformance(rng: () => number): AgentPerformanceMetric[] {
    const names = ['Sentinel-X', 'DeepGuard', 'FraudNet', 'RiskBot', 'ChainEye'];
    return names.map((agentName) => ({
        agentName,
        accuracy: 60 + Math.floor(rng() * 40),
        speed: 50 + Math.floor(rng() * 50),
        throughput: 40 + Math.floor(rng() * 60),
        errorRate: 70 + Math.floor(rng() * 30),
        satisfaction: 55 + Math.floor(rng() * 45),
    }));
}

function genRiskDistribution(rng: () => number): RiskDistributionSlice[] {
    const low = 40 + Math.floor(rng() * 20);
    const med = 20 + Math.floor(rng() * 15);
    const high = 10 + Math.floor(rng() * 10);
    const critical = Math.max(2, 100 - low - med - high);
    return [
        { name: 'Low', value: low, color: '#22c55e' },
        { name: 'Medium', value: med, color: '#f59e0b' },
        { name: 'High', value: high, color: '#f97316' },
        { name: 'Critical', value: critical, color: '#ef4444' },
    ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateDashboardData(tw: TimeWindow): DashboardData {
    const rng = mulberry32(seedForWindow(tw));

    const creditScoreTrend = genCreditScoreTrend(tw, rng);
    const fraudHeatmap = genFraudHeatmap(rng);
    const transactionVolume = genTransactionVolume(tw, rng);
    const agentPerformance = genAgentPerformance(rng);
    const riskDistribution = genRiskDistribution(rng);

    const scores = creditScoreTrend.map((p) => p.score);
    const volumes = transactionVolume.map((p) => p.volume);

    const summary: DashboardSummary = {
        totalTransactions: transactionVolume.reduce((s, p) => s + p.count, 0),
        avgCreditScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
        fraudAlerts: fraudHeatmap.filter((c) => c.severity === 'high' || c.severity === 'critical').length,
        activeAgents: agentPerformance.length,
        riskScore: riskDistribution.find((s) => s.name === 'Critical')?.value ?? 0,
    };

    return {
        summary,
        creditScoreTrend,
        fraudHeatmap,
        transactionVolume,
        agentPerformance,
        riskDistribution,
        scoreStatistics: calcStats(scores),
        volumeStatistics: calcStats(volumes),
    };
}
