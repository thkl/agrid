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
