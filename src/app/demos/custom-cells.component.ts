import { ChangeDetectionStrategy, Component, afterNextRender, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';

const STATUSES = ['Active', 'Inactive', 'On Leave', 'Pending'] as const;
type Status = typeof STATUSES[number];

const STATUS_COLORS: Record<Status, { bg: string; color: string }> = {
  Active:     { bg: '#d4edda', color: '#155724' },
  Inactive:   { bg: '#f8d7da', color: '#721c24' },
  'On Leave': { bg: '#fff3cd', color: '#856404' },
  Pending:    { bg: '#d1ecf1', color: '#0c5460' },
};

function badge(status: string): string {
  const c = STATUS_COLORS[status as Status] ?? { bg: '#e9ecef', color: '#495057' };
  return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${c.bg};color:${c.color}">${status}</span>`;
}

function scoreBar(score: number): string {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 75 ? '#28a745' : pct >= 40 ? '#ffc107' : '#dc3545';
  return `<div style="display:flex;align-items:center;gap:6px">
    <div style="flex:1;height:6px;background:#e9ecef;border-radius:3px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div>
    </div>
    <span style="font-size:11px;color:#6c757d;width:28px;text-align:right">${pct}</span>
  </div>`;
}

const COLUMNS: ColDef[] = [
  { field: 'id',      header: 'ID',          width: 60,  editable: false, locked: true },
  { field: 'name',    header: 'Name',         width: 160, filterable: true },
  { field: 'dept',    header: 'Department',   width: 130, filterable: true, groupable: true,
    values: ['Engineering','Sales','Marketing','HR','Finance','Design'] },
  { field: 'status',  header: 'Status',       width: 120, editable: false,
    cellRenderer: ({ value }) => badge(String(value)),
    cellClass: ({ value }) => value === 'Inactive' ? 'cell-muted' : '',
  },
  { field: 'salary',  header: 'Salary',       width: 110, type: 'number',
    formatter: v => `$${Number(v).toLocaleString()}`,
    cellClass: ({ value }) => Number(value) >= 100_000 ? 'cell-success' : Number(value) < 60_000 ? 'cell-danger' : '',
  },
  { field: 'hiredAt', header: 'Hired',        width: 120, editable: false, locked: true },
  { field: 'score',   header: 'Performance',  width: 160, editable: false,
    cellRenderer: ({ value }) => scoreBar(Number(value)),
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
        <span class="demo-meta">cellRenderer · cellClass · date auto-format · locked columns</span>
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
