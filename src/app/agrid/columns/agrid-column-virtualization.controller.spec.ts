import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AgridColumnVirtualizationController } from './agrid-column-virtualization.controller';

describe('AgridColumnVirtualizationController', () => {
  function make(opts: {
    widths: number[];
    scrollLeft?: number;
    viewportWidth?: number;
    minColumns?: number;
    overscanPx?: number;
  }) {
    return new AgridColumnVirtualizationController({
      columnWidths: signal(opts.widths),
      scrollLeft: signal(opts.scrollLeft ?? 0),
      viewportWidth: signal(opts.viewportWidth ?? 0),
      minColumns: signal(opts.minColumns ?? 4),
      overscanPx: opts.overscanPx ?? 0,
    });
  }

  it('renders the full set when the column count is at or below the threshold', () => {
    const ctrl = make({ widths: [100, 100, 100, 100], viewportWidth: 200, minColumns: 4 });
    expect(ctrl.window()).toEqual({ start: 0, end: 4, leftWidth: 0, rightWidth: 0 });
  });

  it('renders an initial window when the viewport has not been measured yet', () => {
    const ctrl = make({ widths: Array(10).fill(100), viewportWidth: 0, overscanPx: 100 });
    expect(ctrl.window()).toEqual({ start: 0, end: 5, leftWidth: 0, rightWidth: 500 });
  });

  it('windows to the visible columns and reports spacer widths', () => {
    // 10 columns × 100px. Viewport 250px at scrollLeft 300 → x range [300, 550).
    const ctrl = make({ widths: Array(10).fill(100), viewportWidth: 250, scrollLeft: 300 });
    const win = ctrl.window();
    // columns 3,4,5 cover [300,600); col 5 left edge 500 < 550 so it's included.
    expect(win.start).toBe(3);
    expect(win.end).toBe(6);
    expect(win.leftWidth).toBe(300); // columns 0..2
    expect(win.rightWidth).toBe(400); // columns 6..9
  });

  it('includes overscan columns on both sides', () => {
    const ctrl = make({ widths: Array(10).fill(100), viewportWidth: 100, scrollLeft: 300, overscanPx: 100 });
    const win = ctrl.window();
    // base visible col 3 ([300,400)); overscan 100 widens to [200,500) → cols 2,3,4.
    expect(win.start).toBe(2);
    expect(win.end).toBe(5);
    expect(win.leftWidth).toBe(200);
    expect(win.rightWidth).toBe(500);
  });

  it('handles variable column widths', () => {
    const widths = [50, 50, 200, 200, 50, 50, 50, 50]; // total 700
    const ctrl = make({ widths, viewportWidth: 150, scrollLeft: 120 });
    const win = ctrl.window();
    // edges: 0,50,100,300,500,550,600,650,700. Range [120,270).
    // col 2 [100,300) overlaps; col 1 right edge 100 <= 120 so excluded → start 2.
    // col 3 left edge 300 >= 270 → end 3.
    expect(win.start).toBe(2);
    expect(win.end).toBe(3);
    expect(win.leftWidth).toBe(100);
    expect(win.rightWidth).toBe(400);
  });

  it('renders the full set when the threshold is raised above the column count', () => {
    const ctrl = make({
      widths: Array(10).fill(100),
      viewportWidth: 250,
      scrollLeft: 300,
      minColumns: 1000, // effectively disabled
    });
    expect(ctrl.window()).toEqual({ start: 0, end: 10, leftWidth: 0, rightWidth: 0 });
  });

  it('reacts to a threshold change', () => {
    const minColumns = signal(1000);
    const ctrl = new AgridColumnVirtualizationController({
      columnWidths: signal(Array(10).fill(100)),
      scrollLeft: signal(300),
      viewportWidth: signal(250),
      minColumns,
      overscanPx: 0,
    });
    expect(ctrl.window().end - ctrl.window().start).toBe(10); // disabled

    minColumns.set(4); // now virtualizes
    expect(ctrl.window().end - ctrl.window().start).toBeLessThan(10);
  });

  it('always renders at least one column when scrolled to the far edge', () => {
    const ctrl = make({ widths: Array(10).fill(100), viewportWidth: 100, scrollLeft: 100_000 });
    const win = ctrl.window();
    expect(win.end - win.start).toBeGreaterThanOrEqual(1);
  });
});
