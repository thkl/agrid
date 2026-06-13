import { signal } from '@angular/core';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { AgridEditController } from './agrid-edit.controller';
import { CellPosition, ColDef, GridEditEvent } from '../agrid.types';

describe('AgridEditController', () => {
  const columns: ColDef[] = [
    { field: 'name', header: 'Name' },
    { field: 'locked', header: 'Locked', editable: false },
  ];

  function createController(readonly = false) {
    const control = new AgridControl();
    const dataSource = new AgridDataSource([
      { name: 'Alice', locked: 'fixed' },
      { name: 'Bob', locked: 'fixed' },
    ]);
    const selectedCell = signal<CellPosition | null>(null);
    const selectedRange = signal<{
      anchor: CellPosition;
      focus: CellPosition;
    } | null>(null);
    const edits: GridEditEvent[] = [];
    const focusGrid = vi.fn();
    const scrollToCell = vi.fn();
    const controller = new AgridEditController({
      control: signal(control),
      dataSource: signal(dataSource),
      visibleColDefs: signal(columns),
      readonlyGrid: signal(readonly),
      selectedCell,
      selectedRange,
      findDisplayIndex: originalIndex => originalIndex,
      scrollToCell,
      focusGrid,
      onCellEdit: event => edits.push(event),
    });
    return {
      control,
      controller,
      dataSource,
      edits,
      focusGrid,
      scrollToCell,
      selectedCell,
    };
  }

  it('starts and commits an edit while recording history', () => {
    const {
      control,
      controller,
      dataSource,
      edits,
      focusGrid,
      scrollToCell,
      selectedCell,
    } = createController();

    controller.start(0, 0, 'C');
    controller.setDraft('Carol');
    controller.commit();

    expect(dataSource.getRow(0).name).toBe('Carol');
    expect(selectedCell()).toEqual({ rowIndex: 0, colIndex: 0 });
    expect(controller.editingCell()).toBeNull();
    expect(control.canUndo()).toBe(true);
    expect(edits[0]).toMatchObject({ oldValue: 'Alice', newValue: 'Carol' });
    expect(scrollToCell).toHaveBeenCalledWith(0, 0);
    expect(focusGrid).toHaveBeenCalled();
  });

  it('does not start edits for readonly grids or columns', () => {
    const readonlyController = createController(true).controller;
    readonlyController.start(0, 0, '');
    expect(readonlyController.editingCell()).toBeNull();

    const columnController = createController().controller;
    columnController.start(0, 1, '');
    expect(columnController.editingCell()).toBeNull();
  });

  it('applies undo and redo through the datasource and emits both changes', () => {
    const { controller, dataSource, edits } = createController();
    controller.start(0, 0, '');
    controller.setDraft('Carol');
    controller.commit();

    controller.undo();
    expect(dataSource.getRow(0).name).toBe('Alice');

    controller.redo();
    expect(dataSource.getRow(0).name).toBe('Carol');
    expect(edits.map(event => event.newValue)).toEqual(['Carol', 'Alice', 'Carol']);
  });

  it('commits a direct cell value without entering edit mode (checkbox toggle)', () => {
    const { control, controller, dataSource, edits } = createController();

    controller.setCellValue(0, 0, 'Direct');

    expect(dataSource.getRow(0).name).toBe('Direct');
    expect(controller.editingCell()).toBeNull();
    expect(control.canUndo()).toBe(true);
    expect(edits[0]).toMatchObject({ oldValue: 'Alice', newValue: 'Direct' });
  });

  it('ignores direct cell values for readonly columns or unchanged values', () => {
    const { controller, dataSource, edits } = createController();

    controller.setCellValue(0, 1, 'changed'); // locked column
    expect(dataSource.getRow(0).locked).toBe('fixed');

    controller.setCellValue(0, 0, 'Alice'); // unchanged
    expect(edits).toHaveLength(0);
  });

  it('clears or shifts edit state when a row is removed', () => {
    const { controller } = createController();
    controller.start(1, 0, '');
    controller.onRowRemoved(0);
    expect(controller.editingCell()).toEqual({ rowIndex: 0, colIndex: 0 });

    controller.onRowRemoved(0);
    expect(controller.editingCell()).toBeNull();
  });
});
