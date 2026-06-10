# @thkl/agrid

A signal-based, standalone data grid for Angular 21 with virtual scrolling, editing,
filtering, sorting, grouping, pinned columns, selection, clipboard operations, and pagination.

## Install

```bash
npm install @thkl/agrid @angular/cdk
```

## Usage

```ts
import { Component } from '@angular/core';
import {
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  ColDef,
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
  readonly provider = new AgridProvider<Person>({
    columns,
    datasource: new AgridDataSource([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]),
    control: new AgridControl(),
  });
}
```

Full documentation and demos: https://thkl.github.io/agrid/
