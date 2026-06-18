export interface DemoGuide {
  path: string;
  label: string;
  title: string;
  summary: string;
  points: string[];
  code: string;
}

export const DEMO_GUIDES: DemoGuide[] = [
  {
    path: '/demo',
    label: 'Overview',
    title: 'Full-featured editable grid',
    summary:
      'The overview combines editing, validation, grouping, row marking, selection, the column sidebar, and CSV export.',
    points: [
      'Define typed columns and validation rules.',
      'Use the small condition button beside First Name or Last Name to choose includes, starts with, ends with, like, and related operators.',
      'Keep rows in AgridDataSource and interaction state in AgridControl.',
      'Pass both through one AgridProvider and subscribe only to the events you need.',
    ],
    code: `const columns: ColDef<Employee>[] = [
  { field: 'id', header: 'ID', editable: false },
  { field: 'name', header: 'Name', filterable: true },
  {
    field: 'email',
    header: 'Email',
    validate: value => /@/.test(String(value))
      ? null
      : 'Enter a valid email',
  },
  {
    field: 'departmentId',
    header: 'Department',
    filterable: true,
    groupable: true,
    values: departments,
  },
];

readonly datasource = new AgridDataSource<Employee>(rows);
readonly control = new AgridControl({ pageSize: 20 });
readonly provider = new AgridProvider({
  columns,
  datasource: this.datasource,
  control: this.control,
  allowAddRows: true,
  showControlColumn: true,
  showSidebar: true,
  enableRowMarking: true,
  enableQuickFilter: true,
  rowSelection: 'multi',
});

// Template
// <agrid [provider]="provider" (cellEdit)="onEdit($event)" />`,
  },
  {
    path: '/custom-cells',
    label: 'Custom cells',
    title: 'Custom renderers and cell classes',
    summary:
      'Render badges and progress indicators while retaining the grid’s normal sorting, filtering, and editing behavior.',
    points: [
      'Return sanitized HTML from cellRenderer.',
      'Use cellClass for state-based styling.',
      'Lock structural columns that should not be moved or hidden.',
    ],
    code: `const columns: ColDef<Person>[] = [
  { field: 'id', header: 'ID', locked: true, editable: false },
  { field: 'name', header: 'Name', filterable: true },
  {
    field: 'status',
    header: 'Status',
    editable: false,
    cellRenderer: ({ value }) =>
      \`<span class="status-badge">\${value}</span>\`,
  },
  {
    field: 'score',
    header: 'Performance',
    editable: false,
    cellRenderer: ({ value }) =>
      \`<progress max="100" value="\${value}"></progress>\`,
  },
];

readonly provider = new AgridProvider({
  columns,
  datasource: new AgridDataSource(rows),
  control: new AgridControl({ allowRowReorder: true }),
  showControlColumn: true,
  showSidebar: true,
  rowSelection: 'single',
});`,
  },
  {
    path: '/pagination',
    label: 'Pagination',
    title: 'Client-side pagination',
    summary:
      'All rows stay local while AgridControl determines the current page and page size after filtering.',
    points: [
      'Provide the full local dataset once.',
      'Set pageSize on AgridControl.',
      'Change page size at runtime without recreating the provider.',
    ],
    code: `readonly datasource = new AgridDataSource<Product>(rows);
readonly control = new AgridControl({ pageSize: 25 });

readonly provider = new AgridProvider({
  columns,
  datasource: this.datasource,
  control: this.control,
  zebraStripes: true,
  showSidebar: true,
});

setPageSize(size: number): void {
  this.control.setPageSize(size);
}

// Template
// <agrid [provider]="provider" />`,
  },
  {
    path: '/server-pagination',
    label: 'Server pagination',
    title: 'Remote pagination, filtering, and sorting',
    summary:
      'Server-side mode emits requests instead of transforming rows locally, so the host remains responsible for fetching each result page.',
    points: [
      'Enable serverSideFiltering.',
      'Listen for page, filter, and sort events.',
      'Update totalRows and replace the datasource after each request.',
    ],
    code: `readonly datasource = new AgridDataSource<Order>([]);
readonly control = new AgridControl({ pageSize: 20 });
readonly provider = new AgridProvider({
  columns,
  datasource: this.datasource,
  control: this.control,
  serverSideFiltering: true,
  sortOption: 'single',
});

onPageChange({ page, pageSize }: PageChangeEvent): void {
  this.api.loadOrders({ page, pageSize }).subscribe(result => {
    this.control.setTotalRows(result.total);
    this.datasource.setData(result.rows);
  });
}

// <agrid [provider]="provider"
//   (pageChange)="onPageChange($event)"
//   (filterChange)="onFilter($event)"
//   (sortChange)="onSort($event)" />`,
  },
  {
    path: '/aggregates',
    label: 'Aggregates',
    title: 'Aggregate footers and grouped subtotals',
    summary:
      'Numeric columns declare their aggregate function directly; the same configuration drives the footer and grouped subtotals.',
    points: [
      'Set aggregate to sum, avg, min, max, count, or a custom function.',
      'Format the displayed result independently.',
      'Allow users to change aggregates from the column menu.',
    ],
    code: `const columns: ColDef<Sale>[] = [
  { field: 'region', header: 'Region', groupable: true },
  { field: 'deals', header: 'Deals', type: 'number', aggregate: 'sum' },
  {
    field: 'revenue',
    header: 'Revenue',
    type: 'number',
    aggregate: 'sum',
    formatter: value => \`$\${Number(value).toLocaleString()}\`,
  },
  {
    field: 'margin',
    header: 'Margin %',
    type: 'number',
    aggregate: 'avg',
  },
];

readonly provider = new AgridProvider({
  columns,
  datasource: new AgridDataSource(rows),
  control: new AgridControl(),
  showSidebar: true,
});`,
  },
  {
    path: '/readonly',
    label: 'Readonly',
    title: 'Runtime readonly mode',
    summary:
      'The provider exposes a writable readonly signal, allowing the same grid to switch between viewer and editor modes.',
    points: [
      'Start with readonly enabled in the provider.',
      'Toggle provider.readonlyGrid without rebuilding the grid.',
      'Context menu actions can still provide controlled mutations.',
    ],
    code: `readonly isReadonly = signal(true);
readonly datasource = new AgridDataSource<Issue>(rows);

readonly provider = new AgridProvider({
  columns,
  datasource: this.datasource,
  control: new AgridControl(),
  readonly: true,
  rowSelection: 'multi',
  cellMenuItems: [
    {
      label: 'Mark as Done',
      action: ({ originalIndex }) =>
        this.datasource.patchRow(originalIndex, { status: 'Done' }),
    },
  ],
});

constructor() {
  effect(() => this.provider.readonlyGrid.set(this.isReadonly()));
}`,
  },
  {
    path: '/pinning',
    label: 'Column pinning',
    title: 'Pinned and locked columns',
    summary:
      'Columns can start pinned on either side while the middle pane remains horizontally scrollable.',
    points: [
      'Set pinned to left or right in the column definition.',
      'Use locked when users must not move, hide, or unpin a column.',
      'Unpinned columns continue to resize and reorder normally.',
    ],
    code: `const columns: ColDef<Person>[] = [
  {
    field: 'id',
    header: 'ID',
    pinned: 'left',
    locked: true,
    editable: false,
  },
  { field: 'name', header: 'Name', filterable: true },
  { field: 'email', header: 'Email' },
  { field: 'department', header: 'Department' },
  {
    field: 'status',
    header: 'Status',
    pinned: 'right',
    values: statuses,
  },
];

readonly provider = new AgridProvider({
  columns,
  datasource: new AgridDataSource(rows),
  control: new AgridControl(),
  showSidebar: true,
  rowSelection: 'multi',
});`,
  },
  {
    path: '/tree',
    label: 'Standalone tree',
    title: 'Standalone tree from flat rows',
    summary:
      'AgridTree uses the grid hierarchy engine for compact navigation without rendering grid columns.',
    points: [
      'Use the same parent-ID or path-based tree configuration as the grid.',
      'Navigate and expand nodes with standard tree keyboard controls.',
      'Receive typed row and generated branch events from one component.',
    ],
    code: `readonly provider = new AgridTreeProvider<OrgRow>({
  datasource: new AgridDataSource(rows),
  treeConfig: {
    getId: row => row.id,
    getParentId: row => row.parentId,
    treeField: 'name',
    defaultExpanded: true,
  },
  getDescription: row => \`\${row.role} · \${row.team}\`,
  selection: 'single',
});

// tree()?.expandAllNodes();
// tree()?.collapseAllNodes();`,
  },
  {
    path: '/master-detail',
    label: 'Master / detail',
    title: 'Expandable details and pinned rows',
    summary:
      'Master/detail inserts variable-height panels below data rows while pinRow keeps selected records fixed above or below the main body.',
    points: [
      'Enable masterDetail and provide a detail renderer.',
      'Set detailRowHeight for virtual scrolling.',
      'Return top or bottom from pinRow for persistent summary rows.',
    ],
    code: `readonly provider = new AgridProvider<Order>({
  columns,
  datasource: new AgridDataSource([...orders, summary]),
  control: new AgridControl(),
  masterDetail: true,
  detailRowHeight: 150,
  pinRow: row => row.isSummary ? 'bottom' : undefined,
  getRowClass: ({ row }) =>
    row.isSummary ? 'row-summary' : '',
  detailRenderer: ({ row }) => \`
    <section class="order-detail">
      <strong>\${row.customer}</strong>
      <span>\${row.notes}</span>
    </section>
  \`,
});`,
  },
  {
    path: '/performance',
    label: 'Performance',
    title: 'Large-dataset virtual scrolling',
    summary:
      'The performance page uses the normal provider API with a large datasource and measures common control operations.',
    points: [
      'Pass the complete dataset to AgridDataSource.',
      'Virtual scrolling renders only the visible rows.',
      'Drive filters, sorting, grouping, and aggregates through AgridControl.',
    ],
    code: `readonly datasource = new AgridDataSource<PerformanceRow>(
  createRows(100_000),
);
readonly control = new AgridControl();
readonly provider = new AgridProvider({
  columns,
  datasource: this.datasource,
  control: this.control,
  zebraStripes: true,
});

runFilter(): void {
  this.control.setTextFilter('name', 'Employee 42');
}

runSort(): void {
  this.control.setSort('salary', 'desc');
}

runGroup(): void {
  this.control.setGroupBy('department');
}`,
  },
];

export const DEMO_GUIDE_BY_PATH = new Map(DEMO_GUIDES.map(demo => [demo.path, demo]));
