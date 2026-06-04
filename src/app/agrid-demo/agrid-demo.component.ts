import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef, GridEditEvent, GroupAction, NewRecord, RowReorderEvent, RowSelectEvent } from '../agrid';

const COLUMNS: ColDef[] = [
  { field: 'id', header: 'ID', width: 70, editable: false},
  { field: 'firstName', header: 'First Name', width: 140, filterable: true },
  { field: 'lastName', header: 'Last Name', width: 140, filterable: true  ,groupable: true},
  { field: 'email', header: 'Email', width: 240 },
  { field: 'departmentId', header: 'Department', width: 130, filterable: true, groupable: true,
    values: [
      { value: 1, label: 'Engineering' },
      { value: 2, label: 'Sales' },
      { value: 3, label: 'Marketing' },
      { value: 4, label: 'HR' },
      { value: 5, label: 'Finance' },
      { value: 6, label: 'Design' },
      { value: 7, label: 'Operations' },
    ]
  },
  { field: 'salary', header: 'Salary', width: 100, type: 'number', filterable: true, hidden:true },
];

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson'];
const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Design', 'Operations'];

function generateRows(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[i % LAST_NAMES.length],
    email: `user${i + 1}@example.com`,
    departmentId: (i % DEPARTMENTS.length) + 1,  // numeric ID, displayed as label via ValueOption
    salary: 50000 + ((i * 137) % 100000),
  }));
}

@Component({
  selector: 'agrid-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrapper">
      <div class="demo-header">
        <h2>agrid</h2>
        <span class="demo-meta">
          @if (filteredRowCount() !== ds.rows().length) {
            {{ filteredRowCount().toLocaleString() }} of
          }
          {{ ds.rows().length.toLocaleString() }} rows · 6 columns
        </span>
        <label class="demo-toggle">
          <input type="checkbox" [checked]="autoAdd()" (change)="autoAdd.set(!autoAdd())" />
          autoAddRows
        </label>
        <label class="demo-toggle">
          <input type="checkbox" [checked]="isGrouped()" (change)="toggleGroup($any($event.target).checked)" />
          groupByDept
        </label>
        @if (isGrouped()) {
          <button class="demo-btn" (click)="_grid()?.expandGroups()">Expand All</button>
          <button class="demo-btn" (click)="_grid()?.collapseGroups()">Collapse All</button>
        }
        <button class="demo-btn" (click)="_grid()?.exportCsv()">Export CSV</button>
      </div>
      <agrid
        class="demo-grid"
        [colDefs]="columns"
        [dataSource]="ds"
        [allowAddRows]="true"
        [autoAddRows]="autoAdd()"
        [showControlColumn]="true"
        [showSidebar]="true"
        [rowSelection]="'multi'"
        [control]="gridControl"
        [groupDescription]="groupDescriptionFn"
        [groupActions]="groupActionsList"
        (cellEdit)="onEdit($event)"
        (prepareAddRecord)="onPrepareAdd($event)"
        (rowReorder)="onRowReorder($event)"
        (rowSelect)="onRowSelect($event)"
      />
      <div class="demo-footer">
        @if (lastEdit()) {
          <span class="edit-log">{{ lastEdit() }}</span>
        } @else {
          <span class="edit-hint">Press Enter or F2 to edit · Tab to confirm and move right · Escape to cancel</span>
        }
      </div>
    </div>
  `,
  styles: `
    .demo-wrapper {
      padding: 16px;
      height: 100vh;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .demo-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }

    .demo-meta {
      font-size: 13px;
      color: #57606a;
    }

    .demo-toggle {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #57606a;
      cursor: pointer;
      user-select: none;
    }

    .demo-btn {
      font-size: 12px;
      color: #57606a;
      background: none;
      border: 1px solid #d0d7de;
      border-radius: 4px;
      padding: 2px 8px;
      cursor: pointer;
      font-family: inherit;
    }

    .demo-btn:hover {
      background: #f6f8fa;
      border-color: #57606a;
    }

    .demo-grid {
      flex: 1;
      min-height: 0;
    }

    .demo-footer {
      font-size: 12px;
      min-height: 20px;
    }

    .edit-log {
      color: #1a73e8;
      font-weight: 500;
    }

    .edit-hint {
      color: #57606a;
    }
  `,
})
export class AgridDemoComponent {
  readonly columns = COLUMNS;
  readonly ds = new AgridDataSource(generateRows(50));
  readonly gridControl = new AgridControl({ allowRowReorder: true });
  readonly lastEdit = signal('');
  readonly autoAdd = signal(false);
  readonly isGrouped = computed(() => this.gridControl.groupByField() === 'departmentId');

  readonly groupDescriptionFn = (label: string): string => {
    const count = this.ds.rows().filter(r => {
      const dept = DEPARTMENTS[Number(r['departmentId']) - 1];
      return dept === label;
    }).length;
    return `${count} ${count === 1 ? 'employee' : 'employees'}`;
  };

  readonly groupActionsList: GroupAction[] = [
    {
      label: 'Filter to this group',
      action: (label: string) => {
        this.gridControl.setSelectedValues('departmentId',
          COLUMNS.find(c => c.field === 'departmentId')?.values
            ?.filter(v => (typeof v === 'string' ? v : v.label) === label)
            .map(v => String(typeof v === 'string' ? v : v.value)) ?? null
        );
        this.lastEdit.set(`Filtered to department: ${label}`);
      },
    },
    {
      label: 'Clear group filter',
      action: (_label: string) => {
        this.gridControl.clearFilter('departmentId');
        this.lastEdit.set('Department filter cleared');
      },
    },
  ];

  // Safe: returns undefined before view init, then reacts once the grid is live
  readonly _grid = viewChild(AgridComponent);
  readonly filteredRowCount = computed(() => this._grid()?.filteredRowCount() ?? this.ds.length);

  onEdit(event: GridEditEvent): void {
    this.lastEdit.set(
      `Edited row ${event.position.rowIndex + 1} · "${event.field}": ${JSON.stringify(event.oldValue)} → ${JSON.stringify(event.newValue)}`
    );
  }

  onPrepareAdd(event: NewRecord): void {
    // Grid already inserted the blank row — optionally fill it with defaults here.
    // Example: assign the next id based on current length.
    const next = this.ds.length;
    this.ds.patchRow(event.index, { id: next, departmentId: 1 });
    this.lastEdit.set(`Row ${next} added at index ${event.index} — navigate to it and edit`);
  }

  onRowReorder(event: RowReorderEvent): void {
    this.ds.moveRow(event.oldIndex, event.newIndex);
    this.lastEdit.set(`Row moved from position ${event.oldIndex + 1} to ${event.newIndex + 1}`);
  }

  onRowSelect(event: RowSelectEvent | null): void {
    if (!event || event.rows.length === 0) {
      this.lastEdit.set('Selection cleared');
    } else if (event.rows.length === 1) {
      this.lastEdit.set(`Row ${event.rows[0].originalIndex + 1} selected`);
    } else {
      this.lastEdit.set(`${event.rows.length} rows selected`);
    }
  }

  toggleGroup(checked: boolean): void {
    this.gridControl.setGroupBy(checked ? 'departmentId' : null);
  }
}
