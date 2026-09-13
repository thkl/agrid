import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import {
  AgridChartComponent,
  AgridChartProvider,
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  ColDef,
} from '../agrid';

interface SalesRow { region: string; orders: number; revenue: number; }

const ROWS: SalesRow[] = [
  { region: 'North', orders: 42, revenue: 128000 },
  { region: 'South', orders: 35, revenue: 97000 },
  { region: 'East', orders: 51, revenue: 154000 },
  { region: 'West', orders: 29, revenue: 83000 },
  { region: 'Central', orders: 46, revenue: 139000 },
];

const COLUMNS: ColDef<SalesRow>[] = [
  { field: 'region', header: 'Region', width: 140, filterable: true },
  { field: 'orders', header: 'Orders', width: 110, type: 'number' },
  { field: 'revenue', header: 'Revenue', width: 130, type: 'number', formatter: (value: unknown) => `$${Number(value).toLocaleString()}` },
];

@Component({
  selector: 'demo-export-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent, AgridChartComponent],
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h2>Export &amp; state</h2>
          <p>Export a richer workbook, persist the complete grid state, or chart a selected range.</p>
        </div>
        <div class="actions">
          <button type="button" (click)="exportWorkbook()">Export workbook</button>
          <button type="button" (click)="saveState()">Save state</button>
          <button type="button" (click)="restoreState()" [disabled]="!storedState()">Restore state</button>
        </div>
      </header>

      <div class="demo-hint">Select a rectangular range beginning with Region, then create a chart from that selection.</div>
      <section class="demo-body">
        <agrid #grid class="demo-grid" [provider]="provider" />
        <aside class="chart-panel">
          <div class="chart-actions">
            <button type="button" (click)="chartFromSelection()">Chart selected range</button>
            <button type="button" (click)="chart.exportSvg('sales-chart.svg')">Export SVG</button>
          </div>
          <agrid-chart #chart [provider]="chartProvider" />
        </aside>
      </section>
      @if (status()) { <output class="status" aria-live="polite">{{ status() }}</output> }
    </main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex: 1; flex-direction: column; min-height: 0; gap: 10px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0; color: #57606a; font-size: 13px; }
    .actions, .chart-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    button { border: 1px solid #c7d2e0; border-radius: 5px; background: #f8fafc; color: #1f2937; cursor: pointer; font: inherit; font-size: 12px; padding: 7px 10px; }
    button:hover { background: #e8eef6; }
    button:disabled { cursor: default; opacity: .5; }
    .demo-hint { border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; color: #57606a; font-size: 12px; padding: 9px 12px; }
    .demo-body { display: grid; grid-template-columns: minmax(360px, 1fr) minmax(300px, 420px); flex: 1; min-height: 0; gap: 14px; }
    .demo-grid { min-height: 0; }
    .chart-panel { align-self: start; border: 1px solid #d0d7de; border-radius: 6px; padding: 10px; }
    .chart-actions { margin-bottom: 8px; }
    .status { color: #166534; font-size: 12px; }
    :host-context(.dark-theme) p { color: #9ca3af; }
    :host-context(.dark-theme) button { border-color: #30363d; background: #161b22; color: #e6edf3; }
    :host-context(.dark-theme) .demo-hint, :host-context(.dark-theme) .chart-panel { border-color: #30363d; background: #161b22; color: #9ca3af; }
    :host-context(.dark-theme) .status { color: #86efac; }
    @media (max-width: 800px) { .demo-header { align-items: stretch; flex-direction: column; } .demo-body { grid-template-columns: 1fr; } }
  `],
})
export class ExportStateDemoComponent {
  readonly grid = viewChild<AgridComponent<SalesRow>>('grid');
  readonly chart = viewChild.required<AgridChartComponent>('chart');
  readonly storedState = computed(() => localStorage.getItem('agrid-export-state'));
  readonly status = computed(() => this.message());
  private readonly message = signal('');

  readonly provider = new AgridProvider<SalesRow>({
    columns: COLUMNS,
    datasource: new AgridDataSource(ROWS),
    control: new AgridControl(),
    getRowId: row => row.region,
    zebraStripes: true,
    rowSelection: 'multi',
  });

  readonly chartProvider = new AgridChartProvider({
    type: 'column',
    data: { categories: ['North', 'South'], series: [{ name: 'Revenue', values: [128000, 97000] }] },
    height: 260,
  });

  exportWorkbook(): void {
    this.provider.exportXlsx('sales-report.xlsx', {
      sheetName: 'Sales',
      additionalSheets: [{ name: 'Readme', header: ['Field', 'Value'], rows: [
        { cells: [{ kind: 'string', value: 'Generated by' }, { kind: 'string', value: 'aGrid' }] },
      ] }],
    });
    this.message.set('Workbook export started.');
  }

  saveState(): void {
    const state = this.grid()?.getState();
    if (!state) return;
    localStorage.setItem('agrid-export-state', JSON.stringify(state));
    this.message.set('Grid state saved locally.');
  }

  restoreState(): void {
    const saved = localStorage.getItem('agrid-export-state');
    if (!saved) return;
    this.grid()?.setState(JSON.parse(saved));
    this.message.set('Grid state restored.');
  }

  chartFromSelection(): void {
    const data = this.grid()?.getSelectedRangeChartData();
    if (!data) {
      this.message.set('Select at least one category column and one numeric column.');
      return;
    }
    this.chartProvider.setData(data);
    this.message.set('Chart updated from the selected range.');
  }
}
