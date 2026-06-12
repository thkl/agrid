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

  readonly persistenceCode = `const saved = localStorage.getItem('agrid-state');
const control = AgridControl.fromJSON(saved ? JSON.parse(saved) : {});

localStorage.setItem('agrid-state', JSON.stringify(control.toJSON()));`;

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
