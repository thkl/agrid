import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AgridChartComponent,
  AgridChartData,
  AgridChartProvider,
  AgridChartType,
  AgridComponent,
  AgridControl,
  AgridDataSource,
  AgridProvider,
  ColDef,
} from '../agrid';

interface RegionRow {
  region: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

const COLUMNS: ColDef<RegionRow>[] = [
  { field: 'region', header: 'Region', width: 130, editable: false , filterable:true},
  { field: 'q1', header: 'Q1', width: 80, type: 'number', aggregate: 'sum' },
  { field: 'q2', header: 'Q2', width: 80, type: 'number', aggregate: 'sum' },
  { field: 'q3', header: 'Q3', width: 80, type: 'number', aggregate: 'sum' },
  { field: 'q4', header: 'Q4', width: 80, type: 'number', aggregate: 'sum' },
];

const ROWS: RegionRow[] = [
  { region: 'North', q1: 120, q2: 145, q3: 138, q4: 162 },
  { region: 'South', q1: 98, q2: 110, q3: 134, q4: 128 },
  { region: 'East', q1: 142, q2: 138, q3: 156, q4: 171 },
  { region: 'West', q1: 76, q2: 92, q3: 88, q4: 104 },
  { region: 'Central', q1: 110, q2: 118, q3: 122, q4: 130 },
];

const CHART_TYPES: AgridChartType[] = ['column', 'bar', 'line', 'area', 'pie', 'donut'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

@Component({
  selector: 'demo-charts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent, AgridChartComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Charts</h2>
        <span class="demo-meta">Give &lt;agrid-chart&gt; a type and data — edit a cell and the chart updates live</span>
      </div>

      <div class="demo-body">
        <agrid class="demo-grid" [provider]="provider" />

        <div class="chart-panel">
          <div class="chart-toolbar" role="group" aria-label="Chart type">
            @for (t of chartTypes; track t) {
              <button
                type="button"
                class="chart-type"
                [class.chart-type--active]="t === chartProvider.type()"
                (click)="chartProvider.type.set(t)"
              >{{ t }}</button>
            }
          </div>
          <agrid-chart [provider]="chartProvider" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-body { display: grid; grid-template-columns: minmax(360px, 1fr) minmax(320px, 1fr); gap: 16px; min-height: 0; flex: 1; align-items: start; }
    .demo-grid { min-height: 0; height: 100%; }
    .chart-panel { border: 1px solid #d0d7de; border-radius: 8px; padding: 12px; }
    .chart-toolbar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chart-type {
      border: 1px solid #d0d7de; border-radius: 4px; padding: 3px 10px;
      background: #f6f8fa; color: #24292f; font: inherit; font-size: 12px;
      text-transform: capitalize; cursor: pointer;
    }
    .chart-type--active { background: #3b82f6; border-color: #3b82f6; color: #fff; }
    @media (max-width: 820px) { .demo-body { grid-template-columns: 1fr; } }
  `],
})
export class ChartsDemoComponent {
  readonly ds = new AgridDataSource<RegionRow>(ROWS);
  readonly provider = new AgridProvider<RegionRow>({
    columns: COLUMNS,
    datasource: this.ds,
    control: new AgridControl(),
    zebraStripes: true,
  });

  readonly chartTypes = CHART_TYPES;

  // Linked straight to the grid's filtered/sorted rows — filtering a region out updates the chart.
  readonly chartProvider = new AgridChartProvider<RegionRow>({
    type: 'column',
    source: this.provider.visibleRows,
    transform: (rows, type) => this.buildChartData(rows, type),
    height: 300,
  });

  /** Reshapes the grid's visible rows into a chart dataset per chart type. */
  private buildChartData(rows: readonly RegionRow[], type: AgridChartType): AgridChartData {
    if (type === 'pie' || type === 'donut') {
      // Single series of region totals — slices read as a share of the whole.
      return {
        categories: rows.map(r => r.region),
        series: [{ name: 'Total', values: rows.map(r => r.q1 + r.q2 + r.q3 + r.q4) }],
      };
    }
    // Multi-series: one line/column group per region across the quarters.
    return {
      categories: QUARTERS,
      series: rows.map(r => ({ name: r.region, values: [r.q1, r.q2, r.q3, r.q4] })),
    };
  }
}
