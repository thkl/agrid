import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  AgridTransactionResult,
  ColDef,
  RowClickEvent,
} from '../agrid';

interface DealRow {
  id: number;
  customer: string;
  status: 'New' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
  owner: string;
  value: number;
  updatedAt: string;
}

const STATUSES: DealRow['status'][] = ['New', 'Qualified', 'Proposal', 'Won', 'Lost'];
const OWNERS = ['Ava', 'Milan', 'Noor', 'Jonas'];

const initialRows: DealRow[] = [
  { id: 501, customer: 'Northstar Labs', status: 'New', owner: 'Ava', value: 48000, updatedAt: '2026-09-01' },
  { id: 502, customer: 'Keller Foods', status: 'Qualified', owner: 'Milan', value: 76000, updatedAt: '2026-09-02' },
  { id: 503, customer: 'Orbit Systems', status: 'Proposal', owner: 'Noor', value: 112000, updatedAt: '2026-09-03' },
  { id: 504, customer: 'Hafen Retail', status: 'Won', owner: 'Jonas', value: 94000, updatedAt: '2026-09-04' },
  { id: 505, customer: 'Sable Health', status: 'Lost', owner: 'Ava', value: 58000, updatedAt: '2026-09-05' },
];

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const columns: ColDef<DealRow>[] = [
  { field: 'id', header: 'ID', width: 82, type: 'number', editable: false, locked: true },
  { field: 'customer', header: 'Customer', width: 210, filterable: true },
  { field: 'status', header: 'Status', width: 130, values: STATUSES, filterable: true },
  { field: 'owner', header: 'Owner', width: 120, values: OWNERS, filterable: true },
  {
    field: 'value',
    header: 'Value',
    width: 130,
    type: 'number',
    textAlign: 'right',
    formatter: (value: unknown) => currency.format(Number(value ?? 0)),
  },
  { field: 'updatedAt', header: 'Updated', width: 125, type: 'date', editable: false },
];

@Component({
  selector: 'demo-transactions',
  standalone: true,
  imports: [AgridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h1>Transaction API</h1>
          <p>Batch add, update, and remove rows through one datasource write.</p>
        </div>
        <div class="actions">
          <button type="button" (click)="applyBatch()">Apply batch</button>
          <button type="button" (click)="updateSelected()">Update selected</button>
          <button type="button" (click)="removeLost()">Remove lost</button>
          <button type="button" class="secondary" (click)="reset()">Reset</button>
        </div>
      </header>

      <section class="content">
        <agrid
          class="demo-grid"
          [provider]="provider"
          (rowClick)="selectRow($event)"
        />

        <aside class="result-panel">
          <div class="panel-title">PATCH /api/deals</div>
          <pre>{{ patchPayload() }}</pre>
          <div class="result-counts">
            <span>Added {{ result()?.added?.length ?? 0 }}</span>
            <span>Updated {{ result()?.updated?.length ?? 0 }}</span>
            <span>Removed {{ result()?.removed?.length ?? 0 }}</span>
          </div>
        </aside>
      </section>
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
      gap: 16px;
    }

    h1 { margin: 0; font-size: 20px; line-height: 1.2; }
    p { margin: 4px 0 0; color: #57606a; font-size: 13px; }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    button {
      height: 32px;
      border: 1px solid #0969da;
      border-radius: 6px;
      background: #0969da;
      color: #fff;
      padding: 0 10px;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
    }

    button.secondary {
      border-color: #d0d7de;
      background: #fff;
      color: #24292f;
    }

    .content {
      display: grid;
      flex: 1 1 auto;
      min-height: 0;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 12px;
    }

    .demo-grid {
      min-height: 0;
      height: 100%;
    }

    .result-panel {
      display: flex;
      min-width: 0;
      min-height: 0;
      flex-direction: column;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      background: #f6f8fa;
      overflow: hidden;
    }

    .panel-title {
      padding: 10px 12px;
      border-bottom: 1px solid #d0d7de;
      color: #24292f;
      font-size: 12px;
      font-weight: 700;
    }

    pre {
      flex: 1 1 auto;
      min-height: 0;
      margin: 0;
      padding: 12px;
      overflow: auto;
      color: #24292f;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.45;
      white-space: pre-wrap;
    }

    .result-counts {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-top: 1px solid #d0d7de;
      background: #fff;
      color: #57606a;
      font-size: 11px;
    }

    .result-counts span {
      padding: 8px;
      text-align: center;
      border-right: 1px solid #d0d7de;
    }

    .result-counts span:last-child { border-right: 0; }

    :host-context(.dark-theme) p { color: #9ca3af; }
    :host-context(.dark-theme) button.secondary {
      border-color: #30363d;
      background: #161b22;
      color: #e5e7eb;
    }
    :host-context(.dark-theme) .result-panel {
      border-color: #30363d;
      background: #0d1117;
    }
    :host-context(.dark-theme) .panel-title,
    :host-context(.dark-theme) pre {
      border-color: #30363d;
      color: #e5e7eb;
    }
    :host-context(.dark-theme) .result-counts {
      border-color: #30363d;
      background: #161b22;
      color: #9ca3af;
    }
    :host-context(.dark-theme) .result-counts span { border-color: #30363d; }

    @media (max-width: 900px) {
      .demo-header {
        align-items: stretch;
        flex-direction: column;
      }
      .actions { justify-content: flex-start; }
      .content {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(360px, 1fr) 240px;
      }
    }
  `],
})
export class TransactionsDemoComponent {
  private nextId = 506;

  readonly datasource = new AgridDataSource<DealRow>(initialRows);
  readonly control = new AgridControl();
  readonly selectedIndex = signal(0);
  readonly result = signal<AgridTransactionResult<DealRow> | null>(null);
  readonly provider = new AgridProvider<DealRow>({
    columns,
    datasource: this.datasource,
    control: this.control,
    getRowId: row => row.id,
    showSidebar: true,
    enableQuickFilter: true,
    rowSelection: 'single',
    zebraStripes: true,
    showChangedCellIndicator: true,
  });

  readonly patchPayload = computed(() => {
    const updated = this.result()?.updated ?? [];
    return updated.length
      ? JSON.stringify(updated, null, 2)
      : '[]';
  });

  selectRow(event: RowClickEvent<DealRow>): void {
    this.selectedIndex.set(event.originalIndex);
  }

  applyBatch(): void {
    const today = this.today();
    const result = this.datasource.applyTransaction({
      update: [
        { id: 502, changes: { status: 'Proposal', value: 84000, updatedAt: today } },
        { id: 503, changes: { owner: 'Ava', value: 118000, updatedAt: today } },
      ],
      remove: [{ id: 505 }],
      add: [this.newDeal('Vector Works', 'Qualified', 67000)],
      addIndex: 1,
    });
    this.markUpdated(result, ['status', 'owner', 'value', 'updatedAt']);
    this.result.set(result);
  }

  updateSelected(): void {
    const row = this.datasource.getRow(this.selectedIndex());
    if (!row) return;
    const nextStatus = STATUSES[(STATUSES.indexOf(row.status) + 1) % STATUSES.length];
    const result = this.datasource.applyTransaction({
      update: [{
        id: row.id,
        changes: {
          status: nextStatus,
          value: row.value + 5000,
          updatedAt: this.today(),
        },
      }],
    });
    this.markUpdated(result, ['status', 'value', 'updatedAt']);
    this.result.set(result);
  }

  removeLost(): void {
    const result = this.datasource.applyTransaction({
      remove: this.datasource.rows()
        .filter(row => row.status === 'Lost')
        .map(row => ({ id: row.id })),
    });
    this.result.set(result);
  }

  reset(): void {
    this.nextId = 506;
    this.datasource.setData(initialRows);
    this.selectedIndex.set(0);
    this.control.clearChangedCells();
    this.result.set(null);
  }

  private newDeal(customer: string, status: DealRow['status'], value: number): DealRow {
    const id = this.nextId++;
    return {
      id,
      customer,
      status,
      owner: OWNERS[id % OWNERS.length],
      value,
      updatedAt: this.today(),
    };
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private markUpdated(result: AgridTransactionResult<DealRow>, fields: string[]): void {
    for (const index of result.updateIndexes) {
      for (const field of fields) this.control.markChangedCell(index, field);
    }
  }
}
