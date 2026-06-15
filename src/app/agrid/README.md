# @thkl/agrid

A signal-based, standalone data grid for Angular 21 with virtual scrolling, editing,
filtering, sorting, grouping, tree data, pinned columns, selection, clipboard operations,
and pagination.

## Install

```bash
npm install @thkl/agrid @angular/cdk
```

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

`enableRowMarking` adds a checkbox to each control cell. Marked rows are included in keyboard,
cell-context, and row-context copy operations. Read `grid.markedRowIndices()` or call
`grid.clearMarkedRows()` when the host needs to inspect or reset the copy basket.

Marking is independent from row selection. Cell and range copy use the same copied columns for
every marked row, while Copy row uses every visible column. Duplicate rows are omitted, and marked
rows remain included when filters hide them.

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

## Condition filters

Mark a column `filterable: true` and its column menu gains a **condition** filter in addition to
the value picker. Text columns offer equals, not equal, like, starts with, ends with, includes, and
does not include. Numbers offer `=`, `≠`, `>`, `≥`, `<`, `≤`, and `between`; dates offer on /
before / after / between. Conditions combine with the header text filter, value picker, and other
columns using AND semantics, and are included in `AgridControl.toJSON()` state.

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

## Server-side filtering

With `serverSideFiltering: true` the grid never filters locally — it emits events so the host can
refetch:

- `(filterChange)` — header text filters emit `{ field, value }`; menu conditions emit
  `{ field, value: '', operator, operand, operand2 }` (operator `null` clears the condition).
- `(sortChange)` — `{ field, direction }`.
- `(quickFilterChange)` — the quick-filter text (debounced by `filterDebounceMs`).

```html
<agrid [provider]="provider"
  (filterChange)="onFilter($event)"
  (sortChange)="onSort($event)"
  (quickFilterChange)="onQuickFilter($event)" />
```

Text/range/quick events are debounced by `filterDebounceMs` (default 300 ms; `0` disables). The
Excel-style value picker stays client-only and is hidden in this mode.

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
};

readonly provider = new AgridProvider<OrgRow>({
  columns,
  datasource: new AgridDataSource(rows),
  treeConfig,
});
```

For path-like values such as `01.01.0001`, return the ordered segments:

```ts
const treeConfig: AgridTreeConfig<Row> = {
  getPath: row => row.oz.split('.'),
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
use the first row encountered for that raw path prefix.

The `treeField` column shows an indented expand/collapse twisty. Filtering and sorting behave as
in a flat grid; with `keepAncestorsOnFilter` (default `true`) a match deep in the tree keeps its
parents visible and force-opens the path to it. Tree mode takes precedence over grouping and
disables pagination. Call `grid.expandAllNodes()` / `grid.collapseAllNodes()` to toggle the whole
tree.

Tree mode can be combined with `masterDetail: true` and a `detailRenderer`. Detail expanders are
shown only for leaf rows; parent rows retain their tree expand/collapse control.

## Saving edited rows

Use `rowChanged` to send one request after the user edits one or more fields in a row:

```html
<agrid [provider]="provider" (rowChanged)="saveRow($event)" />
```

```ts
saveRow(event: RowUpdateEvent<Person>): void {
  this.http.patch(`/api/people/${event.row.id}`, event.row).subscribe(() => {
    this.grid()?.clearChangedCells(event.originalIndex);
  });
}
```

The event fires with the latest complete row when inline navigation leaves that row, or when the
sidebar editor Save button is used. `cellEdit` and `recordEdit` remain available for every committed
field change. With `showChangedCellIndicator: true`, changed cells keep a corner marker until the
PATCH succeeds. Override `--agrid-color-cell-changed` to customize its color.

Full documentation and demos: https://thkl.github.io/agrid/
