# @thkl/agrid

A signal-based, standalone data grid for Angular 21 and 22 with virtual scrolling, editing,
filtering, sorting, grouping, tree data, pinned columns, selection, clipboard operations,
pagination, and linked SVG charts/graphs.

## Install

```bash
npm install @thkl/agrid @angular/cdk
```

## Feature Highlights

- Virtual rows and virtual columns for large and wide datasets.
- Text, value, quick, and condition filters with local or server-side workflows.
- Multi-column sorting with optional custom comparators per column.
- Inline editing, validation, undo/redo, paste, fill, custom editors, and custom renderers.
- Range selection, selection summaries, row selection, row marking, column marking, and row numbers.
- Grouping, aggregate footers, tree data with descendant rollups, pivot tables, and master/detail rows.
- Pinned columns, pinned rows, column reordering, column autosize, and persistable settings.
- CSV, zero-dependency `.xlsx` export, sparklines, and linked SVG charts/graphs.

## Usage

```ts
import { Component, viewChild } from '@angular/core';
import {
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  ColDef,
  RowUpdateEvent,
} from '@thkl/agrid';

interface Person {
  id: number;
  name: string;
}

const columns: ColDef<Person>[] = [
  { field: 'id', header: 'ID', editable: false },
  {
    field: 'name',
    header: 'Name',
    filterable: true,
    infoIcon: ({ row }) => Boolean(row.name),
  },
];

@Component({
  selector: 'app-people',
  imports: [AgridComponent],
  template: '<agrid [provider]="provider" />',
})
export class PeopleComponent {
  readonly grid = viewChild(AgridComponent);
  readonly provider = new AgridProvider<Person>({
    columns,
    datasource: new AgridDataSource([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]),
    control: new AgridControl(),
    headerGroups: [{ id: 'employee', label: 'Employee' }],
    showChangedCellIndicator: true,
    enableRowMarking: true,
    confirmRowDelete: true,
  });
}
```

Set `infoIcon: true` to show a right-aligned `?` action for every cell in a
column, or use a predicate to enable it per row. Listen to `(cellInfo)` to
receive the row, field, value, original row index, and column definition.

Set `group: 'employee'` on adjacent columns to render the `Employee` label above them. Dragging
that grouped header moves its current contiguous column segment as one block. Reordering, hiding,
or pinning may split one group ID into multiple headers. Segments containing locked columns cannot
be dragged.

`confirmRowDelete` protects grid delete actions with a localized in-row Yes/No confirmation.
Direct calls to `AgridDataSource.removeRow()` remain immediate.

`showRowNumbers` displays 1-based row numbers in the control column for the current filtered and
sorted row order. When row reordering is enabled, the number replaces the drag-handle glyph while
the control cell remains draggable.

`enableRowMarking` makes each control-cell row header clickable and adds a checkbox. Clicking the
header outside its nested controls toggles the same mark state and emits `(rowMark)` with the row,
its original datasource index, and the resulting `marked` state. Marked rows are included in
keyboard, cell-context, and row-context copy operations. Read `grid.markedRowIndices()` or call
`grid.clearMarkedRows()` when the host needs to inspect or reset the copy basket.

Marking is independent from row selection. Cell and range copy use the same copied columns for
every marked row, while Copy row uses every visible column. Duplicate rows are omitted, and marked
rows remain included when filters hide them.

Selecting numeric cells displays a live status bar with count, sum, average, minimum, and maximum.
Read the same values from `grid.selectionSummary()`. The signal is `null` when the active selection
contains no finite numeric values.

## Minimal integration

Import the standalone pieces you use from the package barrel:

```ts
import {
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  AgridTreeComponent,
  AgridTreeProvider,
  type AgridTreeNodeEvent,
  type ColDef,
  type RowClickEvent,
} from '@thkl/agrid';
```

Minimal standalone grid:

```ts
interface Row {
  id: string;
  name: string;
}

const columns: ColDef<Row>[] = [
  { field: 'name', header: 'Name', filterable: true },
];

readonly datasource = new AgridDataSource<Row>([]);
readonly provider = new AgridProvider<Row>({
  datasource: this.datasource,
  control: new AgridControl(),
  columns,
  getRowId: row => row.id,
  readonly: true,
  rowSelection: 'single',
});

selectRow(event: RowClickEvent<Row>): void {
  console.log(event.row);
}
```

```html
<agrid [provider]="provider" (rowClick)="selectRow($event)" />
```

Update rows by replacing the datasource value:

```ts
this.datasource.setData(rows);
this.datasource.setData([newRow, ...this.datasource.rows()]);
```

Set `getRowId` on the provider when rows can be inserted, removed, reordered, or replaced while
selection is active. The grid uses it to keep cell selection, row selection, marked rows, and
expanded detail rows attached to the same logical row; without it, reconciliation falls back to row
object reference equality.

`AgridDataSource.rows()` is an Angular signal. If you read and write the datasource inside an
Angular `effect()`, wrap the datasource read/write block in `untracked()` to avoid accidental
dependency loops:

```ts
effect(() => {
  const rows = this.rowsFromStore();
  untracked(() => this.datasource.setData(rows));
});
```

Minimal standalone tree:

```ts
interface TreeRow {
  id: string;
  parentId: string | null;
  name: string;
}

readonly treeDatasource = new AgridDataSource<TreeRow>([]);
readonly treeProvider = new AgridTreeProvider<TreeRow>({
  datasource: this.treeDatasource,
  treeConfig: {
    getId: row => row.id,
    getParentId: row => row.parentId,
    treeField: 'name',
    defaultExpanded: row => row.id === 'root',
  },
  selection: 'single',
});

selectNode(event: AgridTreeNodeEvent<TreeRow>): void {
  console.log(event);
}
```

```html
<agrid-tree [provider]="treeProvider" (nodeClick)="selectNode($event)" />
```

The standalone tree expects flat rows linked by parent ids, or rows that can be projected with a
path config. It does not consume nested `children` arrays directly.

## Required sizing

`agrid` needs a real height from its parent chain. In full-height layouts, make the host a flex
column and keep flex children shrinkable:

```css
agrid {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
```

Parent containers must also have a defined height, for example through `height: 100%`, a fixed pixel
height, or a flex/grid track that resolves to a real height.

## Common pitfalls

- Do not override `agrid` with `display: block` when using full-height layouts.
- Do not pass huge payload strings into visible or filterable columns; use previews.
- Do not fetch unbounded rows into client-side mode; use limits or the server-side row model.
- `AgridTreeComponent` needs flat rows with parent ids or path config, not nested children.
- `AgridDataSource.rows()` is a signal; reads inside Angular effects are tracked unless wrapped in `untracked()`.

## Charts / Graphs

Use `AgridChartComponent` with an `AgridChartProvider` to render zero-dependency SVG graphs. The
same provider pattern as the grid keeps setup predictable:

```ts
import { AgridChartComponent, AgridChartProvider } from '@thkl/agrid';

readonly chartProvider = new AgridChartProvider({
  type: 'column',
  data: {
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { name: 'North', values: [120, 145, 138, 162] },
      { name: 'South', values: [98, 110, 134, 128] },
    ],
  },
  height: 300,
});
```

```html
<agrid-chart [provider]="chartProvider" />
```

Supported `type` values are `column`, `bar`, `line`, `area`, `pie`, and `donut`. `type`, `height`,
`showLegend`, `showAxis`, and `palette` are signals, so runtime changes redraw immediately.

To link a graph to a grid, pass `provider.visibleRows` as `source` and provide a `transform`. The
chart follows filtering, sorting, and edits live:

```ts
readonly chartProvider = new AgridChartProvider<Person>({
  type: 'bar',
  source: this.provider.visibleRows,
  transform: rows => ({
    categories: rows.map(row => row.name),
    series: [{ name: 'Score', values: rows.map(row => Number(row.score ?? 0)) }],
  }),
});
```

`visibleRows` is the filtered and sorted row set. It intentionally ignores grouping and pagination;
aggregate inside `transform` when the graph should show grouped totals or page-specific summaries.
Pie and donut graphs use the first series and label slices from `categories`.

Set `enableColumnMarking: true` to toggle complete-column highlighting by clicking a header outside
its menu and resize controls. The grid exposes `markedColumnFields()` and emits `(columnMark)`.

Append custom commands to one column's menu and handle them through one typed output:

```ts
{ field: 'status', header: 'Status', headerMenuItems: [
  { key: 'archive', label: 'Archive', icon: '⌂' },
] }
```

```html
<agrid [provider]="provider" (columnHeaderAction)="onColumnHeaderAction($event)" />
```

The event contains `{ column, key }`.

Use `(firstDataRendered)` when host logic must wait until the grid has completed its first render
containing datasource rows:

```html
<agrid [provider]="provider" (firstDataRendered)="onGridReady($event)" />
```

The event fires once per grid component. An initially empty datasource delays it until rows arrive.
Server-side loading placeholders do not count as rendered data. The payload contains `rows`,
`rowCount`, `provider`, and `datasource`.

For commands that change `textAlign` at runtime, keep the writable signal in the host instead of
mutating `event.column`:

```ts
readonly salaryAlignment = signal<'left' | 'center' | 'right'>('right');

// Column definition
{ field: 'salary', header: 'Salary', textAlign: this.salaryAlignment }

onColumnHeaderAction(event: ColumnHeaderActionEvent<Employee>): void {
  if (event.column.field !== 'salary') return;
  if (event.key === 'align-left') this.salaryAlignment.set('left');
  if (event.key === 'align-center') this.salaryAlignment.set('center');
  if (event.key === 'align-right') this.salaryAlignment.set('right');
}
```

Assigning `event.column.textAlign = 'center'` mutates plain configuration and does not trigger an
Angular update. Calling `.set()` on `event.column.textAlign` is also not type-safe because the
property may contain a static string or a read-only signal.

## Menu bar

Set `menuBarItems` to render command buttons above the headers. An item with `items` becomes a
split button: its label emits the parent id and its chevron opens additional commands. Every
command emits through the single `(menuBarAction)` output.

```ts
readonly provider = new AgridProvider<Person>({
  columns,
  datasource,
  menuBarItems: [
    { id: 'refresh', label: 'Refresh', icon: '↻' },
    {
      id: 'selection',
      label: 'Selection',
      disabled: ({ selectedRows }) => selectedRows.length === 0,
      items: [
        { id: 'activate', label: 'Activate' },
        { id: 'deactivate', label: 'Deactivate', active: ({ rows }) => rows.some(row => !row.active) },
      ],
    },
  ],
});
```

```html
<agrid [provider]="provider" (menuBarAction)="runCommand($event)" />
```

`visible`, `active`, and `disabled` may be booleans or callbacks. Callback context includes
`rows`, `selectedRows`, `selectedCell`, `provider`, and `datasource`.

For imperative selection reads, call `grid.getCurrentRow()` or `grid.getCurrentCell()`. The
`(cellSelect)` output emits the same selected-cell shape and `null` when cell selection clears.

## Input masks

Use `inputMask` to select a string mask for each row and cell. The callback
receives `{ row, value, column }`; return `null` for cells that should remain
unrestricted.

```ts
{
  field: 'reference',
  header: 'Reference',
  inputMask: ({ row }) =>
    row.numeric
      ? /\d{0,3}(?:-\d{0,5}(?:-\d{0,5})?)?/
      : /[a-z0-9]{0,3}(?: [a-z0-9]{0,3}(?: [a-z0-9]{0,5})?)?/i,
}
```

The regex is matched against the complete proposed value and must allow
partial input. Separators are typed explicitly rather than inserted
automatically. Invalid edits revert to the last accepted value.

## Boolean columns

Set `type: 'boolean'` to render a cell as an inline checkbox. Clicking it toggles the value and
commits immediately — no edit mode, and the change is recorded in undo/redo like any other edit.
Read-only columns (`editable: false`) or a read-only grid render the checkbox disabled. Values are
truthy-coerced for display, so `true`, `1`, `'true'`, and `'1'` all render as checked.

```ts
const columns: ColDef<Person>[] = [
  { field: 'name', header: 'Name' },
  { field: 'active', header: 'Active', type: 'boolean' },
];
```

## Runtime readonly cells

Use `cellReadonly` when editability depends on the current row. Returning `true` blocks inline
editing, boolean toggles, paste, fill, and sidebar edits for that cell.

```ts
const columns: ColDef<Order>[] = [
  { field: 'status', header: 'Status' },
  {
    field: 'approvedBy',
    header: 'Approved by',
    cellReadonly: ({ row }) => row.status !== 'Draft',
  },
];
```

## Condition filters

Mark a column `filterable: true` and its column menu gains a **condition** filter in addition to
the value picker. Text columns offer equals, not equal, like, starts with, ends with, includes, and
does not include. Numbers offer `=`, `≠`, `>`, `≥`, `<`, `≤`, and `between`; dates offer on /
before / after / between. Conditions combine with the header text filter, value picker, and other
columns using AND semantics, and are included in `AgridControl.toJSON()` state.

The header arrow opens the complete column menu. The condition button beside the inline filter
opens only the condition operator and operand controls; sorting, layout, grouping, custom commands,
clear-all actions, and distinct-value selection remain in the complete menu.

```ts
const columns: ColDef<Order>[] = [
  { field: 'reference', header: 'Reference', filterable: true },
  { field: 'total', header: 'Total', type: 'number', filterable: true },
  { field: 'placedAt', header: 'Placed', type: 'date', filterable: true },
];
```

Set it programmatically with `control.setRangeFilter(field, operator, operand, operand2?)`, where
`operator` can also be `'like' | 'startsWith' | 'endsWith' | 'includes' | 'notIncludes'` for text
columns (pass `null` to clear). `like` uses `%` for any sequence and `_` for one character.

## Edit validation

Add a `validate` hook to a column to reject bad values. Return a message to block the edit (the
value is not written and the message is shown), or `null` to accept it. It runs on inline commit,
boolean-checkbox toggle, and sidebar save.

```ts
const columns: ColDef<Person>[] = [
  { field: 'email', header: 'Email',
    validate: v => /@/.test(String(v)) ? null : 'Enter a valid email' },
  { field: 'age', header: 'Age', type: 'number',
    validate: (v, row) => Number(v) >= 0 ? null : 'Age must be ≥ 0' },
];
```

A rejected inline edit keeps the cell in edit mode with the message shown beneath it, so the user
can correct it; Tab/Enter won't leave the cell until the value is valid. Rejected sidebar edits show
the message under the field. Listen to `(validationFailed)` for `{ rowIndex, field, value, message,
source }` (`source` is `'inline'` or `'sidebar'`).

```html
<agrid [provider]="provider" (validationFailed)="onInvalid($event)" />
```

## Quick filter

Set `enableQuickFilter: true` to render a search box above the grid that keeps rows whose visible
columns contain the text (resolved display values, so `ValueOption` labels and formatters count).

```ts
readonly provider = new AgridProvider<Person>({ columns, datasource, enableQuickFilter: true });
```

Drive it programmatically with `control.setQuickFilter(text)`; it's part of `toJSON()` state and is
cleared by `control.clearAllFilters()`.

Use `control.getFilterModel()` and `control.setFilterModel(model)` to persist or restore just the
filter, quick-filter, and sort state without the rest of the grid settings.

Rows inserted while filters or sorts are active stay visible in insertion order even if their values
do not currently match. Wire `control.reapplyFilters()` to a button or save action when those
inserted rows should be filtered and sorted like the rest of the datasource again. Use
`control.filterReapplyNeeded()` to show visual feedback when that action is available.

## Server-side filtering

With `serverSideFiltering: true` the grid never filters locally. The recommended integration point
is the complete query snapshot:

```html
<agrid [provider]="provider" (serverQueryChange)="loadRows($event)" />
```

```ts
effect(() => {
  const query = provider.serverQuery();
  if (!query) return;
  store.load(query);
});
```

`AgridServerQuery` contains column filters, value selections, menu conditions, ordered sorts,
quick-filter text, and page range (`startRow..endRow`, inclusive). The older granular outputs remain
available for compatibility:

- `(filterChange)` — header text filters emit `{ field, value }`; value filters emit
  `{ field, value: '', selectedValues }`; menu conditions emit
  `{ field, value: '', operator, operand, operand2 }` (operator `null` clears the condition).
- `(sortChange)` — `{ field, direction }`.
- `(quickFilterChange)` — the quick-filter text.

```html
<agrid [provider]="provider"
  (filterChange)="onFilter($event)"
  (sortChange)="onSort($event)"
  (quickFilterChange)="onQuickFilter($event)" />
```

Text/range/quick events are debounced by `filterDebounceMs` (default 300 ms; `0` disables). The
distinct-value picker is hidden in this mode unless the column supplies an explicit `values`
list representing the complete server-side value set.

## Grouping and aggregates

Give a column an `aggregate` (`'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`, or a custom
`(values) => unknown` function) and the grid renders a footer row with that column's total over all
filtered rows. Set/clear it at runtime with `control.setAggregate(field, fn)`.

```ts
const columns: ColDef<Order>[] = [
  { field: 'region', header: 'Region', groupable: true },
  { field: 'total', header: 'Total', type: 'number', aggregate: 'sum' },
];
```

When the grid is grouped (set `groupable: true` and group from the column menu, or call
`control.setGroupBy(field)`), each **group header row also shows that group's subtotals** —
the same aggregate functions applied to just the group's rows, displayed inline beside the group
label and count. No extra configuration is needed; subtotals appear whenever grouping and at least
one aggregated column are both active.

## Tree data

Pass `treeConfig` to render rows as a hierarchical tree. Use stable `id` / `parentId` accessors
for an existing hierarchy, or `getPath` to generate display-only branches from each row.

```ts
import { AgridTreeConfig } from '@thkl/agrid';

const treeConfig: AgridTreeConfig<OrgRow> = {
  getId: row => row.id,
  getParentId: row => row.parentId, // null / unknown id ⇒ root row
  treeField: 'name',                // column that shows the twisty
  aggregateTreeNodes: true,         // parent cells roll up descendant leaves
  defaultExpanded: row => row.level < 2,
};

readonly provider = new AgridProvider<OrgRow>({
  columns,
  datasource: new AgridDataSource(rows),
  treeConfig,
});
```

With `aggregateTreeNodes: true`, every expandable row displays descendant-leaf rollups in columns
that define `aggregate` (or have one set through `AgridControl`). For example,
`{ field: 'amount', aggregate: 'sum' }` shows the sum of a node's leaves in that node's amount cell.
Collapsed leaves still contribute. Filtering recalculates the rollups over the matching tree.

For path-like values such as `01.01.0001`, return the ordered segments:

```ts
const treeConfig: AgridTreeConfig<Row> = {
  getPath: row => row.oz.split('.'),
  nodeUuid: row => row.uuid,
  formatPathSegment: ({ row, segment, level, leaf }) =>
    leaf
      ? `${segment} ${row.description}`
      : `${segment} ${level === 0 ? row.areaLabel : row.groupLabel}`,
  treeField: 'oz',
};
```

This renders `01 / 01 / 0001, 0002`. Generated `01` branch rows are display-only; the leaf remains
the original datasource row. Its tree cell displays `0001`, while editing still uses the complete
`01.01.0001` value. `formatPathSegment` changes labels only; raw segments still control grouping,
expansion identity, and sort order. The callback receives the original `row`; shared branch nodes
use the first row encountered for that raw path prefix. `nodeUuid` uses the same source row and is
included in generated branch-node click events.

The `treeField` column shows an indented expand/collapse twisty. Filtering and sorting behave as
in a flat grid; with `keepAncestorsOnFilter` (default `true`) a match deep in the tree keeps its
parents visible and force-opens the path to it. Tree mode takes precedence over grouping and
disables pagination. Call `grid.expandAllNodes()` / `grid.collapseAllNodes()` to toggle the whole
tree.

Set `defaultExpanded: true` to open every expandable node on first render, or pass
`defaultExpanded: row => boolean` to choose the datasource-backed nodes that start expanded. In
path-tree mode, matching a row expands the generated branch path that contains that row.

Tree mode can be combined with `masterDetail: true` and a `detailRenderer`. Detail expanders are
shown only for leaf rows; parent rows retain their tree expand/collapse control.

Set `detailColumnField` to a column field when the panel should expose one larger multiline value.
The formatted value is shown normally; click it or focus it and press Enter to open a textarea.
Blur or Ctrl/Cmd+Enter commits, while Escape cancels. Editability, validation, history, and edit
events follow the linked column's normal cell behavior.
Set `detailActions` to add text-template buttons above the textarea. Each action has an `id`,
`label`, and optional `text` string or row-aware resolver; clicking inserts at the current
selection, or appends if the button opens the textarea.

## Standalone tree control

Use `<agrid-tree>` for the same parent-ID or path hierarchy without grid columns. It adds tree
keyboard navigation and optional single or multi-selection. Since this component has no columns,
it ignores `aggregateTreeNodes`; descendant rollups apply only to tree mode in `<agrid>`.

```ts
readonly treeProvider = new AgridTreeProvider<OrgRow>({
  datasource: new AgridDataSource(rows),
  treeConfig: {
    getId: row => row.id,
    getParentId: row => row.parentId,
    treeField: 'name',
    defaultExpanded: true,
  },
  getDescription: row => row.role,
  selection: 'single',
  ariaLabel: 'Organization',
});
```

```html
<agrid-tree [provider]="treeProvider"
  (nodeClick)="openNode($event)"
  (nodeDoubleClicked)="openNode($event)"
  (selectionChange)="selectionChanged($event)" />
```

Row and generated path-branch clicks emit `AgridTreeNodeEvent<T>`. Branch events include their
configured or generated `uuid`. `expandAllNodes()` and `collapseAllNodes()` are public methods.
The tree uses the shared `--agrid-color-text`, `--agrid-color-text-muted`,
`--agrid-color-accent`, `--agrid-color-accent-subtle`, `--agrid-color-accent-fg`,
`--agrid-color-border`, `--agrid-color-bg`, and `--agrid-color-bg-muted` CSS variables.

## Pivot tables

Use `pivotConfig` to derive a read-only client-side cross-tabulation from a flat datasource. The
first pivot release supports one row dimension, one column dimension, and one value field.

```ts
const provider = new AgridProvider<Sale>({
  columns: [
    { field: 'region', header: 'Region' },
    { field: 'quarter', header: 'Quarter' },
    { field: 'revenue', header: 'Revenue', type: 'number', formatter: currency },
  ],
  datasource: new AgridDataSource(sales),
  pivotConfig: {
    rowField: 'region',
    columnField: 'quarter',
    valueField: 'revenue',
    aggregate: 'sum',
  },
});
```

Each distinct `rowField` value becomes one row and each distinct `columnField` value becomes a
generated column. Intersections use `sum` by default and also support `avg`, `min`, `max`, `count`,
or a custom `(values) => result` function. Dimension labels and pivot values reuse source column
formatters. Missing intersections render empty.

Pivot rows react to datasource replacement and updates. They are derived values, so editing,
adding, reordering, master/detail, tree mode, server-side row models, and aggregate footers are
disabled or rejected in pivot mode. Client-side filtering, sorting, selection, and pagination
continue through the normal grid pipeline. Multi-level dimensions and totals are intentionally
outside this first slice.

When `showSidebar` is enabled, pivot grids add a **Pivot** sidebar tab. It updates `rowField`,
`columnField`, `valueField`, and built-in aggregate functions immediately without replacing the
provider. Assigning `provider.pivotConfig` programmatically uses the same reactive path.

### Saving and restoring settings

`saveSettings()` returns a detached, versioned object containing the pivot configuration and the
existing control state (column visibility, width, order, pinning, filters, sorts, pagination, and
aggregates). It is safe to JSON-encode and send to a backend. `loadSettings()` applies it to an
already-rendered grid immediately.

```ts
const settings = provider.saveSettings();
await api.saveGridSettings(settings);

const restored = await api.loadGridSettings();
provider.loadSettings(restored);
```

The component exposes the same methods through `viewChild(AgridComponent)`. Sidebar pivot and
column-visibility changes emit the complete snapshot through `(settingsChange)`:

```html
<agrid #grid [provider]="provider" (settingsChange)="saveSettings($event)" />
```

```ts
saveSettings(settings: AgridSettings): void {
  void api.saveGridSettings(settings);
}

// Loading after the grid exists:
grid().loadSettings(savedSettings);
```

Custom aggregate functions are executable code and cannot be represented in JSON; attempting to
save one throws an explicit error. Register custom functions in application code instead.

## Page selector

Use `<agrid-page-selector>` to navigate pages by previous/next button, dropdown, or typed ID.
All three interactions emit an `AgridPageItem<TId>` through the single `(selectPage)` output.

```ts
readonly pages: AgridPageItem<number>[] = [
  { id: 1, label: 'Cover' },
  { id: 2, label: 'Measurements' },
  { id: 3, label: 'Summary' },
];
```

```html
<agrid-page-selector [items]="pages" [selectedId]="currentPageId()"
  (selectPage)="currentPageId.set($event.id)" />
```

IDs can be strings or numbers. Typed IDs are selected with Enter. Available inputs are
`disabled`, `previousLabel`, `nextLabel`, `inputLabel`, `menuLabel`, and `emptyText`.

## Saving edited rows

Use `rowChanged` to send one request after the user edits one or more fields in a row:

```html
<agrid [provider]="provider" (rowChanged)="saveRow($event)" />
```

```ts
saveRow(event: RowUpdateEvent<Person>): void {
  this.http.patch(`/api/people/${event.row.id}`, event.row).subscribe(() => {
    this.provider.control.indicate(event.originalIndex, '#2da44e', 1000);
    this.provider.control.clearChangedCells(event.originalIndex);
  });
}
```

The event fires with the latest complete row when inline navigation leaves that row, or when the
sidebar editor Save button is used. `cellEdit` and `recordEdit` remain available for every committed
field change. With `showChangedCellIndicator: true`, changed cells keep a corner marker until the
PATCH succeeds. Override `--agrid-color-cell-changed` to customize its color. Call
`control.indicate(index, color, durationMs)` to flash a complete row for transient server-side
feedback.

Full documentation and demos: https://thkl.github.io/agrid/
