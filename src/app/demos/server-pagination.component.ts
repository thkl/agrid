import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  signal,
  viewChild,
} from '@angular/core';
import {
  AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef, FilterChangeEvent,
  PageChangeEvent, SortChangeEvent,
} from '@thkl/agrid';
import { escapeRendererText, rendererClassSuffix } from './demo-renderer.utils';

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
  return `<span class="demo-badge demo-badge--${rendererClassSuffix(value)}">${escapeRendererText(value)}</span>`;
}

const COLUMNS: ColDef[] = [
  { field: 'orderId',   header: 'Order',    width: 120, editable: false, filterable: true },
  { field: 'customer',  header: 'Customer', width: 140, editable: false, filterable: true },
  { field: 'amount',    header: 'Amount',   width: 110, editable: false, filterable: true, formatter: v => `$${Number(v).toFixed(2)}` },
  { field: 'status',    header: 'Status',   width: 120, editable: false, filterable: true, cellRenderer: ({ value }) => statusBadge(String(value)) },
  { field: 'createdAt', header: 'Date',     width: 120, editable: false, filterable: true },
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
        (filterChange)="onFilter($event)"
        (sortChange)="onSort($event)"
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
    :host ::ng-deep .demo-badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #e9ecef; color: #495057; }
    :host ::ng-deep .demo-badge--shipped, :host ::ng-deep .demo-badge--delivered { background: #d4edda; color: #155724; }
    :host ::ng-deep .demo-badge--pending { background: #fff3cd; color: #856404; }
    :host ::ng-deep .demo-badge--processing { background: #d1ecf1; color: #0c5460; }
    :host ::ng-deep .demo-badge--cancelled { background: #f8d7da; color: #721c24; }
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
    serverSideFiltering: true,
    sortOption: 'single',
  });

  readonly lastFetch = signal('');
  readonly _grid = viewChild(AgridComponent);
  private readonly filters = new Map<string, string>();
  private readonly sorts = new Map<string, 'asc' | 'desc'>();
  private requestSequence = 0;

  constructor() {
    this.ctrl.setTotalRows(TOTAL_ROWS);
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }

  onPageChange(event: PageChangeEvent): void {
    this.loadPage(event.page, event.pageSize);
  }

  onFilter(event: FilterChangeEvent): void {
    if (event.value) this.filters.set(event.field, event.value);
    else this.filters.delete(event.field);
    this.reloadFirstPage();
  }

  onSort(event: SortChangeEvent): void {
    if (event.direction) this.sorts.set(event.field, event.direction);
    else this.sorts.delete(event.field);
    this.reloadFirstPage();
  }

  private reloadFirstPage(): void {
    if (this.ctrl.currentPage() === 1) this.loadPage(1, PAGE_SIZE);
    else this.ctrl.setPage(1);
  }

  private loadPage(page: number, pageSize: number): void {
    const request = ++this.requestSequence;
    this.provider.loading.set(true);
    setTimeout(() => {
      if (request !== this.requestSequence) return;
      let rows = ALL_ROWS.filter(row =>
        [...this.filters].every(([field, value]) =>
          String(row[field as keyof typeof row] ?? '').toLowerCase().includes(value.toLowerCase())
        )
      );
      const sortOrder = this.ctrl.sortOrder().filter(field => this.sorts.has(field));
      if (sortOrder.length) {
        rows = [...rows].sort((a, b) => {
          for (const field of sortOrder) {
            const left = a[field as keyof typeof a];
            const right = b[field as keyof typeof b];
            const result = String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true });
            if (result !== 0) return this.sorts.get(field) === 'asc' ? result : -result;
          }
          return 0;
        });
      }
      this.ctrl.setTotalRows(rows.length);
      const startRow = (page - 1) * pageSize;
      const endRow = Math.min(startRow + pageSize, rows.length);
      this.ds.setData(rows.slice(startRow, endRow));
      this.provider.loading.set(false);
      this.lastFetch.set(`rows ${startRow}–${Math.max(startRow, endRow - 1)} (page ${page}/${Math.max(1, Math.ceil(rows.length / pageSize))})`);
    }, 180);
  }
}
