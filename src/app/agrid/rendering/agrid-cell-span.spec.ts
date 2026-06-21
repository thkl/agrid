import { describe, expect, it } from 'vitest';
import { ColDef } from '../agrid.types';
import { resolveCellSpanLayout } from './agrid-cell-span';

interface Row {
  first: string;
  second: string;
  third: string;
  summary: boolean;
}

describe('cell span layout', () => {
  const row: Row = { first: 'A', second: 'B', third: 'C', summary: true };

  it('marks covered cells and leaves the next uncovered cell in place', () => {
    const columns: ColDef<Row>[] = [
      { field: 'first', header: 'First', colSpan: 2 },
      { field: 'second', header: 'Second' },
      { field: 'third', header: 'Third' },
    ];

    expect(resolveCellSpanLayout(columns, 0, row, 4)).toEqual({ covered: false, span: 2 });
    expect(resolveCellSpanLayout(columns, 1, row, 4)).toEqual({ covered: true, span: 1 });
    expect(resolveCellSpanLayout(columns, 2, row, 4)).toEqual({ covered: false, span: 1 });
  });

  it('passes typed row context and clamps invalid spans to the pane', () => {
    const columns: ColDef<Row>[] = [
      { field: 'first', header: 'First' },
      {
        field: 'second',
        header: 'Second',
        colSpan: params => {
          expect(params).toEqual({
            row,
            value: 'B',
            column: columns[1],
            originalIndex: 7,
          });
          return params.row.summary ? 99 : 1;
        },
      },
      { field: 'third', header: 'Third' },
    ];

    expect(resolveCellSpanLayout(columns, 1, row, 7)).toEqual({ covered: false, span: 2 });
    expect(resolveCellSpanLayout(columns, 2, row, 7)).toEqual({ covered: true, span: 1 });
  });

  it('normalizes zero, negative, fractional, and non-finite spans', () => {
    const spans = [0, -2, 2.8, Number.NaN];
    const expected = [1, 1, 2, 1];

    spans.forEach((colSpan, index) => {
      const columns: ColDef<Row>[] = [
        { field: 'first', header: 'First', colSpan },
        { field: 'second', header: 'Second' },
        { field: 'third', header: 'Third' },
      ];
      expect(resolveCellSpanLayout(columns, 0, row, index).span).toBe(expected[index]);
    });
  });
});
