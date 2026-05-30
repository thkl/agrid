import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AgridComponent, AgridDataSource, ColDef, GridEditEvent, NewRecord } from '../agrid';

const COLUMNS: ColDef[] = [
  { field: 'id', header: 'ID', width: 70, editable: false },
  { field: 'firstName', header: 'First Name', width: 140 },
  { field: 'lastName', header: 'Last Name', width: 140 },
  { field: 'email', header: 'Email', width: 240 },
  { field: 'department', header: 'Department', width: 130 },
  { field: 'salary', header: 'Salary', width: 100, type: 'number' },
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
    department: DEPARTMENTS[i % DEPARTMENTS.length],
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
        <span class="demo-meta">{{ ds.rows().length.toLocaleString() }} rows · 6 columns</span>
        <label class="demo-toggle">
          <input type="checkbox" [checked]="autoAdd()" (change)="autoAdd.set(!autoAdd())" />
          autoAddRows
        </label>
      </div>
      <agrid
        class="demo-grid"
        [colDefs]="columns"
        [dataSource]="ds"
        [allowAddRows]="true"
        [autoAddRows]="autoAdd()"
        (cellEdit)="onEdit($event)"
        (prepareAddRecord)="onPrepareAdd($event)"
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
  readonly ds = new AgridDataSource(generateRows(10));
  readonly lastEdit = signal('');
  readonly autoAdd = signal(false);

  onEdit(event: GridEditEvent): void {
    this.lastEdit.set(
      `Edited row ${event.position.rowIndex + 1} · "${event.field}": ${JSON.stringify(event.oldValue)} → ${JSON.stringify(event.newValue)}`
    );
  }

  onPrepareAdd(event: NewRecord): void {
    // Grid already inserted the blank row — optionally fill it with defaults here.
    // Example: assign the next id based on current length.
    const next = this.ds.length;
    this.ds.patchRow(event.index, { id: next });
    this.lastEdit.set(`Row ${next} added at index ${event.index} — navigate to it and edit`);
  }
}
