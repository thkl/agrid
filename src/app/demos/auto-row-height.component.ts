import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef } from '../agrid';

interface AutoHeightRow {
  id: number;
  title: string;
  description: string;
  owner: string;
  status: 'Open' | 'Review' | 'Done';
}

const ROWS: AutoHeightRow[] = [
  {
    id: 1,
    title: 'Release notes',
    description: 'Short rows stay compact while longer content wraps naturally when the column is narrow.',
    owner: 'Avery',
    status: 'Open',
  },
  {
    id: 2,
    title: 'Accessibility review',
    description: 'The keyboard navigation pass covers focus restoration after filtering, screen-reader labels, and predictable movement through rows whose measured heights differ.',
    owner: 'Jordan',
    status: 'Review',
  },
  {
    id: 3,
    title: 'Server rollout',
    description: 'Auto-height works with virtual scrolling and continues to use the active density as the minimum row height.',
    owner: 'Morgan',
    status: 'Done',
  },
  {
    id: 4,
    title: 'Empty state copy',
    description: 'A single-line description demonstrates that ordinary rows do not grow unnecessarily.',
    owner: 'Riley',
    status: 'Open',
  },
];

const COLUMNS: ColDef<AutoHeightRow>[] = [
  { field: 'id', header: 'ID', width: 64, editable: false, locked: true },
  { field: 'title', header: 'Work item', width: 180 },
  { field: 'description', header: 'Description', width: 360 },
  { field: 'owner', header: 'Owner', width: 120, values: ['Avery', 'Jordan', 'Morgan', 'Riley'] },
  { field: 'status', header: 'Status', width: 120, values: ['Open', 'Review', 'Done'] },
];

@Component({
  selector: 'demo-auto-row-height',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h1>Auto row height</h1>
          <p>Rows measure wrapped content while keeping the active density as their minimum height.</p>
        </div>
        <span class="demo-state">{{ provider.control.rowDensity() === 'auto' ? 'Measured rows enabled' : 'Fixed rows' }}</span>
      </header>
      <agrid class="demo-grid" [provider]="provider" />
    </main>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; height: 100%; }
    .demo-wrap { display: flex; flex: 1; flex-direction: column; min-height: 0; height: 100%; gap: 12px; padding: 16px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
    h1 { margin: 0; font-size: 20px; line-height: 1.2; }
    p { margin: 4px 0 0; color: #57606a; font-size: 13px; }
    .demo-state { padding: 5px 8px; border: 1px solid #d0d7de; border-radius: 5px; color: #57606a; font-size: 12px; white-space: nowrap; }
    .demo-grid { flex: 1; min-height: 0; }
  `],
})
export class AutoRowHeightDemoComponent {
  readonly provider = new AgridProvider<AutoHeightRow>({
    columns: COLUMNS,
    datasource: new AgridDataSource(ROWS),
    control: new AgridControl({ rowDensity: 'auto' }),
    showRowHeightMenu: true,
    zebraStripes: true,
    rowSelection: 'single',
  });
}
