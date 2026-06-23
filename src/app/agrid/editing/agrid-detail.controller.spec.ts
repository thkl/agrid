import { signal } from '@angular/core';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { AgridDetailController } from './agrid-detail.controller';
import { CellPosition, ColDef, DetailRowItem, GridEditEvent, ValidationFailedEvent } from '../agrid.types';
import { CellRange } from '../selection/agrid-clipboard.handler';

describe('AgridDetailController', () => {
  const detailColumn: ColDef = { field: 'notes', header: 'Notes' };

  function setup(options: { col?: ColDef | null; editable?: boolean } = {}) {
    const { col = detailColumn, editable = true } = options;
    const control = new AgridControl();
    const dataSource = new AgridDataSource([
      { notes: 'first' },
      { notes: 'second' },
    ]);
    const selectedCell = signal<CellPosition | null>(null);
    const selectedRange = signal<CellRange | null>(null);
    const editingCell = signal<CellPosition | null>(null);
    const edits: GridEditEvent[] = [];
    const validationFailures: ValidationFailedEvent[] = [];
    const detailActions: { id: string }[] = [];
    const textareas = new Map<number, HTMLTextAreaElement>();
    const controller = new AgridDetailController({
      dataSource: signal(dataSource),
      control: signal(control),
      detailColumn: signal(col),
      locale: signal('en-US'),
      displayItems: signal([]),
      visibleColDefs: signal([detailColumn]),
      selectedCell,
      selectedRange,
      editingCell,
      isCellEditable: () => editable,
      renderDetailHtml: row => `<p>${row['notes']}</p>`,
      emitEditEvents: event => edits.push(event),
      emitValidationFailed: event => validationFailures.push(event),
      emitDetailAction: event => detailActions.push({ id: event.id }),
      schedule: fn => fn(),
      queryTextarea: rowIndex => textareas.get(rowIndex) ?? null,
    });
    return {
      control,
      controller,
      dataSource,
      selectedCell,
      editingCell,
      edits,
      validationFailures,
      detailActions,
      textareas,
    };
  }

  const itemFor = (index: number, dataSource: AgridDataSource): DetailRowItem => ({
    detailFor: index,
    row: dataSource.getRow(index),
  });

  it('renders and memoizes detail HTML per item', () => {
    const { controller, dataSource } = setup();
    const item = itemFor(0, dataSource);
    expect(controller.detailHtml(item)).toBe('<p>first</p>');
    // Mutating the underlying row does not bust the cache; the item reference is the key.
    dataSource.patchRow(0, { notes: 'changed' });
    expect(controller.detailHtml(item)).toBe('<p>first</p>');
  });

  it('reports editability from the configured detail column', () => {
    const { controller, dataSource } = setup({ editable: false });
    expect(controller.isDetailFieldEditable(itemFor(0, dataSource))).toBe(false);
  });

  it('starts editing, seeding the draft and clearing the selected cell', () => {
    const { controller, dataSource, selectedCell } = setup();
    selectedCell.set({ rowIndex: 0, colIndex: 0 });
    controller.startDetailFieldEdit(itemFor(0, dataSource));
    expect(controller.editingRow()).toBe(0);
    expect(controller.draft()).toBe('first');
    expect(selectedCell()).toBeNull();
  });

  it('commits an edit, patches the row, pushes history, and emits', () => {
    const { controller, dataSource, edits } = setup();
    const item = itemFor(0, dataSource);
    controller.startDetailFieldEdit(item);
    controller.onDetailDraftInput({ target: { value: 'updated' } } as unknown as Event);
    controller.commitDetailFieldEdit(item);

    expect(dataSource.getRow(0).notes).toBe('updated');
    expect(controller.editingRow()).toBeNull();
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ field: 'notes', oldValue: 'first', newValue: 'updated' });
  });

  it('blocks commit and reports validation failures', () => {
    const col: ColDef = { field: 'notes', header: 'Notes', validate: () => 'too short' };
    const { controller, dataSource, validationFailures, edits } = setup({ col });
    const item = itemFor(0, dataSource);
    controller.startDetailFieldEdit(item);
    controller.onDetailDraftInput({ target: { value: 'x' } } as unknown as Event);
    controller.commitDetailFieldEdit(item);

    expect(controller.validationError()).toBe('too short');
    expect(controller.editingRow()).toBe(0);
    expect(dataSource.getRow(0).notes).toBe('first');
    expect(edits).toHaveLength(0);
    expect(validationFailures[0]).toMatchObject({ field: 'notes', source: 'detail' });
  });

  it('cancels editing and restores a keyboard-origin selection', () => {
    const { controller, dataSource, selectedCell } = setup();
    selectedCell.set({ rowIndex: 0, colIndex: 0 });
    const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    controller.startDetailFieldEdit(itemFor(0, dataSource), keyEvent);
    expect(selectedCell()).toBeNull();
    controller.cancelDetailFieldEdit();
    expect(controller.editingRow()).toBeNull();
    expect(selectedCell()).toEqual({ rowIndex: 0, colIndex: 0 });
  });

  it('emits a detail action for a button without inserted text', () => {
    const { controller, dataSource, detailActions } = setup();
    controller.applyDetailAction(
      itemFor(0, dataSource),
      { id: 'ping', label: 'Ping' },
      new Event('click'),
    );
    expect(detailActions).toEqual([{ id: 'ping' }]);
  });

  it('inserts template text into the active draft', () => {
    const { controller, dataSource } = setup();
    const item = itemFor(0, dataSource);
    controller.startDetailFieldEdit(item);
    controller.applyDetailAction(item, { id: 't', label: 'T', text: ' [done]' }, new Event('click'));
    expect(controller.draft()).toContain('[done]');
  });
});
