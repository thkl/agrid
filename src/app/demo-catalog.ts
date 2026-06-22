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
    path: '/conditional-formatting',
    label: 'Conditional formatting',
    title: 'Row-aware cell styling',
    summary:
      'Use cellFormat to calculate colors, borders, typography, and alignment from each cell’s current data.',
    points: [
      'Receive the typed row, value, column, and original datasource index.',
      'Return only the visual properties that should override the grid theme.',
      'Use CSS variables to keep conditional colors compatible with light and dark themes.',
    ],
    code: `const columns: ColDef<PortfolioRow>[] = [
  {
    field: 'status',
    header: 'Status',
    cellFormat: ({ value }) => ({
      backgroundColor: value === 'On track' ? '#ecfdf3' : '#fef2f2',
      borderColor: value === 'On track' ? '#86efac' : '#fca5a5',
      color: value === 'On track' ? '#166534' : '#991b1b',
      fontWeight: 650,
    }),
  },
  {
    field: 'variance',
    header: 'Variance',
    formatter: value => \`\${Number(value) > 0 ? '+' : ''}\${value}%\`,
    cellFormat: ({ value }) => ({
      color: Number(value) >= 0 ? '#166534' : '#991b1b',
      fontWeight: 700,
      textAlign: 'right',
    }),
  },
];

readonly provider = new AgridProvider({
  columns,
  datasource: new AgridDataSource(rows),
  control: new AgridControl(),
  zebraStripes: true,
});`,
  },
  {
    path: '/selection-summary',
    label: 'Selection summary',
    title: 'Live statistics for selected cells',
    summary:
      'Select numeric cells to display count, sum, average, minimum, and maximum in a responsive status bar.',
    points: [
      'Click, Shift+click, use Shift+arrow, or drag to create a rectangular cell range.',
      'Only finite numeric values contribute to the live statistics.',
      'Read the same values programmatically from selectionSummary().',
    ],
    code: `interface RevenueRow {
  month: string;
  north: number;
  south: number;
  east: number;
  west: number;
}

const columns: ColDef<RevenueRow>[] = [
  { field: 'month', header: 'Month', editable: false },
  { field: 'north', header: 'North', type: 'number' },
  { field: 'south', header: 'South', type: 'number' },
  { field: 'east', header: 'East', type: 'number' },
  { field: 'west', header: 'West', type: 'number' },
];

readonly grid = viewChild(AgridComponent<RevenueRow>);
readonly summary = computed(() => this.grid()?.selectionSummary() ?? null);
readonly provider = new AgridProvider({
  columns,
  datasource: new AgridDataSource(rows),
});

// The status bar appears automatically for numeric selections.
// summary() returns { count, sum, average, min, max } or null.`,
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
      'Use the page selector to navigate by button, dropdown, or typed page ID.',
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
// <agrid-page-selector [items]="pages()"
//   [selectedId]="control.currentPage()"
//   (selectPage)="control.setPage($event.id)" />
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
    path: '/server-side-row-model',
    label: 'Server row model',
    title: 'Lazy block loading from a remote dataset',
    summary:
      'The virtual viewport requests sparse row blocks while filters and sorting invalidate the cache and issue a fresh query.',
    points: [
      'Serve the dataset from a deployable GitHub Pages asset.',
      'Implement getRows with the requested startRow/endRow range and query metadata.',
      'Return rowCount so the virtual scrollbar represents the complete result set.',
      'Limit maxBlocksInCache to bound loaded row memory.',
    ],
    code: `const dataUrl = new URL(
  'demo/server-side-orders.json',
  document.baseURI,
).href;

const rowModel = new AgridServerSideRowModel<Order>({
  blockSize: 50,
  maxBlocksInCache: 6,
  initialRowCount: 2_000,
  datasource: {
    async getRows(request) {
      const allRows = await fetch(dataUrl).then(response => response.json());
      const matchingRows = applyServerQuery(allRows, request);
      return {
        rows: matchingRows.slice(request.startRow, request.endRow),
        rowCount: matchingRows.length,
      };
    },
  },
});

readonly provider = new AgridProvider<Order>({
  columns,
  control: new AgridControl(),
  serverSideRowModel: rowModel,
  enableQuickFilter: true,
});`,
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
      'The control owns readonly state, allowing the same grid to switch between viewer and editor modes.',
    points: [
      'Start with readonly enabled in the provider.',
      'Toggle control readonly state without rebuilding the grid.',
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
  effect(() => this.provider.control.setReadonly(this.isReadonly()));
}`,
  },
  {
    path: '/pivot',
    label: 'Pivot table',
    title: 'Client-side pivot table',
    summary:
      'Turn flat sales records into a reactive region-by-quarter matrix using the same aggregate functions as the rest of the grid.',
    points: [
      'Choose one row field, one column field, and one value field.',
      'Aggregate each intersection with sum, average, minimum, maximum, count, or a custom function.',
      'Enable the sidebar so users can reconfigure the pivot without touching source records.',
    ],
    code: `const columns: ColDef<Sale>[] = [
  { field: 'region', header: 'Region' },
  { field: 'quarter', header: 'Quarter' },
  {
    field: 'revenue',
    header: 'Revenue',
    type: 'number',
    formatter: value => \`$\${Number(value).toLocaleString()}\`,
  },
];

readonly provider = new AgridProvider<Sale>({
  columns,
  datasource: new AgridDataSource(sales),
  pivotConfig: {
    rowField: 'region',
    columnField: 'quarter',
    valueField: 'revenue',
    aggregate: 'sum',
  },
  zebraStripes: true,
  showSidebar: true,
});`,
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
      'Use detailColumnField for a multiline field editor in the panel.',
      'Set detailRowHeight for virtual scrolling.',
      'Return top or bottom from pinRow for persistent summary rows.',
    ],
    code: `readonly provider = new AgridProvider<Order>({
  columns,
  datasource: new AgridDataSource([...orders, summary]),
  control: new AgridControl(),
  masterDetail: true,
  detailRowHeight: 150,
  detailColumnField: 'notes',
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
