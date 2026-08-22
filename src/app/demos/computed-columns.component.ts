import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';

interface DealRow {
  id: number;
  account: string;
  region: 'North' | 'South' | 'East' | 'West';
  units: number;
  unitPrice: number;
  cost: number;
  probability: number;
}

const REGIONS: DealRow['region'][] = ['North', 'South', 'East', 'West'];
const ACCOUNTS = [
  'Atlas Foods',
  'Northstar Labs',
  'Summit Health',
  'Evergreen Retail',
  'Bluebird Transit',
  'Pioneer Finance',
  'Riverline Energy',
  'Keystone Media',
];

function revenue(row: DealRow): number {
  return row.units * row.unitPrice;
}

function margin(row: DealRow): number {
  const total = revenue(row);
  return total === 0 ? 0 : (total - row.cost) / total;
}

function riskScore(row: DealRow): number {
  return Math.round((1 - row.probability) * 100 + Math.max(0, 0.28 - margin(row)) * 120);
}

function makeRows(): DealRow[] {
  return Array.from({ length: 36 }, (_, index) => {
    const units = 18 + ((index * 13) % 84);
    const unitPrice = 320 + ((index * 97) % 980);
    const total = units * unitPrice;
    const marginRatio = 0.16 + (((index * 7) % 24) / 100);
    return {
      id: index + 1,
      account: ACCOUNTS[index % ACCOUNTS.length],
      region: REGIONS[(index * 3 + Math.floor(index / 5)) % REGIONS.length],
      units,
      unitPrice,
      cost: Math.round(total * (1 - marginRatio)),
      probability: (35 + ((index * 11) % 61)) / 100,
    };
  });
}

const moneyFormatter = (value: unknown): string => `$${Math.round(Number(value)).toLocaleString()}`;
const percentFormatter = (value: unknown): string => `${Math.round(Number(value) * 100)}%`;

const COLUMNS: ColDef<DealRow>[] = [
  { field: 'id', header: 'ID', width: 64, editable: false, locked: true },
  { field: 'account', header: 'Account', width: 170, filterable: true },
  { field: 'region', header: 'Region', width: 105, filterable: true, values: REGIONS },
  { field: 'units', header: 'Units', width: 90, type: 'number', aggregate: 'sum' },
  {
    field: 'unitPrice',
    header: 'Unit price',
    width: 115,
    type: 'number',
    formatter: moneyFormatter,
  },
  {
    field: 'revenue',
    header: 'Revenue',
    width: 125,
    type: 'number',
    filterable: true,
    aggregate: 'sum',
    valueGetter: ({ row }) => revenue(row),
    formatter: moneyFormatter,
    cellFormat: () => ({ textAlign: 'right', fontWeight: 650 }),
  },
  {
    field: 'margin',
    header: 'Margin',
    width: 105,
    type: 'number',
    filterable: true,
    aggregate: 'avg',
    valueGetter: ({ row }) => margin(row),
    formatter: percentFormatter,
    cellFormat: ({ value }) => ({
      color: Number(value) >= 0.28 ? 'var(--computed-positive)' : 'var(--computed-warning)',
      fontWeight: 700,
      textAlign: 'right',
    }),
  },
  {
    field: 'weightedRevenue',
    header: 'Weighted',
    width: 125,
    type: 'number',
    aggregate: 'sum',
    valueGetter: ({ row }) => revenue(row) * row.probability,
    formatter: moneyFormatter,
    cellFormat: () => ({ textAlign: 'right' }),
  },
  {
    field: 'risk',
    header: 'Risk',
    width: 95,
    type: 'number',
    filterable: true,
    valueGetter: ({ row }) => riskScore(row),
    comparator: ({ valueA, valueB }) => Number(valueA) - Number(valueB),
    cellFormat: ({ value }) => {
      const score = Number(value);
      if (score >= 74) {
        return {
          backgroundColor: 'var(--computed-risk-bg)',
          borderColor: 'var(--computed-risk-border)',
          color: 'var(--computed-risk-text)',
          fontWeight: 700,
          textAlign: 'right',
        };
      }
      return { color: 'var(--computed-muted)', textAlign: 'right' };
    },
  },
];

@Component({
  selector: 'demo-computed-columns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h2>Computed value columns</h2>
          <p>Derived revenue, margin, weighted revenue, and risk columns share the normal grid behavior.</p>
        </div>
        <div class="actions">
          <button type="button" (click)="sortByRisk()">Sort risk</button>
          <button type="button" (click)="filterHighValue()">High value</button>
          <button type="button" (click)="clearFilters()">Clear</button>
        </div>
      </header>

      <agrid class="demo-grid" [provider]="provider" />
    </main>
  `,
  styles: [`
    :host {
      --computed-positive: #166534;
      --computed-warning: #9a3412;
      --computed-risk-bg: #fef2f2;
      --computed-risk-border: #fca5a5;
      --computed-risk-text: #991b1b;
      --computed-muted: #475569;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    :host-context(.dark-theme) {
      --computed-positive: #86efac;
      --computed-warning: #fdba74;
      --computed-risk-bg: #321719;
      --computed-risk-border: #913d42;
      --computed-risk-text: #fca5a5;
      --computed-muted: #cbd5e1;
    }

    .demo-wrap {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      gap: 12px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .demo-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }

    p {
      margin: 3px 0 0;
      color: var(--computed-muted);
      font-size: 12px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }

    button {
      min-height: 30px;
      padding: 0 10px;
      border: 1px solid var(--agrid-color-border, #d0d7de);
      border-radius: 6px;
      color: inherit;
      background: var(--agrid-color-bg, #fff);
      font: 600 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      cursor: pointer;
    }

    button:hover {
      background: var(--agrid-color-bg-subtle, #f6f8fa);
    }

    .demo-grid {
      flex: 1;
      min-height: 0;
    }

    @media (max-width: 700px) {
      .demo-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .actions {
        justify-content: flex-start;
      }
    }
  `],
})
export class ComputedColumnsDemoComponent {
  readonly control = new AgridControl();
  readonly provider = new AgridProvider<DealRow>({
    columns: COLUMNS,
    datasource: new AgridDataSource(makeRows()),
    control: this.control,
    showSidebar: true,
    enableQuickFilter: true,
    zebraStripes: true,
  });

  sortByRisk(): void {
    this.control.setSort('risk', 'desc');
  }

  filterHighValue(): void {
    this.control.setRangeFilter('revenue', 'gt', '50000');
  }

  clearFilters(): void {
    this.control.clearAllFilters();
  }
}
