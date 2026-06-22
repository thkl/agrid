import { describe, expect, it } from 'vitest';
import { ColDef, GridItem } from '../agrid.types';
import { computeSelectionSummary } from './agrid-selection-summary';

describe('computeSelectionSummary', () => {
  const columns: ColDef[] = [
    { field: 'name', header: 'Name' },
    { field: 'amount', header: 'Amount', type: 'number' },
    { field: 'score', header: 'Score' },
  ];
  const items: GridItem[] = [
    { row: { name: 'A', amount: 10, score: 2 }, originalIndex: 0 },
    { groupLabel: 'Group', count: 2, collapsed: false },
    { row: { name: 'B', amount: '20', score: Number.NaN }, originalIndex: 1 },
  ];

  it('summarizes finite numeric values and skips non-data projected rows', () => {
    expect(computeSelectionSummary(items, columns, {
      rowStart: 0, rowEnd: 2, colStart: 0, colEnd: 2,
    })).toEqual({ count: 3, sum: 32, average: 32 / 3, min: 2, max: 20 });
  });

  it('returns null when the selection has no numeric cells', () => {
    expect(computeSelectionSummary(items, columns, {
      rowStart: 0, rowEnd: 2, colStart: 0, colEnd: 0,
    })).toBeNull();
  });
});
