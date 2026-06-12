import { signal } from '@angular/core';
import { AgridClipboardHandler } from './agrid-clipboard.handler';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { CellPosition, ColDef, GridEditEvent, GridItem } from '../agrid.types';

describe('AgridClipboardHandler', () => {
  const columns: ColDef[] = [
    { field: 'name', header: 'Name' },
    { field: 'amount', header: 'Amount', type: 'number' },
    {
      field: 'status',
      header: 'Status',
      values: [
        { value: 1, label: 'Active' },
        { value: 2, label: 'Inactive' },
      ],
    },
    { field: 'locked', header: 'Locked', editable: false },
  ];

  function createHandler(markedRowIndices = signal<ReadonlySet<number>>(new Set())) {
    const dataSource = new AgridDataSource([
      { name: 'Alice', amount: 10, status: 1, locked: 'keep' },
      { name: 'Bob', amount: 20, status: 2, locked: 'keep' },
    ]);
    const control = new AgridControl();
    const selectedCell = signal<CellPosition | null>({ rowIndex: 0, colIndex: 0 });
    const selectedRange = signal<{
      anchor: CellPosition;
      focus: CellPosition;
    } | null>(null);
    const filteredItems = signal<GridItem[]>(dataSource.rows().map((row, originalIndex) => ({
      row,
      originalIndex,
    })));
    const edits: GridEditEvent[] = [];
    const scrollToCell = vi.fn();
    const handler = new AgridClipboardHandler({
      control: signal(control),
      dataSource: signal(dataSource),
      filteredItems,
      visibleColDefs: signal(columns),
      locale: signal('en-US'),
      selectedCell,
      selectedRange,
      markedRowIndices,
      isCellEditable: col => col.editable !== false,
      onCellEdit: event => edits.push(event),
      scrollToCell,
    });
    return {
      control,
      dataSource,
      edits,
      handler,
      scrollToCell,
      selectedCell,
      selectedRange,
    };
  }

  it('serializes the selected range as escaped TSV display values', () => {
    const { handler, selectedRange } = createHandler();
    selectedRange.set({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 2 },
    });

    expect(handler.getSelectedTsv()).toBe(
      'Alice\t10\tActive\nBob\t20\tInactive'
    );
  });

  it('appends marked rows using the copied selection columns without duplicates', () => {
    const markedRowIndices = signal<ReadonlySet<number>>(new Set([0, 1]));
    const { handler, selectedCell, selectedRange } = createHandler(markedRowIndices);
    selectedCell.set({ rowIndex: 0, colIndex: 1 });
    selectedRange.set(null);

    expect(handler.getSelectedTsv()).toBe('10\n20');
  });

  it('parses quoted CSV, coerces typed values, and records one history batch', () => {
    const {
      control,
      dataSource,
      edits,
      handler,
      scrollToCell,
      selectedCell,
      selectedRange,
    } = createHandler();

    handler.pasteTextAtSelection('"Carol, Jr.",42,Inactive,replace');

    expect(dataSource.getRow(0)).toEqual({
      name: 'Carol, Jr.',
      amount: 42,
      status: 2,
      locked: 'keep',
    });
    expect(edits).toHaveLength(3);
    expect(control.canUndo()).toBe(true);
    expect(selectedCell()).toEqual({ rowIndex: 0, colIndex: 2 });
    expect(selectedRange()).toEqual({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 2 },
    });
    expect(scrollToCell).toHaveBeenCalledWith(0, 2);
  });
});
