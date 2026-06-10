import { DestroyRef, signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgridDataSource } from '../agrid-datasource';
import { AgridDragHandler } from './agrid-drag.handler';

describe('AgridDragHandler lifecycle', () => {
  afterEach(() => {
    document.querySelectorAll('.ag-row').forEach(element => element.remove());
  });

  it('cancels row reorder without emitting and removes the overlay', () => {
    const { handler, reorderEvents } = setup();
    const row = createRow(0);

    handler.startReorder(pointerEvent(row), 0);
    expect(handler.reorderOriginalIndex()).toBe(0);

    document.dispatchEvent(new Event('pointercancel'));

    expect(handler.reorderOriginalIndex()).toBeNull();
    expect(handler.reorderOverIndex()).toBeNull();
    expect(reorderEvents).toEqual([]);
    expect(document.body.querySelectorAll('.ag-row').length).toBe(1);
  });

  it('cancels drag selection without emitting a completed selection', () => {
    const { handler, selectionChange } = setup();

    handler.startDragSelect(0);
    document.dispatchEvent(new Event('pointercancel'));
    document.dispatchEvent(new Event('pointerup'));

    expect(selectionChange).not.toHaveBeenCalled();
  });

  it('cleans up an active reorder when destroyed', () => {
    const { handler, destroy } = setup();
    const row = createRow(0);
    handler.startReorder(pointerEvent(row), 0);

    destroy();

    expect(handler.reorderOriginalIndex()).toBeNull();
    expect(document.body.querySelectorAll('.ag-row').length).toBe(1);
  });

  it('clears a previous drop target when the pointer leaves all rows', () => {
    const { handler } = setup();
    const row = createRow(0);
    const target = createRow(1);
    const elementsFromPoint = vi.fn()
      .mockReturnValueOnce([target])
      .mockReturnValueOnce([]);
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: elementsFromPoint,
    });
    handler.startReorder(pointerEvent(row), 0);

    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(handler.reorderOverIndex()).toBe(1);
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 200 }));

    expect(handler.reorderOverIndex()).toBeNull();
    document.dispatchEvent(new Event('pointercancel'));
    delete (document as unknown as { elementsFromPoint?: Document['elementsFromPoint'] })
      .elementsFromPoint;
  });
});

function setup() {
  const callbacks: (() => void)[] = [];
  const destroyRef = {
    destroyed: false,
    onDestroy: (callback: () => void) => {
      callbacks.push(callback);
      return () => undefined;
    },
  } as DestroyRef;
  const dataSource = new AgridDataSource([{ name: 'Alice' }, { name: 'Bob' }]);
  const reorderEvents: unknown[] = [];
  const selectionChange = vi.fn();
  const handler = new AgridDragHandler({
    dataSource: signal(dataSource),
    filteredItems: () => dataSource.rows().map((row, originalIndex) => ({ row, originalIndex })),
    locale: () => 'en-US',
    selectedIndices: signal(new Set<number>()),
    onReorder: event => reorderEvents.push(event),
    onSelectionChange: selectionChange,
  }, destroyRef);

  return {
    handler,
    reorderEvents,
    selectionChange,
    destroy: () => callbacks.forEach(callback => callback()),
  };
}

function createRow(originalIndex: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ag-row';
  row.dataset['originalIndex'] = String(originalIndex);
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    toJSON: () => ({}),
  });
  document.body.appendChild(row);
  return row;
}

function pointerEvent(currentTarget: HTMLElement): PointerEvent {
  return {
    clientX: 10,
    clientY: 10,
    currentTarget,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent;
}
