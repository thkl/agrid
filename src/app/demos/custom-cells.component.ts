import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';
import { AGRID_RENDERER_CONTEXT } from '../agrid/rendering/agrid-cell-renderer';
import { rendererClassSuffix } from './demo-renderer.utils';

/* ------------------------------------------------------------------ *
 * Component cell renderer — status badge. Reads the value from the
 * renderer context and binds it with normal Angular templating, so no
 * manual HTML escaping or sanitization is needed.
 * ------------------------------------------------------------------ */
@Component({
  selector: 'demo-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge--' + suffix()">{{ status() }}</span>`,
  styles: `
    .badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #e9ecef; color: #495057; }
    .badge--active { background: #d4edda; color: #155724; }
    .badge--inactive { background: #f8d7da; color: #721c24; }
    .badge--on-leave { background: #fff3cd; color: #856404; }
    .badge--pending { background: #d1ecf1; color: #0c5460; }
  `,
})
export class StatusBadgeRenderer {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly status = computed(() => String(this.ctx.value() ?? ''));
  readonly suffix = computed(() => rendererClassSuffix(this.status()));
}

/* ------------------------------------------------------------------ *
 * Component cell renderer — score bar. Binds the width directly with
 * [style.width.%] instead of pre-baked CSS width classes.
 * ------------------------------------------------------------------ */
@Component({
  selector: 'demo-score-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="score">
      <span class="score__track">
        <span class="score__fill" [class]="'score__fill--' + level()" [style.width.%]="pct()"></span>
      </span>
      <span class="score__label">{{ pct() }}</span>
    </span>
  `,
  styles: `
    .score { display: flex; align-items: center; gap: 6px; width: 100%; }
    .score__track { flex: 1; height: 6px; background: #e9ecef; border-radius: 3px; overflow: hidden; }
    .score__fill { display: block; height: 100%; background: #dc3545; border-radius: 3px; }
    .score__fill--medium { background: #ffc107; }
    .score__fill--high { background: #28a745; }
    .score__label { width: 28px; text-align: right; font-size: 11px; color: #6c757d; }
  `,
})
export class ScoreBarRenderer {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly pct = computed(() => Math.max(0, Math.min(100, Math.round(Number(this.ctx.value() ?? 0)))));
  readonly level = computed(() => (this.pct() >= 75 ? 'high' : this.pct() >= 40 ? 'medium' : 'low'));
}

const STATUSES = ['Active', 'Inactive', 'On Leave', 'Pending'] as const;

const COLUMNS: ColDef[] = [
  { field: 'id',      header: 'ID',          width: 60,  editable: false, locked: true },
  { field: 'name',    header: 'Name',         width: 160, filterable: true },
  { field: 'dept',    header: 'Department',   width: 130, filterable: true, groupable: true,
    values: ['Engineering','Sales','Marketing','HR','Finance','Design'] },
  { field: 'status',  header: 'Status',       width: 120, editable: false,
    cellRendererComponent: StatusBadgeRenderer,
    cellClass: ({ value }) => value === 'Inactive' ? 'cell-muted' : '',
  },
  { field: 'salary',  header: 'Salary',       width: 110, type: 'number',
    formatter: v => `$${Number(v).toLocaleString()}`,
    cellClass: ({ value }) => Number(value) >= 100_000 ? 'cell-success' : Number(value) < 60_000 ? 'cell-danger' : '',
  },
  { field: 'hiredAt', header: 'Hired',        width: 120, editable: false, locked: true },
  { field: 'score',   header: 'Performance',  width: 160, editable: false,
    cellRendererComponent: ScoreBarRenderer,
  },
];

const NAMES = ['Alice Chen','Bob Martin','Carol White','David Kim','Emma Davis',
  'Frank Torres','Grace Lee','Henry Patel','Iris Wong','Jack Brown',
  'Karen Silva','Leo Nguyen','Maya Osei','Nick Carter','Olivia Park'];
const DEPTS = ['Engineering','Sales','Marketing','HR','Finance','Design'];

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: NAMES[i % NAMES.length],
    dept: DEPTS[i % DEPTS.length],
    status: STATUSES[i % STATUSES.length],
    salary: 48_000 + ((i * 7919) % 80_000),
    hiredAt: new Date(2018 + (i % 6), (i * 3) % 12, (i * 7) % 28 + 1).toISOString(),
    score: Math.round(30 + ((i * 53) % 70)),
  }));
}

@Component({
  selector: 'demo-custom-cells',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Custom cells</h2>
        <span class="demo-meta">cellRendererComponent · cellClass · date auto-format · locked columns</span>
      </div>
      <agrid
        class="demo-grid"
        [provider]="provider"
      />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-grid { flex: 1; min-height: 0; }
    :host ::ng-deep .cell-success { color: #155724 !important; font-weight: 600; }
    :host ::ng-deep .cell-danger  { color: #721c24 !important; font-weight: 600; }
    :host ::ng-deep .cell-muted   { opacity: 0.55; }
  `],
})
export class CustomCellsDemoComponent {
  readonly provider = new AgridProvider({
    columns: COLUMNS,
    datasource: new AgridDataSource(makeRows(30)),
    control: new AgridControl({ allowRowReorder: true }),
    zebraStripes: true,
    showSidebar: true,
    showControlColumn: true,
    rowSelection: 'single',
  });

  readonly _grid = viewChild(AgridComponent);

  constructor() {
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }
}
