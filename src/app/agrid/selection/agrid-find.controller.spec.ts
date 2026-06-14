import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AgridDataSource } from '../agrid-datasource';
import { CellPosition } from '../agrid.types';
import { AgridFindController } from './agrid-find.controller';

describe('AgridFindController', () => {
  it('matches formatted visible values and navigates to matches', () => {
    const selectedCell = signal<CellPosition | null>(null);
    const selectedRange = signal(null);
    const revealMatch = vi.fn();
    const controller = new AgridFindController({
      dataSource: signal(new AgridDataSource([
        { name: 'Alice', amount: 10 },
        { name: 'Bob', amount: 20 },
      ])),
      filteredSortedIndices: signal([0, 1]),
      visibleColDefs: signal([
        { field: 'name', header: 'Name' },
        { field: 'amount', header: 'Amount', formatter: value => `$${value}` },
      ]),
      locale: signal('en-US'),
      selectedCell,
      selectedRange,
      revealMatch,
      focusGrid: vi.fn(),
    });

    controller.setQuery('$20');

    expect(controller.matches()).toEqual([{ rowIndex: 1, colIndex: 1 }]);
    expect(selectedCell()).toBeNull();

    controller.goToMatch(1);

    expect(selectedCell()).toEqual({ rowIndex: 1, colIndex: 1 });
    expect(revealMatch).toHaveBeenCalledWith(1, 1);
    expect(controller.isActiveMatchCell(1, 1)).toBe(true);
  });

  it('clears cell and range selection when find opens', () => {
    const selectedCell = signal<CellPosition | null>({ rowIndex: 1, colIndex: 0 });
    const selectedRange = signal({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 0 },
    });
    const controller = new AgridFindController({
      dataSource: signal(new AgridDataSource([{ name: 'Alice' }, { name: 'Bob' }])),
      filteredSortedIndices: signal([0, 1]),
      visibleColDefs: signal([{ field: 'name', header: 'Name' }]),
      locale: signal('en-US'),
      selectedCell,
      selectedRange,
      revealMatch: vi.fn(),
      focusGrid: vi.fn(),
    });

    controller.show();

    expect(selectedCell()).toBeNull();
    expect(selectedRange()).toBeNull();
  });
});
