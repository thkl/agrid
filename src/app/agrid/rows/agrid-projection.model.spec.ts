import { signal } from '@angular/core';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { AgridProjectionModel } from './agrid-projection.model';
import { AgridTreeConfig, ColDef, GridItem } from '../agrid.types';
import { isDataRowItem, isGroupHeaderItem, isTreeRowItem } from '../agrid.utils';

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
    sourceRows?: Record<string, unknown>[];
    treeConfig?: AgridTreeConfig | null;
    expandedTreeIds?: (string | number)[];
  } = {}) {
    const control = options.control ?? new AgridControl();
    const dataSource = new AgridDataSource(options.sourceRows ?? rows);
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
      treeConfig: signal(options.treeConfig ?? null),
      expandedTreeIds: signal(new Set(options.expandedTreeIds ?? [])),
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

  describe('tree mode', () => {
    const treeRows = [
      { id: 1, parentId: null, name: 'Root', department: 'X', amount: 0 },
      { id: 2, parentId: 1, name: 'Child A', department: 'X', amount: 5 },
      { id: 3, parentId: 1, name: 'Child B', department: 'X', amount: 7 },
      { id: 4, parentId: 2, name: 'Grandchild', department: 'X', amount: 9 },
    ];
    const treeConfig: AgridTreeConfig = {
      getId: (r: any) => r.id,
      getParentId: (r: any) => r.parentId,
      treeField: 'name',
    };

    it('flattens the hierarchy honoring expanded ids and disables pagination', () => {
      const control = new AgridControl({ pageSize: 1 });
      const { model } = createModel({
        control,
        sourceRows: treeRows,
        treeConfig,
        expandedTreeIds: [1],
      });

      const items = model.filteredItems();
      expect(items.filter(isTreeRowItem).map(i => (i.row as any).name))
        .toEqual(['Root', 'Child A', 'Child B']);
      expect(model.showPagination()).toBe(false);
    });

    it('reveals deeper descendants as more nodes expand', () => {
      const { model } = createModel({
        sourceRows: treeRows,
        treeConfig,
        expandedTreeIds: [1, 2],
      });

      const tree = model.filteredItems().filter(isTreeRowItem);
      expect(tree.map(i => (i.row as any).name))
        .toEqual(['Root', 'Child A', 'Grandchild', 'Child B']);
      expect(tree.find(i => (i.row as any).id === 4)!.level).toBe(2);
    });

    it('orders siblings by the active sort', () => {
      const control = new AgridControl();
      control.addSort('amount', 'desc');
      const { model } = createModel({
        control,
        sourceRows: treeRows,
        treeConfig,
        expandedTreeIds: [1],
      });

      expect(model.filteredItems().filter(isTreeRowItem).map(i => (i.row as any).name))
        .toEqual(['Root', 'Child B', 'Child A']);
    });

    it('keeps ancestors of a filter match visible and forces the path open', () => {
      const control = new AgridControl();
      control.setTextFilter('name', 'Grandchild');
      const { model } = createModel({
        control,
        sourceRows: treeRows,
        treeConfig,
        // Nothing explicitly expanded — ancestors are force-opened by the filter.
        expandedTreeIds: [],
      });

      expect(model.filteredItems().filter(isTreeRowItem).map(i => (i.row as any).name))
        .toEqual(['Root', 'Child A', 'Grandchild']);
    });

    it('surfaces a match as a root when keepAncestorsOnFilter is disabled', () => {
      const control = new AgridControl();
      control.setTextFilter('name', 'Grandchild');
      const { model } = createModel({
        control,
        sourceRows: treeRows,
        treeConfig: { ...treeConfig, keepAncestorsOnFilter: false },
        expandedTreeIds: [],
      });

      const tree = model.filteredItems().filter(isTreeRowItem);
      expect(tree.map(i => (i.row as any).name)).toEqual(['Grandchild']);
      expect(tree[0].level).toBe(0);
    });
  });
});

function dataRows(
  items: GridItem[],
): { row: Record<string, unknown>; originalIndex: number }[] {
  return items.filter(isDataRowItem);
}
