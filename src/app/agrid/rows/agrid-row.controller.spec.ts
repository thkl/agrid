import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AgridDataSource } from '../agrid-datasource';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { AgridRowController } from './agrid-row.controller';
import { CellPosition, ColDef, GridItem, RowSelectEvent } from '../agrid.types';

describe('AgridRowController', () => {
  it('selects the exact clicked row and emits row data', () => {
    const { controller, selected } = setup({ rowSelection: 'single' });

    controller.selectFromPointer(primaryPointerEvent(), 1, false);

    expect(controller.selectedRowIndex()).toBe(1);
    expect(selected).toEqual([{ rows: [{ row: { name: 'Bob' }, originalIndex: 1 }] }]);
  });

  it('selects a shift range using visible row order', () => {
    const { controller } = setup({ rowSelection: 'multi' });

    controller.selectFromPointer(primaryPointerEvent(), 0, false);
    controller.selectFromPointer(primaryPointerEvent({ shiftKey: true }), 2, false);

    expect([...controller.selectedRowIndices()]).toEqual([0, 1, 2]);
  });

  it('deletes a row and adjusts selected cell/edit state', () => {
    const selectedCell = signal<CellPosition | null>({ rowIndex: 2, colIndex: 0 });
    const { controller, dataSource, removed, editRemoved } = setup({ selectedCell });

    controller.deleteRow(1);

    expect(dataSource.rows()).toEqual([{ name: 'Alice' }, { name: 'Carol' }]);
    expect(selectedCell()).toEqual({ rowIndex: 1, colIndex: 0 });
    expect(editRemoved).toHaveBeenCalledWith(1);
    expect(removed).toEqual([{ index: 1, data: { name: 'Bob' } }]);
  });

  it('includes marked rows when copying a cell or complete row', async () => {
    const { controller, writeText } = setup({ markedRowIndices: new Set([2]) });

    controller.copyCellToClipboard(0, { field: 'name', header: 'Name' });
    await Promise.resolve();
    expect(writeText).toHaveBeenLastCalledWith('Alice\nCarol');

    controller.copyRowToClipboard(1);
    await Promise.resolve();
    expect(writeText).toHaveBeenLastCalledWith('Bob\nCarol');
  });
});

function setup(overrides: {
  rowSelection?: 'none' | 'single' | 'multi';
  selectedCell?: ReturnType<typeof signal<CellPosition | null>>;
  markedRowIndices?: ReadonlySet<number>;
} = {}) {
  const dataSource = new AgridDataSource([
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Carol' },
  ]);
  const selected: (RowSelectEvent | null)[] = [];
  const removed: { index: number; data: Record<string, unknown> }[] = [];
  const editRemoved = vi.fn();
  const writeText = vi.fn().mockResolvedValue(undefined);
  const browser = new AgridBrowserAdapter(
    document,
    { navigator: { clipboard: { writeText } } } as unknown as Window,
  );
  const cols: ColDef[] = [{ field: 'name', header: 'Name' }];
  const items: GridItem[] = dataSource.rows().map((row, originalIndex) => ({ row, originalIndex }));
  const controller = new AgridRowController({
    dataSource: signal(dataSource),
    filteredItems: signal(items),
    visibleColDefs: signal(cols),
    locale: signal('en-US'),
    markedRowIndices: signal(overrides.markedRowIndices ?? new Set()),
    rowSelection: signal(overrides.rowSelection ?? 'multi'),
    selectedCell: overrides.selectedCell ?? signal<CellPosition | null>(null),
    editingCell: signal(null),
    insertRowAt: vi.fn(),
    startDragSelect: vi.fn(),
    onRowSelect: event => selected.push(event),
    onRowClick: vi.fn(),
    onRowRemoved: event => removed.push(event),
    onEditRowRemoved: editRemoved,
    closeFilterMenu: vi.fn(),
    closeGroupActionsMenu: vi.fn(),
  }, browser);
  return { controller, dataSource, selected, removed, editRemoved, writeText };
}

function primaryPointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as PointerEvent;
}
