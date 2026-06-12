# @thkl/agrid

A signal-based, standalone data grid for Angular 21 with virtual scrolling, editing,
filtering, sorting, grouping, pinned columns, selection, clipboard operations, and pagination.

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
  { field: 'name', header: 'Name', filterable: true },
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
