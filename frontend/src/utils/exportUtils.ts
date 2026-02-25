/**
 * exportUtils.ts
 *
 * Utilities for exporting chart data and images.
 */

import { toPng, toSvg } from 'html-to-image';
import { saveAs } from 'file-saver';

// ─── Image Export ─────────────────────────────────────────────────────────────

export async function exportChartAsImage(
    element: HTMLElement,
    format: 'PNG' | 'SVG' = 'PNG',
    filename = 'chart'
): Promise<void> {
    try {
        if (format === 'SVG') {
            const dataUrl = await toSvg(element, { backgroundColor: '#ffffff' });
            const blob = await (await fetch(dataUrl)).blob();
            saveAs(blob, `${filename}.svg`);
        } else {
            const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: '#ffffff' });
            const blob = await (await fetch(dataUrl)).blob();
            saveAs(blob, `${filename}.png`);
        }
    } catch (err) {
        console.error('Chart export failed:', err);
    }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportDataAsCSV<T extends Record<string, unknown>>(
    data: T[],
    columns: { key: keyof T; label: string }[],
    filename = 'data'
): void {
    const header = columns.map((c) => c.label).join(',');
    const rows = data.map((row) =>
        columns.map((c) => {
            const val = row[c.key];
            const str = String(val ?? '');
            // Escape values containing commas or quotes
            return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${filename}.csv`);
}

// ─── JSON Export ──────────────────────────────────────────────────────────────

export function exportDataAsJSON<T>(data: T, filename = 'data'): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, `${filename}.json`);
}

// ─── Print ────────────────────────────────────────────────────────────────────

export function printDashboard(): void {
    window.print();
}
