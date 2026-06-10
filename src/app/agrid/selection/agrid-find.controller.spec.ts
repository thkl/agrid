import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AgridFindController } from './agrid-find.controller';

describe('AgridFindController', () => {
  it('matches formatted visible values and navigates to matches', () => {
    const selectedCell = signal(null);
    const selectedRange = signal(null);
    const scrollToCell = vi.fn();
    const controller = new AgridFindController({
      filteredItems: signal([
        { row: { name: 'Alice', amount: 10 }, originalIndex: 0 },
        { row: { name: 'Bob', amount: 20 }, originalIndex: 1 },
      ]),
      visibleColDefs: signal([
        { field: 'name', header: 'Name' },
        { field: 'amount', header: 'Amount', formatter: value => `$${value}` },
      ]),
      locale: signal('en-US'),
      selectedCell,
      selectedRange,
      scrollToCell,
      focusGrid: vi.fn(),
    });

    controller.setQuery('$20');

    expect(controller.matches()).toEqual([{ rowIndex: 1, displayIndex: 1, colIndex: 1 }]);
    expect(selectedCell()).toEqual({ rowIndex: 1, colIndex: 1 });
    expect(scrollToCell).toHaveBeenCalledWith(1, 1);
    expect(controller.isActiveMatchCell(1, 1)).toBe(true);
  });
});
