import { signal } from '@angular/core';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridProjectionModel } from './agrid-projection.model';
import { ColDef, GridItem } from './agrid.types';
import { isDataRowItem, isGroupHeaderItem } from './agrid.utils';

describe('AgridProjectionModel', () => {
  const columns: ColDef[] = [
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'amount', header: 'Amount', type: 'number', aggregate: 'sum' },
  ];

  const rows = [
    { name: 'Alice', department: 'Sales', amount: 30 },
    { name: 'Bob', department: 'Engineering', amount: 10 },
    { name: 'Carol', department: 'Engineering', amount: 20 },
  ];

  function createModel(options: {
    control?: AgridControl;
    serverSideFiltering?: boolean;
    expandedLabels?: string[];
  } = {}) {
    const control = options.control ?? new AgridControl();
    const dataSource = new AgridDataSource(rows);
    const model = new AgridProjectionModel({
      dataSource: signal(dataSource),
      control: signal(control),
      colDefs: signal(columns),
      visibleColDefs: signal(columns),
      locale: signal('en-US'),
      serverSideFiltering: signal(options.serverSideFiltering ?? false),
      sortOption: signal<'single' | 'multi' | 'none'>('multi'),
      allowAddRows: signal(false),
      autoAddRows: signal(false),
      expandedGroups: signal({
        field: control.groupByField(),
        labels: new Set(options.expandedLabels ?? []),
      }),
    });
    return { control, dataSource, model };
  }

  it('filters, sorts, and paginates client-side rows', () => {
    const control = new AgridControl({ pageSize: 1 });
    control.setTextFilter('department', 'engineering');
    control.addSort('amount', 'desc');
    control.setPage(2);
    const { model } = createModel({ control });

    expect(model.filteredRowCount()).toBe(2);
    expect(model.totalPages()).toBe(2);
    expect(dataRows(model.filteredItems()).map(item => item.row['name'])).toEqual(['Bob']);
  });

  it('groups rows and applies secondary sorts inside expanded groups', () => {
    const control = new AgridControl({ groupByField: 'department' });
    control.addSort('amount', 'desc');
    const { model } = createModel({
      control,
      expandedLabels: ['Engineering'],
    });

    const items = model.filteredItems();
    expect(items.filter(isGroupHeaderItem).map(item => item.groupLabel))
      .toEqual(['Engineering', 'Sales']);
    expect(dataRows(items).map(item => item.row['name'])).toEqual(['Carol', 'Bob']);
    expect(model.showPagination()).toBe(false);
  });

  it('bypasses local filtering and sorting in server mode', () => {
    const control = new AgridControl({ pageSize: 20, totalRows: 100 });
    control.setTextFilter('name', 'nobody');
    control.addSort('amount', 'asc');
    const { model } = createModel({ control, serverSideFiltering: true });

    expect(model.filteredRowCount()).toBe(3);
    expect(model.totalPages()).toBe(5);
    expect(dataRows(model.filteredItems()).map(item => item.row['name']))
      .toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('computes aggregates over filtered rows before pagination', () => {
    const control = new AgridControl({ pageSize: 1 });
    control.setTextFilter('department', 'engineering');
    control.setAggregate('name', 'count');
    const { model } = createModel({ control });

    expect(model.showFooter()).toBe(true);
    expect(model.footerValues()).toEqual({
      name: 2,
      amount: 30,
    });
  });
});

function dataRows(
  items: GridItem[],
): { row: Record<string, unknown>; originalIndex: number }[] {
  return items.filter(isDataRowItem);
}
