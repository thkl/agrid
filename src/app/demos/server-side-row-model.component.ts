import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
  AgridComponent,
  AgridControl,
  AgridProvider,
  AgridServerSideRequest,
  AgridServerSideResult,
  AgridServerSideRowModel,
  ColDef,
  ColumnFilter,
} from '../agrid';

interface ServerOrder {
  orderId: string;
  customer: string;
  region: string;
  status: string;
  amount: number;
  items: number;
  createdAt: string;
}

interface RequestLog {
  id: number;
  range: string;
  resultCount: number;
  total: number;
  query: string;
}

const DATA_PATH = 'demo/server-side-orders.json';
const BLOCK_SIZE = 50;
const TOTAL_ROWS = 2_000;

const COLUMNS: ColDef<ServerOrder>[] = [
  { field: 'orderId', header: 'Order', width: 125, editable: false, filterable: true },
  { field: 'customer', header: 'Customer', width: 155, editable: false, filterable: true },
  {
    field: 'region',
    header: 'Region',
    width: 100,
    editable: false,
    filterable: true,
    values: ['North', 'South', 'East', 'West'],
  },
  {
    field: 'status',
    header: 'Status',
    width: 115,
    editable: false,
    filterable: true,
    values: ['Shipped', 'Pending', 'Cancelled', 'Processing', 'Delivered'],
  },
  {
    field: 'amount',
    header: 'Amount',
    width: 105,
    type: 'number',
    editable: false,
    filterable: true,
    formatter: value => `$${Number(value).toFixed(2)}`,
  },
  { field: 'items', header: 'Items', width: 80, type: 'number', editable: false, filterable: true },
  { field: 'createdAt', header: 'Created', width: 115, type: 'date', editable: false, filterable: true },
];

@Component({
  selector: 'demo-server-side-row-model',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <main class="demo-wrap">
      <header>
        <div>
          <h1>Server-side row model</h1>
          <p>Scroll to load 50-row blocks. Filters and sorting invalidate the block cache.</p>
        </div>
        <div class="status" [attr.data-loading]="rowModel.loading()">
          <span class="status-dot"></span>
          {{ rowModel.loading() ? 'Loading block' : 'Idle' }}
        </div>
      </header>

      <section class="controls" aria-label="Server-side row model controls">
        <button type="button" (click)="purgeCache()">Purge cache</button>
        <button type="button" (click)="refreshPreserveScroll()">Refresh, preserve scroll</button>
        <button type="button" (click)="refreshResetScroll()">Refresh, reset scroll</button>
        <button type="button" (click)="failNextBlock()">Fail next block</button>
        <button type="button" [disabled]="rowModel.failedBlockIndices().length === 0" (click)="retryFailedBlock()">
          Retry failed block
        </button>
      </section>

      <section class="source-card" aria-label="Demo data source">
        <span>Static GitHub Pages source</span>
        <a [href]="dataUrl" target="_blank" rel="noopener">{{ dataUrl }}</a>
        <small>
          GitHub Pages cannot run an API, so this adapter fetches the JSON asset and evaluates each
          range/filter/sort request before returning the requested block.
        </small>
      </section>

      <div class="content">
        <agrid class="demo-grid" [provider]="provider" />

        <aside aria-label="Recent server requests">
          <div class="aside-title">
            <strong>Requests</strong>
            <span>{{ requestCount() }} total</span>
          </div>
          @if (rowModel.error()) {
            <div class="request-error">Failed to load the static dataset.</div>
          }
          @for (request of requests(); track request.id) {
            <article>
              <div><strong>#{{ request.id }}</strong> rows {{ request.range }}</div>
              <span>{{ request.resultCount }} returned · {{ request.total }} matching</span>
              <small>{{ request.query }}</small>
            </article>
          } @empty {
            <p class="empty-log">Waiting for the first viewport request…</p>
          }
        </aside>
      </div>
    </main>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .demo-wrap {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: 20px; }
    header p { margin: 4px 0 0; color: #57606a; font-size: 13px; }
    .status {
      display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto;
      padding: 5px 9px; border: 1px solid #d0d7de; border-radius: 999px; font-size: 12px;
    }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #1a7f37; }
    .status[data-loading='true'] .status-dot { background: #bf8700; }
    .source-card {
      display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 12px;
      padding: 10px 12px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa;
      font-size: 12px;
    }
    .controls {
      display: flex; flex-wrap: wrap; gap: 8px;
      padding: 9px 10px; border: 1px solid #d0d7de; border-radius: 6px; background: #fff;
    }
    .controls button {
      min-height: 28px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa;
      color: #24292f; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; padding: 0 9px;
    }
    .controls button:disabled { color: #8c959f; cursor: not-allowed; }
    .source-card > span { font-weight: 650; }
    .source-card a { overflow: hidden; color: #0969da; text-overflow: ellipsis; white-space: nowrap; }
    .source-card small { grid-column: 1 / -1; color: #57606a; }
    .content { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 12px; flex: 1; min-height: 0; }
    .demo-grid { min-width: 0; min-height: 0; }
    aside { overflow: auto; border: 1px solid #d0d7de; border-radius: 6px; background: #fff; }
    .aside-title {
      position: sticky; top: 0; z-index: 1; display: flex; justify-content: space-between;
      padding: 10px 11px; border-bottom: 1px solid #d0d7de; background: #f6f8fa; font-size: 12px;
    }
    .aside-title span { color: #57606a; }
    article { display: grid; gap: 3px; padding: 9px 11px; border-bottom: 1px solid #d8dee4; font-size: 12px; }
    article > span, article small { color: #57606a; }
    article small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty-log, .request-error { margin: 0; padding: 12px; color: #57606a; font-size: 12px; }
    .request-error { color: #cf222e; }
    :host-context(.app-shell--dark) .source-card,
    :host-context(.app-shell--dark) .aside-title { background: #161b22; border-color: #30363d; }
    :host-context(.app-shell--dark) .controls { background: #0d1117; border-color: #30363d; }
    :host-context(.app-shell--dark) .controls button { background: #161b22; border-color: #30363d; color: #c9d1d9; }
    :host-context(.app-shell--dark) aside { background: #0d1117; border-color: #30363d; }
    :host-context(.app-shell--dark) article { border-color: #30363d; }
    :host-context(.app-shell--dark) .status { border-color: #30363d; }
    @media (max-width: 800px) {
      .content { grid-template-columns: 1fr; grid-template-rows: minmax(360px, 1fr) auto; }
      aside { max-height: 220px; }
      .source-card { grid-template-columns: 1fr; }
      .source-card small { grid-column: auto; }
    }
  `],
})
export class ServerSideRowModelDemoComponent {
  readonly grid = viewChild(AgridComponent<ServerOrder>);
  readonly dataUrl = new URL(DATA_PATH, document.baseURI).href;
  readonly control = new AgridControl();
  readonly requests = signal<RequestLog[]>([]);
  readonly requestCount = signal(0);
  readonly failNextRequest = signal(false);

  private rowsPromise: Promise<ServerOrder[]> | null = null;

  readonly rowModel = new AgridServerSideRowModel<ServerOrder>({
    blockSize: BLOCK_SIZE,
    maxBlocksInCache: 6,
    initialRowCount: TOTAL_ROWS,
    datasource: {
      getRows: request => this.loadBlock(request),
    },
  });

  readonly provider = new AgridProvider<ServerOrder>({
    columns: COLUMNS,
    control: this.control,
    serverSideRowModel: this.rowModel,
    enableQuickFilter: true,
    filterDebounceMs: 180,
    sortOption: 'multi',
    zebraStripes: true,
    emptyText: 'No matching orders',
  });

  private async loadBlock(
    request: AgridServerSideRequest,
  ): Promise<AgridServerSideResult<ServerOrder>> {
    const id = this.requestCount() + 1;
    this.requestCount.set(id);
    const source = await this.loadRows();
    await delay(180);
    if (this.failNextRequest()) {
      this.failNextRequest.set(false);
      throw new Error(`Demo failure for rows ${request.startRow}-${request.endRow - 1}`);
    }

    let rows = source.filter(row => matchesRequest(row, request));
    if (request.sort.length) rows = [...rows].sort((left, right) => compareRows(left, right, request));

    const result = rows.slice(request.startRow, request.endRow);
    const query = describeRequest(request);
    this.requests.update(items => [{
      id,
      range: `${request.startRow}–${Math.max(request.startRow, request.endRow - 1)}`,
      resultCount: result.length,
      total: rows.length,
      query,
    }, ...items].slice(0, 12));

    return { rows: result, rowCount: rows.length };
  }

  private loadRows(): Promise<ServerOrder[]> {
    this.rowsPromise ??= fetch(this.dataUrl).then(response => {
      if (!response.ok) throw new Error(`Dataset request failed: ${response.status}`);
      return response.json() as Promise<ServerOrder[]>;
    });
    return this.rowsPromise;
  }

  purgeCache(): void {
    this.grid()?.refreshServerSideRows({ purge: true });
  }

  refreshPreserveScroll(): void {
    this.grid()?.refreshServerSideRows({ purge: false, resetScroll: false });
  }

  refreshResetScroll(): void {
    this.grid()?.refreshServerSideRows({ purge: true, resetScroll: true });
  }

  failNextBlock(): void {
    this.failNextRequest.set(true);
    this.grid()?.refreshServerSideRows({ purge: true });
  }

  retryFailedBlock(): void {
    this.rowModel.retryFailedBlock();
  }
}

function matchesRequest(row: ServerOrder, request: AgridServerSideRequest): boolean {
  if (request.quickFilter) {
    const query = request.quickFilter.toLowerCase();
    if (!Object.values(row).some(value => String(value).toLowerCase().includes(query))) return false;
  }

  return Object.entries(request.filters).every(([field, filter]) =>
    matchesFilter(row[field as keyof ServerOrder], filter)
  );
}

function matchesFilter(value: unknown, filter: ColumnFilter): boolean {
  const display = String(value ?? '');
  if (filter.text && !display.toLowerCase().includes(filter.text.toLowerCase())) return false;
  if (filter.selectedValues && !filter.selectedValues.includes(display)) return false;
  if (!filter.operator || filter.operand == null || filter.operand === '') return true;

  const left = comparable(value);
  const right = comparable(filter.operand);
  const upper = comparable(filter.operand2);
  switch (filter.operator) {
    case 'eq': return left === right;
    case 'neq': return left !== right;
    case 'gt': return left > right;
    case 'gte': return left >= right;
    case 'lt': return left < right;
    case 'lte': return left <= right;
    case 'between': return left >= right && left <= upper;
    case 'startsWith': return display.toLowerCase().startsWith(filter.operand.toLowerCase());
    case 'endsWith': return display.toLowerCase().endsWith(filter.operand.toLowerCase());
    case 'notIncludes': return !display.toLowerCase().includes(filter.operand.toLowerCase());
    case 'like':
    case 'includes': return display.toLowerCase().includes(filter.operand.toLowerCase());
  }
}

function compareRows(
  left: ServerOrder,
  right: ServerOrder,
  request: AgridServerSideRequest,
): number {
  for (const sort of request.sort) {
    const a = left[sort.field as keyof ServerOrder];
    const b = right[sort.field as keyof ServerOrder];
    const result = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true });
    if (result !== 0) return sort.direction === 'asc' ? result : -result;
  }
  return 0;
}

function comparable(value: unknown): number | string {
  if (value == null) return '';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value).toLowerCase() : numeric;
}

function describeRequest(request: AgridServerSideRequest): string {
  const activeFilters = Object.entries(request.filters)
    .filter(([, filter]) => filter.text || filter.selectedValues || filter.operator)
    .map(([field]) => field);
  const parts = [
    activeFilters.length ? `filter: ${activeFilters.join(', ')}` : '',
    request.quickFilter ? `quick: “${request.quickFilter}”` : '',
    request.sort.length
      ? `sort: ${request.sort.map(item => `${item.field} ${item.direction}`).join(', ')}`
      : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'no filter or sort';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
