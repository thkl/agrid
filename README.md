# agrid

`agrid` is an Angular data grid with spreadsheet-like editing, virtual scrolling, filtering, sorting, grouping, column state, pinned columns, selection, clipboard workflows, and row operations.

## Quick Start

```ts
import { Component } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef, GridEditEvent } from './agrid';

const columns: ColDef[] = [
  { field: 'id', header: 'ID', width: 70, editable: false, pinned: 'left' },
  { field: 'name', header: 'Name', width: 160, filterable: true },
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
    <agrid
      [colDefs]="columns"
      [dataSource]="ds"
      [control]="gridControl"
      [showControlColumn]="true"
      [showSidebar]="true"
      [rowSelection]="'multi'"
      (cellEdit)="onCellEdit($event)"
    />
  `,
})
export class PageComponent {
  readonly columns = columns;
  readonly ds = new AgridDataSource([
    { id: 1, name: 'Alice', departmentId: 1 },
    { id: 2, name: 'Bob', departmentId: 2 },
  ]);
  readonly gridControl = new AgridControl({ allowRowReorder: true });

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

## Component API

Use the component as:

```html
<agrid
  [colDefs]="columns"
  [dataSource]="ds"
  [control]="gridControl"
/>
```

### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `colDefs` | `ColDef[]` | `[]` | Column definitions. Order controls display order unless `AgridControl.columnOrder` is set. |
| `rowHeight` | `number` | `32` | Fixed row height in pixels. Required by CDK virtual scroll. |
| `minHeight` | `string \| undefined` | `undefined` | CSS min-height for the virtual body. Example: `'200px'`. |
| `maxHeight` | `string \| undefined` | `undefined` | CSS max-height for the virtual body. Example: `'500px'`. |
| `dataSource` | `AgridDataSource` | `new AgridDataSource()` | Signal-based row container. |
| `control` | `AgridControl \| null` | `null` | Optional UI state controller for widths, filters, sort, grouping, visibility, pinning, row reorder, and undo/redo. |
| `allowAddRows` | `boolean` | `false` | Shows a `+ Add row` placeholder at the bottom when `autoAddRows` is false. |
| `autoAddRows` | `boolean` | `false` | Automatically inserts a blank row when navigation moves past the last real row. |
| `showControlColumn` | `boolean` | `false` | Shows a 24 px control column for row actions and row drag handles. |
| `showSidebar` | `boolean` | `false` | Shows a collapsible column visibility sidebar. Requires `control`. |
| `rowSelection` | `'single' \| 'multi' \| 'none'` | `'none'` | Enables row selection behavior. |
| `groupDescription` | `((label: string) => string) \| null` | `null` | Optional description text shown next to each group label. |
| `groupActions` | `GroupAction[]` | `[]` | Actions shown in each group header menu. |

### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `cellEdit` | `GridEditEvent` | Emitted after a committed cell edit, paste, fill, undo, or redo changes a cell. |
| `rowRemoved` | `RowRemovedEvent` | Emitted after deleting a row through the control column context menu. |
| `prepareAddRecord` | `NewRecord` | Emitted after the grid inserts a blank row. Use it to patch defaults. |
| `rowReorder` | `RowReorderEvent` | Emitted after the user drops a reordered row. The host must call `dataSource.moveRow()`. |
| `rowSelect` | `RowSelectEvent \| null` | Emitted when row selection changes. `null` means selection was cleared. |

### Public Component Methods

These can be called through `viewChild(AgridComponent)`.

| Method | Description |
| --- | --- |
| `exportCsv(filename = 'export.csv')` | Downloads visible, filtered data rows as CSV using display values. Group headers are excluded. |
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
| `canUndo` | `Signal<boolean>` | Whether Ctrl/Cmd+Z can undo an edit. Requires `control`. |
| `canRedo` | `Signal<boolean>` | Whether redo is available. Requires `control`. |
| `filteredRowCount` | `Signal<number>` | Count of currently visible data rows, or grouped row total. |

## Column Definitions

`ColDef` describes one column.

```ts
interface ColDef {
  field: string;
  header: string;
  width: number;
  type?: 'text' | 'number' | 'date';
  editable?: boolean;
  values?: string[] | ValueOption[];
  formatter?: (value: unknown) => string;
  filterable?: boolean;
  groupable?: boolean;
  hidden?: boolean;
  pinned?: 'left';
}
```

| Property | Required | Description |
| --- | --- | --- |
| `field` | Yes | Key in each row object. |
| `header` | Yes | Header label shown in the grid. |
| `width` | Yes | Default width in pixels. Runtime widths can override it. |
| `type` | No | Semantic type. `number` initializes blank rows with `0`; `date` is reserved for future typed editors. |
| `editable` | No | Set to `false` for read-only cells. Defaults to editable. |
| `values` | No | Fixed editor/filter values. Use `string[]` or `{ value, label }[]`. |
| `formatter` | No | Display formatter for cells without `values`. |
| `filterable` | No | Enables text filter and value picker for the column. |
| `groupable` | No | Enables "group by" in the column menu. |
| `hidden` | No | Hides the column on first render. Seeded into `AgridControl` when provided. |
| `pinned` | No | Use `'left'` to pin the column initially. Seeded into `AgridControl` when provided. |

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

## AgridDataSource

`AgridDataSource<T>` is a signal-based row container shared by the host and grid.

```ts
const ds = new AgridDataSource<Record<string, unknown>>([
  { id: 1, name: 'Alice' },
]);
```

| Member | Description |
| --- | --- |
| `rows` | Readonly Angular `Signal<T[]>` of current rows. |
| `setData(rows)` | Replaces all rows with a shallow copy. |
| `updateRow(index, row)` | Replaces one row. |
| `patchRow(index, patch)` | Merges a partial row update. |
| `addRow(row, atIndex?)` | Inserts a row and returns the inserted index. |
| `removeRow(index)` | Removes a row. |
| `moveRow(from, to)` | Moves a row using insert-before semantics. |
| `getRow(index)` | Returns a non-reactive row snapshot. |
| `length` | Current row count. |

## AgridControl

`AgridControl` stores optional grid UI state and behavior. Pass it to `[control]` to enable persisted state, filters, sort, grouping, visibility, pinning, row reorder, and undo/redo.

```ts
const control = new AgridControl({
  allowRowReorder: true,
  hiddenColumns: ['salary'],
  pinnedColumns: ['id'],
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
| `pushEdit(entry)` | Adds one edit to undo history. Used by the grid. |
| `pushEditBatch(entries)` | Adds a multi-cell operation as one undo step. Used by paste/fill. |
| `undo()` | Returns a `HistoryItem` to reverse, or `null`. The grid applies it. |
| `redo()` | Returns a `HistoryItem` to reapply, or `null`. The grid applies it. |
| `clearHistory()` | Clears undo/redo history. |
| `toJSON()` | Serializes control state. |
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

Persisted state includes widths, filters, sort, grouping, hidden columns, column order, pinned columns, and row reorder setting.

## Development

```bash
pnpm install
pnpm start
pnpm build
```

The current Angular production build may fail if the component stylesheet exceeds the configured CSS budget. The TypeScript compile check can be run with:

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
```
