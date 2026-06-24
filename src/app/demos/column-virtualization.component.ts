import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';

const COLUMN_COUNT = 60;
const ROW_COUNT = 1_000;

const COLUMNS: ColDef[] = [
  { field: 'id', header: 'ID', width: 70, editable: false, pinned: 'left', locked: true },
  { field: 'name', header: 'Name', width: 150, pinned: 'left', filterable: true },
  ...Array.from({ length: COLUMN_COUNT }, (_, i): ColDef => ({
    field: `m${i + 1}`,
    header: `Metric ${i + 1}`,
    width: 110,
    type: 'number',
    aggregate: i % 5 === 0 ? 'sum' : undefined,
  })),
];

function makeRows(n: number) {
  return Array.from({ length: n }, (_, r) => {
    const row: Record<string, unknown> = { id: r + 1, name: `Row ${r + 1}` };
    for (let c = 1; c <= COLUMN_COUNT; c++) {
      row[`m${c}`] = (r * 31 + c * 17) % 1000;
    }
    return row;
  });
}

@Component({
  selector: 'demo-column-virtualization',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Column virtualization</h2>
        <span class="demo-meta">
          {{ rowCount.toLocaleString() }} rows × {{ totalColumns }} columns — only the columns near the
          horizontal viewport are rendered per row
        </span>
      </div>
      <agrid class="demo-grid" [provider]="provider" />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-grid { flex: 1; min-height: 0; }
  `],
})
export class ColumnVirtualizationDemoComponent {
  readonly rowCount = ROW_COUNT;
  readonly totalColumns = COLUMNS.length;
  readonly provider = new AgridProvider({
    columns: COLUMNS,
    datasource: new AgridDataSource(makeRows(ROW_COUNT)),
    control: new AgridControl(),
    zebraStripes: true,
  });

  readonly _grid = viewChild(AgridComponent);
}
