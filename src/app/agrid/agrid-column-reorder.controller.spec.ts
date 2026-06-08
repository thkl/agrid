import { DestroyRef, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AgridColumnReorderController } from './agrid-column-reorder.controller';
import { AgridControl } from './agrid-control';

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
    const header = document.createElement('div');
    header.className = 'ag-header-cell';
    header.dataset['colField'] = 'amount';
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
      x: 20, y: 0, top: 0, left: 20, right: 120, bottom: 40,
      width: 100, height: 40, toJSON: () => ({}),
    });
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn().mockReturnValue([header]),
    });

    controller.start(pointerEvent(), 'name');
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 10 }));
    expect(controller.isDragging('name')).toBe(true);

    document.dispatchEvent(new Event('pointercancel'));

    expect(controller.isDragging('name')).toBe(false);
    expect(control.columnOrder()).toEqual([]);
    delete (document as unknown as { elementsFromPoint?: Document['elementsFromPoint'] })
      .elementsFromPoint;
  });
});

function pointerEvent(): PointerEvent {
  return { button: 0, clientX: 10 } as PointerEvent;
}

function destroyRef(): DestroyRef {
  return {
    destroyed: false,
    onDestroy: () => () => undefined,
  } as DestroyRef;
}
