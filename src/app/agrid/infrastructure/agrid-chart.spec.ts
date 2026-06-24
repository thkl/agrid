import { describe, expect, it } from 'vitest';
import { buildChart } from './agrid-chart';

const box = { width: 200, height: 120 };

describe('buildChart', () => {
  it('returns an empty layout for missing data', () => {
    const layout = buildChart('column', { series: [] }, box);
    expect(layout.bars).toEqual([]);
    expect(layout.legend).toEqual([]);
  });

  it('builds grouped columns with one bar per value and a legend per series', () => {
    const layout = buildChart('column', {
      categories: ['A', 'B'],
      series: [
        { name: 'X', values: [10, 20] },
        { name: 'Y', values: [5, 15] },
      ],
    }, box);

    expect(layout.bars).toHaveLength(4); // 2 series × 2 categories
    expect(layout.legend.map(l => l.name)).toEqual(['X', 'Y']);
    // Series share a category slot — the two series get different x positions within category A.
    const inA = layout.bars.filter(b => b.categoryIndex === 0);
    expect(inA[0].x).not.toBe(inA[1].x);
    // Taller value → taller bar.
    expect(layout.bars[1].height).toBeGreaterThan(layout.bars[0].height);
  });

  it('builds a line path and an area path with a baseline close', () => {
    const line = buildChart('line', { categories: ['A', 'B', 'C'], series: [{ values: [1, 3, 2] }] }, box);
    expect(line.lines).toHaveLength(1);
    expect(line.lines[0].d.startsWith('M ')).toBe(true);
    expect(line.areas).toHaveLength(0);

    const area = buildChart('area', { categories: ['A', 'B', 'C'], series: [{ values: [1, 3, 2] }] }, box);
    expect(area.areas).toHaveLength(1);
    expect(area.areas[0].d.endsWith('Z')).toBe(true); // closed back to the baseline
  });

  it('builds pie slices that sum to the full circle with percent labels', () => {
    const layout = buildChart('pie', {
      categories: ['A', 'B', 'C', 'D'],
      series: [{ values: [25, 25, 25, 25] }],
    }, box);

    expect(layout.slices).toHaveLength(4);
    expect(layout.slices.every(s => s.percentText === '25%')).toBe(true);
    expect(layout.slices.every(s => s.d.includes('A '))).toBe(true); // each has an arc command
    expect(layout.legend.map(l => l.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('renders a single full-value pie slice as a closed full circle', () => {
    const layout = buildChart('donut', { categories: ['Only'], series: [{ values: [100] }] }, box);
    expect(layout.slices).toHaveLength(1);
    expect(layout.slices[0].full).toBe(true);
    expect(layout.slices[0].percentText).toBe('100%');
  });

  it('omits axes when showAxis is false', () => {
    const withAxis = buildChart('column', { categories: ['A'], series: [{ values: [5] }] }, { ...box, showAxis: true });
    const noAxis = buildChart('column', { categories: ['A'], series: [{ values: [5] }] }, { ...box, showAxis: false });
    expect(withAxis.gridlines.length).toBeGreaterThan(0);
    expect(noAxis.gridlines).toHaveLength(0);
    expect(noAxis.axisLabels).toHaveLength(0);
  });

  it('respects an explicit series colour over the palette', () => {
    const layout = buildChart('column', { categories: ['A'], series: [{ color: '#abcdef', values: [3] }] }, box);
    expect(layout.bars[0].color).toBe('#abcdef');
    expect(layout.legend[0].color).toBe('#abcdef');
  });
});
