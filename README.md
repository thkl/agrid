# agrid

`agrid` is an Angular data grid with spreadsheet-like editing, virtual scrolling, filtering, sorting, grouping, column state, pinned columns, selection, clipboard workflows, row operations, pagination, and custom cell renderers.

## Live Demo

[https://thkl.github.io/agrid/](https://thkl.github.io/agrid/)

## Quick Start

```ts
import { Component } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef, GridEditEvent } from './agrid';

const columns: ColDef[] = [
  { field: 'id', header: 'ID', width: 70, editable: false, pinned: 'left' },
  { field: 'name', header: 'Name', width: 160, filterable: true },
  { field: 'hiredAt', header: 'Hire Date', width: 130 }, // auto-formatted as a date
  { field: 'departmentId', header: 'Department', width: 140, filterable: true, groupable: true,
    values: [
      { value: 1, label: 'Engineering' },
      { value: 2, label: 'Sales' },
    ],
  },
];

@Component({
  selector: 'app-page',
  imports: [AgridComponent],
  template: `
    <agrid [provider]="gridProvider" (cellEdit)="onCellEdit($event)" />
  `,
})
export class PageComponent {
  readonly columns = columns;
  readonly ds = new AgridDataSource([
    { id: 1, name: 'Alice', hiredAt: '2021-03-15', departmentId: 1 },
    { id: 2, name: 'Bob',   hiredAt: '2022-07-01', departmentId: 2 },
  ]);
  readonly gridControl = new AgridControl({ allowRowReorder: true });
  readonly gridProvider = new AgridProvider({
    locale: 'en-US',
    columns: this.columns,
    datasource: this.ds,
    control: this.gridControl,
    showControlColumn: true,
    showSidebar: true,
    zebraStripes: true,
    rowSelection: 'multi',
  });

  onCellEdit(event: GridEditEvent): void {
    console.log(event);
  }
}
```

## Features

- Angular 21 standalone component.
- CDK virtual scrolling for large row sets.
- Signal-based data source and control state.
- Editable text cells and select editors for fixed value columns.
- Keyboard navigation with auto-scroll to the active cell.
- Type-to-edit, Enter/F2 edit, Tab/Enter commit, Escape cancel.
- Undo/redo for edits, paste, and fill operations.
- Cell range selection with Shift+arrow and Shift+click.
- Clipboard copy/paste using TSV/CSV-like plain text.
- Fill handle for repeating selected cell/range values down or right.
- Find panel with Ctrl/Cmd+F, match highlighting, next/previous navigation.
- Text filters, value filters, and single-column sorting.
- Column menu with sort, clear sort, autosize, pin/unpin, hide, group, and clear filter actions.
- Column resizing by drag and autosize by double-click.
- Column reordering by header drag.
- Split-pane pinned columns on the left.
- Optional control column for row context actions and row reordering.
- Row selection: none, single, or multi.
- Grouping with expand/collapse and custom group actions.
- Sidebar column visibility picker.
- Add-row placeholder and automatic row insertion.
- CSV export of visible filtered data rows.
- **Date auto-formatting** — ISO strings and `Date` objects are detected and displayed as locale-formatted dates automatically.
- **Zebra stripes** — alternating row shading for easier reading.
- **Readonly mode** — disable all editing with a single input.
- **Pagination** — built-in page controls driven by `AgridControl`.
- **Custom cell renderers** — return HTML strings per column for rich cell content.
- **Column autosize all** — fit every visible column to its content in one call.

## Component API

```html
<agrid [provider]="gridProvider" (cellEdit)="onEdit($event)" />
```

`AgridComponent` has a single input: `provider`. All grid options, data, and control state are supplied through `AgridProvider`. See [AgridProvider Configuration](#agridprovider-configuration) for the full option list.

### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `provider` | `AgridProvider` | New empty provider | Supplies column definitions, data source, control state, and all grid options. |

## Localization

Set `locale` on `AgridProvider` to control built-in grid text and date formatting. Built-in text supports English (`en-*`) and German (`de-*`).

The default is `'auto'`, which reads `navigator.language` from the browser and falls back to `'en-US'` if the browser language is not supported.

```ts
// Auto-detect browser language (default — no need to set locale explicitly)
readonly gridProvider = new AgridProvider({ ... });

// Pin to a specific locale
readonly gridProvider = new AgridProvider({ locale: 'de-DE', ... });
```

### Adding custom locale text

Use `addLocalization(locale, overrides)` to register label overrides for one or more locales. When `locale` is `'auto'`, the grid matches the browser language against all registered locales — exact match first, then primary-language match (e.g. a registered `'fr'` locale matches a browser locale of `'fr-FR'` or `'fr-BE'`).

```ts
readonly gridProvider = new AgridProvider({ ... })
  .addLocalization('fr-FR', {
    addRow: 'Ajouter une ligne',
    noRows: 'Aucune donnée',
    rows: count => `${count} enregistrement${count === 1 ? '' : 's'}`,
    groupBy: header => `Grouper par ${header}`,
  })
  .addLocalization('nl-NL', {
    addRow: 'Rij toevoegen',
    noRows: 'Geen rijen',
  });
```

`addLocalization` returns the provider so calls can be chained. Partial overrides are merged on top of the built-in base bundle for that locale — you only need to supply the labels you want to change.

The `AgridLocaleTextOverrides` type covers all overridable labels.

### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `cellEdit` | `GridEditEvent` | Emitted after a committed cell edit, paste, fill, undo, or redo changes a cell. |
| `rowRemoved` | `RowRemovedEvent` | Emitted after deleting a row through the control column context menu. |
| `prepareAddRecord` | `NewRecord` | Emitted after the grid inserts a blank row. Patch `event.datasource` to target the correct grid when multiple providers are rendered. |
| `rowReorder` | `RowReorderEvent` | Emitted after the user drops a reordered row. The host must call `dataSource.moveRow()`. |
| `rowSelect` | `RowSelectEvent \| null` | Emitted when row selection changes. `null` means selection was cleared. |
| `filterChange` | `FilterChangeEvent` | Emitted for text filter changes when `serverSideFiltering` is enabled. |
| `sortChange` | `SortChangeEvent` | Emitted for sort changes when `serverSideFiltering` is enabled. |

## AgridProvider Configuration

All grid options are passed to `AgridProvider` at construction time:

```ts
readonly gridProvider = new AgridProvider({
  columns: this.columns,
  datasource: this.ds,
  control: this.gridControl,
  zebraStripes: true,
  showSidebar: true,
  showControlColumn: true,
  rowSelection: 'multi',
  allowAddRows: true,
  readonly: false,
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `columns` | `ColDef[]` | `[]` | Column definitions. |
| `datasource` | `AgridDataSource` | New empty datasource | Row data container. |
| `control` | `AgridControl` | New default control | Manages filters, sort, grouping, pagination, and undo/redo. |
| `locale` | `string` | `'auto'` | BCP-47 locale tag for grid text and date formatting. `'auto'` reads `navigator.language` and falls back to `'en-US'`. |
| `localization` | `AgridLocaleTextOverrides` | `undefined` | Overrides individual labels. See [Localization](#localization). |
| `rowHeight` | `number` | `32` | Fixed row height in pixels. Required by CDK virtual scroll. |
| `minHeight` | `string` | `undefined` | CSS min-height for the virtual body. Example: `'200px'`. |
| `maxHeight` | `string` | `undefined` | CSS max-height for the virtual body. Example: `'500px'`. |
| `allowAddRows` | `boolean` | `false` | Shows a `+ Add row` placeholder at the bottom when `autoAddRows` is `false`. |
| `autoAddRows` | `boolean` | `false` | Automatically inserts a blank row when navigation moves past the last real row. |
| `showControlColumn` | `boolean` | `false` | Shows a 24 px control column for row context actions and drag handles. |
| `showSidebar` | `boolean` | `false` | Shows a collapsible column visibility sidebar. Requires `control`. |
| `autoOpenDetail` | `boolean` | `false` | Opens the detail row automatically when a row is selected. |
| `serverSideFiltering` | `boolean` | `false` | Emits filter/sort events instead of applying them locally and hides the value checklist. |
| `filterDebounceMs` | `number` | `300` | Debounce delay for server-side `filterChange` events. Set to `0` to disable. |
| `sortOption` | `'single' \| 'multi' \| 'none'` | `'multi'` | Allows one sort, multiple sorts, or disables sorting. |
| `rowSelection` | `'single' \| 'multi' \| 'none'` | `'none'` | Row selection behavior. |
| `groupDescription` | `((label: string) => string) \| null` | `null` | Optional description text shown next to each group label. |
| `groupActions` | `GroupAction[]` | `[]` | Actions shown in each group header menu. |
| `cellMenuItems` | `(CellContextMenuItem \| null)[]` | `[]` | Additional items in the cell right-click context menu. `null` inserts a divider. |
| `zebraStripes` | `boolean` | `false` | Shades every other row. Override `--agrid-color-bg-stripe` to change the shade. |
| `emptyText` | `string` | `undefined` | Text shown when the grid has no rows. Falls back to the locale default. |
| `readonly` | `boolean` | `false` | Initial value for the readonly signal. Makes all cells non-editable. |
| `loading` | `boolean` | `false` | Initial value for the loading signal. Shows a loading overlay over the grid body. |

### Dynamic Provider Options

Three options are `WritableSignal` properties on the provider instance — update them at runtime without recreating the provider:

| Signal | Type | Description |
| --- | --- | --- |
| `provider.loading` | `WritableSignal<boolean>` | Show or hide the loading overlay. |
| `provider.readonlyGrid` | `WritableSignal<boolean>` | Toggle readonly mode. |
| `provider.autoAddRows` | `WritableSignal<boolean>` | Toggle automatic row insertion. |

Example — toggle readonly in a host component:

```ts
readonly provider = new AgridProvider({ ..., readonly: true });
readonly isEditing = signal(false);

constructor() {
  effect(() => this.provider.readonlyGrid.set(!this.isEditing()));
}
```

Example — server-side loading state:

```ts
async loadPage(page: number) {
  this.provider.loading.set(true);
  this.ds.setData(await fetchPage(page));
  this.provider.loading.set(false);
}
```

### Public Component Methods

Call these through `viewChild(AgridComponent)`.

| Method | Description |
| --- | --- |
| `exportCsv(filename?)` | Downloads visible, filtered data rows as CSV using display values. Group headers are excluded. |
| `autosizeAllColumns()` | Resizes every visible column to fit its header text and current row values. Call after setting data. |
| `expandGroups()` | Expands every group when grouping is active. |
| `collapseGroups()` | Collapses every group when grouping is active. |
| `toggleSidebar()` | Opens or closes the column sidebar. |
| `openFind()` | Opens the find panel and focuses the input. |
| `closeFind()` | Closes the find panel. |
| `goToFindMatch(direction)` | Moves to the next (`1`) or previous (`-1`) find match. |
| `deleteRow(originalIndex)` | Removes a row and emits `rowRemoved`. |

### Public Component State

| Property | Type | Description |
| --- | --- | --- |
| `selectedCell` | `Signal<CellPosition \| null>` | Currently focused cell. |
| `editingCell` | `Signal<CellPosition \| null>` | Cell currently in edit mode. |
| `selectedRowIndices` | `Signal<ReadonlySet<number>>` | Selected original row indices. |
| `selectedRowIndex` | `Signal<number \| null>` | First selected row index, useful for single selection. |
| `sidebarOpen` | `Signal<boolean>` | Current sidebar visibility. |
| `canUndo` | `Signal<boolean>` | Whether Ctrl/Cmd+Z can undo an edit. Requires `provider.control`. |
| `canRedo` | `Signal<boolean>` | Whether redo is available. Requires `provider.control`. |
| `filteredRowCount` | `Signal<number>` | Total filtered data row count, unaffected by current page. |
| `totalPages` | `Signal<number>` | Total page count given the current filter and page size. `1` when pagination is off. |
| `showPagination` | `Signal<boolean>` | Whether the pagination bar is visible (`pageSize > 0`). |

## Column Definitions

`ColDef` describes one column.

```ts
interface ColDef {
  field: string;
  header: string;
  width: number;           // use ColDefAutoSize (-1) to autosize on first render
  type?: 'text' | 'number' | 'date';
  editable?: boolean;
  locked?: boolean;
  values?: string[] | ValueOption[];
  formatter?: (value: unknown) => string;
  filterable?: boolean;
  groupable?: boolean;
  hidden?: boolean;
  pinned?: 'left' | 'right';
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  cellRenderer?: (params: { value: unknown; row: Record<string, unknown> }) => string;
  cellClass?: (params: { value: unknown; row: Record<string, unknown> }) => string;
}
```

| Property | Required | Description |
| --- | --- | --- |
| `field` | Yes | Key in each row object. |
| `header` | Yes | Header label shown in the grid. |
| `width` | Yes | Default width in pixels. Set to `ColDefAutoSize` (`-1`) to fit the column to its content on first render. |
| `type` | No | Semantic type. `number` initializes blank rows with `0`. `date` forces date formatting even for values that don't match the auto-detect pattern. |
| `editable` | No | Set to `false` for read-only cells. Defaults to editable. |
| `locked` | No | Prevents the column from being hidden, reordered, or unpinned through the column menu. |
| `values` | No | Fixed editor/filter values. Use `string[]` or `{ value, label }[]`. |
| `formatter` | No | Custom display formatter. Takes precedence over date auto-formatting. |
| `filterable` | No | Enables text filter and value picker for the column. |
| `groupable` | No | Enables "group by" in the column menu. |
| `hidden` | No | Hides the column on first render. |
| `pinned` | No | `'left'` or `'right'` to pin the column initially. Left-pinned columns render in a fixed pane before the scrollable area; right-pinned columns render in a fixed pane after it. |
| `aggregate` | No | Shows an aggregate footer value: `'sum'`, `'avg'`, `'min'`, `'max'`, or `'count'`. |
| `cellRenderer` | No | Custom HTML renderer. Return an HTML string; Angular sanitizes it automatically. See [Custom Cell Renderers](#custom-cell-renderers). |
| `cellClass` | No | Returns a CSS class name for each cell. Applied alongside built-in state classes. |

### ColDefAutoSize

Import `ColDefAutoSize` and use it as the `width` value to fit the column to its content on first render:

```ts
import { ColDefAutoSize } from './agrid';

const columns: ColDef[] = [
  { field: 'name', header: 'Name', width: ColDefAutoSize },
  { field: 'email', header: 'Email', width: ColDefAutoSize },
];
```

The column sizes itself once on first render and then behaves like a normal resizable column.

### Value Options

Use value options when stored values differ from labels.

```ts
interface ValueOption {
  value: unknown;
  label: string;
}
```

Example:

```ts
{
  field: 'departmentId',
  header: 'Department',
  width: 140,
  values: [
    { value: 1, label: 'Engineering' },
    { value: 2, label: 'Sales' },
  ],
}
```

The grid displays labels, but committed edits store `value`.

## Date Auto-Formatting

The grid automatically detects and formats date values without any configuration. Both display and sorting use the native date value.

**Auto-detected formats:**
- `Date` objects
- ISO 8601 strings: `"2024-01-15"`, `"2024-01-15T10:30:00Z"`, `"2024-01-15T10:30:00+02:00"`

**Display:** Values are formatted using the browser's locale — e.g. `Jan 15, 2024`.

**Sorting:** Date columns sort chronologically by raw timestamp, not alphabetically by display string.

**Priority:** `values` list → `formatter` → date auto-format → raw string.

To force date formatting on a column regardless of value shape, set `type: 'date'`.

To use a custom date format, set `formatter`:

```ts
{ field: 'hiredAt', header: 'Hired', width: 120,
  formatter: v => new Date(v as string).toLocaleDateString('de-DE') }
```

## Zebra Stripes

Alternating row shading is opt-in via the provider:

```ts
readonly provider = new AgridProvider({ ..., zebraStripes: true });
```

Override the stripe color with a CSS custom property on the host:

```css
agrid {
  --agrid-color-bg-stripe: #f0f4ff;
}
```

Hover and selection colors always override the stripe.

## Readonly Mode

Set `readonly: true` in the provider to make the entire grid non-editable:

```ts
readonly provider = new AgridProvider({ ..., readonly: true });
```

To toggle readonly at runtime, use the `readonlyGrid` signal on the provider:

```ts
readonly isReadonly = signal(true);

constructor() {
  effect(() => this.provider.readonlyGrid.set(this.isReadonly()));
}
```

Individual `ColDef.editable: false` still works when `readonly` is `false`.

## Pagination

Pagination is controlled through `AgridControl`. When a page size is set the grid renders a page bar at the bottom showing `« ‹ page / total › »` and the total filtered row count.

```ts
readonly gridControl = new AgridControl({ pageSize: 25 });
```

Or change it at runtime:

```ts
this.gridControl.setPageSize(10);  // 0 = show all rows
this.gridControl.setPage(2);
```

Pagination applies to data rows after filtering and sorting, before grouping. Each page therefore always contains at most `pageSize` data rows.

### Server-side filtering and sorting

Enable `serverSideFiltering` when the API should filter and sort the dataset:

```ts
readonly provider = new AgridProvider({
  columns: [
    { field: 'name', header: 'Name', filterable: true },
    { field: 'status', header: 'Status', filterable: true },
  ],
  datasource: this.ds,
  control: this.ctrl,
  serverSideFiltering: true,
  sortOption: 'single',
});
```

```html
<agrid
  [provider]="provider"
  (filterChange)="onFilter($event)"
  (sortChange)="onSort($event)"
/>
```

```ts
readonly filters = new Map<string, string>();
readonly sorts = new Map<string, 'asc' | 'desc'>();

onFilter(event: FilterChangeEvent): void {
  if (event.value) this.filters.set(event.field, event.value);
  else this.filters.delete(event.field);
  this.loadRows();
}

onSort(event: SortChangeEvent): void {
  if (event.direction) this.sorts.set(event.field, event.direction);
  else this.sorts.delete(event.field);
  this.loadRows();
}
```

In server-side mode:

- Filter and sort state remains visible in the grid headers.
- The grid does not filter or sort loaded rows locally.
- The Excel-style distinct-value checklist is hidden.
- Clearing emits an empty filter value or a `null` sort direction.
- Multi-column sorting emits one event for each changed column.
- Text filter events are debounced by `filterDebounceMs` (300 ms by default).

Use `sortOption: 'single'` for backends that accept only one sort field. Selecting another column
clears the previous sort first. Use `'none'` to remove sorting controls completely; `'multi'`
preserves the default multi-column behavior.

The grid updates its visible filter state immediately, but only emits the final server filter value
after the debounce delay. Set `filterDebounceMs: 0` when immediate events are required. For server
pagination, call `control.setTotalRows(total)` after each response and replace the datasource
contents with the returned page.

## Custom Cell Renderers

Return an HTML string from `cellRenderer` to render rich content in a cell. Angular's built-in
sanitization runs automatically. Use CSS classes rather than inline styles; Angular strips unsafe
attributes and logs a development warning when renderer output requires sanitization. Escape
dynamic text before interpolating it into HTML.

```ts
const columns: ColDef[] = [
  {
    field: 'status',
    header: 'Status',
    width: 100,
    editable: false,
    cellRenderer: ({ value }) => {
      const status = value === 'active' ? 'active' : 'inactive';
      return `<span class="status-badge status-badge--${status}">${status}</span>`;
    },
  },
  {
    field: 'salary',
    header: 'Salary',
    width: 120,
    editable: false,
    cellRenderer: ({ value, row }) =>
      `<strong>$${Number(value).toLocaleString()}</strong>`,
  },
];
```

The `row` parameter gives you access to the full row object, useful when the display depends on sibling fields.

## Column Autosize

Fit all visible columns to their content after loading data:

```ts
constructor() {
  afterNextRender(() => this._grid()?.autosizeAllColumns());
}
```

Or autosize a single column by double-clicking its resize handle, or through the column menu.

## AgridDataSource

`AgridDataSource<T>` is a signal-based row container shared by the host and grid.

```ts
const ds = new AgridDataSource<Record<string, unknown>>([
  { id: 1, name: 'Alice' },
]);
```

### Linking an Angular signal

Link a writable Angular signal directly when the application and grid should share ownership of
the rows:

```ts
interface Row {
  id: number;
  name: string;
}

readonly rows = signal<Row[]>([
  { id: 1, name: 'Alice' },
]);
readonly ds = new AgridDataSource<Row>();
readonly provider = new AgridProvider({
  columns: [
    { field: 'id', header: 'ID', editable: false },
    { field: 'name', header: 'Name' },
  ],
  datasource: this.ds,
});

constructor() {
  this.ds.linkSignal(this.rows);
}
```

No synchronization `effect()` is needed. Updates work in both directions:

- Calling `rows.set(...)` or `rows.update(...)` refreshes the grid.
- Cell edits, paste, `setData`, `updateRow`, `patchRow`, `addRow`, `removeRow`, and `moveRow`
  update `rows` automatically.
- Undo and redo also update `rows` because they use datasource mutations.

The `(cellEdit)` output is not required to keep the writable signal synchronized. Use it only for
side effects such as saving changes to an API:

```html
<agrid [provider]="provider" (cellEdit)="saveEdit($event)" />
```

For one-way linking, pass a readonly signal:

```ts
readonly rows = signal<Row[]>([]);

constructor() {
  this.ds.linkSignal(this.rows.asReadonly());
}
```

In this mode, source updates refresh the grid, but grid mutations remain local to the datasource.
In both modes, source updates are linked without copying the source array.

| Member | Description |
| --- | --- |
| `rows` | Readonly Angular `Signal<T[]>` of current rows. |
| `linkSignal(source)` | Links an external signal without copying. Writable signals receive datasource mutations automatically. |
| `setData(rows)` | Replaces all rows with a shallow copy. |
| `updateRow(index, row)` | Replaces one row. |
| `patchRow(index, patch)` | Merges a partial row update. |
| `addRow(row, atIndex?)` | Inserts a row and returns the inserted index. |
| `removeRow(index)` | Removes a row. |
| `moveRow(from, to)` | Moves a row using insert-before semantics. |
| `getRow(index)` | Returns a non-reactive row snapshot. |
| `length` | Current row count. |

## AgridControl

`AgridControl` stores optional grid UI state and behavior. Assign it to `AgridProvider.control` to enable persisted state, filters, sort, grouping, visibility, pinning, row reorder, pagination, and undo/redo.

```ts
const control = new AgridControl({
  allowRowReorder: true,
  hiddenColumns: ['salary'],
  pinnedColumns: ['id'],
  pageSize: 20,
});
```

### Control State

```ts
interface AgridControlState {
  columnWidths: Record<string, number>;
  filters: Record<string, ColumnFilter>;
  allowRowReorder?: boolean;
  groupByField?: string | null;
  hiddenColumns?: string[];
  columnOrder?: string[];
  pinnedColumns?: string[];
  pageSize?: number;
  currentPage?: number;
}
```

### Column Filters

```ts
interface ColumnFilter {
  text: string;
  selectedValues: string[] | null;
  sort: 'asc' | 'desc' | null;
}
```

`text`, `selectedValues`, and `sort` are combined when rows are displayed. `selectedValues: null` means all values are allowed.

### Control Signals

| Signal | Description |
| --- | --- |
| `allowRowReorder` | Whether row drag handles can reorder rows. |
| `groupByField` | Field currently used for grouping, or `null`. |
| `hiddenColumns` | Set of hidden field names. |
| `columnOrder` | Current field order. Empty means original `colDefs` order. |
| `pinnedColumns` | Set of pinned field names. |
| `columnWidths` | Width overrides by field. |
| `filters` | Active filter/sort state by field. |
| `pageSize` | Rows per page. `0` means all rows (no pagination). |
| `currentPage` | Current page number (1-based). |
| `canUndo` | Whether an undo history item exists. |
| `canRedo` | Whether a redo history item exists. |

### Control Methods

| Method | Description |
| --- | --- |
| `setAllowRowReorder(value)` | Enables or disables row reorder. |
| `setGroupBy(field)` | Groups by a field or clears grouping with `null`. |
| `isColumnHidden(field)` | Returns whether a column is hidden. |
| `setColumnVisibility(field, visible)` | Shows or hides a column. |
| `toggleColumnVisibility(field)` | Toggles column visibility. |
| `setColumnOrder(fields)` | Replaces the current column order. |
| `moveColumn(currentVisibleOrder, fromField, toField, insertBefore)` | Reorders columns. Used by header dragging. |
| `isPinned(field)` | Returns whether a column is pinned. |
| `setPinned(field, pinned)` | Pins or unpins a column. |
| `togglePinned(field)` | Toggles pinning. |
| `getColumnWidth(field, defaultWidth)` | Returns effective width. |
| `setColumnWidth(field, width)` | Sets a width override with a 40 px minimum. |
| `getFilter(field)` | Returns current filter state or defaults. |
| `setTextFilter(field, text)` | Sets text filter. |
| `setSelectedValues(field, values)` | Sets allowed values, or `null` for all. |
| `setSort(field, sort)` | Sets sort and clears sort on other fields. |
| `clearFilter(field)` | Clears one column filter/sort. |
| `clearAllFilters()` | Clears all filters and sorts. |
| `hasActiveFilter(field)` | Returns whether a column has active filter/sort state. |
| `hasAnyActiveFilter()` | Returns whether any column has active filter/sort state. |
| `setPageSize(size)` | Sets rows per page. `0` disables pagination. Resets to page 1. |
| `setPage(page)` | Navigates to a page (1-based). Clamped to valid range by the grid. |
| `pushEdit(entry)` | Adds one edit to undo history. Used by the grid. |
| `pushEditBatch(entries)` | Adds a multi-cell operation as one undo step. Used by paste/fill. |
| `undo()` | Returns a `HistoryItem` to reverse, or `null`. The grid applies it. |
| `redo()` | Returns a `HistoryItem` to reapply, or `null`. The grid applies it. |
| `clearHistory()` | Clears undo/redo history. |
| `toJSON()` | Serializes control state including pagination. |
| `AgridControl.fromJSON(state)` | Restores control state. |

## Events And Types

### GridEditEvent

```ts
interface GridEditEvent {
  position: CellPosition;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}
```

Emitted whenever a committed grid operation changes a cell.

### FilterChangeEvent

```ts
interface FilterChangeEvent {
  field: string;
  value: string;
}
```

An empty `value` clears the server-side text filter.

### SortChangeEvent

```ts
interface SortChangeEvent {
  field: string;
  direction: 'asc' | 'desc' | null;
}
```

A `null` direction clears the server-side sort for that field.

### CellPosition

```ts
interface CellPosition {
  rowIndex: number;
  colIndex: number;
}
```

`rowIndex` is the original data-source row index. `colIndex` is the visible column index.

### RowSelectEvent

```ts
interface RowSelectEvent {
  rows: { row: Record<string, unknown>; originalIndex: number }[];
}
```

`rowSelect` emits `null` when selection is cleared.

### RowReorderEvent

```ts
interface RowReorderEvent {
  row: Record<string, unknown>;
  oldIndex: number;
  newIndex: number;
}
```

The grid does not reorder rows itself on drop. Call `dataSource.moveRow(event.oldIndex, event.newIndex)` in the handler.

### NewRecord

```ts
interface NewRecord {
  index: number;
  data: Record<string, unknown>;
  provider: AgridProvider;
  datasource: AgridDataSource;
}
```

For repeated grids, use the source carried by the event instead of looking the provider up by
the row or loop index:

```ts
onPrepareAdd(event: NewRecord): void {
  const next = event.datasource.length;
  event.datasource.patchRow(event.index, { id: next, departmentId: 1 });
}
```

Emitted after the grid inserts a blank row. Patch defaults from the host if needed.

### GroupAction

```ts
interface GroupAction {
  label: string;
  action: (groupLabel: string) => void;
}
```

Actions appear in group header menus.

### HistoryEntry And HistoryItem

```ts
interface HistoryEntry {
  rowIndex: number;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

type HistoryItem = HistoryEntry | HistoryEntry[];
```

Paste and fill store multiple entries as one `HistoryItem`, so Ctrl/Cmd+Z reverses the whole operation.

## Keyboard And Mouse Behavior

| Action | Behavior |
| --- | --- |
| Arrow keys | Move active cell. |
| Shift+arrow | Extend cell range selection. |
| Tab / Shift+Tab | Move right / left, wrapping rows. |
| Enter / F2 | Start editing active cell. |
| Printable key | Start editing active cell with typed seed character. |
| Escape | Cancel edit, or close find when find input is focused. |
| Ctrl/Cmd+Z | Undo. |
| Ctrl/Cmd+Y | Redo. |
| Ctrl/Cmd+Shift+Z | Redo. |
| Ctrl/Cmd+F | Open find panel. |
| Enter in find | Next match. |
| Shift+Enter in find | Previous match. |
| Click cell | Select cell. |
| Shift+click cell | Extend range selection. |
| Double-click cell | Start editing. |
| Drag fill handle | Fill selected value/range down or right. |
| Double-click resize handle | Autosize column. |
| Drag resize handle | Resize column. |
| Drag header | Reorder columns when `control` is provided. |
| Right-click control cell | Open row context menu. |

## Filtering, Sorting, And Grouping

- A filter row appears when at least one visible column has `filterable: true`.
- Text filter and value picker are combined.
- Sort is single-column. Setting sort on one field clears sort on other fields.
- Date columns sort chronologically by raw value, not alphabetically by display string.
- Grouping is enabled per column with `groupable: true`.
- Group state is controlled through `AgridControl.setGroupBy(field | null)`.
- `expandGroups()` and `collapseGroups()` can be called on the component.

## Clipboard, Range Selection, And Fill

- Copy exports the active cell or selected rectangular range as TSV.
- Paste accepts TSV or CSV-like plain text and writes from the active cell.
- Pasted values use labels/raw values for `values` columns.
- Number columns coerce numeric pasted values to `number`.
- Paste skips read-only columns.
- Fill repeats the selected source block into the dragged target area.
- Paste and fill are each one undo history item.

## Pinned Columns

Pinned columns are rendered in a fixed left pane. The unpinned columns render in a separate horizontally scrollable pane. Vertical scrolling is synchronized between the panes.

Pin columns initially with:

```ts
{ field: 'id', header: 'ID', width: 70, pinned: 'left' }
```

Or at runtime:

```ts
control.setPinned('id', true);
```

## State Persistence

```ts
const saved = localStorage.getItem('agrid-state');
const control = AgridControl.fromJSON(saved ? JSON.parse(saved) : {});

localStorage.setItem('agrid-state', JSON.stringify(control.toJSON()));
```

Persisted state includes widths, filters, sort, grouping, hidden columns, column order, pinned columns, row reorder setting, page size, and current page.

## Layout In A Card Or Flex Container

The grid host is a flex column. Give it a defined height by participating in the parent's flex layout:

```css
/* Angular Material card example */
mat-card {
  height: 600px;
  display: flex;
  flex-direction: column;
}

mat-card-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}

agrid {
  flex: 1;
  min-height: 0;
}
```

## CSS Custom Properties

Override these on the `agrid` host element to theme the grid.

| Property | Default | Description |
| --- | --- | --- |
| `--agrid-color-text` | `#24292f` | Primary text color. |
| `--agrid-color-text-muted` | `#57606a` | Secondary / placeholder text. |
| `--agrid-color-accent` | `#1a73e8` | Selection, focus, and active state color. |
| `--agrid-color-border` | `#d0d7de` | Cell and header borders. |
| `--agrid-color-bg` | `#ffffff` | Cell background. |
| `--agrid-color-bg-subtle` | `#fafbfc` | Control column background. |
| `--agrid-color-bg-muted` | `#f6f8fa` | Header and hover background. |
| `--agrid-color-bg-stripe` | `#f0f2f5` | Zebra stripe background (even rows). |

## Development

```bash
pnpm install
pnpm start
pnpm build
```

The TypeScript compile check:

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
```
