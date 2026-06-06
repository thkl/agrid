import { ChangeDetectionStrategy, Component, afterNextRender, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';

const REGIONS  = ['North','South','East','West','Central'];
const PRODUCTS = ['Widget A','Widget B','Gadget Pro','Service Pack','Support Plan','Add-on Kit'];
const REPS     = ['Alice','Bob','Carol','David','Emma','Frank'];

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id:       i + 1,
    quarter:  `Q${(i % 4) + 1} ${2024 + Math.floor(i / 16)}`,
    region:   REGIONS[i % REGIONS.length],
    product:  PRODUCTS[i % PRODUCTS.length],
    rep:      REPS[(i * 3) % REPS.length],
    deals:    1 + (i * 7) % 15,
    revenue:  5_000 + ((i * 9973) % 95_000),
    margin:   Math.round(10 + ((i * 17) % 55)),
  }));
}

const COLUMNS: ColDef[] = [
  { field: 'id',      header: 'ID',       width: 60,  editable: false },
  { field: 'quarter', header: 'Quarter',  width: 90,  filterable: true, groupable: true },
  { field: 'region',  header: 'Region',   width: 100, filterable: true, groupable: true, values: REGIONS },
  { field: 'product', header: 'Product',  width: 130, filterable: true, groupable: true, values: PRODUCTS },
  { field: 'rep',     header: 'Rep',      width: 100, filterable: true, values: REPS },
  { field: 'deals',   header: 'Deals',    width: 80,  type: 'number', aggregate: 'sum' },
  { field: 'revenue', header: 'Revenue',  width: 120, type: 'number', aggregate: 'sum',
    formatter: v => `$${Number(v).toLocaleString()}` },
  { field: 'margin',  header: 'Margin %', width: 100, type: 'number', aggregate: 'avg',
    formatter: v => `${Number(v).toFixed(1)}%`,
    cellClass: ({ value }) => Number(value) >= 40 ? 'cell-success' : Number(value) < 20 ? 'cell-danger' : '',
  },
];

@Component({
  selector: 'demo-aggregates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Aggregates</h2>
        <span class="demo-meta">Pre-configured sum/avg footer · open any column menu to change aggregate</span>
      </div>
      <agrid
        class="demo-grid"
        [provider]="provider"
        [zebraStripes]="true"
        [showSidebar]="true"
        [showControlColumn]="true"
        [rowSelection]="'multi'"
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
  `],
})
export class AggregatesDemoComponent {
  readonly provider = new AgridProvider({
    columns: COLUMNS,
    datasource: new AgridDataSource(makeRows(80)),
    control: new AgridControl(),
  });

  readonly _grid = viewChild(AgridComponent);

  constructor() {
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }
}
