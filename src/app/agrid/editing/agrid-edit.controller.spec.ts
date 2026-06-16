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

  function createController(readonly = false, cols: ColDef[] = columns) {
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
    const validationFailures: { rowIndex: number; field: string; value: unknown; message: string }[] = [];
    const focusGrid = vi.fn();
    const scrollToCell = vi.fn();
    const controller = new AgridEditController({
      control: signal(control),
      dataSource: signal(dataSource),
      visibleColDefs: signal(cols),
      readonlyGrid: signal(readonly),
      selectedCell,
      selectedRange,
      findDisplayIndex: originalIndex => originalIndex,
      scrollToCell,
      focusGrid,
      onCellEdit: event => edits.push(event),
      onValidationFailed: event => validationFailures.push(event),
    });
    return {
      control,
      controller,
      dataSource,
      edits,
      validationFailures,
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

  it('does not start or directly commit runtime readonly cells', () => {
    const { controller, dataSource, edits } = createController(false, [
      {
        field: 'name',
        header: 'Name',
        cellReadonly: ({ row }) => row['locked'] === 'fixed',
      },
      { field: 'locked', header: 'Locked' },
    ]);

    controller.start(0, 0, '');
    expect(controller.editingCell()).toBeNull();

    expect(controller.setCellValue(0, 0, 'Carol')).toBe(false);
    expect(dataSource.getRow(0).name).toBe('Alice');
    expect(edits).toHaveLength(0);
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

  it('rejects a commit when ColDef.validate returns a message', () => {
    const { controller, dataSource, edits, validationFailures } = createController(false, [
      { field: 'name', header: 'Name', validate: v => (v === 'Bad' ? 'Not allowed' : null) },
      { field: 'locked', header: 'Locked', editable: false },
    ]);

    controller.start(0, 0, '');
    controller.setDraft('Bad');
    const committed = controller.commit();

    expect(committed).toBe(false);
    expect(dataSource.getRow(0).name).toBe('Alice'); // not written
    expect(controller.editingCell()).toEqual({ rowIndex: 0, colIndex: 0 }); // stays editing
    expect(controller.validationError()).toMatchObject({ field: 'name', message: 'Not allowed' });
    expect(validationFailures[0]).toMatchObject({ field: 'name', value: 'Bad', message: 'Not allowed' });
    expect(edits).toHaveLength(0);

    // a valid value then commits and clears the error
    controller.setDraft('Carol');
    expect(controller.commit()).toBe(true);
    expect(dataSource.getRow(0).name).toBe('Carol');
    expect(controller.validationError()).toBeNull();
  });

  it('rejects a direct setCellValue when validation fails', () => {
    const { controller, dataSource, validationFailures } = createController(false, [
      { field: 'name', header: 'Name', validate: () => 'nope' },
    ]);

    expect(controller.setCellValue(0, 0, 'X')).toBe(false);
    expect(dataSource.getRow(0).name).toBe('Alice');
    expect(validationFailures[0]).toMatchObject({ field: 'name', message: 'nope' });
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
