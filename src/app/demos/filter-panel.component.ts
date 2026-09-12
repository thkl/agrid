import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef } from '../agrid';

type TicketRow = {
  id: string;
  customer: string;
  status: 'New' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
  priority: 'Low' | 'Medium' | 'High';
  region: 'EU' | 'US' | 'APAC';
  value: number;
  created: string;
  owner: string;
};

const ROWS: TicketRow[] = [
  { id: 'OP-1042', customer: 'Northwind Systems', status: 'Qualified', priority: 'High', region: 'EU', value: 48000, created: '2026-08-04', owner: 'Mira' },
  { id: 'OP-1043', customer: 'Blueport Retail', status: 'Proposal', priority: 'Medium', region: 'US', value: 32000, created: '2026-08-09', owner: 'Noah' },
  { id: 'OP-1044', customer: 'Kite Analytics', status: 'Won', priority: 'High', region: 'APAC', value: 76000, created: '2026-08-14', owner: 'Sam' },
  { id: 'OP-1045', customer: 'Haven Medical', status: 'New', priority: 'Low', region: 'EU', value: 18500, created: '2026-08-18', owner: 'Nora' },
  { id: 'OP-1046', customer: 'Orbit Foods', status: 'Lost', priority: 'Medium', region: 'US', value: 22400, created: '2026-08-23', owner: 'Leo' },
  { id: 'OP-1047', customer: 'Cinder Labs', status: 'Qualified', priority: 'High', region: 'APAC', value: 54000, created: '2026-08-28', owner: 'Amara' },
  { id: 'OP-1048', customer: 'Vector Works', status: 'Proposal', priority: 'Low', region: 'EU', value: 41000, created: '2026-09-02', owner: 'Mira' },
  { id: 'OP-1049', customer: 'Polar Grid', status: 'Won', priority: 'Medium', region: 'US', value: 69000, created: '2026-09-07', owner: 'Noah' },
];

const COLUMNS: ColDef<TicketRow>[] = [
  { field: 'id', header: 'ID', width: 100, editable: false, locked: true, filterable: true },
  { field: 'customer', header: 'Customer', width: 190, filterable: true },
  { field: 'status', header: 'Status', width: 130, filterable: true, values: ['New', 'Qualified', 'Proposal', 'Won', 'Lost'] },
  { field: 'priority', header: 'Priority', width: 120, filterable: true, values: ['Low', 'Medium', 'High'] },
  { field: 'region', header: 'Region', width: 110, filterable: true, values: ['EU', 'US', 'APAC'] },
  { field: 'value', header: 'Value', width: 120, type: 'number', filterable: true, aggregate: 'sum' },
  { field: 'created', header: 'Created', width: 130, type: 'date', filterable: true },
  { field: 'owner', header: 'Owner', width: 120, filterable: true, values: ['Mira', 'Noah', 'Sam', 'Nora', 'Leo', 'Amara'] },
];

@Component({
  selector: 'demo-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <div>
          <h1>Filter tool panel</h1>
          <p>Inspect, edit, and clear grid filters from the sidebar while the header filters stay in sync.</p>
        </div>
        <div class="demo-stats">
          <span>{{ visibleCount() }} visible</span>
          <span>{{ activeFilterCount() }} active</span>
        </div>
      </div>

      <agrid class="demo-grid" [provider]="provider" />
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .demo-wrap {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      gap: 12px;
      padding: 16px;
      background: var(--app-bg, #f7f9f7);
      color: var(--app-text, #17221b);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .demo-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
    }

    p {
      margin: 4px 0 0;
      color: var(--app-text-muted, #66736b);
      font-size: 12px;
      line-height: 1.4;
    }

    .demo-stats {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }

    .demo-stats span {
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      padding: 0 9px;
      border: 1px solid var(--app-border, #dce5df);
      border-radius: 4px;
      background: var(--app-surface, #ffffff);
      color: var(--app-text-muted, #66736b);
      font-size: 12px;
      font-weight: 650;
    }

    .demo-grid {
      min-width: 0;
      min-height: 0;
      flex: 1;
    }

    @media (max-width: 720px) {
      .demo-header {
        flex-direction: column;
      }

      .demo-stats {
        justify-content: flex-start;
      }
    }
  `],
})
export class FilterPanelDemoComponent {
  readonly control = new AgridControl({
    pageSize: 0,
    filters: {
      priority: { text: '', selectedValues: ['High', 'Medium'], sort: null },
      value: { text: '', selectedValues: null, sort: null, operator: 'gte', operand: '30000' },
    },
    quickFilter: 'o',
  });
  readonly datasource = new AgridDataSource<TicketRow>(ROWS);
  readonly provider = new AgridProvider<TicketRow>({
    columns: COLUMNS,
    datasource: this.datasource,
    control: this.control,
    showSidebar: true,
    showFilterPanel: true,
    resizableSidebar: true,
    sidebarWidth: 300,
    enableQuickFilter: true,
    zebraStripes: true,
    showFormulaBar: true,
    enableExportButtons: true,
  });

  readonly visibleCount = computed(() => this.provider.visibleRows()?.length ?? ROWS.length);
  readonly activeFilterCount = computed(() => {
    const filters = Object.values(this.control.filters())
      .filter(filter => !!filter.text || filter.selectedValues !== null || !!filter.operator);
    return filters.length + (this.control.quickFilter() ? 1 : 0);
  });
}
