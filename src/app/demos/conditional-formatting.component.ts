import { ChangeDetectionStrategy, Component, afterNextRender, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';

interface PortfolioRow {
  id: number;
  initiative: string;
  owner: string;
  status: 'On track' | 'At risk' | 'Blocked';
  budget: number;
  variance: number;
  utilization: number;
}

const INITIATIVES = [
  'Checkout refresh',
  'Mobile onboarding',
  'Search relevance',
  'Billing migration',
  'Analytics workspace',
  'Identity consolidation',
  'Partner API',
  'Support automation',
];
const OWNERS = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Sam', 'Taylor'];
const STATUSES: PortfolioRow['status'][] = ['On track', 'At risk', 'Blocked'];

function makeRows(): PortfolioRow[] {
  return Array.from({ length: 32 }, (_, index) => {
    const variance = -18 + ((index * 11) % 39);
    const utilization = 42 + ((index * 17) % 59);
    return {
      id: index + 1,
      initiative: INITIATIVES[index % INITIATIVES.length],
      owner: OWNERS[(index * 5) % OWNERS.length],
      status: STATUSES[(index + Math.floor(index / 4)) % STATUSES.length],
      budget: 45_000 + ((index * 19_937) % 180_000),
      variance,
      utilization,
    };
  });
}

const COLUMNS: ColDef<PortfolioRow>[] = [
  { field: 'id', header: 'ID', width: 64, editable: false, locked: true },
  { field: 'initiative', header: 'Initiative', width: 190, filterable: true },
  { field: 'owner', header: 'Owner', width: 110, filterable: true, values: OWNERS },
  {
    field: 'status',
    header: 'Status',
    width: 120,
    filterable: true,
    values: STATUSES,
    cellFormat: ({ value }) => ({
      backgroundColor: `var(--format-${value === 'On track' ? 'success' : value === 'At risk' ? 'warning' : 'danger'}-bg)`,
      borderColor: `var(--format-${value === 'On track' ? 'success' : value === 'At risk' ? 'warning' : 'danger'}-border)`,
      color: `var(--format-${value === 'On track' ? 'success' : value === 'At risk' ? 'warning' : 'danger'}-text)`,
      fontWeight: 650,
    }),
  },
  {
    field: 'budget',
    header: 'Budget',
    width: 125,
    type: 'number',
    formatter: value => `$${Number(value).toLocaleString()}`,
  },
  {
    field: 'variance',
    header: 'Variance',
    width: 110,
    type: 'number',
    formatter: value => `${Number(value) > 0 ? '+' : ''}${value}%`,
    cellFormat: ({ value }) => Number(value) === 0 ? undefined : {
      color: Number(value) > 0 ? 'var(--format-success-text)' : 'var(--format-danger-text)',
      fontWeight: 700,
      textAlign: 'right',
    },
  },
  {
    field: 'utilization',
    header: 'Utilization',
    width: 125,
    type: 'number',
    formatter: value => `${value}%`,
    cellFormat: ({ value }) => {
      const utilization = Number(value);
      if (utilization >= 90) {
        return {
          backgroundColor: 'var(--format-danger-bg)',
          borderColor: 'var(--format-danger-border)',
          color: 'var(--format-danger-text)',
          fontWeight: 700,
          textAlign: 'right',
        };
      }
      if (utilization >= 75) {
        return {
          backgroundColor: 'var(--format-warning-bg)',
          color: 'var(--format-warning-text)',
          fontWeight: 600,
          textAlign: 'right',
        };
      }
      return { color: 'var(--format-muted-text)', textAlign: 'right' };
    },
  },
];

@Component({
  selector: 'demo-conditional-formatting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h2>Conditional formatting</h2>
          <p>Style cells from their current row, value, column, and datasource index.</p>
        </div>
        <div class="legend" aria-label="Formatting legend">
          <span class="legend-item legend-item--success">On track</span>
          <span class="legend-item legend-item--warning">Needs attention</span>
          <span class="legend-item legend-item--danger">Critical</span>
        </div>
      </header>

      <aside class="demo-hint">
        Edit <strong>Status</strong>, <strong>Variance</strong>, or <strong>Utilization</strong>
        to see <code>cellFormat</code> update immediately.
      </aside>

      <agrid class="demo-grid" [provider]="provider" />
    </main>
  `,
  styles: [`
    :host {
      --format-success-bg: #ecfdf3;
      --format-success-border: #86efac;
      --format-success-text: #166534;
      --format-warning-bg: #fffbeb;
      --format-warning-border: #fcd34d;
      --format-warning-text: #92400e;
      --format-danger-bg: #fef2f2;
      --format-danger-border: #fca5a5;
      --format-danger-text: #991b1b;
      --format-muted-text: #475569;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    :host-context(.dark-theme) {
      --format-success-bg: #102a1c;
      --format-success-border: #287a48;
      --format-success-text: #86efac;
      --format-warning-bg: #30240d;
      --format-warning-border: #8f6815;
      --format-warning-text: #fcd34d;
      --format-danger-bg: #321719;
      --format-danger-border: #913d42;
      --format-danger-text: #fca5a5;
      --format-muted-text: #cbd5e1;
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

    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    p { margin: 3px 0 0; color: var(--format-muted-text); font-size: 12px; }

    .legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .legend-item {
      padding: 3px 8px;
      border: 1px solid;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 650;
      white-space: nowrap;
    }
    .legend-item--success { color: var(--format-success-text); background: var(--format-success-bg); border-color: var(--format-success-border); }
    .legend-item--warning { color: var(--format-warning-text); background: var(--format-warning-bg); border-color: var(--format-warning-border); }
    .legend-item--danger { color: var(--format-danger-text); background: var(--format-danger-bg); border-color: var(--format-danger-border); }

    .demo-hint {
      padding: 8px 12px;
      border: 1px solid var(--agrid-color-border, #d0d7de);
      border-radius: 6px;
      color: var(--format-muted-text);
      background: var(--agrid-color-bg-subtle, #f6f8fa);
      font-size: 12px;
    }
    code { font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .demo-grid { flex: 1; min-height: 0; }

    @media (max-width: 700px) {
      .demo-header { align-items: flex-start; flex-direction: column; gap: 8px; }
      .legend { justify-content: flex-start; }
    }
  `],
})
export class ConditionalFormattingDemoComponent {
  readonly provider = new AgridProvider<PortfolioRow>({
    columns: COLUMNS,
    datasource: new AgridDataSource(makeRows()),
    control: new AgridControl(),
    zebraStripes: true,
    showSidebar: true,
    rowSelection: 'single',
  });

  readonly grid = viewChild(AgridComponent);

  constructor() {
    afterNextRender(() => this.grid()?.autosizeAllColumns());
  }
}
