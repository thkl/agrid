import { ChangeDetectionStrategy, Component, afterNextRender, computed, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';

const COLUMNS: ColDef[] = [
  { field: 'id',       header: 'ID',       width: 70,  editable: false },
  { field: 'name',     header: 'Product',  width: 200, filterable: true },
  { field: 'category', header: 'Category', width: 130, filterable: true, groupable: true,
    values: ['Electronics','Clothing','Food','Sports','Books','Home','Toys'] },
  { field: 'price',    header: 'Price',    width: 100, type: 'number',
    formatter: v => `$${Number(v).toFixed(2)}` },
  { field: 'stock',    header: 'Stock',    width: 90,  type: 'number' },
  { field: 'rating',   header: 'Rating',   width: 90,  type: 'number',
    formatter: v => `★ ${Number(v).toFixed(1)}` },
];

const CATS = ['Electronics','Clothing','Food','Sports','Books','Home','Toys'];
const ADJ  = ['Premium','Basic','Pro','Ultra','Mini','Mega','Smart','Classic'];
const NOUN = ['Widget','Gadget','Device','Tool','Kit','Pack','Set','Bundle'];

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `${ADJ[i % ADJ.length]} ${NOUN[(i * 3) % NOUN.length]} ${i + 1}`,
    category: CATS[i % CATS.length],
    price: 4.99 + ((i * 173) % 49500) / 100,
    stock: (i * 37) % 500,
    rating: 1 + ((i * 11) % 40) / 10,
  }));
}

@Component({
  selector: 'demo-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Client-side pagination</h2>
        <span class="demo-meta">{{ ds.length.toLocaleString() }} rows · {{ filteredCount() }} visible</span>
        <div class="page-sizes">
          Page size:
          @for (n of pageSizes; track n) {
            <button class="ps-btn" [class.ps-btn--active]="ctrl.pageSize() === n" (click)="ctrl.setPageSize(n)">{{ n }}</button>
          }
        </div>
      </div>
      <agrid
        class="demo-grid"
        [provider]="provider"
        [zebraStripes]="true"
        [showSidebar]="true"
      />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-grid { flex: 1; min-height: 0; }
    .page-sizes { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #57606a; margin-left: auto; }
    .ps-btn { padding: 2px 10px; border: 1px solid #d0d7de; border-radius: 4px; background: none; cursor: pointer; font-size: 12px; font-family: inherit; }
    .ps-btn:hover { background: #f6f8fa; }
    .ps-btn--active { background: #1a73e8; color: #fff; border-color: #1a73e8; }
  `],
})
export class PaginationDemoComponent {
  readonly ds   = new AgridDataSource(makeRows(500));
  readonly ctrl = new AgridControl({ pageSize: 25 });
  readonly provider = new AgridProvider({ columns: COLUMNS, datasource: this.ds, control: this.ctrl });
  readonly pageSizes = [10, 25, 50, 100];
  readonly _grid = viewChild(AgridComponent);
  readonly filteredCount = computed(() => this._grid()?.filteredRowCount() ?? this.ds.length);

  constructor() {
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }
}
