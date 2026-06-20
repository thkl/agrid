import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridPivotConfig,
  AgridProvider,
  ColDef,
} from '../agrid';

interface PivotSale {
  region: string;
  quarter: string;
  product: string;
  revenue: number;
  units: number;
}

const REGIONS = ['Central', 'East', 'North', 'West'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const PRODUCTS = ['Platform', 'Analytics', 'Support'];

/** Deterministic source rows keep the live pivot stable across reloads and screenshots. */
const SALES: PivotSale[] = REGIONS.flatMap((region, regionIndex) =>
  QUARTERS.flatMap((quarter, quarterIndex) =>
    PRODUCTS.flatMap((product, productIndex) =>
      Array.from({ length: 2 }, (_, dealIndex) => ({
        region,
        quarter,
        product,
        units: 8 + regionIndex * 3 + quarterIndex * 4 + productIndex * 5 + dealIndex * 2,
        revenue: 12_000
          + regionIndex * 4_300
          + quarterIndex * 6_700
          + productIndex * 3_100
          + dealIndex * 1_900,
      })),
    ),
  ),
);

const COLUMNS: ColDef<PivotSale>[] = [
  { field: 'region', header: 'Region', width: 150, filterable: true },
  { field: 'quarter', header: 'Quarter', width: 120 },
  { field: 'product', header: 'Product', width: 140 },
  {
    field: 'revenue',
    header: 'Revenue',
    width: 150,
    type: 'number',
    formatter: value => `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
  },
  {
    field: 'units',
    header: 'Units',
    width: 120,
    type: 'number',
    formatter: value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 }),
  },
];

const PIVOTCONFIG : AgridPivotConfig<PivotSale>=  {
      rowField: 'region',
      columnField: 'quarter',
      valueField: 'revenue',
      aggregate: 'sum',
    };

@Component({
  selector: 'demo-pivot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <header class="demo-header">
        <div>
          <div class="demo-kicker">Client-side analysis</div>
          <h2>Revenue by region and quarter</h2>
          <p>One flat datasource becomes a read-only cross-tabulation. Open Pivot in the sidebar to reconfigure it.</p>
        </div>

        <div class="demo-stats" aria-label="Pivot summary">
          <span><strong>{{ sourceRows }}</strong> source rows</span>
          <span><strong>{{ regions }}</strong> × <strong>{{ quarters }}</strong> matrix</span>
        </div>
      </header>

      <agrid class="demo-grid" [provider]="provider" (menuBarAction)="onMenuBarAction($event)"/>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      padding: 18px;
      gap: 14px;
      color: var(--agrid-color-text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .demo-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
    .demo-kicker {
      margin-bottom: 4px;
      color: var(--agrid-color-accent);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: .09em;
      text-transform: uppercase;
    }
    h2 { margin: 0; font-size: 20px; line-height: 1.25; letter-spacing: -.015em; }
    p { margin: 4px 0 0; color: var(--agrid-color-text-muted); font-size: 12px; }
    .demo-stats { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .demo-stats span {
      border: 1px solid var(--agrid-color-border);
      border-radius: 999px;
      background: var(--agrid-color-bg-muted);
      padding: 5px 9px;
      color: var(--agrid-color-text-muted);
      font-size: 11px;
      white-space: nowrap;
    }
    .demo-stats strong { color: var(--agrid-color-text); font-variant-numeric: tabular-nums; }
    .demo-grid { flex: 1; min-height: 260px; }
    @media (max-width: 760px) {
      .demo-wrap { padding: 12px; }
      .demo-header { align-items: flex-start; flex-direction: column; gap: 10px; }
      .demo-stats { justify-content: flex-start; }
    }
  `],
})
export class PivotDemoComponent {
  readonly sourceRows = SALES.length;
  readonly regions = REGIONS.length;
  readonly quarters = QUARTERS.length;
  readonly provider = new AgridProvider<PivotSale>({
    columns: COLUMNS,
    datasource: new AgridDataSource(SALES),
    pivotConfig: PIVOTCONFIG,
    zebraStripes: true,
    showSidebar: true,
    menuBarItems: [
      { id: 'saveControl', class:'material-symbols-outlined', icon:'save', label: 'Save Table config'},
      {
        id: 'pivot', label: "Pivot", class:'material-symbols-outlined', icon:'pivot_table_chart', items: [
          { id: 'addPivot', label: 'Add Pivot', disabled: (context => context.provider.pivotConfig !== null) },
          { id: 'removePivot', label: 'Remove Pivot', disabled: (context => context.provider.pivotConfig === null) }
        ]
      }
    ]
  });

  constructor() {
    const saved = localStorage.getItem('agrid-state-demo-pivot');
    if (saved) {
      this.provider.loadSettings(JSON.parse(saved));
    }
  }

  saveConfig() {
    const pivotSettings = this.provider.saveSettings();
    localStorage.setItem('agrid-state-demo-pivot', JSON.stringify(pivotSettings));
  }

  onMenuBarAction(id: string): void {
    if (id === 'saveControl') {
      this.saveConfig();
      return;
    }
    if (id === 'addPivot') {
      this.provider.pivotConfig = PIVOTCONFIG;
    }
    if (id === 'removePivot') {
      this.provider.pivotConfig = null
    }
  }
}
