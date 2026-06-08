import { DestroyRef, signal } from '@angular/core';
import { AgridColumnSizingController } from './agrid-column-sizing.controller';
import { AgridControl } from './agrid-control';
import { ColDef, GridItem } from './agrid.types';

describe('AgridColumnSizingController', () => {
  const columns: ColDef[] = [
    { field: 'name', header: 'Name', width: 100 },
    { field: 'department', header: 'Department', width: 120 },
    { field: 'notes', header: 'Notes' },
  ];

  function createController(control: AgridControl | null = new AgridControl()) {
    const scroller = document.createElement('div');
    Object.defineProperties(scroller, {
      clientWidth: { value: 150, configurable: true },
      scrollWidth: { value: 320, configurable: true },
    });
    const wrapper = document.createElement('div');
    let destroyCallback: () => void = () => undefined;
    const destroyRef = {
      onDestroy(callback: () => void) {
        destroyCallback = callback;
        return () => undefined;
      },
    } as unknown as DestroyRef;
    const controller = new AgridColumnSizingController({
      control: signal(control),
      filteredItems: signal<GridItem[]>([
        { row: { name: 'Alice', department: 'Engineering', notes: 'Long note' }, originalIndex: 0 },
      ]),
      visibleColDefs: signal(columns),
      scrollableColDefs: signal(columns),
      locale: signal('en-US'),
      isColumnPinned: () => false,
      wrapperElement: () => wrapper,
      scrollerElement: () => scroller,
    }, destroyRef);
    return {
      controller,
      destroy: () => destroyCallback(),
      scroller,
    };
  }

  it('resolves fixed, flexible, control, and local width values', () => {
    const control = new AgridControl();
    const { controller } = createController(control);

    expect(controller.getWidth(columns[0])).toBe(100);
    expect(controller.getWidthToken(columns[2])).toBe('1fr');

    controller.setWidth('name', 180);
    expect(controller.getWidth(columns[0])).toBe(180);
    expect(controller.getWidthToken(columns[0])).toBe('180px');

    const local = createController(null).controller;
    local.setWidth('name', 10);
    expect(local.getWidth(columns[0])).toBe(40);
  });

  it('resizes from the keyboard with the minimum width enforced', () => {
    const { controller } = createController();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      cancelable: true,
    });

    controller.resizeFromKeyboard(event, columns[0]);

    expect(event.defaultPrevented).toBe(true);
    expect(controller.getWidth(columns[0])).toBe(110);
  });

  it('scrolls an off-screen column into view', () => {
    const { controller, scroller } = createController();

    controller.scrollColumnToKeepVisible(1);

    expect(scroller.scrollLeft).toBe(70);
  });

  it('autosizes from header and visible values', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        font: '',
        measureText: (value: string) => ({ width: value.length * 10 }),
      } as unknown as CanvasRenderingContext2D);
    const { controller } = createController();

    controller.autosizeColumn(columns[1]);

    expect(controller.getWidth(columns[1])).toBe(152);
    getContext.mockRestore();
  });
});
