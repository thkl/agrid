import { DestroyRef, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AgridColumnReorderController } from './agrid-column-reorder.controller';
import { AgridControl } from '../agrid-control';

describe('AgridColumnReorderController', () => {
  it('ignores locked columns and primary-drags unlocked columns', () => {
    const control = new AgridControl();
    const addListener = vi.spyOn(document, 'addEventListener');
    const columns = [
      { field: 'name', header: 'Name', locked: true },
      { field: 'amount', header: 'Amount' },
    ];
    const controller = new AgridColumnReorderController({
      control: signal(control),
      visibleColDefs: signal(columns),
      getColDef: field => columns.find(col => col.field === field),
    }, destroyRef());

    controller.start(pointerEvent(), 'name');
    expect(addListener).not.toHaveBeenCalledWith('pointermove', expect.any(Function));

    controller.start(pointerEvent(), 'amount');
    expect(addListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
    addListener.mockRestore();
  });

  it('clears active drag state on pointer cancellation', () => {
    const control = new AgridControl();
    const columns = [
      { field: 'name', header: 'Name' },
      { field: 'amount', header: 'Amount' },
    ];
    const controller = new AgridColumnReorderController({
      control: signal(control),
      visibleColDefs: signal(columns),
      getColDef: field => columns.find(col => col.field === field),
    }, destroyRef());
    const [source] = headerGrid([
      ['name', 0],
      ['amount', 100],
    ]);
    controller.start(pointerEvent(source), 'name');
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 10 }));
    expect(controller.isDragging('name')).toBe(true);
    expect(controller.preview()?.label).toBe('Name');

    document.dispatchEvent(new Event('pointercancel'));

    expect(controller.isDragging('name')).toBe(false);
    expect(controller.preview()).toBeNull();
    expect(control.columnOrder()).toEqual([]);
  });

  it('shifts intervening headers to create an animated insertion gap', () => {
    const control = new AgridControl();
    const columns = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C' },
      { field: 'd', header: 'D' },
    ];
    const controller = new AgridColumnReorderController({
      control: signal(control),
      visibleColDefs: signal(columns),
      getColDef: field => columns.find(col => col.field === field),
    }, destroyRef());
    const [source] = headerGrid([
      ['a', 0],
      ['b', 100],
      ['c', 200],
      ['d', 300],
    ]);
    controller.start(pointerEvent(source), 'a');
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 360, clientY: 10 }));

    expect(controller.getHeaderOffset('b')).toBe(-100);
    expect(controller.getHeaderOffset('c')).toBe(-100);
    expect(controller.getHeaderOffset('d')).toBe(-100);
    expect(controller.preview()).toMatchObject({ field: 'a', x: 350, width: 100 });

    document.dispatchEvent(new Event('pointercancel'));
  });

  it('shifts headers right when dragging a column toward the start', () => {
    const control = new AgridControl();
    const columns = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C' },
    ];
    const controller = new AgridColumnReorderController({
      control: signal(control),
      visibleColDefs: signal(columns),
      getColDef: field => columns.find(col => col.field === field),
    }, destroyRef());
    const headers = headerGrid([
      ['a', 0],
      ['b', 100],
      ['c', 200],
    ]);
    controller.start(pointerEvent(headers[2], 250), 'c');
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }));

    expect(controller.getHeaderOffset('a')).toBe(100);
    expect(controller.getHeaderOffset('b')).toBe(100);

    document.dispatchEvent(new Event('pointercancel'));
  });

  it('keeps the captured drop target stable after headers are visually translated', () => {
    const control = new AgridControl();
    const columns = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C' },
    ];
    const controller = new AgridColumnReorderController({
      control: signal(control),
      visibleColDefs: signal(columns),
      getColDef: field => columns.find(col => col.field === field),
    }, destroyRef());
    const headers = headerGrid([
      ['a', 0],
      ['b', 100],
      ['c', 200],
    ]);

    controller.start(pointerEvent(headers[0]), 'a');
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 250, clientY: 10 }));
    expect(controller.getHeaderOffset('b')).toBe(-100);

    vi.spyOn(headers[2], 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 0, top: 0, left: 100, right: 200, bottom: 40,
      width: 100, height: 40, toJSON: () => ({}),
    });
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 250, clientY: 80 }));

    expect(controller.getHeaderOffset('b')).toBe(-100);
    expect(controller.getHeaderOffset('c')).toBe(-100);
    document.dispatchEvent(new Event('pointercancel'));
  });

  it('drags a contiguous header group as one ordered block', () => {
    const control = new AgridControl();
    const columns = [
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
      { field: 'c', header: 'C' },
      { field: 'd', header: 'D' },
    ];
    const controller = new AgridColumnReorderController({
      control: signal(control),
      visibleColDefs: signal(columns),
      getColDef: field => columns.find(col => col.field === field),
    }, destroyRef());
    const headers = headerGrid([
      ['a', 0],
      ['b', 100],
      ['c', 200],
      ['d', 300],
    ]);
    const groupHeader = document.createElement('div');
    vi.spyOn(groupHeader, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 28,
      width: 200, height: 28, toJSON: () => ({}),
    });
    headers[0].closest('.ag-wrapper')?.append(groupHeader);

    controller.startGroup(pointerEvent(groupHeader), ['a', 'b'], 'Employee');
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 360, clientY: 10 }));

    expect(controller.isDragging('a')).toBe(true);
    expect(controller.isDragging('b')).toBe(true);
    expect(controller.getHeaderOffset('c')).toBe(-200);
    expect(controller.getHeaderOffset('d')).toBe(-200);
    expect(controller.preview()).toMatchObject({
      fields: ['a', 'b'],
      label: 'Employee',
      width: 200,
    });

    document.dispatchEvent(new MouseEvent('pointerup'));
    expect(control.columnOrder()).toEqual(['c', 'd', 'a', 'b']);
  });
});

function pointerEvent(currentTarget?: HTMLElement, clientX = 10): PointerEvent {
  return { button: 0, clientX, clientY: 10, currentTarget } as unknown as PointerEvent;
}

function headerFor(field: string, left: number): HTMLElement {
  const header = document.createElement('div');
  header.className = 'ag-header-cell';
  header.dataset['colField'] = field;
  vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
    x: left, y: 0, top: 0, left, right: left + 100, bottom: 40,
    width: 100, height: 40, toJSON: () => ({}),
  });
  return header;
}

function headerGrid(definitions: [field: string, left: number][]): HTMLElement[] {
  const wrapper = document.createElement('div');
  wrapper.className = 'ag-wrapper';
  const headerRow = document.createElement('div');
  wrapper.append(headerRow);
  const headers = definitions.map(([field, left]) => headerFor(field, left));
  headerRow.append(...headers);
  return headers;
}

function destroyRef(): DestroyRef {
  return {
    destroyed: false,
    onDestroy: () => () => undefined,
  } as DestroyRef;
}
