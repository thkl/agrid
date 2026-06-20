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

interface PerformanceRow {
  id: number;
  name: string;
  department: string;
  region: string;
  salary: number;
  score: number;
  hiredAt: string;
}

interface BenchmarkResult {
  operation: string;
  durationMs: number;
}

const ROW_COUNTS = new Set([10_000, 50_000, 100_000,250_000,500_000, 1000_000]);
const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'Operations'];
const REGIONS = ['North', 'South', 'East', 'West'];

const COLUMNS: ColDef<PerformanceRow>[] = [
  { field: 'id', header: 'ID', width: 80, editable: false },
  { field: 'name', header: 'Name', width: 150, filterable: true },
  {
    field: 'department',
    header: 'Department',
    width: 130,
    filterable: true,
    groupable: true,
    values: DEPARTMENTS,
  },
  { field: 'region', header: 'Region', width: 100, filterable: true, values: REGIONS },
  { field: 'salary', header: 'Salary', width: 110, type: 'number', aggregate: 'sum' },
  { field: 'score', header: 'Score', width: 90, type: 'number', aggregate: 'avg' },
  { field: 'hiredAt', header: 'Hire Date', width: 130, type: 'date' },
];

function createRows(count: number): PerformanceRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Employee ${index % 1_000}`,
    department: DEPARTMENTS[index % DEPARTMENTS.length],
    region: REGIONS[(index * 3) % REGIONS.length],
    salary: 40_000 + ((index * 137) % 120_000),
    score: (index * 17) % 100,
    hiredAt: new Date(2015 + (index % 10), index % 12, (index % 28) + 1).toISOString(),
  }));
}

@Component({
  selector: 'demo-performance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent, RouterLink],
  template: `
    <main class="benchmark">
      <header>
        <div>
          <h1>Large-dataset benchmark</h1>
          <p>
            {{ rowCount().toLocaleString() }} rows ·
            {{ filteredRowCount().toLocaleString() }} currently visible
          </p>
        </div>
        <nav aria-label="Dataset size">
          <a routerLink="." [queryParams]="{ rows: 10000 }">10k</a>
          <a routerLink="." [queryParams]="{ rows: 50000 }">50k</a>
          <a routerLink="." [queryParams]="{ rows: 100000 }">100k</a>
          <a routerLink="." [queryParams]="{ rows: 250000 }">250k</a>
          <a routerLink="." [queryParams]="{ rows: 500000 }">500k</a>
          <a routerLink="." [queryParams]="{ rows: 1000000 }">1Mio</a>
        </nav>
      </header>

      <section class="controls" aria-label="Benchmark operations">
        <button data-testid="filter" (click)="runFilter()">Filter</button>
        <button data-testid="clear" (click)="runClear()">Clear</button>
        <button data-testid="sort" (click)="runSort()">Sort</button>
        <button data-testid="multi-sort" (click)="runMultiSort()">Multi-sort</button>
        <button data-testid="group" (click)="runGroup()">Group</button>
        <button data-testid="expand-groups" (click)="runExpandGroups()">Expand groups</button>
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
    p { margin: 4px 0 0; color: #57606a; font-size: 13px; }
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
export class PerformanceDemoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly requestedRowCount = Number(this.route.snapshot.queryParamMap.get('rows'));

  readonly rowCount = signal(
    ROW_COUNTS.has(this.requestedRowCount) ? this.requestedRowCount : 10_000,
  );
  readonly datasource = new AgridDataSource<PerformanceRow>(createRows(this.rowCount()));
  readonly control = new AgridControl();
  readonly provider = new AgridProvider<PerformanceRow>({
    columns: COLUMNS,
    datasource: this.datasource,
    control: this.control,
    zebraStripes: true,
  });
  readonly grid = viewChild(AgridComponent);
  readonly filteredRowCount = computed(
    () => this.grid()?.filteredRowCount() ?? this.datasource.length,
  );
  readonly benchmarkState = signal<'loading' | 'running' | 'ready'>('loading');
  readonly lastOperation = signal('initial-render');
  readonly lastDurationMs = signal(0);
  readonly sequence = signal(0);
  readonly results = signal<BenchmarkResult[]>([]);

  constructor() {
    const startedAt = performance.now();
    afterNextRender(() => this.finish('initial-render', startedAt));

    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe(params => {
        const requestedRowCount = Number(params.get('rows'));
        const rowCount = ROW_COUNTS.has(requestedRowCount) ? requestedRowCount : 10_000;
        if (rowCount === this.rowCount()) return;

        this.rowCount.set(rowCount);
        this.datasource.setData(createRows(rowCount));
      });
  }

  runFilter(): void {
    this.measure('filter', () => this.control.setTextFilter('name', 'Employee 42'));
  }

  runClear(): void {
    this.measure('clear', () => {
      this.control.clearAllFilters();
      this.control.setGroupBy(null);
    });
  }

  runSort(): void {
    this.measure('sort', () => this.control.setSort('salary', 'desc'));
  }

  runMultiSort(): void {
    this.measure('multi-sort', () => {
      this.control.clearAllFilters();
      this.control.addSort('department', 'asc');
      this.control.addSort('salary', 'desc');
    });
  }

  runGroup(): void {
    this.measure('group', () => {
      this.control.clearAllFilters();
      this.control.setGroupBy('department');
    });
  }

  runExpandGroups(): void {
    this.measure('expand-groups', () => this.grid()?.expandGroups());
  }

  runAggregate(): void {
    this.measure('aggregate', () => {
      const next = this.control.aggregates()['salary'] === 'avg' ? 'sum' : 'avg';
      this.control.setAggregate('salary', next);
    });
  }

  runRowUpdate(): void {
    this.measure('update-row', () => {
      const current = this.datasource.getRow(0);
      this.datasource.patchRow(0, { score: (current.score + 1) % 100 });
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
