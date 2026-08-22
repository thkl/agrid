# agrid

`agrid` is an Angular data grid with spreadsheet-like editing, virtual scrolling, filtering, sorting, grouping, column state, pinned columns, selection, clipboard workflows, row operations, pagination, CSV/Excel export, charts/graphs, and custom cell renderers.


[![npm version](https://img.shields.io/npm/v/@thkl/agrid.svg)](https://www.npmjs.com/package/@thkl/agrid)

![image](./public/demo/screenshot_agrid.png)

## Live Demo

[https://thkl.github.io/agrid/](https://thkl.github.io/agrid/)

## Quick Start

```bash
npm install @thkl/agrid @angular/cdk
```

```ts
import { Component } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef, GridEditEvent } from '@thkl/agrid';

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

## Minimal Integration

Import the standalone grid and tree APIs from the package barrel:

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
const columns: ColDef<Row>[] = [
  { field: 'name', header: 'Name', filterable: true },
];

readonly datasource = new AgridDataSource<Row>([]);
readonly provider = new AgridProvider<Row>({
  datasource: this.datasource,
  control: new AgridControl(),
  columns,
  readonly: true,
  rowSelection: 'single',
});
```

```html
<agrid [provider]="provider" (rowClick)="selectRow($event)" />
```

Update rows by replacing the datasource value:

```ts
this.datasource.setData(rows);
this.datasource.setData([newRow, ...this.datasource.rows()]);
```

`AgridDataSource.rows()` is an Angular signal. If you read and write the datasource inside an
Angular `effect()`, wrap the datasource read/write block in `untracked()` to avoid accidental
dependency loops.

Minimal standalone tree:

```ts
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
```

```html
<agrid-tree [provider]="treeProvider" (nodeClick)="selectNode($event)" />
```

`AgridTreeComponent` expects flat rows linked by parent ids, or rows projected with a path config.
It does not consume nested `children` arrays directly.

Required full-height CSS:

```css
agrid {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
```

Parent containers must also have a real height.

Common pitfalls:

- Do not override `agrid` with `display: block` when using full-height layouts.
- Do not pass huge payload strings into visible or filterable columns; use previews.
- Do not fetch unbounded rows into client-side mode; use limits or the server-side row model.
- `AgridTreeComponent` needs flat rows with parent ids or path config, not nested children.
- `AgridDataSource.rows()` is a signal; reads inside Angular effects are tracked unless wrapped in `untracked()`.

## Features

See [ROADMAP.md](./ROADMAP.md) for the AG Grid comparison checklist and open parity items.

- Angular 21 and 22 standalone component.
- CDK virtual scrolling for large row sets.
- Signal-based data source and control state.
- Editable text cells and select editors for fixed value columns.
- Custom component cell editors via `ColDef.cellEditor` (star ratings, pickers, sliders) with zero extra dependencies.
- Keyboard navigation with auto-scroll to the active cell.
- Type-to-edit, Enter/F2 edit, Tab/Enter commit, Escape cancel.
- Undo/redo for edits, paste, and fill operations.
- Cell range selection with Shift+arrow, Shift+click, or left-button drag with edge auto-scroll.
- Clipboard copy/paste using TSV/CSV-like plain text.
- Live selection status bar with count, sum, average, minimum, and maximum.
- Fill handle for repeating selected cell/range values down or right.
- Find panel with Ctrl/Cmd+F, full filtered-dataset matching, and next/previous navigation.
- Quick filter for searching across all visible columns.
- Text filters, string/number/date condition filters, value filters, and multi-column sorting.
- Custom sort comparators for domain-specific column ordering.
- Server-side filter/sort events for remote data workflows.
- Column menu with sort, clear sort, autosize, pin/unpin, hide, group, and clear filter actions.
- Column resizing by drag and autosize by double-click.
- Column reordering by header drag.
- Column virtualization for very wide grids.
- Conditional cell formatting with colors, typography, borders, and alignment.
- Row-aware horizontal cell spanning, clamped within each pinned or scrollable pane.
- Split-pane pinned columns on the left.
- Optional control column for row context actions, row numbers, row marking, and row reordering.
- Column marking for complete-column highlighting and clipboard workflows.
- Row selection: none, single, or multi.
- Grouping with expand/collapse and custom group actions.
- Sidebar column visibility picker.
- Add-row placeholder and automatic row insertion.
- CSV and zero-dependency Excel (`.xlsx`) export of visible, filtered data rows.
- Server-side row model with lazy block loading and virtual placeholders.
- **Date auto-formatting** — ISO strings and `Date` objects are detected and displayed as locale-formatted dates automatically.
- **Zebra stripes** — alternating row shading for easier reading.
- **Readonly mode** — disable all editing with a single input.
- **Pagination** — built-in page controls driven by `AgridControl`.
- **Pivot tables** — derive read-only cross-tab views from row, column, value, and aggregate fields.
- **Tree node aggregates** — roll up sum, average, count, or custom values into expandable tree nodes.
- **Custom cell renderers** — render any Angular component per column for rich cell content (the legacy HTML-string renderer is deprecated).
- **Custom cell editors** — render any Angular component while editing; the grid keeps validation, history, and the commit lifecycle.
- **Charts / graphs** — zero-dependency SVG column/bar/line/area/pie/donut diagrams via `<agrid-chart>`, configured with an `AgridChartProvider`. Link to a grid's `visibleRows` to follow filters and sorting live.
- **Sparklines** — inline SVG line and bar charts rendered per row from numeric series data.
- **Column autosize all** — fit every visible column to its content in one call.
- **Master/detail rows** — expand any row to reveal a custom HTML detail panel beneath it.
- **Pinned rows** — keep summary/total rows fixed at the top or bottom of the body.
- **Persistable settings** — save and restore serializable column, filter, sidebar, and pivot state.
- **Row CSS classes** — apply conditional classes to whole rows via `getRowClass`.

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
| `recordEdit` | `RecordEditEvent` | Emitted on the next microtask after an edit updates a row. Includes the row `index`, current `data`, exact `provider`, and `datasource`. |
| `rowChanged` | `RowUpdateEvent` | Emitted once with the latest row after inline editing leaves that row, or when the sidebar editor Save button is used. Use this for one API request after several field edits. |
| `rowRemoved` | `RecordEditEvent` | Emitted after deleting a row. Includes its former `index`, captured `data`, exact `provider`, and `datasource`. |
| `prepareAddRecord` | `NewRecord` | Emitted after the grid inserts a blank row. Patch `event.datasource` to target the correct grid when multiple providers are rendered. |
| `rowReorder` | `RowReorderEvent` | Emitted after the user drops a reordered row. The host must call `dataSource.moveRow()`. |
| `rowSelect` | `RowSelectEvent \| null` | Emitted when row selection changes. `null` means selection was cleared. |
| `cellSelect` | `CellSelectEvent<T> \| null` | Emitted when cell selection changes. `null` means selection was cleared. |
| `rowMark` | `RowMarkEvent<T>` | Emitted after the row-header surface or marker checkbox marks or unmarks a row. |
| `columnMark` | `ColumnMarkEvent<T>` | Emitted after a header marks or unmarks a complete column. |
| `columnHeaderAction` | `ColumnHeaderActionEvent<T>` | Emitted for a custom column-menu command with `{ column, key }`. |
| `firstDataRendered` | `FirstDataRenderedEvent<T>` | Emitted once after the first completed render containing datasource rows. |
| `menuBarAction` | `string` | Emitted for every enabled menu-bar button or dropdown item with its configured `id`. |
| `treeNodeClick` | `TreeNodeClickEvent` | Emitted when a generated path-tree branch node is clicked. |
| `treeNodeDoubleClicked` | `TreeNodeClickEvent` | Emitted when a generated path-tree branch node is double-clicked. |
| `cellInfo` | `CellInfoEvent<T>` | Emitted when a column's optional cell info icon is clicked. |
| `filterChange` | `FilterChangeEvent` | Emitted for text filter changes when `serverSideFiltering` is enabled. |
| `sortChange` | `SortChangeEvent` | Emitted for sort changes when `serverSideFiltering` is enabled. |

Use `rowChanged` instead of `cellEdit` when an API should receive the complete row only after the
user finishes editing it:

```html
<agrid [provider]="provider" (rowChanged)="saveRow($event)" />
```

```ts
saveRow(event: RowUpdateEvent<PersonRow>): void {
  this.http.patch(`/api/people/${event.row.id}`, event.row).subscribe(() => {
    this.provider.control.indicate(event.originalIndex, '#2da44e', 1000);
    this.provider.control.clearChangedCells(event.originalIndex);
  });
}
```

During inline editing, moving between fields in the same row does not emit `rowChanged`. The event
fires when navigation enters another row, filter focus clears the active cell, or focus leaves the
grid. `recordEdit` and `cellEdit` continue to fire for each committed field mutation.

Enable changed-cell markers when the user should see which values are waiting to be persisted:

```ts
readonly provider = new AgridProvider<PersonRow>({
  columns,
  datasource,
  showChangedCellIndicator: true,
});
```

After a successful API request, call `control.clearChangedCells(index)` for the complete row,
`control.clearChangedCells(index, ['name', 'email'])` for selected fields, or
`control.clearChangedCells()` for every marker. Call `control.indicate(index, color, durationMs)`
to flash a complete row for transient server-side feedback.

## AgridProvider Configuration

All grid options are passed to `AgridProvider` at construction time:

```ts
readonly gridProvider = new AgridProvider({
  columns: this.columns,
  datasource: this.ds,
  control: this.gridControl,
  getRowId: row => row.id,
  zebraStripes: true,
  showSidebar: true,
  showControlColumn: true,
  rowSelection: 'multi',
  allowAddRows: true,
  enableRowMarking: true,
  confirmRowDelete: true,
  readonly: false,
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `columns` | `ColDef[]` | `[]` | Column definitions. |
| `headerGroups` | `HeaderGroup[]` | `[]` | Labels for optional grouped column headers. |
| `datasource` | `AgridDataSource` | New empty datasource | Row data container. |
| `serverSideRowModel` | `AgridServerSideRowModel` | `undefined` | Lazy block-based datasource with virtual placeholders, caching, and automatic filter/sort query forwarding. |
| `control` | `AgridControl` | New default control | Manages filters, sort, grouping, pagination, and undo/redo. |
| `getRowId` | `(row, index) => string \| number` | Object reference | Stable row identity used to keep selection and row-attached state on the same logical row when rows are inserted, removed, reordered, or replaced. |
| `locale` | `string` | `'auto'` | BCP-47 locale tag for grid text and date formatting. `'auto'` reads `navigator.language` and falls back to `'en-US'`. |
| `localization` | `AgridLocaleTextOverrides` | `undefined` | Overrides individual labels. See [Localization](#localization). |
| `rowHeight` | `number` | `32` | Fixed row height in pixels. Required by CDK virtual scroll. |
| `minHeight` | `string` | `undefined` | CSS min-height for the virtual body. Example: `'200px'`. |
| `maxHeight` | `string` | `undefined` | CSS max-height for the virtual body. Example: `'500px'`. |
| `allowAddRows` | `boolean` | `false` | Shows a `+ Add row` placeholder at the bottom when `autoAddRows` is `false`. |
| `autoAddRows` | `boolean` | `false` | Automatically inserts a blank row when navigation moves past the last real row. |
| `showControlColumn` | `boolean` | `false` | Shows a 24 px control column for row context actions and drag handles. |
| `showRowNumbers` | `boolean` | `false` | Shows 1-based filtered/sorted row numbers in the control column, replacing the drag-handle glyph. |
| `enableRowMarking` | `boolean` | `false` | Makes row headers clickable, shows checkboxes in a 48 px control column, and includes marked rows in every copy operation. |
| `enableColumnMarking` | `boolean` | `false` | Makes column-header surfaces clickable and exposes marked fields through `markedColumnFields`. |
| `showSidebar` | `boolean` | `false` | Shows a collapsible column visibility sidebar. Requires `control`. |
| `autoOpenDetail` | `boolean` | `false` | Opens the detail row automatically when a row is selected. |
| `serverSideFiltering` | `boolean` | `false` | Emits filter/sort events instead of applying them locally and hides the value checklist. |
| `filterDebounceMs` | `number` | `300` | Debounce delay for server-side `filterChange` events. Set to `0` to disable. |
| `externalFilter` | `(params) => boolean` | `undefined` | Application-owned client-side predicate applied after built-in filters and quick filter. |
| `enableQuickFilter` | `boolean` | `false` | Shows a global search box above the grid. In server-side mode it emits quick-filter requests instead of filtering locally. |
| `showFormulaBar` | `boolean` | `false` | Shows an Excel-style input line above the grid for the selected cell's raw value. |
| `menuBarItems` | `AgridMenuBarItem<T>[]` | `[]` | Optional buttons above the headers. Buttons may expose additional dropdown commands. |
| `sortOption` | `'single' \| 'multi' \| 'none'` | `'multi'` | Allows one sort, multiple sorts, or disables sorting. |
| `rowSelection` | `'single' \| 'multi' \| 'none'` | `'none'` | Row selection behavior. |
| `enterEditAction` | `'nothing' \| 'nextColumn' \| 'nextRow'` | `'nextRow'` | Behavior after pressing Enter while editing a cell. |
| `groupDescription` | `((label: string) => string) \| null` | `null` | Optional description text shown next to each group label. |
| `groupActions` | `GroupAction[]` | `[]` | Actions shown in each group header menu. |
| `cellMenuItems` | `(CellContextMenuItem \| null)[]` | `[]` | Additional items in the cell right-click context menu. `null` inserts a divider. |
| `getCellMenuItems` | `({ row, cell }) => (CellContextMenuItem \| null)[] \| undefined` | `undefined` | Resolves cell right-click menu items for the targeted cell. Return `undefined` to use `cellMenuItems`; return an array, including `[]`, to use that dynamic result. |
| `zebraStripes` | `boolean` | `false` | Shades every other row. Override `--agrid-color-bg-stripe` to change the shade. |
| `columnVirtualizationThreshold` | `number` | `30` | Renders only the scrollable columns near the horizontal viewport once the scrollable-column count exceeds this value. Lower it to virtualize sooner, or set `Infinity` to disable. Pinned columns always render. |
| `showChangedCellIndicator` | `boolean` | `false` | Marks committed cell changes until `clearChangedCells()` is called. |
| `confirmRowDelete` | `boolean` | `false` | Fades the target row and shows a localized in-row Yes/No confirmation. |
| `emptyText` | `string` | `undefined` | Text shown when the grid has no rows. Falls back to the locale default. |
| `readonly` | `boolean` | `false` | Initial value for the readonly signal. Makes all cells non-editable. |
| `loading` | `boolean` | `false` | Initial value for `control.loading`. Shows a loading overlay over the grid body. |
| `getRowClass` | `(p: { row; index }) => string` | `undefined` | Returns CSS class names applied to a whole data row. Complements `ColDef.cellClass`. |
| `pinRow` | `(row, index) => 'top' \| 'bottom' \| undefined` | `undefined` | Pins matching rows to the top/bottom of the body (see [Master/Detail and Pinned Rows](#masterdetail-and-pinned-rows)). |
| `treeConfig` | `AgridTreeConfig<T> \| null` | `null` | Builds a tree from id/parent-id accessors or `getPath` segments. Supports descendant rollups through `aggregateTreeNodes`. Path labels and branch UUIDs can be customized with `formatPathSegment` and `nodeUuid`. |
| `pivotConfig` | `AgridPivotConfig<T> \| null` | `null` | Derives a read-only client-side pivot from one row field, one column field, and one aggregated value field. |
| `masterDetail` | `boolean` | `false` | Enables expandable detail panels. In tree mode, only leaf rows can expand details. Not available while grouped. |
| `detailRenderer` | `(p: { row }) => string` | `undefined` | Returns sanitized HTML for an expanded detail panel. |
| `detailColumnField` | column field | `undefined` | Shows one linked column as a multiline editable field in the detail panel. |
| `detailActions` | `{ id; label; text? }[]` | `[]` | Adds template buttons above the linked detail textarea. `text` may be a string or `(p: { row; rowIndex }) => string`. |
| `detailRowHeight` | `number` | `200` | Fixed height in pixels of an expanded detail panel. |

### Tree grids and descendant rollups

Set `aggregateTreeNodes` to display aggregate-column values on every expandable tree node. The
grid uses each column's existing `aggregate` function, so footer and tree aggregation share the
same sum/average/minimum/maximum/count or custom-function configuration.

```ts
const columns: ColDef<OrgRow>[] = [
  { field: 'name', header: 'Name' },
  { field: 'amount', header: 'Amount', type: 'number', aggregate: 'sum' },
];

const treeConfig: AgridTreeConfig<OrgRow> = {
  getId: row => row.id,
  getParentId: row => row.parentId,
  treeField: 'name',
  aggregateTreeNodes: true,
};
```

Rollups use descendant leaves, not intermediate parent values, which avoids double-counting stored
subtotals in multi-level trees. Collapsed descendants continue to contribute. Active filters
recalculate rollups over the filtered tree, including ancestors retained by
`keepAncestorsOnFilter`. Parent aggregate cells are display-only and do not overwrite source data.
Generated `getPath` branches use all datasource leaves beneath the branch and show their rollups
inline.

### Standalone tree

`AgridTreeComponent` and `AgridTreeProvider` provide the same hierarchy without grid columns.
The control accepts `AgridTreeConfig<T>`, supports keyboard navigation and selection, and emits
normalized row/path-branch events. Because the standalone tree has no columns, it ignores
`aggregateTreeNodes`.

```ts
readonly treeProvider = new AgridTreeProvider<Node>({
  datasource: new AgridDataSource(nodes),
  treeConfig: {
    getId: node => node.id,
    getParentId: node => node.parentId,
    treeField: 'name',
    defaultExpanded: true,
  },
  getDescription: node => node.type,
  getNodeClass: node => node.type === 'archived' ? 'tree-node-archived' : '',
  contextMenuItems: node => [
    { id: 'open', label: `Open ${node.label}` },
    {
      id: 'delete',
      label: 'Delete',
      danger: true,
      disabled: node.kind !== 'row',
      confirm: { message: `Delete ${node.label}?`, confirmLabel: 'Delete' },
    },
  ],
});
```

```html
<agrid-tree
  [provider]="treeProvider"
  (nodeClick)="openNode($event)"
  (nodeMenuAction)="handleNodeMenu($event)" />
```

For server-backed trees, keep the same parent/id config and add `serverTree`. The component calls
`loadRoot` once on startup and calls `loadChildren` the first time a branch expands. Use
`hasChildren` when the server knows a node has children before those rows are loaded locally; the
tree shows a spinner while each request is pending.

```ts
readonly treeProvider = new AgridTreeProvider<Node>({
  datasource: new AgridDataSource<Node>(),
  treeConfig: {
    getId: node => node.id,
    getParentId: node => node.parentId,
    treeField: 'name',
  },
  serverTree: {
    loadRoot: () => api.getTreeRoot(),
    loadChildren: ({ id }) => api.getTreeChildren(id),
    hasChildren: node => node.hasChildren,
    rootLoadingText: 'Loading root configuration',
    childLoadingText: 'Loading child nodes',
  },
});
```

### Client-side pivot

The first pivot slice creates a read-only table from one row dimension, one column dimension, and
one value field:

```ts
readonly provider = new AgridProvider<Sale>({
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
});
```

Supported aggregates are `sum` (default), `avg`, `min`, `max`, `count`, and custom functions.
Source updates regenerate the pivot. Filtering, sorting, selection, and pagination remain
available; editing, row mutation, tree mode, server-side row models, and aggregate footers do not.
Set `showSidebar: true` to expose a Pivot tab that changes dimensions, values, and built-in
aggregates directly from the table. The tab also repeats the generated-column visibility selector
so pivot configuration and display choices can be managed in one place.

Persist the complete JSON-safe state with the provider or component API:

```ts
const settings = provider.saveSettings(); // AgridSettings
await backend.save(settings);

provider.loadSettings(await backend.load());
```

The snapshot includes `pivotConfig` plus `AgridControlState` (visibility, widths, order, pinning,
filters, sorting, pagination, and aggregates). Sidebar pivot and visibility changes also emit the
full object through `(settingsChange)`. Custom aggregate functions are intentionally rejected
because functions cannot be serialized safely.

### Page selector

`AgridPageSelectorComponent` navigates a labeled list using previous/next buttons, a typed ID,
or a dropdown. Every navigation path emits the complete selected item through `(selectPage)`.

```ts
readonly pages: AgridPageItem<number>[] = Array.from({ length: 100 }, (_, index) => ({
  id: index + 1,
  label: `Page ${index + 1}`,
}));
readonly selectedPageId = signal(1);

selectPage(item: AgridPageItem<number>): void {
  this.selectedPageId.set(item.id);
}
```

```html
<agrid-page-selector [items]="pages" [selectedId]="selectedPageId()"
  (selectPage)="selectPage($event)" />
```

IDs may be strings or numbers. Type an exact ID and press Enter to jump. The component uses the
shared `--agrid-color-*` theme variables and accepts optional labels plus a disabled state.

### Menu bar

Configure `menuBarItems` to render commands above the column headers. Main buttons and dropdown
items share the single `(menuBarAction)` output. `visible`, `active`, and `disabled` accept either
a boolean or a resolver receiving current rows, selected rows, selected cell, provider, and
datasource.

```ts
readonly provider = new AgridProvider<Order>({
  columns,
  datasource,
  rowSelection: 'multi',
  menuBarItems: [
    { id: 'refresh', label: 'Refresh', icon: '↻' },
    {
      id: 'selection',
      label: 'Selection',
      disabled: ({ selectedRows }) => selectedRows.length === 0,
      active: ({ selectedRows }) => selectedRows.length > 0,
      items: [
        { id: 'approve', label: 'Approve', visible: ({ selectedRows }) => selectedRows.length > 0 },
        { id: 'archive', label: 'Archive', disabled: ({ selectedRows }) => selectedRows.some(({ row }) => row.locked) },
      ],
    },
  ],
});

onMenuBarAction(id: string): void {
  // refresh, selection, approve, archive, ...
}
```

```html
<agrid [provider]="provider" (menuBarAction)="onMenuBarAction($event)" />
```

### Dynamic Provider Options

Three options are `WritableSignal` properties on the provider instance — update them at runtime without recreating the provider:

| Signal | Type | Description |
| --- | --- | --- |
| `control.loading` | `Signal<boolean>` | Whether the loading overlay is visible. Change with `setLoading()`. |
| `control.readonly` | `Signal<boolean>` | Whether readonly mode is active. Change with `setReadonly()`. |
| `control.autoAddRows` | `Signal<boolean>` | Whether automatic row insertion is active. Change with `setAutoAddRows()`. |
| `control.clearChangedCells(rowIndex?, fields?)` | method | Clears every changed-cell marker, one row, or selected fields in one row. |
| `control.indicate(rowIndex, color, durationMs?)` | method | Flashes one original datasource row with a CSS color, then fades back over `durationMs` (default `1000`). |

Example — toggle readonly in a host component:

```ts
readonly provider = new AgridProvider({ ..., readonly: true });
readonly isEditing = signal(false);

constructor() {
  effect(() => this.provider.control.setReadonly(!this.isEditing()));
}
```

Example — server-side loading state:

```ts
async loadPage(page: number) {
  this.provider.control.setLoading(true);
  this.ds.setData(await fetchPage(page));
  this.provider.control.setLoading(false);
}
```

### Public Component Methods

Call these through `viewChild(AgridComponent)`.

| Method | Description |
| --- | --- |
| `autosizeAllColumns()` | Resizes every visible column to fit its header text and current row values. Call after setting data. |
| `expandGroups()` | Expands every group when grouping is active. |
| `collapseGroups()` | Collapses every group when grouping is active. |
| `toggleSidebar()` | Opens or closes the column sidebar. |
| `openFind()` | Opens the find panel and focuses the input. |
| `closeFind()` | Closes the find panel. |
| `goToFindMatch(direction)` | Moves to the next (`1`) or previous (`-1`) find match. |
| `deleteRow(originalIndex)` | Removes a row and emits `rowRemoved`, after confirmation when `confirmRowDelete` is enabled. |
| `clearChangedCells(originalIndex?, fields?)` | Backwards-compatible delegate to `provider.control.clearChangedCells(...)`. |
| `clearMarkedRows()` | Clears all rows marked for clipboard inclusion. |
| `setRowMarked(index, marked)` | Sets one row's mark state and emits `rowMark` when it changes. |
| `toggleRowMarked(index)` | Toggles one row's mark state and emits `rowMark`. |
| `setColumnMarked(field, marked)` | Sets one complete column's mark state and emits `columnMark` when it changes. |
| `toggleColumnMarked(field)` | Toggles one complete column's mark state. |
| `clearMarkedColumns()` | Clears all marked columns. |

### Data Export

Export lives on the **provider**, so you can trigger it from anywhere that holds the provider — no `viewChild(AgridComponent)` required:

```ts
provider.exportCsv();                  // downloads "export.csv"
provider.exportCsv('employees.csv');

provider.exportXlsx();                 // downloads "export.xlsx"
provider.exportXlsx('employees.xlsx');
```

Both use display values (value-list labels, formatters) and respect column visibility; group-header rows are excluded. `exportXlsx` writes a real `.xlsx` workbook with **zero third-party dependencies** — numbers and dates are emitted as native, sortable/summable cells under a bold frozen header row. Both methods operate on the grid's current filtered, visible projection and are a no-op until an `<agrid>` bound to the provider has rendered.

### Public Component State

| Property | Type | Description |
| --- | --- | --- |
| `selectedCell` | `Signal<CellPosition \| null>` | Currently focused cell. |
| `editingCell` | `Signal<CellPosition \| null>` | Cell currently in edit mode. |
| `selectedRowIndices` | `Signal<ReadonlySet<number>>` | Selected original row indices. |
| `selectedRowIndex` | `Signal<number \| null>` | First selected row index, useful for single selection. |
| `getCurrentRow()` | `AgridCurrentRow<T> \| null` | Returns the first selected row with its original index. |
| `getCurrentCell()` | `AgridCurrentCell<T> \| null` | Returns the selected cell with row, field, value, and column metadata. |
| `markedRowIndices` | `Signal<ReadonlySet<number>>` | Original datasource indices included in copy operations. |
| `markedColumnFields` | `Signal<ReadonlySet<string>>` | Fields currently marked as complete columns. |
| `selectionSummary` | `Signal<AgridSelectionSummary \| null>` | Live numeric statistics for the active cell or range. `null` when no numeric values are selected. |
| `sidebarOpen` | `Signal<boolean>` | Current sidebar visibility. |
| `canUndo` | `Signal<boolean>` | Whether Ctrl/Cmd+Z can undo an edit. Requires `provider.control`. |
| `canRedo` | `Signal<boolean>` | Whether redo is available. Requires `provider.control`. |
| `filteredRowCount` | `Signal<number>` | Total filtered data row count, unaffected by current page. |
| `totalPages` | `Signal<number>` | Total page count given the current filter and page size. `1` when pagination is off. |
| `showPagination` | `Signal<boolean>` | Whether the pagination bar is visible (`pageSize > 0`). |

## Column Definitions

`ColDef` describes one column.

Columns, providers, datasources, and row events accept a row type. Supplying it makes
column fields and callback values type-safe:

```ts
interface PersonRow {
  id: number;
  name: string;
  active: boolean;
}

const columns: ColDef<PersonRow>[] = [
  { field: 'id', header: 'ID', formatter: value => value.toFixed(0) },
  { field: 'name', header: 'Name', formatter: value => value.toUpperCase() },
  {
    field: 'active',
    header: 'Active',
    values: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
  },
];

const datasource = new AgridDataSource<PersonRow>([]);
const provider = new AgridProvider<PersonRow>({ columns, datasource });

function onRecordEdit(event: RecordEditEvent<PersonRow>): void {
  console.log(event.data.name);
}
```

An invalid field such as `{ field: 'email' }` is rejected by TypeScript. Generic parameters
are optional, so existing untyped configurations remain compatible.

### Grouped Column Headers

```ts
const columns: ColDef<PersonRow>[] = [
  { field: 'firstName', header: 'First name', group: 'employee' },
  { field: 'lastName', header: 'Last name', group: 'employee' },
  { field: 'email', header: 'Email' },
];

const provider = new AgridProvider({
  columns,
  headerGroups: [{ id: 'employee', label: 'Employee' }],
});
```

The extra header row appears when a visible column references a configured group. Only adjacent
columns share one group header. Reordering, hiding, or pinning columns can split the same group ID
into multiple rendered segments. Dragging a group header moves every column in that segment as one
ordered block. A segment containing a locked column cannot be dragged. The `group` property is only
for header presentation; `groupable` continues to control data-row grouping.

```ts
interface ColDef {
  field: string;
  header: string;
  group?: string;          // references AgridProvider.headerGroups
  headerMenuItems?: AgridColumnHeaderMenuItem[];
  width: number;           // use ColDefAutoSize (-1) to autosize on first render
  type?: 'text' | 'number' | 'date' | 'boolean';
  editable?: boolean;
  cellReadonly?: (params: { value: unknown; row: Record<string, unknown>; column: ColDef; originalIndex: number }) => boolean;
  textAlign?: 'left' | 'center' | 'right' | Signal<'left' | 'center' | 'right'>;
  cellFormat?: (params: { value: unknown; row: Record<string, unknown>; column: ColDef; originalIndex: number }) => CellFormat | null | undefined;
  colSpan?: number | ((params: { value: unknown; row: Record<string, unknown>; column: ColDef; originalIndex: number }) => number);
  locked?: boolean;
  values?: string[] | ValueOption[];
  formatter?: (value: unknown) => string;
  comparator?: (params: { valueA: unknown; valueB: unknown; rowA: Record<string, unknown>; rowB: Record<string, unknown>; indexA: number; indexB: number; column: ColDef; locale?: string }) => number;
  inputMask?: (params: { value: unknown; row: Record<string, unknown>; column: ColDef }) => RegExp | null;
  filterable?: boolean;
  groupable?: boolean;
  hidden?: boolean;
  pinned?: 'left' | 'right';
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  cellRenderer?: (params: { value: unknown; row: Record<string, unknown> }) => string;
  cellClass?: (params: { value: unknown; row: Record<string, unknown> }) => string;
  infoIcon?: boolean | ((params: { value: unknown; row: Record<string, unknown> }) => boolean);
}
```

| Property | Required | Description |
| --- | --- | --- |
| `field` | Yes | Key in each row object. |
| `header` | Yes | Header label shown in the grid. |
| `group` | No | Header-group ID. Adjacent columns with the same ID share a grouped header. |
| `headerMenuItems` | No | Custom `{ key, label, icon?, disabled?, itemClasses?, iconClasses? }` commands appended to this column's header menu. |
| `width` | Yes | Default width in pixels. Set to `ColDefAutoSize` (`-1`) to fit the column to its content on first render. |
| `type` | No | Semantic type. `number` initializes blank rows with `0`. `date` treats the ISO date prefix as a calendar date, with localized display formatting and a native inline editor. |
| `editable` | No | Set to `false` for a read-only column. Defaults to editable. |
| `cellReadonly` | No | Return `true` to make one cell read-only from its current row, value, column, and original row index. Applies to inline edit, boolean toggles, paste, fill, and sidebar edits. |
| `textAlign` | No | Static value or Angular `Signal` containing `'left'`, `'center'`, or `'right'`. A `textAlign` returned by `cellFormat` overrides it for that cell. |
| `cellFormat` | No | Returns per-cell visual overrides from the current row context. Its `textAlign` takes precedence over the column-level `textAlign`. |
| `colSpan` | No | Number of adjacent visible columns occupied by a cell, or a row-aware callback returning that number. Spans stop at pinned-pane boundaries. |
| `locked` | No | Prevents the column from being hidden, reordered, or unpinned through the column menu. |
| `values` | No | Fixed editor/filter values. Use `string[]` or `{ value, label }[]`. |
| `editor` | No | Built-in editor: `'text'`, `'richSelect'`, `'largeText'`, or `'formula'`. |
| `asyncValues` | No | Async option provider for the built-in rich-select editor. |
| `formula` | No | Evaluates strings beginning with `=` for display, filtering, sorting, copy, and export while keeping the raw value in row data. |
| `formatter` | No | Custom display formatter. Takes precedence over date auto-formatting. |
| `comparator` | No | Custom client-side sort comparator for domain-specific ordering. The grid applies ascending/descending direction after the comparator returns. |
| `inputMask` | No | Resolves a regular-expression input constraint for each string cell from its `row`, `value`, and `column`. Invalid proposed values are rejected. |
| `filterable` | No | Enables text filter and value picker for the column. |
| `filterComponent` | No | Standalone Angular component rendered in this column's filter menu. It injects `AGRID_FILTER_CONTEXT` and writes normal `ColumnFilter` state. |
| `filterValueLimit` | No | Caps the number of value-filter choices rendered after mini-search matching. |
| `groupable` | No | Enables "group by" in the column menu. |
| `hidden` | No | Hides the column on first render. |
| `pinned` | No | `'left'` or `'right'` to pin the column initially. Left-pinned columns render in a fixed pane before the scrollable area; right-pinned columns render in a fixed pane after it. |
| `aggregate` | No | Shows an aggregate footer value: `'sum'`, `'avg'`, `'min'`, `'max'`, or `'count'`. |
| `cellRendererComponent` | No | A standalone Angular component rendered for the cell's display state. The component injects `AGRID_RENDERER_CONTEXT`. See [Custom Cell Renderers](#custom-cell-renderers). |
| `cellRenderer` | No | **Deprecated** — use `cellRendererComponent`. Custom HTML renderer: return an HTML string; Angular sanitizes it automatically. |
| `cellEditor` | No | A standalone Angular component to use as the cell editor instead of the built-in input. The component injects `AGRID_EDITOR_CONTEXT`. See [Custom Cell Editors](#custom-cell-editors). |
| `cellClass` | No | Returns a CSS class name for each cell. Applied alongside built-in state classes. |
| `infoIcon` | No | Shows a right-aligned `?` action. Set it to `true` or return a boolean per cell. Clicking it emits `cellInfo` with the row, field, value, original index, and column definition. |

### Runtime text alignment

Use a host-owned writable signal when alignment must change at runtime. Pass that signal into the
column definition and update the original signal from `columnHeaderAction`:

```ts
import { signal } from '@angular/core';
import { ColDef, ColumnHeaderActionEvent } from '@thkl/agrid';

type TextAlign = 'left' | 'center' | 'right';

readonly salaryAlignment = signal<TextAlign>('right');

readonly columns: ColDef<Employee>[] = [
  {
    field: 'salary',
    header: 'Salary',
    textAlign: this.salaryAlignment,
    headerMenuItems: [
      { key: 'align-left', label: 'Align left' },
      { key: 'align-center', label: 'Align center' },
      { key: 'align-right', label: 'Align right' },
    ],
  },
];

onColumnHeaderAction(event: ColumnHeaderActionEvent<Employee>): void {
  if (event.column.field !== 'salary') return;

  const alignment = event.key.replace('align-', '') as TextAlign;
  this.salaryAlignment.set(alignment);
}
```

```html
<agrid [provider]="provider" (columnHeaderAction)="onColumnHeaderAction($event)" />
```

Do not assign a new string to `event.column.textAlign` for runtime changes. A column definition is
configuration rather than reactive state, so mutating the object does not notify rendered cells.
Also, `event.column.textAlign` is typed as a static value or a read-only `Signal`; retain the
original writable signal when calling `.set()`.

### Cell spanning

Use `colSpan` to merge adjacent cells horizontally for selected rows:

```ts
const columns: ColDef<OrderRow>[] = [
  {
    field: 'label',
    header: 'Label',
    textAlign: 'center',
    colSpan: ({ row }) => row.kind === 'summary' ? 3 : 1,
  },
  { field: 'quantity', header: 'Quantity' },
  { field: 'total', header: 'Total' },
];
```

The callback receives the typed row, value, column, and original datasource index. Values are
rounded down and clamped to the columns remaining in the current pane. A span cannot cross from a
left-pinned pane into the scrollable pane or from the scrollable pane into a right-pinned pane.

```html
<agrid [provider]="provider" (cellInfo)="showCellInfo($event)" />
```

### Input masks

Return a mask per row when string values need a structured format:

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

The expression is matched against the entire proposed value, so explicit `^`
and `$` anchors are optional. It must accept partial input, including the empty
string and any intermediate separators users need to type. Return `null` when
a particular row should use an unrestricted text editor.

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

## Built-in Rich Editors and Formulas

Use `ColDef.editor` when the default text input is too small but a custom Angular component would be
overkill:

```ts
const columns: ColDef<Task>[] = [
  {
    field: 'assignee',
    header: 'Assignee',
    editor: 'richSelect',
    asyncValues: () => fetch('/api/users').then(r => r.json()),
  },
  { field: 'notes', header: 'Notes', editor: 'largeText' },
  {
    field: 'budget',
    header: 'Budget',
    editor: 'formula',
    formula: true,
  },
];

const provider = new AgridProvider({
  columns,
  datasource,
  showFormulaBar: true,
});
```

`richSelect` searches through `values` and can load options from `asyncValues` when the editor
opens. `largeText` renders a multiline textarea. `formula` gives the cell a formula-friendly input;
set `formula: true` to evaluate raw strings that start with `=` for display, filtering, sorting,
copy, and export. Formula evaluation uses a small parser in `agrid.utils.ts`; it does not call
JavaScript `eval`.

`showFormulaBar` adds an Excel-style input line above the grid. It edits the selected cell's raw
value, which makes long text and formulas easier to work with than editing inside a narrow cell.

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

To toggle readonly at runtime, update the control:

```ts
readonly isReadonly = signal(true);

constructor() {
  effect(() => this.provider.control.setReadonly(this.isReadonly()));
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
  (serverQueryChange)="loadRows($event)"
/>
```

```ts
loadRows(query: AgridServerQuery): void {
  this.api.orders(query).subscribe(result => {
    this.ds.setData(result.rows);
    this.ctrl.setTotalRows(result.total);
  });
}
```

For signal-backed stores, subscribe to the provider instead of template outputs:

```ts
effect(() => {
  const query = this.provider.serverQuery();
  if (!query) return;
  this.store.load(query);
});
```

In server-side mode:

- Filter and sort state remains visible in the grid headers.
- The grid does not filter or sort loaded rows locally.
- The distinct-value checklist is hidden unless `ColDef.values` supplies the complete server-side value set.
- `AgridServerQuery` contains column filters, value selections, menu conditions, ordered sorts, quick-filter text, and page range.
- Clearing emits an empty filter value, `selectedValues: null`, or a `null` sort direction on the compatibility outputs.
- Multi-column sorting emits one event for each changed column.
- Text filter events are debounced by `filterDebounceMs` (300 ms by default).

Use `sortOption: 'single'` for backends that accept only one sort field. Selecting another column
clears the previous sort first. Use `'none'` to remove sorting controls completely; `'multi'`
preserves the default multi-column behavior.

The grid updates its visible filter state immediately, but only emits the final server text or
condition value after the debounce delay. Set `filterDebounceMs: 0` when immediate events are
required. For server pagination, set a `pageSize`, call `control.setTotalRows(total)` after each
response, and replace the datasource contents with the returned page.

### Server-side row model

Use `AgridServerSideRowModel` when rows should be loaded in blocks as the virtual viewport scrolls.
Global row indices remain stable, unloaded rows render as placeholders, stale responses are ignored
after query changes, and old blocks are evicted at the configured cache limit.

```ts
const rowModel = new AgridServerSideRowModel<Order>({
  blockSize: 100,
  maxBlocksInCache: 8,
  initialRowCount: 1_000_000, // optional; the server can return rowCount instead
  datasource: {
    async getRows(request) {
      const response = await api.searchOrders(request);
      return { rows: response.rows, rowCount: response.total };
    },
  },
});

const provider = new AgridProvider<Order>({
  columns,
  serverSideRowModel: rowModel,
  enableQuickFilter: true,
});
```

Requests contain the half-open `startRow`/`endRow` range, complete column filter state, ordered sort
entries, and the quick-filter string. Returning `rowCount` sets the exact scrollbar extent. Without
it, a short block marks the end and a full block extends the unknown extent by one block.

The initial row model is flat: client-side grouping, tree data, pinned rows, master/detail,
pagination, and local aggregate footers are not applied. Editing updates the loaded cache; persist
edits from grid events because an evicted block is fetched again.

## Custom Cell Renderers

Point `ColDef.cellRendererComponent` at any standalone Angular component to control the cell's
display (read) state. The component injects `AGRID_RENDERER_CONTEXT` to read the value, row, and
column as signals — with full Angular bindings, event handlers, and child components, and **no
manual HTML escaping or sanitization**. This needs no third-party dependency.

```ts
import { AGRID_RENDERER_CONTEXT } from '@thkl/agrid';

@Component({
  selector: 'status-badge',
  template: `<span class="badge" [class]="'badge--' + value()">{{ value() }}</span>`,
})
export class StatusBadge {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly value = computed(() => String(this.ctx.value() ?? ''));
}

@Component({
  selector: 'score-bar',
  template: `<span class="track"><span class="fill" [style.width.%]="value()"></span></span>`,
})
export class ScoreBar {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly value = computed(() => Number(this.ctx.value() ?? 0));
}

const columns: ColDef[] = [
  { field: 'status', header: 'Status', editable: false, cellRendererComponent: StatusBadge },
  { field: 'score', header: 'Performance', editable: false, cellRendererComponent: ScoreBar },
];
```

### `AgridRendererContext`

| Member | Type | Description |
| --- | --- | --- |
| `value` | `Signal<T>` | The cell's current value. |
| `row` | `Signal<Record<string, unknown>>` | The full row record — useful when the display depends on sibling fields. |
| `column` | `Signal<ColDef>` | The column definition being rendered. |

A component renderer also works for `boolean` columns, replacing the default checkbox. See the
**Custom cells** demo for badge and score-bar renderers.

### Deprecated: HTML-string `cellRenderer`

> **Deprecated.** Prefer `cellRendererComponent`. The string renderer remains supported for now but
> will be removed in a future release.

Return an HTML string from `cellRenderer` to render content in a cell. Angular's built-in
sanitization runs automatically. Use CSS classes rather than inline styles, and escape dynamic text
before interpolating it into HTML.

```ts
const columns: ColDef[] = [
  {
    field: 'status',
    header: 'Status',
    editable: false,
    cellRenderer: ({ value }) =>
      `<span class="status-badge status-badge--${value}">${value}</span>`,
  },
];
```

The `row` parameter gives you access to the full row object. When both are set,
`cellRendererComponent` wins.

## Custom Cell Editors

When the built-in text input, dropdown, or checkbox isn't enough, point `ColDef.cellEditor` at any
standalone Angular component. The grid instantiates it while the cell is in edit mode and provides
an `AgridEditorContext` through dependency injection. The editor is purely an *input surface* — the
grid keeps ownership of validation (`validate`), undo/redo history, and the commit/cancel lifecycle,
so **Tab, Enter, and Escape keep working without any extra wiring** (their key events bubble up to
the grid). This needs no third-party dependency — just Angular.

Inject `AGRID_EDITOR_CONTEXT` to talk to the grid:

```ts
import { AGRID_EDITOR_CONTEXT } from '@thkl/agrid';

@Component({
  selector: 'star-rating-editor',
  template: `
    @for (n of [1, 2, 3, 4, 5]; track n) {
      <button type="button" (click)="pick(n)">{{ n <= value() ? '★' : '☆' }}</button>
    }`,
})
export class StarRatingEditor {
  private readonly ctx = inject(AGRID_EDITOR_CONTEXT);
  readonly value = signal(Number(this.ctx.value() ?? 0));

  pick(n: number): void {
    this.value.set(n);
    this.ctx.setDraft(n);   // stage the value the grid will commit
    this.ctx.commit();      // confirm immediately (optional — Tab/Enter also commit)
  }
}

const columns: ColDef[] = [
  {
    field: 'rating',
    header: 'Rating',
    type: 'number',
    cellEditor: StarRatingEditor,
    cellRenderer: ({ value }) => '★'.repeat(Number(value)), // how it looks when not editing
  },
];
```

### `AgridEditorContext`

| Member | Type | Description |
| --- | --- | --- |
| `value` | `Signal<T>` | The cell's value when editing started. |
| `row` | `Signal<Record<string, unknown>>` | The full row record. |
| `column` | `Signal<ColDef>` | The column definition being edited. |
| `seedChar` | `Signal<string>` | The printable character that triggered type-to-edit, or `''`. Seed a free-text editor with it. |
| `setDraft(value)` | method | Stage a value; the grid commits the last staged value on Tab/Enter. |
| `commit()` | method | Commit the staged value programmatically (same as pressing Enter). |
| `cancel()` | method | Discard the edit (same as pressing Escape). |

Pair `cellEditor` with `cellRenderer` to control how the value looks when the cell isn't being
edited. See the **Custom editors** demo for star-rating, colour-swatch, and slider editors.

## Charts / Graphs

`AgridChartComponent` renders zero-dependency SVG charts/graphs — column, bar, line, area, pie,
and donut — configured exactly like the grid: build an `AgridChartProvider` and pass it in.

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

The chart sizes itself to its container width (observed) and the provider's `height`. Every option
is a signal: `type` is writable, so `chartProvider.type.set('pie')` re-renders.

### `AgridChartProvider` configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | `'column' \| 'bar' \| 'line' \| 'area' \| 'pie' \| 'donut'` | — | Diagram type. Writable signal — set it to switch at runtime. |
| `data` | `AgridChartData` | — | Static dataset (`{ categories?, series: [{ name?, color?, values }] }`). Ignored when `source` is set. |
| `source` | `Signal<readonly T[]>` | — | A reactive row source to derive the dataset from. Requires `transform`. See below. |
| `transform` | `(rows, type) => AgridChartData` | — | Turns the `source` rows (and current type) into a dataset. Re-runs when the rows or type change. |
| `height` | `number` | `220` | Chart height in pixels (width follows the host). |
| `showLegend` | `boolean` | `true` | Show the series/category legend. |
| `showAxis` | `boolean` | `true` | Draw value/category axes (cartesian types). |
| `palette` | `string[]` | built-in | Override the series/slice colours. |

Pie and donut charts use the **first** series; its values become slices labelled by `categories`.

### Linking a chart to a grid

Pass a grid provider's `visibleRows` as the `source` and the chart follows the grid live — including
its **filters and sorting**:

```ts
readonly chartProvider = new AgridChartProvider<RegionRow>({
  type: 'column',
  source: this.gridProvider.visibleRows,           // filtered + sorted rows
  transform: (rows, type) => ({
    categories: rows.map(r => r.region),
    series: [{ values: rows.map(r => r.total) }],
  }),
});
```

`AgridProvider.visibleRows` is a `Signal<readonly T[]>` of the grid's current rows. Important
semantics:

- It reflects **filtering and sorting** — filter a row out of the grid and it leaves the chart too.
- It deliberately **ignores grouping and pagination**: a chart wants the whole filtered set, not a
  single page or grouped subtotals. (Use a `transform` to aggregate if you want grouped totals.)
- It is **published by the rendered grid component**. Before the grid mounts (or with no grid
  attached) it falls back to every datasource row.

With a `source` the dataset is a derived signal, so `setData()` is unavailable — update the source or
the `transform` instead. Without a `source`, use `chartProvider.setData(next)` to replace static data.

See the **Charts** demo for a grid beside a chart with a type switcher. The main demo also has a
**Show Charts** menu action that opens a graph panel linked to the grid's filtered rows. In both
cases, filtering a row or editing a cell redraws the chart instantly.

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

The header arrow opens the complete column menu. The condition button beside an inline filter opens
only condition operators and operands. Each trigger toggles its own menu mode.

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
| `loading` | Whether the loading overlay is visible. Change with `setLoading()`. |
| `readonly` | Whether all editing and mutation UI is disabled. Change with `setReadonly()`. |
| `autoAddRows` | Whether navigation can insert rows automatically. Change with `setAutoAddRows()`. |
| `allowRowReorder` | Whether row drag handles can reorder rows. |
| `groupByField` | Field currently used for grouping, or `null`. |
| `hiddenColumns` | Set of hidden field names. |
| `columnOrder` | Current field order. Empty means original `colDefs` order. |
| `pinnedColumns` | Set of pinned field names. |
| `columnWidths` | Width overrides by field. |
| `filters` | Active filter/sort state by field. |
| `pageSize` | Rows per page. `0` means all rows (no pagination). |
| `currentPage` | Current page number (1-based). |
| `filterReapplyNeeded` | Whether inserted rows are currently bypassing active filters or sorts. |
| `canUndo` | Whether an undo history item exists. |
| `canRedo` | Whether a redo history item exists. |

### Control Methods

| Method | Description |
| --- | --- |
| `setLoading(value)` | Shows or hides the loading overlay. |
| `setReadonly(value)` | Enables or disables readonly mode. |
| `setAutoAddRows(value)` | Enables or disables automatic row insertion. |
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
| `getFilterModel()` | Returns a detached serializable filter, quick-filter, and sort snapshot. |
| `setFilterModel(model)` | Replaces filters, quick filter, and sort order. Pass `null` to clear them. |
| `setTextFilter(field, text)` | Sets text filter. |
| `setSelectedValues(field, values)` | Sets allowed values, or `null` for all. |
| `setSort(field, sort)` | Sets sort and clears sort on other fields. |
| `reapplyFilters()` | Applies active filters and sorts to rows inserted since the last explicit reapply. |
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

### FirstDataRenderedEvent

`firstDataRendered` fires once per grid component, after the first completed render that contains
real datasource rows. If the datasource starts empty, the event waits until rows are supplied.
Server-side loading placeholders do not trigger it.

```html
<agrid [provider]="provider" (firstDataRendered)="onGridReady($event)" />
```

```ts
interface FirstDataRenderedEvent<T> {
  rows: readonly T[];
  rowCount: number;
  provider: AgridProvider<T>;
  datasource: AgridDataSource<T>;
}
```

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
  selectedValues?: readonly string[] | null;
  operator?: FilterOperator | null;
  operand?: string | null;
  operand2?: string | null;
}
```

An empty `value` clears the server-side text filter. `selectedValues: null` clears a value-list
filter. Condition filters include `operator`, `operand`, and `operand2`.

### AgridServerQuery

```ts
interface AgridServerQuery {
  filters: Readonly<Record<string, ColumnFilter>>;
  sort: readonly { field: string; direction: 'asc' | 'desc' }[];
  quickFilter: string;
  page: number;
  pageSize: number;
  startRow: number;
  endRow: number; // inclusive
}
```

Emitted by `(serverQueryChange)` and published as `provider.serverQuery`.

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

### CellSelectEvent

```ts
interface CellSelectEvent<T> {
  position: CellPosition;
  row: T;
  originalIndex: number;
  field: keyof T;
  value: T[keyof T];
  column: ColDef<T>;
}
```

`cellSelect` emits `null` when selection is cleared. Use `grid.getCurrentCell()` to read the same
shape on demand.

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

### RowUpdateEvent

```ts
interface RowUpdateEvent<T extends object = Record<string, unknown>> {
  row: T;
  originalIndex: number;
}
```

`rowChanged` carries the latest complete datasource row and its current zero-based index. Inline
edits are grouped until the active row is left. Sidebar-only editing emits the same event when the
Save button is clicked.

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
| Page Up / Page Down | Move by the number of complete rows visible in the viewport. |
| Home / End (Pos1 / Ende) | Move to the first / last cell in the current row. |
| Ctrl/Cmd+Home / Ctrl/Cmd+End | Move to the first / last cell in the projected grid. |
| Tab / Shift+Tab | Move right / left, wrapping rows. |
| Enter | Start editing the active cell. |
| Enter while editing | Commit and follow `enterEditAction` (`nextRow` by default). |
| Ctrl/Cmd+Enter | Toggle an expandable tree node. |
| F2 | Start editing active cell. |
| Printable key | Start editing active cell with typed seed character. |
| Escape | Close any open menu, cancel edit, or close find when its input is focused. |
| Ctrl/Cmd+Z | Undo. |
| Ctrl/Cmd+Y | Redo. |
| Ctrl/Cmd+Shift+Z | Redo. |
| Ctrl/Cmd+F | Open find panel. |
| Enter in find | Next match. |
| Shift+Enter in find | Previous match. |

Opening find clears the active cell so typing remains in the find input. Tree searches include
collapsed descendants; navigating to one expands its ancestor path before scrolling to the match.
| Click cell | Select cell. |
| Shift+click cell | Extend range selection. |
| Drag across cells | Select a rectangular range; dragging beyond the viewport auto-scrolls. |
| Double-click cell | Start editing. |
| Drag fill handle | Fill selected value/range down or right. |
| Double-click resize handle | Autosize column. |
| Drag resize handle | Resize column. |
| Drag header | Reorder columns when `control` is provided. |
| Right-click control cell | Open row context menu. |

## Filtering, Sorting, And Grouping

- A filter row appears when at least one visible column has `filterable: true`.
- Text filter and value picker are combined.
- Sorting supports single-column, multi-column, or disabled modes through `sortOption`.
- Date columns sort chronologically by raw value, not alphabetically by display string.
- `ColDef.comparator` can override client-side sorting for domain-specific values.
- Grouping is enabled per column with `groupable: true`.
- Group state is controlled through `AgridControl.setGroupBy(field | null)`.
- `expandGroups()` and `collapseGroups()` can be called on the component.

```ts
const severityRank: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const columns: ColDef<Issue>[] = [
  {
    field: 'severity',
    header: 'Severity',
    comparator: ({ valueA, valueB }) =>
      severityRank[String(valueA)] - severityRank[String(valueB)],
  },
];
```

The comparator always describes ascending order. The grid applies descending direction afterward,
and a `0` result preserves the existing row order for that sort key.

## Clipboard, Range Selection, And Fill

- Copy exports the active cell or selected rectangular range as TSV.
- With `enableRowMarking`, clicking a row header outside its nested controls or using its checkbox toggles the mark and emits `rowMark`.
- With `showRowNumbers`, the control column displays 1-based row numbers for the current filtered and sorted row order instead of the drag-handle glyph.
- Marked rows are appended to every copy using the copied columns.
- Copying without an active cell copies all visible columns from the marked rows.
- Context-menu `Copy cell` and `Copy row` also include marked rows without duplicates.

### Selection status bar

Selecting a numeric cell or rectangular range shows a status bar beneath the grid body with Count,
Sum, Average, Minimum, and Maximum. It updates immediately when the range, projected rows, columns,
or datasource values change and hides when the selection contains no numeric values.

Actual finite numbers are included in every column. Numeric strings are included only when their
column declares `type: 'number'`, preventing IDs and numeric-looking text from being aggregated by
accident. Group headers, detail panels, loading rows, blanks, `NaN`, and infinite values are skipped.

The raw values are also available programmatically:

```ts
const summary = grid.selectionSummary();
// { count, sum, average, min, max } | null
```

The dedicated `/selection-summary` demo shows Shift+click and drag selection across comparable
regional revenue columns and mirrors the raw signal above the grid.
- Row marking is independent from row selection.
- Marked rows remain part of copy output when filters hide them.
- Paste accepts TSV or CSV-like plain text and writes from the active cell.
- Pasted values use labels/raw values for `values` columns.
- Number columns coerce numeric pasted values to `number`.
- Paste skips read-only columns.
- Fill repeats the selected source block into the dragged target area.
- Paste and fill are each one undo history item.

## Master/Detail and Pinned Rows

### Master/detail

Set `masterDetail: true` and provide a `detailRenderer` to make every data row expandable. A chevron
appears in the control column; clicking it reveals a detail panel rendered beneath the row. The
renderer returns an HTML string (sanitized automatically, like `cellRenderer`).

```ts
readonly provider = new AgridProvider<Order>({
  columns, datasource,
  masterDetail: true,
  detailRowHeight: 160, // fixed panel height in px (default 200)
  detailColumnField: 'notes',
  detailActions: [
    { id: 'follow-up', label: 'Follow-up', text: '\nFollow-up required.' },
    { id: 'customer', label: 'Customer', text: ({ row }) => `\nCustomer: ${row.customer}` },
  ],
  detailRenderer: ({ row }) => `<div class="order-detail">${row.notes}</div>`,
});
```

`detailColumnField` is optional. When set, the panel shows that column's formatted value below the
custom renderer. If the linked cell is editable, click or Enter opens a multiline textarea. Blur or
Ctrl/Cmd+Enter commits through normal validation, undo history, `cellEdit`, and `recordEdit` flows;
Escape cancels. `detailActions` can add text-template buttons above the textarea; buttons insert at
the current selection, or append when the editor is opened by the button. `editable: false`,
`cellReadonly`, and grid read-only mode are respected.

Detail panels are sized by a built-in variable-height virtual-scroll strategy, so large lists stay
performant whether or not panels are open. In tree mode, only leaf rows expose detail panels;
parent rows continue to control tree expansion. Master/detail remains disabled while grouping.
Toggle a panel imperatively with the public
`toggleDetail(originalIndex)` / `isDetailExpanded(originalIndex)` methods on the component.

### Pinned rows

`pinRow` designates rows to keep fixed at the top or bottom of the body during vertical scroll —
ideal for header or total/summary rows. Pinned rows are pulled out of grouping and pagination but
keep their real data-source index, so editing, selection, and cell rendering work on them unchanged.

```ts
readonly provider = new AgridProvider<Order>({
  columns, datasource, // datasource includes a summary row
  pinRow: row => (row.isSummary ? 'bottom' : undefined),
});
```

**Interactive pinning.** Right-click any row (its cell context menu, or the control-cell row menu)
to **Pin row to top / bottom** or **Unpin row**. A runtime override always wins over the `pinRow`
predicate, so a user can unpin a declaratively-pinned row. Drive it programmatically with the
public component methods `pinRowTo(originalIndex, 'top' | 'bottom' | null)` and
`rowPinState(originalIndex)`.

> Pinned rows are designated over existing data-source rows (not a separate detached array).
> Keyboard arrow-navigation and range-selection do not currently cross the body↔pinned boundary.

### Row CSS classes

`getRowClass` returns class names for a whole data row, complementing the per-cell `ColDef.cellClass`:

```ts
getRowClass: ({ row }) => (row.status === 'overdue' ? 'row-danger' : '')
```

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
| `--agrid-color-text` | `#24292f` | Primary text color. Also used by `agrid-tree`. |
| `--agrid-color-text-muted` | `#57606a` | Secondary / placeholder text. Also used by `agrid-tree`. |
| `--agrid-color-accent` | `#1a73e8` | Selection, focus, and active state color. |
| `--agrid-color-border` | `#d0d7de` | Cell and header borders. |
| `--agrid-color-bg` | `#ffffff` | Cell background. |
| `--agrid-color-bg-subtle` | `#fafbfc` | Control column background. |
| `--agrid-color-bg-muted` | `#f6f8fa` | Header and hover background. |
| `--agrid-color-bg-stripe` | `#f0f2f5` | Zebra stripe background (even rows). |
| `--agrid-color-cell-changed` | `#f59e0b` | Corner marker for changed cells. |
| `--agrid-color-row-marked` | `#fff8c5` | Background for rows marked for clipboard inclusion. |
| `--agrid-color-column-marked` | `#e8f0fe` | Background for marked columns. |

## Development

```bash
pnpm install
pnpm start
pnpm build          # publishable package
pnpm build:demo
pnpm copy:local     # uncompiled runtime sources in localdist/agrid
pnpm test
pnpm test:e2e
pnpm test:performance
```

The TypeScript compile check:

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
```

The Playwright suite starts the Angular demo server automatically and runs the grid interaction
tests in Chromium. Install its browser once when setting up a new environment:

```bash
pnpm exec playwright install chromium
```

`pnpm test:performance` runs the isolated large-dataset suite serially against 10k, 50k, 100k,
and 250k rows. It reports initial render, filtering, sorting, grouping, aggregation, row updates,
and virtual-scroll timings without enforcing machine-dependent thresholds. The same operations can
be run manually at `/performance`.

`pnpm build:lib` increments the package patch version and creates the publishable Angular package
in `dist/agrid-package`. Inspect the package
contents with:

```bash
cd dist/agrid-package
npm pack --dry-run
```

`pnpm copy:local` recreates `localdist/agrid` with only the library's runtime `.ts`, `.html`, and
`.css` files. Tests, documentation, licenses, package metadata, and build configuration are
excluded, making the directory suitable for source-level debugging in another Angular workspace.
