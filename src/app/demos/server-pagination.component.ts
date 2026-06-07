import { ChangeDetectionStrategy, Component, afterNextRender, signal, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef, PageChangeEvent } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';

const TOTAL_ROWS = 1_000;
const PAGE_SIZE  = 20;
const STATUSES   = ['Shipped','Pending','Cancelled','Processing','Delivered'];
const CUSTOMERS  = ['Acme Corp','Globex','Initech','Umbrella','Stark Ind.',
                    'Wayne Ent.','Cyberdyne','Soylent','Hooli','Vought'];

function fakeRow(i: number) {
  return {
    orderId:   `ORD-${String(i + 1).padStart(5, '0')}`,
    customer:  CUSTOMERS[i % CUSTOMERS.length],
    amount:    19.99 + ((i * 317) % 9800) / 10,
    status:    STATUSES[i % STATUSES.length],
    createdAt: new Date(2023, (i * 3) % 12, (i * 7) % 28 + 1).toISOString(),
  };
}

const ALL_ROWS = Array.from({ length: TOTAL_ROWS }, (_, i) => fakeRow(i));

function statusBadge(value: string): string {
  const bg: Record<string, string> = { Shipped: '#d4edda', Delivered: '#d4edda', Pending: '#fff3cd', Processing: '#d1ecf1', Cancelled: '#f8d7da' };
  const fg: Record<string, string> = { Shipped: '#155724', Delivered: '#155724', Pending: '#856404', Processing: '#0c5460', Cancelled: '#721c24' };
  return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${bg[value] ?? '#e9ecef'};color:${fg[value] ?? '#495057'}">${value}</span>`;
}

const COLUMNS: ColDef[] = [
  { field: 'orderId',   header: 'Order',    width: 120, editable: false },
  { field: 'customer',  header: 'Customer', width: 140, editable: false },
  { field: 'amount',    header: 'Amount',   width: 110, editable: false, formatter: v => `$${Number(v).toFixed(2)}` },
  { field: 'status',    header: 'Status',   width: 120, editable: false, cellRenderer: ({ value }) => statusBadge(String(value)) },
  { field: 'createdAt', header: 'Date',     width: 120, editable: false },
];

@Component({
  selector: 'demo-server-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Server-side pagination</h2>
        <span class="demo-meta">{{ TOTAL_ROWS.toLocaleString() }} rows on server · {{ PAGE_SIZE }} per page</span>
        @if (lastFetch()) {
          <span class="fetch-info">Last fetch: {{ lastFetch() }}</span>
        }
      </div>
      <agrid
        class="demo-grid"
        [provider]="provider"
        (pageChange)="onPageChange($event)"
      />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .fetch-info { font-size: 11px; color: #1a73e8; margin-left: auto; }
    .demo-grid { flex: 1; min-height: 0; }
  `],
})
export class ServerPaginationDemoComponent {
  readonly TOTAL_ROWS = TOTAL_ROWS;
  readonly PAGE_SIZE  = PAGE_SIZE;

  readonly ds   = new AgridDataSource<Record<string, unknown>>([]);
  readonly ctrl = new AgridControl({ pageSize: PAGE_SIZE });
  readonly provider = new AgridProvider({
    columns: COLUMNS,
    datasource: this.ds,
    control: this.ctrl,
    zebraStripes: true,
    emptyText: 'No orders found',
  });

  readonly lastFetch = signal('');
  readonly _grid = viewChild(AgridComponent);

  constructor() {
    this.ctrl.setTotalRows(TOTAL_ROWS);
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }

  onPageChange(event: PageChangeEvent): void {
    this.provider.loading.set(true);
    setTimeout(() => {
      this.ds.setData(ALL_ROWS.slice(event.startRow, event.endRow + 1));
      this.provider.loading.set(false);
      this.lastFetch.set(`rows ${event.startRow}–${event.endRow} (page ${event.page}/${Math.ceil(TOTAL_ROWS / PAGE_SIZE)})`);
    }, 180);
  }
}
