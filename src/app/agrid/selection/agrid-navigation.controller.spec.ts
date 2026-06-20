import { WritableSignal, signal } from '@angular/core';
import { Mock, describe, expect, it, vi } from 'vitest';
import { CellRange } from './agrid-clipboard.handler';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import {
  AgridNavigationController,
  AgridNavigationControllerOptions,
  AgridVerticalViewport,
} from './agrid-navigation.controller';
import { CellPosition, ColDef, GridItem, NewRecord } from '../agrid.types';

describe('AgridNavigationController', () => {
  it('wraps across columns and skips group headers', () => {
    const { controller, selectedCell, focusGrid } = setup({
      filteredItems: [
        dataItem(0),
        { groupLabel: 'Next', count: 1, collapsed: false },
        dataItem(1),
      ],
    });
    selectedCell.set({ rowIndex: 0, colIndex: 1 });

    controller.handleKeyDown(keyboardEvent('Tab'));

    expect(selectedCell()).toEqual({ rowIndex: 1, colIndex: 0 });
    expect(focusGrid).toHaveBeenCalled();
  });

  it('extends the current range with Shift+arrow', () => {
    const { controller, selectedCell, extendRangeTo } = setup();
    selectedCell.set({ rowIndex: 0, colIndex: 0 });

    controller.handleKeyDown(keyboardEvent('ArrowDown', { shiftKey: true }));

    expect(extendRangeTo).toHaveBeenCalledWith(1, 0);
  });

  it('moves Page Up and Page Down by the visible viewport row count', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      name: `Row ${index}`, amount: index, hidden: 'x',
    }));
    const { controller, selectedCell } = setup({
      initialRows: rows,
      filteredItems: rows.map((_, index) => dataItem(index)),
      viewport: createViewport(0, 120),
    });
    selectedCell.set({ rowIndex: 5, colIndex: 1 });

    controller.handleKeyDown(keyboardEvent('PageDown'));
    expect(selectedCell()).toEqual({ rowIndex: 8, colIndex: 1 });

    controller.handleKeyDown(keyboardEvent('PageUp'));
    expect(selectedCell()).toEqual({ rowIndex: 5, colIndex: 1 });
  });

  it('uses Home and End for row edges and Ctrl/Cmd for grid corners', () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      name: `Row ${index}`, amount: index, hidden: 'x',
    }));
    const { controller, selectedCell } = setup({
      initialRows: rows,
      filteredItems: rows.map((_, index) => dataItem(index)),
    });
    selectedCell.set({ rowIndex: 2, colIndex: 1 });

    controller.handleKeyDown(keyboardEvent('Home'));
    expect(selectedCell()).toEqual({ rowIndex: 2, colIndex: 0 });
    controller.handleKeyDown(keyboardEvent('End'));
    expect(selectedCell()).toEqual({ rowIndex: 2, colIndex: 1 });
    controller.handleKeyDown(keyboardEvent('Home', { ctrlKey: true }));
    expect(selectedCell()).toEqual({ rowIndex: 0, colIndex: 0 });
    controller.handleKeyDown(keyboardEvent('End', { metaKey: true }));
    expect(selectedCell()).toEqual({ rowIndex: 3, colIndex: 1 });
  });

  it('extends the selected range with Shift+PageDown', () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      name: `Row ${index}`, amount: index, hidden: 'x',
    }));
    const { controller, selectedCell, extendRangeTo } = setup({
      initialRows: rows,
      filteredItems: rows.map((_, index) => dataItem(index)),
      viewport: createViewport(0, 80),
    });
    selectedCell.set({ rowIndex: 1, colIndex: 0 });

    controller.handleKeyDown(keyboardEvent('PageDown', { shiftKey: true }));

    expect(extendRangeTo).toHaveBeenCalledWith(3, 0);
  });

  it('clears cell and range navigation when a grid control takes focus', () => {
    const { controller, selectedCell, selectedRange, cancelEdit } = setup();
    selectedCell.set({ rowIndex: 0, colIndex: 0 });
    selectedRange.set({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 1 },
    });

    controller.deactivateCell();

    expect(selectedCell()).toBeNull();
    expect(selectedRange()).toBeNull();
    expect(cancelEdit).toHaveBeenCalledOnce();
  });

  it('does not route filter input keys into cell editing', () => {
    const { controller, selectedCell, startEdit } = setup();
    selectedCell.set({ rowIndex: 0, colIndex: 0 });
    const filter = document.createElement('input');
    filter.className = 'ag-filter-input';

    controller.handleKeyDown(keyboardEvent('a', { target: filter }));

    expect(startEdit).not.toHaveBeenCalled();
  });

  it('commits edits before moving and routes undo and redo shortcuts', () => {
    const editingCell = signal<CellPosition | null>({ rowIndex: 0, colIndex: 0 });
    const { controller, commitEdit, undoEdit, redoEdit, selectedCell } = setup({ editingCell });
    selectedCell.set({ rowIndex: 0, colIndex: 0 });

    controller.handleKeyDown(keyboardEvent('Tab'));
    controller.handleKeyDown(keyboardEvent('z', { ctrlKey: true }));
    controller.handleKeyDown(keyboardEvent('z', { ctrlKey: true, shiftKey: true }));
    controller.handleKeyDown(keyboardEvent('y', { ctrlKey: true }));

    expect(commitEdit).toHaveBeenCalledOnce();
    expect(undoEdit).toHaveBeenCalledOnce();
    expect(redoEdit).toHaveBeenCalledTimes(2);
  });

  it('commits Enter edits and keeps the current cell selected when configured', () => {
    const editingCell = signal<CellPosition | null>({ rowIndex: 0, colIndex: 0 });
    const { controller, commitEdit, selectedCell, focusGrid } = setup({
      editingCell,
      enterEditAction: 'nothing',
    });
    selectedCell.set({ rowIndex: 0, colIndex: 0 });

    controller.handleKeyDown(keyboardEvent('Enter'));

    expect(commitEdit).toHaveBeenCalledOnce();
    expect(selectedCell()).toEqual({ rowIndex: 0, colIndex: 0 });
    expect(focusGrid).toHaveBeenCalledOnce();
  });

  it('commits Enter edits, skips read-only columns, and starts editing the next text column', () => {
    const editingCell = signal<CellPosition | null>({ rowIndex: 0, colIndex: 0 });
    const { controller, selectedCell, startEdit, focusGrid } = setup({
      editingCell,
      enterEditAction: 'nextColumn',
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'locked', header: 'Locked', editable: false },
        { field: 'notes', header: 'Notes', type: 'text' },
      ],
      initialRows: [{ name: 'Alice', locked: 'skip', notes: 'ready' }],
    });
    selectedCell.set({ rowIndex: 0, colIndex: 0 });

    controller.handleKeyDown(keyboardEvent('Enter'));

    expect(selectedCell()).toEqual({ rowIndex: 0, colIndex: 2 });
    expect(startEdit).toHaveBeenCalledWith(0, 2, '', false);
    expect(focusGrid).not.toHaveBeenCalled();
  });

  it('commits Enter edits and moves down by default', () => {
    const editingCell = signal<CellPosition | null>({ rowIndex: 0, colIndex: 0 });
    const { controller, selectedCell } = setup({ editingCell });
    selectedCell.set({ rowIndex: 0, colIndex: 0 });

    controller.handleKeyDown(keyboardEvent('Enter'));

    expect(selectedCell()).toEqual({ rowIndex: 1, colIndex: 0 });
  });

  it('toggles a tree cell with Ctrl/Cmd+Enter without starting an edit', () => {
    const toggleTreeCell = vi.fn(() => true);
    const { controller, selectedCell, startEdit } = setup({ toggleTreeCell });
    selectedCell.set({ rowIndex: 0, colIndex: 0 });

    controller.handleKeyDown(keyboardEvent('Enter', { metaKey: true }));

    expect(toggleTreeCell).toHaveBeenCalledWith(0, 0);
    expect(startEdit).not.toHaveBeenCalled();
  });

  it('keeps plain Enter dedicated to editing', () => {
    const toggleTreeCell = vi.fn(() => true);
    const { controller, selectedCell, startEdit } = setup({ toggleTreeCell });
    selectedCell.set({ rowIndex: 0, colIndex: 0 });

    controller.handleKeyDown(keyboardEvent('Enter'));

    expect(toggleTreeCell).not.toHaveBeenCalled();
    expect(startEdit).toHaveBeenCalledWith(0, 0, '');
  });

  it('adds and selects a blank row when navigation leaves the final cell', () => {
    const { controller, dataSource, selectedCell, prepared } = setup({
      filteredItems: [dataItem(0)],
      autoAddRows: true,
    });
    selectedCell.set({ rowIndex: 0, colIndex: 1 });

    controller.handleKeyDown(keyboardEvent('Tab'));

    expect(dataSource.length).toBe(2);
    expect(dataSource.getRow(1)).toEqual({ name: '', amount: 0, hidden: '' });
    expect(selectedCell()).toEqual({ rowIndex: 1, colIndex: 0 });
    expect(prepared).toEqual([{ index: 1, data: { name: '', amount: 0, hidden: '' } }]);
  });

  it('emits prepareAddRecord when navigation creates the first row', () => {
    const { controller, dataSource, selectedCell, prepared } = setup({
      filteredItems: [],
      autoAddRows: true,
      initialRows: [],
    });

    controller.handleKeyDown(keyboardEvent('Tab'));

    expect(dataSource.length).toBe(1);
    expect(selectedCell()).toEqual({ rowIndex: 0, colIndex: 0 });
    expect(prepared).toEqual([{
      index: 0,
      data: { name: '', amount: 0, hidden: '' },
    }]);
  });

  it('scrolls rows into view and delegates horizontal visibility', () => {
    const viewport = createViewport(40, 40);
    const scrollColumn = vi.fn();
    const { controller } = setup({ viewport, scrollColumn });

    controller.scrollToKeepVisible(0, 1);
    controller.scrollToKeepVisible(3, 1);

    expect(viewport.scrollToOffset).toHaveBeenNthCalledWith(1, 0);
    expect(viewport.scrollToOffset).toHaveBeenNthCalledWith(2, 120);
    expect(scrollColumn).toHaveBeenCalledTimes(2);
  });
});

function setup(overrides: {
  filteredItems?: GridItem[];
  autoAddRows?: boolean;
  initialRows?: Record<string, unknown>[];
  editingCell?: WritableSignal<CellPosition | null>;
  viewport?: AgridVerticalViewport & { scrollToOffset: Mock<(offset: number) => void> };
  scrollColumn?: Mock<(colIndex: number) => void>;
  toggleTreeCell?: Mock<(originalIndex: number, colIndex: number) => boolean>;
  enterEditAction?: 'nothing' | 'nextColumn' | 'nextRow';
  columns?: ColDef[];
} = {}) {
  const columns: ColDef[] = overrides.columns ?? [
    { field: 'name', header: 'Name' },
    { field: 'amount', header: 'Amount', type: 'number' },
    { field: 'hidden', header: 'Hidden', hidden: true },
  ];
  const dataSource = new AgridDataSource(
    overrides.initialRows ?? [{ name: 'Alice', amount: 1, hidden: 'x' }],
  );
  const selectedCell = signal<CellPosition | null>(null);
  const selectedRange = signal<CellRange | null>(null);
  const editingCell = overrides.editingCell ?? signal<CellPosition | null>(null);
  const prepared: Pick<NewRecord, 'index' | 'data'>[] = [];
  const focusGrid = vi.fn();
  const startEdit = vi.fn();
  const commitEdit = vi.fn(() => true);
  const cancelEdit = vi.fn();
  const undoEdit = vi.fn();
  const redoEdit = vi.fn();
  const extendRangeTo = vi.fn();
  const viewport = overrides.viewport ?? createViewport(0, 80);
  const scrollColumn = overrides.scrollColumn ?? vi.fn<(colIndex: number) => void>();
  const filteredItems = signal<GridItem[]>(
    overrides.filteredItems ?? [dataItem(0), dataItem(1)],
  );

  const options: AgridNavigationControllerOptions = {
    control: signal<AgridControl | null>(new AgridControl()),
    dataSource: signal(dataSource),
    filteredItems,
    filteredSortedIndices: signal([0, 1]),
    colDefs: signal(columns),
    visibleColDefs: signal(columns.filter(col => !col.hidden)),
    rowHeight: signal(40),
    allowAddRows: signal(true),
    autoAddRows: signal(overrides.autoAddRows ?? false),
    enterEditAction: signal(overrides.enterEditAction ?? 'nextRow'),
    selectedCell,
    selectedRange,
    editingCell,
    isEditing: (rowIndex, colIndex) => {
      const current = editingCell();
      return current?.rowIndex === rowIndex && current.colIndex === colIndex;
    },
    isCellEditable: (col, originalIndex) => {
      if (!col || col.editable === false) return false;
      const row = dataSource.getRow(originalIndex);
      return !col.cellReadonly?.({
        row,
        value: row[col.field],
        column: col,
        originalIndex,
      });
    },
    toggleTreeCell: overrides.toggleTreeCell ?? vi.fn(() => false),
    startEdit,
    commitEdit,
    cancelEdit,
    undoEdit,
    redoEdit,
    extendRangeTo,
    openFind: vi.fn(),
    focusGrid,
    viewport: () => viewport,
    scrollColumnToKeepVisible: scrollColumn,
    onPrepareAddRecord: event => {
      prepared.push(event);
      filteredItems.set([
        ...filteredItems().filter(item => item !== null),
        dataItem(event.index),
      ]);
    },
  };

  return {
    controller: new AgridNavigationController(options),
    dataSource,
    selectedCell,
    selectedRange,
    prepared,
    focusGrid,
    startEdit,
    commitEdit,
    cancelEdit,
    undoEdit,
    redoEdit,
    extendRangeTo,
  };
}

function dataItem(originalIndex: number): GridItem {
  return {
    originalIndex,
    row: { name: `Row ${originalIndex}`, amount: originalIndex, hidden: 'x' },
  };
}

function keyboardEvent(
  key: string,
  init: KeyboardEventInit & { target?: EventTarget } = {},
): KeyboardEvent {
  const { target, ...eventInit } = init;
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...eventInit });
  if (target) Object.defineProperty(event, 'target', { value: target });
  return event;
}

function createViewport(
  scrollOffset: number,
  viewportSize: number,
): AgridVerticalViewport & { scrollToOffset: Mock<(offset: number) => void> } {
  return {
    measureScrollOffset: () => scrollOffset,
    getViewportSize: () => viewportSize,
    scrollToOffset: vi.fn<(offset: number) => void>(),
  };
}
