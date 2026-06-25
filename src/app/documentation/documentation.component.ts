import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-documentation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './documentation.component.html',
  styleUrl: './documentation.component.css',
})
export class DocumentationComponent {
  /** Keep in-page chapter links inside the hash-routed documentation page. */
  onAnchorClick(event: MouseEvent): void {
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!anchor) return;
    const id = anchor.getAttribute('href')?.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'start' });
  }

  readonly installCode = 'pnpm add @thkl/agrid @angular/cdk';

  readonly quickStartCode = `import { Component } from '@angular/core';
import {
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  ColDef,
  GridEditEvent,
} from '@thkl/agrid';

interface Person {
  id: number;
  name: string;
  hiredAt: string;
  departmentId: number;
}

const columns: ColDef<Person>[] = [
  { field: 'id', header: 'ID', width: 70, editable: false, pinned: 'left' },
  { field: 'name', header: 'Name', width: 160, filterable: true },
  { field: 'hiredAt', header: 'Hire Date', width: 130, type: 'date' },
  {
    field: 'departmentId',
    header: 'Department',
    width: 140,
    filterable: true,
    groupable: true,
    values: [
      { value: 1, label: 'Engineering' },
      { value: 2, label: 'Sales' },
    ],
  },
];

@Component({
  selector: 'app-page',
  imports: [AgridComponent],
  template: \`
    <agrid [provider]="provider" (cellEdit)="onCellEdit($event)" />
  \`,
})
export class PageComponent {
  readonly datasource = new AgridDataSource<Person>([
    { id: 1, name: 'Alice', hiredAt: '2021-03-15', departmentId: 1 },
    { id: 2, name: 'Bob', hiredAt: '2022-07-01', departmentId: 2 },
  ]);

  readonly control = new AgridControl({ allowRowReorder: true });

  readonly provider = new AgridProvider<Person>({
    columns,
    datasource: this.datasource,
    control: this.control,
    showControlColumn: true,
    showSidebar: true,
    zebraStripes: true,
    rowSelection: 'multi',
  });

  onCellEdit(event: GridEditEvent): void {
    console.log(event);
  }
}`;

  readonly localizationCode = `readonly provider = new AgridProvider({
  locale: 'de-DE',
  columns,
  datasource,
}).addLocalization('fr-FR', {
  addRow: 'Ajouter une ligne',
  noRows: 'Aucune donnée',
  rows: count => \`\${count} enregistrement\${count === 1 ? '' : 's'}\`,
});`;

  readonly signalCode = `interface Row {
  id: number;
  name: string;
}

readonly rows = signal<Row[]>([
  { id: 1, name: 'Alice' },
]);
readonly datasource = new AgridDataSource<Row>();

constructor() {
  this.datasource.linkSignal(this.rows);
}`;

  readonly addRecordCode = `onPrepareAdd(event: NewRecord<Person>): void {
  const next = event.datasource.length;
  event.datasource.patchRow(event.index, {
    id: next,
    departmentId: 1,
  });
}`;

  readonly saveRowCode = `saveRow(event: RowUpdateEvent<Person>): void {
  this.http.patch(
    \`/api/people/\${event.row.id}\`,
    event.row,
  ).subscribe(() => {
    this.grid()?.clearChangedCells(event.originalIndex);
  });
}`;

  readonly rowMarkingCode = `readonly grid = viewChild(AgridComponent);

readonly provider = new AgridProvider<Person>({
  columns,
  datasource,
  enableRowMarking: true,
});

getMarkedRows(): Person[] {
  return [...this.grid()!.markedRowIndices()]
    .map(index => datasource.getRow(index));
}

clearCopyBasket(): void {
  this.grid()?.clearMarkedRows();
}`;

  readonly headerGroupsCode = `const columns: ColDef<Person>[] = [
  { field: 'firstName', header: 'First name', group: 'employee' },
  { field: 'lastName', header: 'Last name', group: 'employee' },
  { field: 'email', header: 'Email' },
];

readonly provider = new AgridProvider<Person>({
  columns,
  datasource,
  control: new AgridControl(),
  headerGroups: [
    { id: 'employee', label: 'Employee' },
  ],
});`;

  readonly treeCode = `import { AgridProvider, AgridDataSource, ColDef, AgridTreeConfig } from '@thkl/agrid';

interface OrgRow {
  id: number;
  parentId: number | null;
  name: string;
  role: string;
}

// Flat rows linked by parentId — no nested children arrays.
const rows: OrgRow[] = [
  { id: 1, parentId: null, name: 'Dana',  role: 'CEO' },
  { id: 2, parentId: 1,    name: 'Priya', role: 'VP Engineering' },
  { id: 3, parentId: 2,    name: 'Marco', role: 'Engineer' },
];

const columns: ColDef<OrgRow>[] = [
  { field: 'name', header: 'Name', width: 240, filterable: true },
  { field: 'role', header: 'Role', width: 160 },
];

const treeConfig: AgridTreeConfig<OrgRow> = {
  getId: row => row.id,
  getParentId: row => row.parentId,   // null / unknown id ⇒ root row
  treeField: 'name',                  // column that shows the twisty
};

readonly provider = new AgridProvider<OrgRow>({
  columns,
  datasource: new AgridDataSource(rows),
  treeConfig,
});

// Alternative: derive display-only branches from a path-like field.
interface OzRow {
  oz: string;
  description: string;
  areaLabel: string;
  groupLabel: string;
}

const pathTreeConfig: AgridTreeConfig<OzRow> = {
  getPath: row => row.oz.split('.'),
  formatPathSegment: ({ row, segment, level, leaf }) =>
    leaf
      ? \`\${segment} \${row.description}\`
      : \`\${segment} \${level === 0 ? row.areaLabel : row.groupLabel}\`,
  treeField: 'oz',
};`;

  readonly typedFilterCode = `const columns: ColDef<Order>[] = [
  // text column → equals, not equal, like, starts/ends with, includes
  { field: 'reference', header: 'Reference', filterable: true },
  // number column → =, ≠, >, ≥, <, ≤, between
  { field: 'total', header: 'Total', type: 'number', filterable: true },
  // date column → on / before / after / between
  { field: 'placedAt', header: 'Placed', type: 'date', filterable: true },
  // boolean column → inline checkbox, toggles on click (no edit mode)
  { field: 'paid', header: 'Paid', type: 'boolean' },
];

// Conditions are also available programmatically:
control.setRangeFilter('reference', 'startsWith', 'INV-');
control.setRangeFilter('total', 'between', '100', '500');
control.setRangeFilter('total', null, null); // clear it`;

  readonly quickFilterCode = `readonly provider = new AgridProvider<Person>({
  columns,
  datasource,
  enableQuickFilter: true, // renders a search box above the grid
});

// Or drive it from code — part of toJSON() state:
control.setQuickFilter('alice');`;

  readonly validationCode = `const columns: ColDef<Person>[] = [
  {
    field: 'email',
    header: 'Email',
    // return a message to reject the edit, or null to accept it
    validate: v => /@/.test(String(v)) ? null : 'Enter a valid email',
  },
  {
    field: 'age',
    header: 'Age',
    type: 'number',
    validate: (v, row) => Number(v) >= 0 ? null : 'Age must be ≥ 0',
  },
];`;

  readonly serverSideCode = `<agrid [provider]="provider" (serverQueryChange)="loadRows($event)" />

loadRows(query: AgridServerQuery): void {
  this.api.orders(query).subscribe(result => {
    this.datasource.setData(result.rows);
    this.control.setTotalRows(result.total);
  });
}

// Or drive a signal-backed store directly from the provider:
effect(() => {
  const query = this.provider.serverQuery();
  if (!query) return;
  this.store.load(query);
});`;

  readonly persistenceCode = `const saved = localStorage.getItem('agrid-state');
const control = AgridControl.fromJSON(saved ? JSON.parse(saved) : {});

localStorage.setItem('agrid-state', JSON.stringify(control.toJSON()));`;

  readonly sortingGuideCode = `const control = new AgridControl();

// Replace the current sort.
control.setSort('total', 'desc');

// Add a secondary sort (when sortOption is 'multi').
control.addSort('customer', 'asc');

// Clear one sort.
control.setSort('total', null);

readonly provider = new AgridProvider({
  columns,
  datasource,
  control,
  sortOption: 'multi', // 'single' | 'multi' | 'none'
});`;

  readonly filteringGuideCode = `const columns: ColDef<Order>[] = [
  { field: 'customer', header: 'Customer', filterable: true },
  { field: 'total', header: 'Total', type: 'number', filterable: true },
  { field: 'placedAt', header: 'Placed', type: 'date', filterable: true },
];

control.setTextFilter('customer', 'alice');
control.setRangeFilter('total', 'between', '100', '500');
control.setQuickFilter('priority');
control.clearFilter('total');`;

  readonly columnsGuideCode = `const columns: ColDef<Person>[] = [
  { field: 'id', header: 'ID', width: 72, pinned: 'left', locked: true },
  { field: 'name', header: 'Name', width: 180 },
  { field: 'email', header: 'Email', hidden: true },
];

control.setColumnVisibility('email', true);
control.setPinned('name', true);
control.setColumnOrder(['id', 'name', 'email']);
control.setColumnWidth('name', 240);

// Let users make the same changes in the grid.
const provider = new AgridProvider({ columns, datasource, control, showSidebar: true });`;

  readonly editingGuideCode = `const columns: ColDef<Person>[] = [
  { field: 'id', header: 'ID', editable: false },
  {
    field: 'email',
    header: 'Email',
    validate: value => /@/.test(String(value))
      ? null
      : 'Enter a valid email',
  },
  {
    field: 'status',
    header: 'Status',
    values: ['Active', 'Paused'],
  },
];

// Template:
// <agrid [provider]="provider"
//   (cellEdit)="onCellEdit($event)"
//   (rowChanged)="saveRow($event)"
//   (validationFailed)="showError($event)" />`;

  readonly selectionGuideCode = `readonly grid = viewChild(AgridComponent<Person>);

readonly provider = new AgridProvider<Person>({
  columns,
  datasource,
  rowSelection: 'multi',
  enableRowMarking: true,
});

// Cell ranges support Shift+click, copy/paste, and fill handles.
// Marked rows are appended to clipboard operations.
const selectedRows = [...(grid()?.selectedRowIndices() ?? [])]
  .map(index => datasource.getRow(index));
grid()?.clearMarkedRows();

// Live spreadsheet statistics for the active numeric range:
const summary = grid()?.selectionSummary();
// { count, sum, average, min, max } | null`;

  readonly groupingGuideCode = `const columns: ColDef<Sale>[] = [
  { field: 'region', header: 'Region', groupable: true },
  { field: 'revenue', header: 'Revenue', type: 'number', aggregate: 'sum' },
  { field: 'margin', header: 'Margin', type: 'number', aggregate: 'avg' },
];

control.setGroupBy('region');
control.setAggregate('revenue', 'sum');

grid()?.expandGroups();
grid()?.collapseGroups();
control.setGroupBy(null);`;

  readonly pivotGuideCode = `const provider = new AgridProvider<Sale>({
  columns: [
    { field: 'region', header: 'Region' },
    { field: 'quarter', header: 'Quarter' },
    { field: 'revenue', header: 'Revenue', type: 'number' },
  ],
  datasource: new AgridDataSource(sales),
  pivotConfig: {
    rowField: 'region',
    columnField: 'quarter',
    valueField: 'revenue',
    aggregate: 'sum',
  },
  showSidebar: true, // users can reconfigure the pivot here
});`;

  readonly paginationGuideCode = `// Client-side pagination.
const control = new AgridControl({ pageSize: 25 });
control.setPage(2);
control.setPageSize(50);

// For lazy server data, provide a row model instead of a datasource.
const rowModel = new AgridServerSideRowModel<Order>({
  blockSize: 100,
  datasource: {
    getRows: request => api.getOrders(request),
  },
});

const provider = new AgridProvider({ columns, control, serverSideRowModel: rowModel });`;

  readonly settingsGuideCode = `// Save after a user changes pivot or column visibility.
saveSettings(settings: AgridSettings): void {
  this.http.put('/api/users/me/grid-settings/orders', settings).subscribe();
}

// Template:
// <agrid #grid [provider]="provider" (settingsChange)="saveSettings($event)" />

// Restore before or after rendering.
provider.loadSettings(savedSettings);
grid()?.loadSettings(savedSettings);

// Create a snapshot on demand.
const snapshot = provider.saveSettings();`;

  readonly chartsCode = `import { AgridChartComponent, AgridChartProvider } from '@thkl/agrid';

// Linked to the grid's filtered + sorted rows.
readonly chartProvider = new AgridChartProvider<RegionRow>({
  type: 'column',
  source: this.gridProvider.visibleRows,
  transform: (rows, type) => ({
    categories: rows.map(r => r.region),
    series: [{ values: rows.map(r => r.total) }],
  }),
  height: 300,
});

// Switch type at runtime — the chart (and transform) re-run.
this.chartProvider.type.set('pie');

// Template:
// <agrid-chart [provider]="chartProvider" />`;

  readonly layoutCode = `mat-card {
  height: 600px;
  display: flex;
  flex-direction: column;
}

mat-card-content,
agrid {
  flex: 1;
  min-height: 0;
}`;
}
