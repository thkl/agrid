import { DestroyRef, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AgridColumnMenuController } from './agrid-column-menu.controller';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { ColDef, FilterChangeEvent, SortChangeEvent } from '../agrid.types';

describe('AgridColumnMenuController', () => {
  it('builds sorted value items from column values and tracks selected state', () => {
    const { controller, control } = setup({
      columns: [
        {
          field: 'status',
          header: 'Status',
          filterable: true,
          values: [
            { label: 'Backlog', value: 'backlog' },
            { label: 'Done', value: 'done' },
          ],
        },
      ],
    });
    controller.menu.set({ field: 'status', x: 0, y: 0 });
    control.setSelectedValues('status', ['done']);

    expect(controller.valueItems()).toEqual([
      { label: 'Backlog', rawStr: 'backlog', active: true, selected: false },
      { label: 'Done', rawStr: 'done', active: true, selected: true },
    ]);
  });

  it('does not scan values for non-filterable columns', () => {
    const formatter = vi.fn(value => String(value));
    const { controller } = setup({
      columns: [
        { field: 'status', header: 'Status', formatter },
      ],
    });

    controller.menu.set({ field: 'status', x: 0, y: 0 });

    expect(controller.valueItems()).toEqual([]);
    expect(formatter).not.toHaveBeenCalled();
  });

  it('debounces server-side text filter events per field', () => {
    vi.useFakeTimers();
    const { controller, control, filterEvents } = setup({ filterDebounceMs: 300 });

    controller.onTextFilterChange(textInputEvent('a'), 'name');
    controller.onTextFilterChange(textInputEvent('alice'), 'name');

    expect(control.getFilter('name').text).toBe('alice');
    expect(filterEvents).toEqual([]);

    vi.advanceTimersByTime(300);

    expect(filterEvents).toEqual([{ field: 'name', value: 'alice' }]);
    vi.useRealTimers();
  });

  it('emits cleared previous sort when single sorting switches fields', () => {
    const { controller, control, sortEvents } = setup();

    controller.sort('name', 'asc');
    controller.sort('department', 'desc');

    expect(control.sortOrder()).toEqual(['department']);
    expect(sortEvents).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'name', direction: null },
      { field: 'department', direction: 'desc' },
    ]);
  });

  it('toggles distinct value selections and collapses back to all selected', () => {
    const { controller, control } = setup();
    controller.menu.set({ field: 'department', x: 0, y: 0 });

    controller.toggleValue('department', 'Sales');
    expect(control.getFilter('department').selectedValues).toEqual(['Engineering']);

    controller.toggleValue('department', 'Sales');
    expect(control.getFilter('department').selectedValues).toBeNull();
  });

  it('clears filters and sorts while emitting server-side reset events', () => {
    const { controller, control, filterEvents, sortEvents } = setup();
    control.setTextFilter('name', 'ali');
    control.setSort('name', 'asc');
    control.setTextFilter('department', 'eng');

    controller.clearAll();

    expect(control.filters()).toEqual({});
    expect(filterEvents).toEqual([
      { field: 'name', value: '' },
      { field: 'department', value: '' },
    ]);
    expect(sortEvents).toEqual([{ field: 'name', direction: null }]);
  });

  it('emits a server-side filter event for typed range conditions', () => {
    const { controller, control, filterEvents } = setup({
      columns: [{ field: 'score', header: 'Score', type: 'number', filterable: true }],
    });

    controller.setFilterOperator('score', 'between');
    controller.setFilterOperand('score', '10');
    controller.setFilterOperand2('score', '20');

    expect(control.getFilter('score')).toMatchObject({ operator: 'between', operand: '10', operand2: '20' });
    expect(filterEvents.at(-1)).toEqual({
      field: 'score', value: '', operator: 'between', operand: '10', operand2: '20',
    });

    controller.clearFilter('score');
    expect(filterEvents.at(-1)).toEqual({
      field: 'score', value: '', operator: null, operand: null, operand2: null,
    });
  });

  it('exposes and emits text conditions for string columns', () => {
    const { controller, control, filterEvents } = setup();

    expect(controller.getFilterType('name')).toBe('text');
    controller.setFilterOperator('name', 'startsWith');
    controller.setFilterOperand('name', 'Al');

    expect(control.getFilter('name')).toMatchObject({
      operator: 'startsWith',
      operand: 'Al',
    });
    expect(filterEvents.at(-1)).toEqual({
      field: 'name',
      value: '',
      operator: 'startsWith',
      operand: 'Al',
      operand2: '',
    });
  });

  it('does not expose condition filters for boolean columns', () => {
    const { controller } = setup({
      columns: [{ field: 'active', header: 'Active', type: 'boolean', filterable: true }],
    });

    expect(controller.getFilterType('active')).toBeNull();
  });

  it('preserves a condition when clearing sort through the menu', () => {
    const { controller, control } = setup();
    control.setRangeFilter('name', 'includes', 'ali');
    control.setSort('name', 'asc');

    controller.sort('name', 'asc');

    expect(control.getFilter('name')).toMatchObject({
      sort: null,
      operator: 'includes',
      operand: 'ali',
    });
  });
});

function setup(overrides: {
  columns?: ColDef[];
  filterDebounceMs?: number;
  sortOption?: 'single' | 'multi' | 'none';
} = {}) {
  const control = new AgridControl();
  const filterEvents: FilterChangeEvent[] = [];
  const sortEvents: SortChangeEvent[] = [];
  const columns = overrides.columns ?? [
    { field: 'name', header: 'Name', filterable: true },
    { field: 'department', header: 'Department', filterable: true },
  ];
  const destroyCallbacks: (() => void)[] = [];
  const destroyRef = {
    destroyed: false,
    onDestroy: (callback: () => void) => {
      destroyCallbacks.push(callback);
      return () => undefined;
    },
  } as DestroyRef;
  const controller = new AgridColumnMenuController({
    control: signal(control),
    dataSource: signal(new AgridDataSource([
      { name: 'Bob', department: 'Sales', status: 'backlog' },
      { name: 'Alice', department: 'Engineering', status: 'done' },
    ])),
    colDefs: signal(columns),
    serverSideFiltering: signal(true),
    filterDebounceMs: signal(overrides.filterDebounceMs ?? 0),
    sortOption: signal(overrides.sortOption ?? 'single'),
    effectiveSortOrder: () => control.sortOrder(),
    autosizeColumn: vi.fn(),
    onFilterChange: event => filterEvents.push(event),
    onSortChange: event => sortEvents.push(event),
  }, destroyRef);

  return { controller, control, filterEvents, sortEvents, destroyCallbacks };
}

function textInputEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}
