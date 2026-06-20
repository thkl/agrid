import { describe, expect, it } from 'vitest';
import { buildPivotResult } from './agrid-pivot';
import { ColDef } from './agrid.types';

interface Sale {
  region: string;
  quarter: string;
  revenue: number | null;
}

const columns: ColDef<Sale>[] = [
  { field: 'region', header: 'Region' },
  { field: 'quarter', header: 'Quarter' },
  { field: 'revenue', header: 'Revenue', type: 'number', formatter: value => `$${value}` },
];

describe('buildPivotResult', () => {
  const rows: Sale[] = [
    { region: 'West', quarter: 'Q2', revenue: 7 },
    { region: 'East', quarter: 'Q1', revenue: 10 },
    { region: 'East', quarter: 'Q1', revenue: 5 },
    { region: 'East', quarter: 'Q2', revenue: 20 },
    { region: 'West', quarter: 'Q1', revenue: 3 },
  ];

  it('creates sorted row and column dimensions and sums each intersection', () => {
    const result = buildPivotResult(rows, columns, {
      rowField: 'region',
      columnField: 'quarter',
      valueField: 'revenue',
      aggregate: 'sum',
    });

    expect(result.columns.map(column => column.header)).toEqual(['Region', 'Q1', 'Q2']);
    expect(result.rows).toEqual([
      { region: 'East', __agrid_pivot_0: 15, __agrid_pivot_1: 20 },
      { region: 'West', __agrid_pivot_0: 3, __agrid_pivot_1: 7 },
    ]);
    expect(result.columns.every(column => column.editable === false)).toBe(true);
  });

  it('supports average, count, and custom aggregations', () => {
    const average = buildPivotResult(rows, columns, {
      rowField: 'region', columnField: 'quarter', valueField: 'revenue', aggregate: 'avg',
    });
    const count = buildPivotResult(rows, columns, {
      rowField: 'region', columnField: 'quarter', valueField: 'revenue', aggregate: 'count',
    });
    const custom = buildPivotResult(rows, columns, {
      rowField: 'region',
      columnField: 'quarter',
      valueField: 'revenue',
      aggregate: values => values.join('|'),
    });

    expect(average.rows[0]['__agrid_pivot_0']).toBe(7.5);
    expect(count.rows[0]['__agrid_pivot_0']).toBe(2);
    expect(count.columns[1].formatter).toBeUndefined();
    expect(custom.rows[0]['__agrid_pivot_0']).toBe('10|5');
  });

  it('uses null for missing intersections and validates configured fields', () => {
    const result = buildPivotResult(rows.slice(0, 1), columns, {
      rowField: 'region', columnField: 'quarter', valueField: 'revenue',
    });
    expect(result.rows[0]['__agrid_pivot_0']).toBe(7);

    expect(() => buildPivotResult(rows, columns, {
      rowField: 'region', columnField: 'quarter', valueField: 'missing' as keyof Sale,
    })).toThrowError(/must reference configured columns/);
  });
});
