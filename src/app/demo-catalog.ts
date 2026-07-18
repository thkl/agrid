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
    path: '/filters',
    label: 'Filters',
    title: 'Every filter type in one grid',
    summary:
      'A server-style filter lab that drives all filter UI through one AgridServerQuery signal: text, values, typed conditions, dates, numbers, booleans, quick search, sorting, and pagination.',
    points: [
      'Enable serverSideFiltering and read provider.serverQuery() from an effect.',
      'Provide values for server-side value checklists.',
      'Use text, number, and date filterable columns to expose the right condition operators.',
      'Set totalRows and replace the datasource with the returned page after each query.',
    ],
    code: `const columns: ColDef<Order>[] = [
  { field: 'reference', header: 'Reference', filterable: true },
  { field: 'customer', header: 'Customer', filterable: true },
  { field: 'status', header: 'Status', filterable: true, values: statuses },
  { field: 'amount', header: 'Amount', type: 'number', filterable: true },
  { field: 'createdAt', header: 'Created', type: 'date', filterable: true },
  {
    field: 'paid',
    header: 'Paid',
    type: 'boolean',
    filterable: true,
    values: [
      { value: true, label: 'Paid' },
      { value: false, label: 'Open' },
    ],
  },
];

readonly datasource = new AgridDataSource<Order>([]);
readonly control = new AgridControl({ pageSize: 25 });
readonly provider = new AgridProvider({
  columns,
  datasource: this.datasource,
  control: this.control,
  serverSideFiltering: true,
  enableQuickFilter: true,
  sortOption: 'multi',
});

constructor() {
  effect(() => {
    const query = this.provider.serverQuery();
    if (!query) return;
    this.api.searchOrders(query).subscribe(result => {
      this.control.setTotalRows(result.total);
      this.datasource.setData(result.rows);
    });
  });
}`,
  },
  {
    path: '/custom-cells',
    label: 'Custom cells',
    title: 'Component renderers and cell classes',
    summary:
      'Render badges and progress bars with real Angular components — full bindings, no HTML-string escaping — while retaining the grid’s normal sorting, filtering, and editing behavior.',
    points: [
      'Point cellRendererComponent at a standalone component.',
      'Inject AGRID_RENDERER_CONTEXT to read value, row, and column reactively.',
      'Use cellClass for state-based styling.',
      'Lock structural columns that should not be moved or hidden.',
    ],
    code: `@Component({
  selector: 'status-badge',
  template: \`<span class="badge" [class]="'badge--' + value()">{{ value() }}</span>\`,
})
export class StatusBadge {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly value = computed(() => String(this.ctx.value() ?? ''));
}

@Component({
  selector: 'score-bar',
  template: \`<span class="track"><span class="fill" [style.width.%]="value()"></span></span>\`,
})
export class ScoreBar {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly value = computed(() => Number(this.ctx.value() ?? 0));
}

const columns: ColDef<Person>[] = [
  { field: 'id', header: 'ID', locked: true, editable: false },
  { field: 'name', header: 'Name', filterable: true },
  { field: 'status', header: 'Status', editable: false, cellRendererComponent: StatusBadge },
  { field: 'score', header: 'Performance', editable: false, cellRendererComponent: ScoreBar },
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
    path: '/custom-editors',
    label: 'Custom editors',
    title: 'Component cell editors',
    summary:
      'Swap the built-in text input for any Angular component — a star rating, a colour picker, a slider — while the grid keeps ownership of validation, history, and the commit lifecycle.',
    points: [
      'Reference a standalone component from ColDef.cellEditor.',
      'Inject AGRID_EDITOR_CONTEXT to read value/row/column and stage drafts with setDraft.',
      'Call commit() to confirm immediately, or let Tab / Enter / Escape work for free.',
      'Pair it with cellRenderer to control how the value looks when not editing.',
    ],
    code: `@Component({
  selector: 'star-rating-editor',
  template: \`
    @for (n of [1,2,3,4,5]; track n) {
      <button (click)="pick(n)">{{ n <= value() ? '★' : '☆' }}</button>
    }\`,
})
export class StarRatingEditor {
  private readonly ctx = inject(AGRID_EDITOR_CONTEXT);
  readonly value = signal(Number(this.ctx.value() ?? 0));
  pick(n: number): void {
    this.value.set(n);
    this.ctx.setDraft(n);   // stage the value
    this.ctx.commit();      // confirm immediately
  }
}

const columns: ColDef<Task>[] = [
  { field: 'task', header: 'Task' },
  {
    field: 'rating',
    header: 'Rating',
    type: 'number',
    cellEditor: StarRatingEditor,
    cellRenderer: ({ value }) => '★'.repeat(value),
  },
];`,
  },
  {
    path: '/charts',
    label: 'Charts',
    title: 'Configurable charts and graphs from grid data',
    summary:
      'A reusable <agrid-chart> component configured exactly like the grid: build an AgridChartProvider and pass it in. Link it to the grid provider’s visibleRows with a transform and the chart or graph follows the grid’s filters and sorting — filter a region out and the chart updates instantly.',
    points: [
      'Same API shape as the grid: <agrid-chart [provider]="chartProvider" />.',
      'Link source: gridProvider.visibleRows for filter/sort-aware data.',
      'A transform(rows, type) callback shapes the rows into chart data.',
      'No effects to wire — the dataset is a derived signal.',
    ],
    code: `readonly chartProvider = new AgridChartProvider<RegionRow>({
  type: 'column',
  source: this.gridProvider.visibleRows,   // filtered + sorted rows
  transform: (rows, type) => ({
    categories: rows.map(r => r.region),
    series: [{ values: rows.map(r => r.total) }],
  }),
  height: 300,
});

// Switch type at runtime — the chart (and transform) re-run.
this.chartProvider.type.set('pie');

// Template
// <agrid-chart [provider]="chartProvider" />`,
  },
  {
    path: '/sparklines',
    label: 'Sparklines',
    title: 'Zero-dependency inline charts',
    summary:
      'Excel-style in-cell charts drawn with plain SVG. A cellRendererComponent reads a number[] field and renders a line or bar sparkline — no charting library, just the renderer API and a pure geometry helper.',
    points: [
      'Store a numeric series per row (e.g. 12 monthly values).',
      'buildSparkline() scales the series into an SVG box (line + bar geometry).',
      'A small renderer component emits the <path> / <rect> elements.',
      'High, low, and last points are highlighted on the line variant.',
    ],
    code: `@Component({
  selector: 'line-sparkline',
  template: \`
    <svg [attr.width]="w" [attr.height]="h">
      <path fill="none" [attr.d]="geo().linePath" />
      @if (geo().last; as l) { <circle [attr.cx]="l.x" [attr.cy]="l.y" r="2" /> }
    </svg>\`,
})
export class LineSparkline {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly w = 96; readonly h = 26;
  readonly geo = computed(() =>
    buildSparkline(this.ctx.value() as number[], { width: this.w, height: this.h }));
}

const columns: ColDef[] = [
  { field: 'name', header: 'Product' },
  { field: 'trend', header: 'Trend', cellRendererComponent: LineSparkline },
];`,
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
    title: 'Standalone tree with local and server data',
    summary:
      'AgridTree uses the grid hierarchy engine for compact navigation, with either local rows or lazy server-loaded children.',
    points: [
      'Use the same parent-ID or path-based tree configuration as the grid.',
      'Add serverTree loaders when the root config and child nodes should arrive on demand.',
      'Expose hasChildren so unloaded server nodes still render an expander and spinner.',
      'Navigate and expand nodes with standard tree keyboard controls.',
    ],
    code: `interface OrgRow {
  id: number;
  parentId: number | null;
  name: string;
  role: string;
  team: string;
  hasChildren: boolean;
}

// Server responses use the same flat parent/id shape as local data.
// GET /api/tree/root
// {
//   "rows": [
//     { "id": 101, "parentId": null, "name": "Global Operations",
//       "role": "Division", "team": "Operations", "hasChildren": true },
//     { "id": 201, "parentId": null, "name": "Customer Programs",
//       "role": "Division", "team": "Customer Success", "hasChildren": true }
//   ]
// }
//
// GET /api/tree/nodes/101/children
// {
//   "rows": [
//     { "id": 102, "parentId": 101, "name": "Logistics",
//       "role": "Department", "team": "Operations", "hasChildren": true },
//     { "id": 103, "parentId": 101, "name": "Facilities",
//       "role": "Department", "team": "Operations", "hasChildren": false }
//   ]
// }

const treeConfig = {
  getId: (row: OrgRow) => row.id,
  getParentId: (row: OrgRow) => row.parentId,
  treeField: 'name',
} as const;

const api = {
  async getTreeRoot(): Promise<{ rows: OrgRow[] }> {
    const response = await fetch('/api/tree/root');
    return response.json();
  },
  async getTreeChildren(id: number): Promise<{ rows: OrgRow[] }> {
    const response = await fetch(\`/api/tree/nodes/\${id}/children\`);
    return response.json();
  },
};

readonly provider = new AgridTreeProvider<OrgRow>({
  datasource: new AgridDataSource(rows),
  treeConfig: { ...treeConfig, defaultExpanded: true },
  getDescription: row => \`\${row.role} · \${row.team}\`,
  selection: 'single',
});

readonly serverProvider = new AgridTreeProvider<OrgRow>({
  datasource: new AgridDataSource(),
  treeConfig,
  serverTree: {
    loadRoot: () => api.getTreeRoot(),
    loadChildren: ({ id }) => api.getTreeChildren(Number(id)),
    hasChildren: row => row.hasChildren === true,
    rootLoadingText: 'Loading root configuration',
    childLoadingText: 'Loading child nodes',
  },
  getDescription: row => \`\${row.role} · \${row.team}\`,
  selection: 'single',
});

// Template
// <agrid-tree [provider]="provider" />
// <agrid-tree [provider]="serverProvider" />`,
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
    path: '/column-virtualization',
    label: 'Column virtualization',
    title: 'Wide grids with many columns',
    summary:
      'Beyond a column-count threshold the scrollable pane renders only the columns near the horizontal viewport (plus overscan), so a 60-column grid keeps a small per-row DOM. Pinned columns always render.',
    points: [
      'Activates automatically past ~30 scrollable columns — no configuration.',
      'The full grid-template-columns is preserved, so headers, filters, and footers stay aligned and scroll width is exact.',
      'Leading/trailing spacer cells hold the place of off-screen columns.',
      'Pin the columns that must always stay visible with pinned: left | right.',
    ],
    code: `const columns: ColDef[] = [
  { field: 'id', header: 'ID', pinned: 'left' },
  { field: 'name', header: 'Name', pinned: 'left' },
  ...Array.from({ length: 60 }, (_, i) => ({
    field: \`m\${i + 1}\`,
    header: \`Metric \${i + 1}\`,
    type: 'number',
  })),
];

readonly provider = new AgridProvider({
  columns,
  datasource: new AgridDataSource(rows),
  control: new AgridControl(),
  zebraStripes: true,
});`,
  },
  {
    path: '/column-performance',
    label: 'Column benchmark',
    title: 'Wide-grid benchmark',
    summary:
      'A performance harness scaled across columns instead of rows: switch between 50, 100, 200, and 400 columns and time filter, sort, and update operations. Render and operation times stay flat because only the columns near the viewport are materialized per row.',
    points: [
      'Pick a column count (50–400) — the same dataset, re-columned.',
      'Run an operation and read the elapsed time in the status output.',
      'Compare timings across column counts to see the per-row DOM stay bounded.',
      'Two identity columns are pinned; the rest are virtualized.',
    ],
    code: `const columns: ColDef[] = [
  { field: 'id', header: 'ID', pinned: 'left' },
  { field: 'name', header: 'Name', pinned: 'left' },
  ...Array.from({ length: metricCount }, (_, i) => ({
    field: \`m\${i + 1}\`,
    header: \`Metric \${i + 1}\`,
    type: 'number',
  })),
];

readonly provider = new AgridProvider({
  columns,
  datasource: new AgridDataSource(createRows(5_000, metricCount)),
  control: new AgridControl(),
  zebraStripes: true,
});

// Re-column at runtime — the columns signal is writable.
this.provider.columns.set(createColumns(nextCount));`,
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
