import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';

interface OrderRow {
  id: number;
  customer: string;
  region: string;
  total: number;
  status: 'paid' | 'pending' | 'refunded';
  notes: string;
  isSummary?: boolean;
}

const REGIONS = ['EMEA', 'Americas', 'APAC'];
const STATUSES: OrderRow['status'][] = ['paid', 'pending', 'refunded'];

const ORDERS: OrderRow[] = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  customer: `Customer ${i + 1}`,
  region: REGIONS[i % REGIONS.length],
  total: 100 + ((i * 173) % 9000),
  status: STATUSES[i % STATUSES.length],
  notes: `Order #${i + 1} placed on day ${(i % 28) + 1}. Handled by the ${REGIONS[i % REGIONS.length]} team.`,
}));

// A summary row lives in the data source and is pinned to the bottom (kept fully interactive).
const SUMMARY: OrderRow = {
  id: 0,
  customer: 'TOTAL',
  region: '',
  total: ORDERS.reduce((sum, o) => sum + o.total, 0),
  status: 'paid',
  notes: '',
  isSummary: true,
};

const COLUMNS: ColDef<OrderRow>[] = [
  { field: 'id', header: 'ID', width: 70, editable: false },
  { field: 'customer', header: 'Customer', width: 160, filterable: true },
  { field: 'region', header: 'Region', width: 120, filterable: true, groupable: true },
  { field: 'total', header: 'Total', width: 120, type: 'number', filterable: true,
    formatter: (v: unknown) => `$${Number(v).toLocaleString()}` },
  { field: 'status', header: 'Status', width: 120,
    values: ['paid', 'pending', 'refunded'],
    cellClass: ({ value }: { value: unknown }) => (value === 'refunded' ? 'cell-refunded' : '') },
  { field: 'notes', header: 'Notes', width: 220 },
];

@Component({
  selector: 'demo-master-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Master / Detail &amp; Pinned Rows</h2>
        <span class="demo-meta">
          Expand a row, then click its Notes field to edit multiline text · the TOTAL row is pinned to the bottom ·
          right-click any row to pin/unpin it · pending orders are tinted via getRowClass
        </span>
      </div>
      <agrid class="demo-grid" [provider]="provider" (detailAction)="detailAction($event)"/>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-grid { flex: 1; min-height: 0; }

    /* row + cell classes referenced by the provider/column config */
    .demo-grid ::ng-deep .row-pending agrid-cell:not(.editing) { background: #fffbe6; }
    .demo-grid ::ng-deep .row-summary agrid-cell:not(.editing) { font-weight: 700; background: #eef2ff; }
    .demo-grid ::ng-deep .cell-refunded { color: #d1242f; }
    .demo-grid ::ng-deep .od-detail { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #3c4043; }
  `],
})
export class MasterDetailDemoComponent {
  readonly provider = new AgridProvider<OrderRow>({
    columns: COLUMNS,
    datasource: new AgridDataSource<OrderRow>([...ORDERS, SUMMARY]),
    control: new AgridControl(),
    zebraStripes: true,
    rowSelection: 'multi',
    getRowClass: ({ row }: { row: OrderRow; index: number }) =>
      row.isSummary ? 'row-summary' : row.status === 'pending' ? 'row-pending' : '',
    pinRow: (row: OrderRow) => (row.isSummary ? 'bottom' : undefined),
    masterDetail: true,
    detailRowHeight: 220,
    detailColumnField: 'notes',
    detailActions: [
      { id:"fup", label: 'Follow-up', text: '\nFollow-up required with customer.' },
      { id:"rn", label: 'Region note', text: ({ row }) => `\nCoordinate with ${row.region} operations.` },
      { id:"pna", label: 'Paid note' },
    ],
    detailRenderer: ({ row }: { row: OrderRow }) => `
      <div class="od-detail">
        <div><strong>Customer:</strong> ${row.customer}</div>
        <div><strong>Region:</strong> ${row.region}</div>
        <div><strong>Total:</strong> $${Number(row.total).toLocaleString()}</div>
        <div><strong>Status:</strong> ${row.status}</div>
      </div>`,
  });

  detailAction(event:any) {
    console.log(event);
  }
}
