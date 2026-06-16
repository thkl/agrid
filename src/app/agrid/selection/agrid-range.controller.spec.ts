import { DestroyRef, signal } from '@angular/core';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { AgridRangeController } from './agrid-range.controller';
import { CellPosition, ColDef, GridEditEvent, GridItem } from '../agrid.types';

describe('AgridRangeController', () => {
  const columns: ColDef[] = [
    { field: 'name', header: 'Name' },
    { field: 'amount', header: 'Amount', type: 'number' },
    { field: 'locked', header: 'Locked', editable: false },
  ];

  function createController() {
    const control = new AgridControl();
    const dataSource = new AgridDataSource([
      { name: 'A', amount: 1, locked: 'source' },
      { name: 'B', amount: 2, locked: 'keep-1' },
      { name: 'C', amount: 3, locked: 'keep-2' },
    ]);
    const filteredItems = signal<GridItem[]>(
      dataSource.rows().map((row, originalIndex) => ({ row, originalIndex }))
    );
    const selectedCell = signal<CellPosition | null>({ rowIndex: 0, colIndex: 0 });
    const selectedRange = signal<{
      anchor: CellPosition;
      focus: CellPosition;
    } | null>(null);
    const edits: GridEditEvent[] = [];
    let destroyCallback: () => void = () => undefined;
    const destroyRef = {
      onDestroy(callback: () => void) {
        destroyCallback = callback;
        return () => undefined;
      },
    } as unknown as DestroyRef;
    const controller = new AgridRangeController({
      control: signal(control),
      dataSource: signal(dataSource),
      filteredItems,
      visibleColDefs: signal(columns),
      selectedCell,
      selectedRange,
      isCellEditable: (col, originalIndex) => {
        if (col.editable === false) return false;
        const row = dataSource.getRow(originalIndex) as Record<string, unknown>;
        return !col.cellReadonly?.({
          row,
          value: row[col.field],
          column: col,
          originalIndex,
        });
      },
      cancelEdit: vi.fn(),
      findDisplayIndex: originalIndex =>
        filteredItems().findIndex(item =>
          typeof item === 'object' && item !== null
          && 'originalIndex' in item && item.originalIndex === originalIndex
        ),
      scrollToCell: vi.fn(),
      onCellEdit: event => edits.push(event),
    }, destroyRef);
    return {
      control,
      controller,
      dataSource,
      destroy: () => destroyCallback(),
      edits,
      selectedCell,
      selectedRange,
    };
  }

  it('extends a range and resolves display-order bounds', () => {
    const { controller, selectedCell, selectedRange } = createController();

    controller.extendTo(2, 1);

    expect(selectedCell()).toEqual({ rowIndex: 2, colIndex: 1 });
    expect(selectedRange()).toEqual({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 2, colIndex: 1 },
    });
    expect(controller.getVisibleRangeBounds()).toEqual({
      rowStart: 0,
      rowEnd: 2,
      colStart: 0,
      colEnd: 1,
    });
    expect(controller.isRangeSelected(1, 1)).toBe(true);
  });

  it('fills a source block across target rows as one undo step', () => {
    const {
      control,
      controller,
      dataSource,
      edits,
      selectedCell,
      selectedRange,
    } = createController();
    selectedRange.set({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 0, colIndex: 1 },
    });

    controller.applyFill(
      { rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 1 },
      { rowStart: 0, rowEnd: 2, colStart: 0, colEnd: 2 },
    );

    expect(dataSource.rows()).toEqual([
      { name: 'A', amount: 1, locked: 'source' },
      { name: 'A', amount: 1, locked: 'keep-1' },
      { name: 'A', amount: 1, locked: 'keep-2' },
    ]);
    expect(edits).toHaveLength(4);
    expect(selectedCell()).toEqual({ rowIndex: 2, colIndex: 2 });
    expect(selectedRange()).toEqual({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 2, colIndex: 2 },
    });

    const history = control.undo();
    expect(Array.isArray(history)).toBe(true);
    expect(history).toHaveLength(4);
  });

  it('skips runtime readonly cells during fill', () => {
    const { controller, dataSource, edits } = createController();
    columns[0].cellReadonly = ({ row }) => row['amount'] === 2;

    controller.applyFill(
      { rowStart: 0, rowEnd: 0, colStart: 0, colEnd: 0 },
      { rowStart: 0, rowEnd: 2, colStart: 0, colEnd: 0 },
    );

    expect(dataSource.rows().map(row => row.name)).toEqual(['A', 'B', 'A']);
    expect(edits).toHaveLength(1);

    delete columns[0].cellReadonly;
  });

  it('cancels an active fill drag without applying changes', () => {
    const { controller, dataSource } = createController();
    const cell = document.createElement('div');
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 40,
      width: 100, height: 40, toJSON: () => ({}),
    });
    controller.startFill({
      button: 0,
      clientX: 99,
      clientY: 39,
      currentTarget: cell,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent, 0, 0);

    document.dispatchEvent(new Event('pointercancel'));
    document.dispatchEvent(new Event('pointerup'));

    expect(controller.fillPreviewBounds()).toBeNull();
    expect(dataSource.rows()).toEqual([
      { name: 'A', amount: 1, locked: 'source' },
      { name: 'B', amount: 2, locked: 'keep-1' },
      { name: 'C', amount: 3, locked: 'keep-2' },
    ]);
  });
});
