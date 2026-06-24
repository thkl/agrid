import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  ColDef,
} from '../agrid';

interface BenchmarkResult {
  operation: string;
  durationMs: number;
}

const COLUMN_COUNTS = new Set([50, 100, 200, 400]);
const ROW_COUNT = 5_000;

/** Two pinned identity columns + N scrollable numeric metric columns. */
function createColumns(metricCount: number): ColDef[] {
  return [
    { field: 'id', header: 'ID', width: 70, editable: false, pinned: 'left', locked: true },
    { field: 'name', header: 'Name', width: 150, pinned: 'left', filterable: true },
    ...Array.from({ length: metricCount }, (_, i): ColDef => ({
      field: `m${i + 1}`,
      header: `Metric ${i + 1}`,
      width: 110,
      type: 'number',
      filterable: true,
      aggregate: i % 8 === 0 ? 'sum' : undefined,
    })),
  ];
}

function createRows(rowCount: number, metricCount: number): Record<string, unknown>[] {
  return Array.from({ length: rowCount }, (_, r) => {
    const row: Record<string, unknown> = { id: r + 1, name: `Row ${r % 1_000}` };
    for (let c = 1; c <= metricCount; c++) row[`m${c}`] = (r * 31 + c * 17) % 1000;
    return row;
  });
}

@Component({
  selector: 'demo-column-performance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent, RouterLink],
  template: `
    <main class="benchmark">
      <header>
        <div>
          <h1>Wide-grid benchmark</h1>
          <p>
            {{ rowCount.toLocaleString() }} rows × {{ metricCount() }} scrollable columns ·
            {{ filteredRowCount().toLocaleString() }} currently visible · column virtualization renders
            only the columns near the viewport
          </p>
        </div>
        <nav aria-label="Column count">
          <a routerLink="." [queryParams]="{ cols: 50 }">50 cols</a>
          <a routerLink="." [queryParams]="{ cols: 100 }">100 cols</a>
          <a routerLink="." [queryParams]="{ cols: 200 }">200 cols</a>
          <a routerLink="." [queryParams]="{ cols: 400 }">400 cols</a>
        </nav>
      </header>

      <section class="controls" aria-label="Benchmark operations">
        <button data-testid="filter" (click)="runFilter()">Filter last column</button>
        <button data-testid="clear" (click)="runClear()">Clear</button>
        <button data-testid="sort" (click)="runSort()">Sort last column</button>
        <button data-testid="multi-sort" (click)="runMultiSort()">Multi-sort</button>
        <button data-testid="aggregate" (click)="runAggregate()">Aggregate</button>
        <button data-testid="update-row" (click)="runRowUpdate()">Update row</button>
      </section>

      <output
        data-testid="benchmark-status"
        [attr.data-state]="benchmarkState()"
        [attr.data-operation]="lastOperation()"
        [attr.data-sequence]="sequence()"
        [attr.data-duration-ms]="lastDurationMs()"
      >
        {{ benchmarkState() }} · {{ lastOperation() }} · {{ lastDurationMs() }} ms
      </output>

      <agrid class="benchmark-grid" [provider]="provider" />

      <table>
        <thead>
          <tr><th>Operation</th><th>Duration</th></tr>
        </thead>
        <tbody>
          @for (result of results(); track $index) {
            <tr>
              <td>{{ result.operation }}</td>
              <td>{{ result.durationMs }} ms</td>
            </tr>
          }
        </tbody>
      </table>
    </main>
  `,
  styles: [`
    :host { display: block; height: 100vh; }
    .benchmark {
      box-sizing: border-box;
      display: grid;
      grid-template-rows: auto auto auto minmax(300px, 1fr) auto;
      gap: 10px;
      height: 100%;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: 20px; }
    p { margin: 4px 0 0; color: #57606a; font-size: 13px; max-width: 70ch; }
    nav, .controls { display: flex; flex-wrap: wrap; gap: 8px; }
    nav a, button {
      border: 1px solid #d0d7de;
      border-radius: 4px;
      padding: 5px 10px;
      color: #24292f;
      background: #f6f8fa;
      font: inherit;
      text-decoration: none;
      cursor: pointer;
    }
    output { color: #57606a; font-size: 12px; }
    .benchmark-grid { min-height: 0; }
    table { border-collapse: collapse; width: 320px; font-size: 12px; }
    th, td { border: 1px solid #d0d7de; padding: 4px 8px; text-align: left; }
  `],
})
export class ColumnPerformanceDemoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly requestedCols = Number(this.route.snapshot.queryParamMap.get('cols'));

  readonly rowCount = ROW_COUNT;
  readonly metricCount = signal(COLUMN_COUNTS.has(this.requestedCols) ? this.requestedCols : 100);
  readonly datasource = new AgridDataSource(createRows(ROW_COUNT, this.metricCount()));
  readonly control = new AgridControl();
  readonly provider = new AgridProvider({
    columns: createColumns(this.metricCount()),
    datasource: this.datasource,
    control: this.control,
    zebraStripes: true,
  });
  readonly grid = viewChild(AgridComponent);
  readonly filteredRowCount = computed(() => this.grid()?.filteredRowCount() ?? this.datasource.length);
  readonly benchmarkState = signal<'loading' | 'running' | 'ready'>('loading');
  readonly lastOperation = signal('initial-render');
  readonly lastDurationMs = signal(0);
  readonly sequence = signal(0);
  readonly results = signal<BenchmarkResult[]>([]);

  private lastField = `m${this.metricCount()}`;

  constructor() {
    const startedAt = performance.now();
    afterNextRender(() => this.finish('initial-render', startedAt));

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const requested = Number(params.get('cols'));
      const cols = COLUMN_COUNTS.has(requested) ? requested : 100;
      if (cols === this.metricCount()) return;

      this.metricCount.set(cols);
      this.lastField = `m${cols}`;
      this.control.clearAllFilters();
      this.provider.columns.set(createColumns(cols));
      this.datasource.setData(createRows(ROW_COUNT, cols));
    });
  }

  runFilter(): void {
    this.measure('filter', () => this.control.setTextFilter(this.lastField, '500'));
  }

  runClear(): void {
    this.measure('clear', () => this.control.clearAllFilters());
  }

  runSort(): void {
    this.measure('sort', () => this.control.setSort(this.lastField, 'desc'));
  }

  runMultiSort(): void {
    this.measure('multi-sort', () => {
      this.control.clearAllFilters();
      this.control.addSort('m1', 'asc');
      this.control.addSort(this.lastField, 'desc');
    });
  }

  runAggregate(): void {
    this.measure('aggregate', () => {
      const next = this.control.aggregates()['m1'] === 'avg' ? 'sum' : 'avg';
      this.control.setAggregate('m1', next);
    });
  }

  runRowUpdate(): void {
    this.measure('update-row', () => {
      const current = Number(this.datasource.getRow(0)['m1'] ?? 0);
      this.datasource.patchRow(0, { m1: (current + 1) % 1000 });
    });
  }

  private measure(operation: string, mutate: () => void): void {
    this.benchmarkState.set('running');
    const startedAt = performance.now();
    mutate();
    requestAnimationFrame(() => requestAnimationFrame(() => this.finish(operation, startedAt)));
  }

  private finish(operation: string, startedAt: number): void {
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    this.lastOperation.set(operation);
    this.lastDurationMs.set(durationMs);
    this.results.update(results => [...results, { operation, durationMs }]);
    this.sequence.update(value => value + 1);
    this.benchmarkState.set('ready');
  }
}
