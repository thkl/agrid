import { ChangeDetectionStrategy, Component, afterNextRender, effect, signal, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, CellContextMenuItem, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';
import { escapeRendererText, rendererClassSuffix } from './demo-renderer.utils';

const PRIORITIES = ['Critical','High','Medium','Low'];
const TYPES      = ['Bug','Feature','Task','Improvement','Documentation'];
const ASSIGNEES  = ['Alice','Bob','Carol','David','Emma','Unassigned'];
const STATUSES   = ['Open','In Progress','Review','Done','Closed'];
const TAG_POOL   = ['frontend','backend','api','ux','infra','perf','security','a11y','mobile','auth'];

function priorityBadge(value: string): string {
  return `<span class="demo-priority demo-priority--${rendererClassSuffix(value)}">${escapeRendererText(value)}</span>`;
}

function renderTags(value: string): string {
  return value.split(',').map(t => t.trim()).filter(Boolean)
    .map(tag => `<span class="demo-tag">${escapeRendererText(tag)}</span>`)
    .join('');
}

const COLUMNS: ColDef[] = [
  { field: 'key',      header: 'Key',      width: 100, editable: false, locked: true },
  { field: 'title',    header: 'Title',    width: 260 },
  { field: 'type',     header: 'Type',     width: 130, values: TYPES },
  { field: 'priority', header: 'Priority', width: 110, values: PRIORITIES,
    cellRenderer: ({ value }) => priorityBadge(String(value)) },
  { field: 'status',   header: 'Status',   width: 120, values: STATUSES,
    cellClass: ({ value }) => value === 'Done' || value === 'Closed' ? 'cell-muted' : '' },
  { field: 'assignee', header: 'Assignee', width: 120, values: ASSIGNEES },
  { field: 'created',  header: 'Created',  width: 120, editable: false },
  { field: 'tags',     header: 'Tags',     width: 200, editable: false,
    cellRenderer: ({ value }) => renderTags(String(value ?? '')) },
];

const TITLES = [
  'Fix login redirect loop','Add dark mode toggle','Improve API response time',
  'Update onboarding flow','Fix mobile layout issues','Add CSV export feature',
  'Refactor auth middleware','Improve error messages','Add keyboard shortcuts','Fix date parsing bug',
];

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    key:      `PROJ-${i + 1}`,
    title:    TITLES[i % TITLES.length] + (i >= TITLES.length ? ` (${Math.floor(i / TITLES.length) + 1})` : ''),
    type:     TYPES[i % TYPES.length],
    priority: PRIORITIES[i % PRIORITIES.length],
    status:   STATUSES[(i * 2) % STATUSES.length],
    assignee: ASSIGNEES[i % ASSIGNEES.length],
    created:  new Date(2024, (i * 2) % 12, (i * 5) % 28 + 1).toISOString(),
    tags:     [TAG_POOL[i % TAG_POOL.length], TAG_POOL[(i + 3) % TAG_POOL.length]]
                .filter((_, j) => j < (1 + i % 3)).join(', '),
  }));
}

@Component({
  selector: 'demo-readonly',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Readonly viewer</h2>
        <span class="demo-meta">Readonly mode · custom renderers · cellClass · context menu actions</span>
        <label class="demo-toggle">
          <input type="checkbox" [checked]="!isReadonly()" (change)="isReadonly.set(!isReadonly())" />
          Allow editing
        </label>
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
    .demo-header { display: flex; align-items: center; gap: 12px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-toggle { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #57606a; cursor: pointer; margin-left: auto; }
    .demo-grid { flex: 1; min-height: 0; }
    :host ::ng-deep .cell-muted { opacity: 0.45; }
    :host ::ng-deep .demo-priority { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #e9ecef; color: #495057; }
    :host ::ng-deep .demo-priority--critical { background: #f8d7da; color: #721c24; }
    :host ::ng-deep .demo-priority--high { background: #fff3cd; color: #856404; }
    :host ::ng-deep .demo-priority--medium { background: #d1ecf1; color: #0c5460; }
    :host ::ng-deep .demo-priority--low { background: #e2e3e5; color: #383d41; }
    :host ::ng-deep .demo-tag { display: inline-block; padding: 0 6px; margin-right: 3px; border: 1px solid #d0d7de; border-radius: 10px; font-size: 11px; color: #57606a; }
  `],
})
export class ReadonlyDemoComponent {
  readonly ds = new AgridDataSource(makeRows(40));
  readonly isReadonly = signal(true);
  readonly _grid = viewChild(AgridComponent);

  readonly contextItems: CellContextMenuItem[] = [
    { label: 'Mark as Done',  action: ({ originalIndex }) => this.ds.patchRow(originalIndex, { status: 'Done' }) },
    { label: 'Assign to me',  action: ({ originalIndex }) => this.ds.patchRow(originalIndex, { assignee: 'Alice' }) },
  ];

  readonly provider = new AgridProvider({
    columns: COLUMNS,
    datasource: this.ds,
    control: new AgridControl(),
    zebraStripes: true,
    showSidebar: true,
    rowSelection: 'multi',
    cellMenuItems: this.contextItems,
    readonly: true,
  });

  constructor() {
    effect(() => this.provider.readonlyGrid.set(this.isReadonly()));
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }
}
