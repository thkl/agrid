import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import {
  AGRID_FILTER_CONTEXT,
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  AgridServerQuery,
  ColDef,
  ColumnFilter,
} from '../agrid';
import { applyQuickFilter, applySortToIndices, applyTextAndValueFilters } from '../agrid/agrid.utils';

interface FilterLabRow {
  id: number;
  reference: string;
  customer: string;
  region: 'North' | 'South' | 'East' | 'West';
  channel: 'Direct' | 'Partner' | 'Web' | 'Retail';
  status: 'New' | 'Qualified' | 'Won' | 'Lost';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  owner: string;
  amount: number;
  margin: number;
  createdAt: string;
  dueDate: string;
  paid: boolean;
}

const REGIONS: FilterLabRow['region'][] = ['North', 'South', 'East', 'West'];
const CHANNELS: FilterLabRow['channel'][] = ['Direct', 'Partner', 'Web', 'Retail'];
const STATUSES: FilterLabRow['status'][] = ['New', 'Qualified', 'Won', 'Lost'];
const PRIORITIES: FilterLabRow['priority'][] = ['Low', 'Medium', 'High', 'Urgent'];
const OWNERS = Array.from({ length: 180 }, (_, index) => `Owner ${String(index + 1).padStart(3, '0')}`);
const CUSTOMERS = [
  'Acme Systems',
  'Globex Europe',
  'Initech Labs',
  'Umbrella Health',
  'Stark Industries',
  'Wayne Logistics',
  'Cyberdyne Retail',
  'Hooli Cloud',
  'Vought Media',
  'Soylent Foods',
];

function makeRows(count: number): FilterLabRow[] {
  return Array.from({ length: count }, (_, index) => {
    const created = new Date(2024, (index * 5) % 12, (index * 7) % 28 + 1);
    const due = new Date(created);
    due.setDate(created.getDate() + 7 + (index * 3) % 46);
    return {
      id: index + 1,
      reference: `REQ-${String(index + 1).padStart(5, '0')}`,
      customer: CUSTOMERS[(index * 3) % CUSTOMERS.length],
      region: REGIONS[index % REGIONS.length],
      channel: CHANNELS[(index + Math.floor(index / 5)) % CHANNELS.length],
      status: STATUSES[(index + Math.floor(index / 9)) % STATUSES.length],
      priority: PRIORITIES[(index * 2 + Math.floor(index / 7)) % PRIORITIES.length],
      owner: OWNERS[(index * 17) % OWNERS.length],
      amount: 1_250 + ((index * 947) % 48_000),
      margin: -12 + ((index * 7) % 43),
      createdAt: created.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      paid: index % 3 !== 0,
    };
  });
}

const COLUMNS: ColDef<FilterLabRow>[] = [
  { field: 'id', header: 'ID', width: 68, editable: false, locked: true, pinned: 'left' },
  { field: 'reference', header: 'Reference', width: 118, editable: false, filterable: true },
  { field: 'customer', header: 'Customer', width: 160, editable: false, filterable: true },
  { field: 'region', header: 'Region', width: 104, editable: false, filterable: true, values: REGIONS },
  { field: 'channel', header: 'Channel', width: 112, editable: false, filterable: true, values: CHANNELS },
  { field: 'status', header: 'Status', width: 118, editable: false, filterable: true, values: STATUSES },
  { field: 'priority', header: 'Priority', width: 112, editable: false, filterable: true, values: PRIORITIES },
  {
    field: 'owner',
    header: 'Owner',
    width: 116,
    editable: false,
    filterable: true,
    values: OWNERS,
    filterValueLimit: 40,
  },
  {
    field: 'amount',
    header: 'Amount',
    width: 120,
    editable: false,
    type: 'number',
    filterable: true,
    formatter: value => `$${Number(value).toLocaleString()}`,
  },
  {
    field: 'margin',
    header: 'Margin %',
    width: 104,
    editable: false,
    type: 'number',
    filterable: true,
    formatter: value => `${Number(value) > 0 ? '+' : ''}${value}%`,
  },
  { field: 'createdAt', header: 'Created', width: 116, editable: false, type: 'date', filterable: true },
  { field: 'dueDate', header: 'Due', width: 116, editable: false, type: 'date', filterable: true },
  {
    field: 'paid',
    header: 'Paid',
    width: 86,
    editable: false,
    type: 'boolean',
    filterable: true,
    values: [
      { value: true, label: 'Paid' },
      { value: false, label: 'Open' },
    ],
  },
];

@Component({
  selector: 'demo-priority-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="priority-filter" aria-label="Priority presets">
      <button type="button" (click)="set(['High', 'Urgent'])">High risk</button>
      <button type="button" (click)="set(['Urgent'])">Urgent</button>
      <button type="button" (click)="ctx.clear()">Reset</button>
    </div>
  `,
  styles: [`
    .priority-filter {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    button {
      min-height: 28px;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      background: #fff;
      color: #24292f;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
    }
    button:hover { background: #f6f8fa; }
  `],
})
class PriorityFilterComponent {
  readonly ctx = inject(AGRID_FILTER_CONTEXT);

  set(values: string[]): void {
    const current = this.ctx.filter();
    this.ctx.setFilter({ ...current, selectedValues: values });
  }
}

(COLUMNS.find(column => column.field === 'priority') as ColDef<FilterLabRow>).filterComponent = PriorityFilterComponent;

const ALL_ROWS = makeRows(360);
const FILTER_COLUMNS = COLUMNS as unknown as ColDef[];
const COLUMN_MAP = new Map<string, ColDef>(FILTER_COLUMNS.map(column => [column.field, column]));

@Component({
  selector: 'demo-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h2>Filter coverage</h2>
          <p>Text, values, conditions, dates, numbers, booleans, quick search, sorting, and pages through one server query.</p>
        </div>
        <div class="stats">
          <span>{{ matchCount().toLocaleString() }} matching</span>
          <span>{{ ds.length }} loaded</span>
          <span>Page {{ ctrl.currentPage() }} / {{ totalPages() }}</span>
        </div>
      </header>

      <section class="filter-strip" aria-label="Filter coverage">
        <span>Text: Reference, Customer</span>
        <span>Values: Region, Channel, Status, Priority</span>
        <span>Number: Amount, Margin</span>
        <span>Date: Created, Due</span>
        <span>Boolean: Paid</span>
        <span>Quick filter enabled</span>
        <span>Owner list capped at 40 matches</span>
      </section>

      <section class="state-actions" aria-label="Filter state">
        <label>
          <input type="checkbox" [checked]="externalHighValueOnly()" (change)="toggleExternalFilter($any($event.target).checked)" />
          High-value external filter
        </label>
        <button type="button" (click)="saveFilterState()">Save filters</button>
        <button type="button" (click)="restoreFilterState()">Restore filters</button>
        <button type="button" (click)="clearSavedFilterState()">Clear saved</button>
        <span>{{ savedStateLabel() }}</span>
      </section>

      <agrid class="demo-grid" [provider]="provider" />

      <footer class="query-bar">
        <span class="query-label">Server query</span>
        <span>{{ querySummary() }}</span>
      </footer>
    </main>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .demo-wrap {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      gap: 10px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .demo-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
    }

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }

    p {
      max-width: 720px;
      margin: 3px 0 0;
      color: #57606a;
      font-size: 12px;
      line-height: 1.45;
    }

    .stats,
    .filter-strip,
    .state-actions,
    .query-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }

    .stats {
      justify-content: flex-end;
      min-width: 250px;
    }

    .stats span,
    .filter-strip span {
      border: 1px solid #d0d7de;
      border-radius: 999px;
      background: #f6f8fa;
      color: #3b434d;
      font-size: 11px;
      font-weight: 650;
      line-height: 1;
      padding: 5px 9px;
      white-space: nowrap;
    }

    .filter-strip {
      padding: 8px 10px;
      border: 1px solid #d8dee4;
      border-radius: 8px;
      background: #ffffff;
    }

    .state-actions {
      min-height: 34px;
      padding: 8px 10px;
      border: 1px solid #d8dee4;
      border-radius: 8px;
      background: #ffffff;
      color: #3b434d;
      font-size: 12px;
    }

    .state-actions label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 650;
    }

    .state-actions button {
      min-height: 26px;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      background: #f6f8fa;
      color: #24292f;
      font: inherit;
      font-weight: 650;
      cursor: pointer;
      padding: 0 9px;
    }

    .filter-strip span:nth-child(1),
    .filter-strip span:nth-child(6) {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .filter-strip span:nth-child(2) {
      border-color: #bbf7d0;
      background: #f0fdf4;
      color: #15803d;
    }

    .filter-strip span:nth-child(3),
    .filter-strip span:nth-child(4) {
      border-color: #fde68a;
      background: #fffbeb;
      color: #92400e;
    }

    .filter-strip span:nth-child(5) {
      border-color: #e9d5ff;
      background: #faf5ff;
      color: #7e22ce;
    }

    .demo-grid {
      flex: 1;
      min-height: 0;
    }

    .query-bar {
      min-height: 34px;
      padding: 8px 10px;
      border: 1px solid #d8dee4;
      border-radius: 8px;
      background: #f6f8fa;
      color: #57606a;
      font-size: 12px;
    }

    .query-label {
      color: #24292f;
      font-weight: 700;
    }

    :host-context(.app-shell--dark) p,
    :host-context(.app-shell--dark) .query-bar {
      color: var(--app-text-muted);
    }

    :host-context(.app-shell--dark) .stats span,
    :host-context(.app-shell--dark) .filter-strip span,
    :host-context(.app-shell--dark) .state-actions button {
      border-color: var(--app-border);
      background: var(--app-surface-muted);
      color: var(--app-text);
    }

    :host-context(.app-shell--dark) .filter-strip,
    :host-context(.app-shell--dark) .state-actions,
    :host-context(.app-shell--dark) .query-bar {
      border-color: var(--app-border);
      background: var(--app-surface);
    }

    :host-context(.app-shell--dark) .state-actions {
      color: var(--app-text);
    }

    :host-context(.app-shell--dark) .query-label {
      color: var(--app-text);
    }

    :host-context(.app-shell--dark) .filter-strip span:nth-child(1),
    :host-context(.app-shell--dark) .filter-strip span:nth-child(6) {
      border-color: #255f94;
      background: #112b43;
      color: #8ecbff;
    }

    :host-context(.app-shell--dark) .filter-strip span:nth-child(2) {
      border-color: #2f6842;
      background: #132a1d;
      color: #86efac;
    }

    :host-context(.app-shell--dark) .filter-strip span:nth-child(3),
    :host-context(.app-shell--dark) .filter-strip span:nth-child(4) {
      border-color: #7c5c17;
      background: #2f240d;
      color: #facc15;
    }

    :host-context(.app-shell--dark) .filter-strip span:nth-child(5) {
      border-color: #6b3fa0;
      background: #2a173f;
      color: #d8b4fe;
    }

    @media (max-width: 780px) {
      .demo-header {
        align-items: flex-start;
        flex-direction: column;
        gap: 8px;
      }

      .stats {
        justify-content: flex-start;
      }
    }
  `],
})
export class FiltersDemoComponent {
  private readonly storageKey = 'agrid-filter-demo-model';
  readonly ds = new AgridDataSource<FilterLabRow>([]);
  readonly ctrl = new AgridControl({ pageSize: 25 });
  readonly externalHighValueOnly = signal(false);
  readonly savedStateLabel = signal(this.hasSavedFilterState() ? 'Saved filter model available' : 'No saved filter model');
  readonly provider = new AgridProvider<FilterLabRow>({
    columns: COLUMNS,
    datasource: this.ds,
    control: this.ctrl,
    serverSideFiltering: true,
    enableQuickFilter: true,
    filterDebounceMs: 0,
    sortOption: 'multi',
    showRowNumbers: true,
    zebraStripes: true,
    emptyText: 'No rows match the active filters',
    externalFilter: ({ row }) => !this.externalHighValueOnly() || row.amount >= 25_000,
  });
  readonly grid = viewChild(AgridComponent<FilterLabRow>);
  readonly matchCount = signal(ALL_ROWS.length);
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.matchCount() / Math.max(1, this.ctrl.pageSize()))),
  );
  readonly querySummary = computed(() => {
    const query = this.provider.serverQuery();
    if (!query) return 'Waiting for grid query';
    const filterCount = Object.values(query.filters).filter(filter => isActiveFilter(filter)).length;
    const sort = query.sort.map(entry => `${entry.field}:${entry.direction}`).join(', ') || 'none';
    const quick = query.quickFilter ? `"${query.quickFilter}"` : 'none';
    const extFilter :string[] = [];
    Object.keys(query.filters).forEach(field=>{
      const f = query.filters[field];
      const ft = `${field} ${f.operator} ${f.operand} ${f.operand2}`
      extFilter.push(ft);
    })
    return `${filterCount} column filters · quick ${quick} · detail ${(extFilter.length > 0) ? extFilter.join(","):'none'} · sort ${sort} · rows ${query.startRow}-${query.endRow} `;
  });

  constructor() {
    effect(() => {
      const query = this.provider.serverQuery();
      if (!query) return;
      this.applyQuery(query);
    });
  }

  private applyQuery(query: AgridServerQuery): void {
    const rows = ALL_ROWS as unknown as Record<string, unknown>[];
    let indices = rows.map((_, index) => index);
    indices = applyTextAndValueFilters(rows, indices, query.filters as Record<string, ColumnFilter>, COLUMN_MAP);
    indices = applyQuickFilter(rows, indices, query.quickFilter, FILTER_COLUMNS);
    if (this.externalHighValueOnly()) {
      indices = indices.filter(index => ALL_ROWS[index].amount >= 25_000);
    }
    const sortEntries = query.sort.map(entry => [
      entry.field,
      { ...(query.filters[entry.field] ?? defaultFilter()), sort: entry.direction },
    ] as [string, ColumnFilter]);
    indices = applySortToIndices(rows, indices, sortEntries, COLUMN_MAP);

    this.matchCount.set(indices.length);
    if (query.page > 1 && query.startRow >= indices.length && indices.length > 0) {
      this.ctrl.setPage(1);
      return;
    }

    this.ctrl.setTotalRows(indices.length);
    const pageIndices = indices.slice(query.startRow, query.endRow + 1);
    this.ds.setData(pageIndices.map(index => ALL_ROWS[index]));
  }

  toggleExternalFilter(value: boolean): void {
    this.externalHighValueOnly.set(value);
  }

  saveFilterState(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.ctrl.getFilterModel()));
    this.savedStateLabel.set('Saved filter model to local storage');
  }

  restoreFilterState(): void {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) {
      this.savedStateLabel.set('No saved filter model');
      return;
    }
    this.ctrl.setFilterModel(JSON.parse(saved));
    this.savedStateLabel.set('Restored filter model from local storage');
  }

  clearSavedFilterState(): void {
    localStorage.removeItem(this.storageKey);
    this.savedStateLabel.set('No saved filter model');
  }

  private hasSavedFilterState(): boolean {
    return typeof localStorage !== 'undefined' && localStorage.getItem(this.storageKey) !== null;
  }
}

function defaultFilter(): ColumnFilter {
  return { text: '', selectedValues: null, sort: null };
}

function isActiveFilter(filter: ColumnFilter): boolean {
  return !!filter.text
    || filter.selectedValues !== null
    || (!!filter.operator && filter.operand != null && filter.operand !== '');
}
