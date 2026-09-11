import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  ColDef,
  RowUpdateEvent,
} from '../agrid';

interface InvoiceRow {
  id: number;
  customer: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  owner: string;
  amount: number;
  dueDate: string;
}

const STATUSES: InvoiceRow['status'][] = ['Draft', 'Sent', 'Paid', 'Overdue'];
const OWNERS = ['Ava', 'Milan', 'Noor', 'Jonas'];

const rows: InvoiceRow[] = [
  { id: 9001, customer: 'Northstar Labs', status: 'Draft', owner: 'Ava', amount: 4200, dueDate: '2026-09-18' },
  { id: 9002, customer: 'Keller Foods', status: 'Sent', owner: 'Milan', amount: 8300, dueDate: '2026-09-22' },
  { id: 9003, customer: 'Orbit Systems', status: 'Paid', owner: 'Noor', amount: 12800, dueDate: '2026-09-28' },
  { id: 9004, customer: 'Hafen Retail', status: 'Overdue', owner: 'Jonas', amount: 6100, dueDate: '2026-09-08' },
];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const columns: ColDef<InvoiceRow>[] = [
  { field: 'id', header: 'ID', width: 88, type: 'number', editable: false, locked: true },
  {
    field: 'customer',
    header: 'Customer',
    width: 210,
    validate: (value: unknown) => String(value).trim() ? null : 'Required',
  },
  { field: 'status', header: 'Status', width: 130, values: STATUSES, filterable: true },
  { field: 'owner', header: 'Owner', width: 120, values: OWNERS },
  {
    field: 'amount',
    header: 'Amount',
    width: 120,
    type: 'number',
    textAlign: 'right',
    formatter: (value: unknown) => money.format(Number(value ?? 0)),
    validate: (value: unknown) => Number(value) > 0 ? null : 'Must be positive',
  },
  { field: 'dueDate', header: 'Due date', width: 130, type: 'date' },
];

@Component({
  selector: 'demo-row-editing',
  standalone: true,
  imports: [AgridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h1>Full-row editing</h1>
          <p>Use the row action to edit several fields, then save one complete updated record.</p>
        </div>
        <div class="demo-state">
          {{ patchPayload() }}
        </div>
      </header>

      <agrid class="demo-grid" [provider]="provider" (rowChanged)="onRowChanged($event)" />
    </main>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      height: 100%;
    }

    .demo-wrap {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      gap: 12px;
      padding: 16px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .demo-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 18px;
    }

    h1 { margin: 0; font-size: 20px; line-height: 1.2; }
    p { margin: 4px 0 0; color: #57606a; font-size: 13px; }

    .demo-state {
      max-width: min(620px, 50vw);
      padding: 8px 10px;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      background: #f6f8fa;
      color: #24292f;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .demo-grid {
      flex: 1 1 auto;
      min-height: 360px;
    }

    :host-context(.dark-theme) p { color: #9ca3af; }
    :host-context(.dark-theme) .demo-state {
      border-color: #30363d;
      background: #161b22;
      color: #e5e7eb;
    }

    @media (max-width: 760px) {
      .demo-header {
        align-items: stretch;
        flex-direction: column;
      }
      .demo-state {
        max-width: none;
        white-space: normal;
      }
      .demo-grid { min-height: 420px; }
    }
  `],
})
export class RowEditingDemoComponent {
  readonly datasource = new AgridDataSource<InvoiceRow>(rows);
  readonly lastSaved = signal<InvoiceRow | null>(null);
  readonly provider = new AgridProvider<InvoiceRow>({
    columns,
    datasource: this.datasource,
    control: new AgridControl(),
    getRowId: row => row.id,
    editMode: 'row',
    showControlColumn: true,
    showChangedCellIndicator: true,
    enableQuickFilter: true,
    zebraStripes: true,
  });

  readonly patchPayload = computed(() => {
    const row = this.lastSaved();
    return row ? `PATCH /api/invoices [${JSON.stringify(row)}]` : 'PATCH /api/invoices []';
  });

  onRowChanged(event: RowUpdateEvent<InvoiceRow>): void {
    this.lastSaved.set(event.row);
  }
}
