import { ChangeDetectionStrategy, Component, afterNextRender, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef } from '@thkl/agrid';
import { escapeRendererText, rendererClassSuffix } from './demo-renderer.utils';

const COLUMNS: ColDef[] = [
  { field: 'id',         header: 'ID',         width: 70,  editable: false, pinned: 'left', locked: true },
  { field: 'name',       header: 'Name',        width: 160, filterable: true },
  { field: 'email',      header: 'Email',       width: 220 },
  { field: 'dept',       header: 'Department',  width: 140, filterable: true, groupable: true,
    values: ['Engineering','Sales','Marketing','HR','Finance','Design','Operations'] },
  { field: 'location',   header: 'Location',    width: 130,
    values: ['New York','London','Berlin','Tokyo','Sydney','Toronto','Paris'] },
  { field: 'role',       header: 'Role',        width: 140,
    values: ['Engineer','Manager','Director','Analyst','Designer','Support'] },
  { field: 'salary',     header: 'Salary',      width: 110, type: 'number',
    formatter: v => `$${Number(v).toLocaleString()}`, aggregate: 'sum' },
  { field: 'hiredAt',    header: 'Hired',       width: 120, editable: false },
  { field: 'score',      header: 'Score',       width: 90,  type: 'number', aggregate: 'avg' },
  { field: 'status',     header: 'Status',      width: 110, pinned: 'right',
    values: ['Active','Inactive','On Leave','Pending'],
    cellRenderer: ({ value }) =>
      `<span class="demo-badge demo-badge--${rendererClassSuffix(value)}">${escapeRendererText(value)}</span>`,
  },
];

const NAMES = ['Alice Chen','Bob Martin','Carol White','David Kim','Emma Davis',
  'Frank Torres','Grace Lee','Henry Patel','Iris Wong','Jack Brown',
  'Karen Silva','Leo Nguyen','Maya Osei','Nick Carter','Olivia Park','Peter Xu'];
const DEPTS    = ['Engineering','Sales','Marketing','HR','Finance','Design','Operations'];
const LOCS     = ['New York','London','Berlin','Tokyo','Sydney','Toronto','Paris'];
const ROLES    = ['Engineer','Manager','Director','Analyst','Designer','Support'];
const STATUSES = ['Active','Inactive','On Leave','Pending'];

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id:      i + 1,
    name:    NAMES[i % NAMES.length],
    email:   `${NAMES[i % NAMES.length].split(' ')[0].toLowerCase()}@example.com`,
    dept:    DEPTS[i % DEPTS.length],
    location:LOCS[i % LOCS.length],
    role:    ROLES[(i * 3) % ROLES.length],
    salary:  55_000 + ((i * 7919) % 90_000),
    hiredAt: new Date(2017 + (i % 7), (i * 3) % 12, (i * 7) % 28 + 1).toISOString(),
    score:   Math.round(40 + ((i * 53) % 60)),
    status:  STATUSES[i % STATUSES.length],
  }));
}

@Component({
  selector: 'demo-pinning',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Column pinning</h2>
        <span class="demo-meta">Pin left · Pin right · open any column menu to change pinning</span>
      </div>
      <div class="demo-hint">
        <strong>ID</strong> is pinned left · <strong>Status</strong> is pinned right ·
        scroll the middle columns to see both pinned panes stay fixed
      </div>
      <agrid
        class="demo-grid"
        [provider]="provider"
      />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-hint { font-size: 12px; color: #57606a; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 12px; }
    .demo-grid { flex: 1; min-height: 0; }
    :host ::ng-deep .demo-badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #e9ecef; color: #495057; }
    :host ::ng-deep .demo-badge--active { background: #d4edda; color: #155724; }
    :host ::ng-deep .demo-badge--inactive { background: #f8d7da; color: #721c24; }
    :host ::ng-deep .demo-badge--on-leave { background: #fff3cd; color: #856404; }
    :host ::ng-deep .demo-badge--pending { background: #d1ecf1; color: #0c5460; }
  `],
})
export class PinningDemoComponent {
  readonly provider = new AgridProvider({
    columns: COLUMNS,
    datasource: new AgridDataSource(makeRows(40)),
    control: new AgridControl(),
    zebraStripes: true,
    showSidebar: true,
    showControlColumn: true,
    rowSelection: 'multi',
    autoOpenDetail:true
  });

  readonly _grid = viewChild(AgridComponent);

  constructor() {
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }
}
