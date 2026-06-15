import { signal } from '@angular/core';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { AgridProjectionModel } from './agrid-projection.model';
import { AgridTreeConfig, ColDef, GridItem } from '../agrid.types';
import {
  computeAggregates,
  isDataRowItem,
  isDetailRowItem,
  isGroupHeaderItem,
  isPathTreeNodeItem,
  isTreeRowItem,
} from '../agrid.utils';

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
    pinRow?: (row: Record<string, unknown>, index: number) => 'top' | 'bottom' | undefined;
    masterDetail?: boolean;
    expandedDetailIds?: number[];
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
      pinRow: signal(options.pinRow),
      masterDetail: signal(options.masterDetail ?? false),
      expandedDetailIds: signal(new Set(options.expandedDetailIds ?? [])),
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

  it('computes built-in aggregates without spreading large value arrays', () => {
    const largeRows = Array.from({ length: 150_000 }, (_, index) => ({
      amount: index === 149_999 ? -5 : index,
    }));
    const indices = largeRows.map((_, index) => index);
    const aggregateColumns: ColDef[] = [
      { field: 'amount', header: 'Amount', aggregate: 'min' },
    ];

    expect(computeAggregates(largeRows, indices, aggregateColumns, {})).toEqual({
      amount: -5,
    });
  });

  it('preserves count and custom aggregate semantics', () => {
    const aggregateRows = [
      { value: 1, label: 'A' },
      { value: '2', label: '' },
      { value: 'invalid', label: null },
    ];
    const aggregateColumns: ColDef[] = [
      { field: 'value', header: 'Value', aggregate: values => values.join('|') },
      { field: 'label', header: 'Label', aggregate: 'count' },
    ];

    expect(computeAggregates(aggregateRows, [0, 1, 2], aggregateColumns, {})).toEqual({
      value: '1|2|invalid',
      label: 1,
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

    it('inserts master/detail panels for leaf rows but not parent rows', () => {
      const { model } = createModel({
        sourceRows: treeRows,
        treeConfig,
        expandedTreeIds: [1],
        masterDetail: true,
        expandedDetailIds: [1, 2],
      });

      const items = model.filteredItems();
      const details = items.filter(isDetailRowItem);
      expect(details.map(item => item.detailFor)).toEqual([2]);
      const leafPos = items.findIndex(item =>
        isDataRowItem(item) && item.originalIndex === 2,
      );
      expect(isDetailRowItem(items[leafPos + 1])).toBe(true);
    });

    it('does not treat a parent as a detail leaf when filtering hides its children', () => {
      const control = new AgridControl();
      control.setTextFilter('name', 'Child A');
      const { model } = createModel({
        control,
        sourceRows: treeRows,
        treeConfig: { ...treeConfig, keepAncestorsOnFilter: false },
        masterDetail: true,
        expandedDetailIds: [1],
      });

      expect(model.filteredItems().some(isDetailRowItem)).toBe(false);
    });

    it('builds generated branch nodes from getPath while preserving source row indices', () => {
      const sourceRows = [
        { oz: '01.01.0001', department: 'X', amount: 1 },
        { oz: '01.01.0002', department: 'X', amount: 2 },
        { oz: '01.02.0001', department: 'X', amount: 3 },
      ];
      const { model } = createModel({
        sourceRows,
        treeConfig: {
          getPath: row => String((row as any).oz).split('.'),
          treeField: 'name',
        },
        expandedTreeIds: ['__agrid_path__["01"]', '__agrid_path__["01","01"]'],
      });

      const items = model.filteredItems();
      expect(items.filter(isPathTreeNodeItem).map(item => item.pathLabel))
        .toEqual(['01', '01', '02']);
      expect(items.filter(isTreeRowItem).map(item => [item.originalIndex, item.treeLabel]))
        .toEqual([[0, '0001'], [1, '0002']]);
    });
  });

  describe('pinned rows', () => {
    it('partitions rows into top/bottom and removes them from the body', () => {
      const { model } = createModel({
        pinRow: row => (row['name'] === 'Alice' ? 'top' : row['name'] === 'Carol' ? 'bottom' : undefined),
      });

      expect(model.pinnedTopItems().map(i => i.row['name'])).toEqual(['Alice']);
      expect(model.pinnedBottomItems().map(i => i.row['name'])).toEqual(['Carol']);
      expect(dataRows(model.filteredItems()).map(i => i.row['name'])).toEqual(['Bob']);
    });

    it('keeps the real source index on pinned rows so editing stays addressable', () => {
      const { model } = createModel({ pinRow: row => (row['name'] === 'Carol' ? 'bottom' : undefined) });
      expect(model.pinnedBottomItems()[0].originalIndex).toBe(2);
    });

    it('ignores pinRow in tree mode', () => {
      const treeRows = [{ id: 1, parentId: null, name: 'Root' }];
      const { model } = createModel({
        sourceRows: treeRows,
        treeConfig: { getId: r => (r as any).id, getParentId: r => (r as any).parentId, treeField: 'name' },
        pinRow: () => 'top',
      });
      expect(model.pinnedTopItems()).toEqual([]);
    });
  });

  describe('master/detail', () => {
    it('inserts a detail item after each expanded row when masterDetail is on', () => {
      const { model } = createModel({ masterDetail: true, expandedDetailIds: [1] });
      const items = model.filteredItems();
      const detail = items.filter(isDetailRowItem);
      expect(detail).toHaveLength(1);
      expect(detail[0].detailFor).toBe(1);
      // the detail item directly follows its parent row
      const parentPos = items.findIndex(i => isDataRowItem(i) && i.originalIndex === 1);
      expect(isDetailRowItem(items[parentPos + 1])).toBe(true);
    });

    it('emits no detail items when masterDetail is off', () => {
      const { model } = createModel({ expandedDetailIds: [0, 1] });
      expect(model.filteredItems().some(isDetailRowItem)).toBe(false);
    });
  });
});

function dataRows(
  items: GridItem[],
): { row: Record<string, unknown>; originalIndex: number }[] {
  return items.filter(isDataRowItem);
}
