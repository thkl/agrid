import { describe, expect, it } from 'vitest';
import { buildSparkline } from './agrid-sparkline';

describe('buildSparkline', () => {
  const box = { width: 100, height: 20, padding: 2 };

  it('returns empty geometry for an empty or non-finite series', () => {
    expect(buildSparkline([], box)).toEqual({
      points: [], linePath: '', bars: [], last: null, min: null, max: null,
    });
    expect(buildSparkline([NaN, Infinity], box).points).toEqual([]);
  });

  it('scales a series across the full box, mapping the max to the top and min to the bottom', () => {
    const geo = buildSparkline([0, 5, 10], box);
    // x spans padding..width-padding; 3 points → 2, 50, 98
    expect(geo.points.map(p => p.x)).toEqual([2, 50, 98]);
    // min(0) sits at the bottom (height - padding = 18), max(10) at the top (padding = 2)
    expect(geo.points[0].y).toBe(18);
    expect(geo.points[2].y).toBe(2);
    expect(geo.max).toEqual({ x: 98, y: 2 });
    expect(geo.min).toEqual({ x: 2, y: 18 });
    expect(geo.last).toEqual({ x: 98, y: 2 });
  });

  it('emits a line path beginning with a move command', () => {
    const geo = buildSparkline([1, 3, 2], box);
    expect(geo.linePath.startsWith('M ')).toBe(true);
    expect(geo.linePath).toContain('L ');
  });

  it('draws a flat horizontal line for a single value', () => {
    const geo = buildSparkline([7], box);
    expect(geo.points).toHaveLength(1);
    // Two endpoints at the same y (vertical middle) across the inner width.
    expect(geo.linePath).toBe('M 2 10 L 98 10');
  });

  it('keeps a constant series centred vertically without dividing by zero', () => {
    const geo = buildSparkline([4, 4, 4], box);
    // innerH = 16 → vertical middle is padding + innerH/2 = 10
    expect(geo.points.every(p => p.y === 10)).toBe(true);
    expect(Number.isFinite(geo.points[0].y)).toBe(true);
  });

  it('baselines bars at zero, flagging negatives', () => {
    const geo = buildSparkline([-2, 0, 4], box);
    expect(geo.bars).toHaveLength(3);
    expect(geo.bars[0].negative).toBe(true);
    expect(geo.bars[2].negative).toBe(false);
    // The zero-valued middle bar has no height.
    expect(geo.bars[1].height).toBe(0);
    // Negative and positive bars sit on opposite sides of the baseline.
    expect(geo.bars[0].y).toBeGreaterThan(geo.bars[2].y);
  });

  it('gives all-positive bars a zero baseline (tallest bar fills the box)', () => {
    const geo = buildSparkline([2, 4, 8], box);
    const tallest = geo.bars[2];
    expect(tallest.height).toBe(16); // innerH = height - 2*padding
    expect(geo.bars.every(b => !b.negative)).toBe(true);
  });
});
