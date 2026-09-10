import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef } from '../agrid';

interface AccountRow {
  id: number;
  firstName: string;
  lastName: string;
  account: {
    plan: 'Starter' | 'Growth' | 'Enterprise';
    monthlyCents: number;
  };
  tags: string[];
  notes: string;
}

const rows: AccountRow[] = [
  {
    id: 1001,
    firstName: 'Ava',
    lastName: 'Lindholm',
    account: { plan: 'Growth', monthlyCents: 12900 },
    tags: ['priority', 'renewal'],
    notes: 'Annual renewal discussion scheduled.',
  },
  {
    id: 1002,
    firstName: 'Milan',
    lastName: 'Kovac',
    account: { plan: 'Starter', monthlyCents: 3900 },
    tags: ['self-serve'],
    notes: 'Migrating from trial workspace.',
  },
  {
    id: 1003,
    firstName: 'Noor',
    lastName: 'Rahman',
    account: { plan: 'Enterprise', monthlyCents: 48200 },
    tags: ['security', 'procurement'],
    notes: 'Needs security questionnaire before upgrade.',
  },
  {
    id: 1004,
    firstName: 'Jonas',
    lastName: 'Weber',
    account: { plan: 'Growth', monthlyCents: 16800 },
    tags: ['expansion'],
    notes: 'Additional seats expected next quarter.',
  },
];

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const columns: ColDef<AccountRow>[] = [
  { field: 'id', header: 'ID', width: 76, editable: false, type: 'number' },
  {
    field: 'fullName',
    header: 'Full name',
    width: 190,
    filterable: true,
    valueGetter: ({ row }) => `${row.firstName} ${row.lastName}`,
    valueParser: ({ value }) => String(value).trim().replace(/\s+/g, ' '),
    valueSetter: ({ row, value }) => {
      const parts = String(value).split(' ');
      const firstName = parts.shift() ?? '';
      const lastName = parts.join(' ');
      if (!firstName || !lastName) return false;
      return { firstName, lastName };
    },
    validate: value => String(value).includes(' ') ? null : 'Enter first and last name',
  },
  {
    field: 'accountPlan',
    header: 'Plan',
    width: 130,
    filterable: true,
    values: ['Starter', 'Growth', 'Enterprise'],
    valueGetter: ({ row }) => row.account.plan,
    valueSetter: ({ row, value }) => ({
      account: { ...row.account, plan: value as AccountRow['account']['plan'] },
    }),
  },
  {
    field: 'monthlyRevenue',
    header: 'Monthly',
    width: 125,
    type: 'number',
    textAlign: 'right',
    valueGetter: ({ row }) => row.account.monthlyCents / 100,
    formatter: value => currency.format(Number(value)),
    valueParser: ({ value }) => {
      const cleaned = String(value).replace(/[$,\s]/g, '');
      return Math.round(Number(cleaned) || 0);
    },
    valueSetter: ({ row, value }) => ({
      account: { ...row.account, monthlyCents: Math.round(Number(value) * 100) },
    }),
    validate: value => Number(value) > 0 ? null : 'Amount must be greater than zero',
  },
  {
    field: 'tagsText',
    header: 'Tags',
    width: 220,
    filterable: true,
    valueGetter: ({ row }) => row.tags.join(', '),
    valueParser: ({ value }) => String(value)
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean),
    valueSetter: ({ value }) => ({ tags: Array.isArray(value) ? value : [] }),
    formatter: value => Array.isArray(value) ? value.join(', ') : String(value ?? ''),
  },
  { field: 'notes', header: 'Notes', width: 260, editor: 'largeText', filterable: true , sidebarControl:{ type: 'textarea', height: 5 } },
];

@Component({
  selector: 'demo-value-parser-setter',
  standalone: true,
  imports: [AgridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h1>Value parser and setter</h1>
          <p>Edit Full name, Plan, Monthly, or Tags to update derived and nested row data.</p>
        </div>
        <div class="demo-state" aria-label="Selected row state">
          {{ selectedState() }}
        </div>
      </header>

      <agrid class="demo-grid" [provider]="provider" (cellEdit)="lastRowIndex.set($event.position.rowIndex)" />
    </main>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      height: 100%;
    }

    .demo-wrap {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      gap: 12px;
      padding: 16px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .demo-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 18px;
    }

    h1 { margin: 0; font-size: 20px; line-height: 1.2; }
    p { margin: 4px 0 0; color: #57606a; font-size: 13px; }

    .demo-state {
      max-width: min(540px, 48vw);
      padding: 8px 10px;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      background: #f6f8fa;
      color: #24292f;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .demo-grid {
      flex: 1 1 auto;
      min-height: 360px;
    }

    :host-context(.dark-theme) p { color: #9ca3af; }
    :host-context(.dark-theme) .demo-state {
      border-color: #30363d;
      background: #161b22;
      color: #e5e7eb;
    }

    @media (max-width: 760px) {
      .demo-header { align-items: stretch; flex-direction: column; }
      .demo-state { max-width: none; white-space: normal; }
      .demo-grid { min-height: 420px; }
    }
  `],
})
export class ValueParserSetterDemoComponent {
  readonly datasource = new AgridDataSource<AccountRow>(rows);
  readonly control = new AgridControl();
  readonly lastRowIndex = signal(0);
  readonly provider = new AgridProvider<AccountRow>({
    columns,
    datasource: this.datasource,
    control: this.control,
    showSidebar: true,
    enableQuickFilter: true,
    rowSelection: 'single',
    zebraStripes: true,
    resizableSidebar:true
  });

  readonly selectedState = computed(() => {
    const row = this.datasource.rows()[this.lastRowIndex()] ?? this.datasource.rows()[0];
    return row ? JSON.stringify(row) : '';
  });
}
