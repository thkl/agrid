import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AgridChartProvider } from './agrid-chart-provider';

describe('AgridChartProvider', () => {
  it('exposes static data and lets setData replace it', () => {
    const provider = new AgridChartProvider({
      type: 'column',
      data: { categories: ['A'], series: [{ values: [1] }] },
    });

    expect(provider.type()).toBe('column');
    expect(provider.data().categories).toEqual(['A']);

    provider.type.set('pie');
    provider.setData({ categories: ['B'], series: [{ values: [2] }] });
    expect(provider.type()).toBe('pie');
    expect(provider.data().categories).toEqual(['B']);
  });

  it('derives data from a linked source + transform, reacting to row and type changes', () => {
    const rows = signal<readonly { region: string; total: number }[]>([
      { region: 'North', total: 10 },
      { region: 'South', total: 20 },
    ]);
    const provider = new AgridChartProvider({
      type: 'column',
      source: rows,
      transform: (data, type) => ({
        categories: data.map(r => r.region),
        series: [{ name: type, values: data.map(r => r.total) }],
      }),
    });

    expect(provider.data().categories).toEqual(['North', 'South']);
    expect(provider.data().series[0].values).toEqual([10, 20]);
    expect(provider.data().series[0].name).toBe('column');

    // Filtering a row out of the source updates the chart data.
    rows.set([{ region: 'North', total: 10 }]);
    expect(provider.data().categories).toEqual(['North']);

    // Switching the type re-runs the transform.
    provider.type.set('pie');
    expect(provider.data().series[0].name).toBe('pie');
  });

  it('throws when a source is provided without a transform', () => {
    expect(() => new AgridChartProvider({ type: 'column', source: signal([]) })).toThrow(/transform/);
  });

  it('throws when setData is called on a linked provider', () => {
    const provider = new AgridChartProvider({
      type: 'column',
      source: signal([]),
      transform: () => ({ series: [] }),
    });
    expect(() => provider.setData({ series: [] })).toThrow(/source/);
  });

  it('applies display-option defaults', () => {
    const provider = new AgridChartProvider({ type: 'line', data: { series: [{ values: [1, 2] }] } });
    expect(provider.height()).toBe(220);
    expect(provider.showLegend()).toBe(true);
    expect(provider.showAxis()).toBe(true);
    expect(provider.palette()).toBeUndefined();
  });

  it('honours overridden display options', () => {
    const provider = new AgridChartProvider({
      type: 'donut',
      data: { series: [{ values: [1] }] },
      height: 400,
      showLegend: false,
      showAxis: false,
      palette: ['#000'],
    });
    expect(provider.height()).toBe(400);
    expect(provider.showLegend()).toBe(false);
    expect(provider.showAxis()).toBe(false);
    expect(provider.palette()).toEqual(['#000']);
  });
});
