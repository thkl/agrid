import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef } from '../agrid';

interface FormulaRow { item: string; amount: number; tax: number; total: string; average: string; }

const ROWS: FormulaRow[] = [
  { item: 'Design work', amount: 1200, tax: 192, total: '=B1+C1', average: '=AVERAGE(B1:C1)' },
  { item: 'Implementation', amount: 2800, tax: 448, total: '=B2+C2', average: '=AVERAGE(B2:C2)' },
  { item: 'Support', amount: 900, tax: 144, total: '=B3+C3', average: '=AVERAGE(B3:C3)' },
  { item: 'Training', amount: 650, tax: 104, total: '=B4+C4', average: '=AVERAGE(B4:C4)' },
];

const COLUMNS: ColDef<FormulaRow>[] = [
  { field: 'item', header: 'Item', width: 150, editable: false },
  { field: 'amount', header: 'Amount', width: 110, type: 'number', formatter: (value: unknown) => `$${Number(value).toLocaleString()}` },
  { field: 'tax', header: 'Tax', width: 100, type: 'number', formatter: (value: unknown) => `$${Number(value).toLocaleString()}` },
  { field: 'total', header: 'Total (=B+C)', width: 130, formula: true, editor: 'formula', formatter: (value: unknown) => `$${Number(value).toLocaleString()}` },
  { field: 'average', header: 'Average', width: 150, formula: true, editor: 'formula', formatter: (value: unknown) => `$${Number(value).toFixed(2)}` },
];

@Component({
  selector: 'demo-formulas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div><h2>Formula cells</h2><p>Excel-style references recalculate when source cells change.</p></div>
        <code>=B1+C1</code>
      </header>
      <aside class="demo-hint">Edit Amount or Tax and watch Total and Average update. Formula columns use the formula editor and formula bar.</aside>
      <agrid class="demo-grid" [provider]="provider" />
    </main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex: 1; flex-direction: column; min-height: 0; gap: 10px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
    h2 { margin: 0 0 4px; font-size: 18px; } p { margin: 0; color: #57606a; font-size: 13px; }
    code { border: 1px solid #c7d2e0; border-radius: 5px; background: #f6f8fa; color: #1558b0; padding: 7px 10px; }
    .demo-hint { border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; color: #57606a; font-size: 12px; padding: 9px 12px; }
    .demo-grid { flex: 1; min-height: 0; }
    :host-context(.dark-theme) p { color: #9ca3af; }
    :host-context(.dark-theme) code, :host-context(.dark-theme) .demo-hint { border-color: #30363d; background: #161b22; color: #9ca3af; }
  `],
})
export class FormulasDemoComponent {
  readonly provider = new AgridProvider<FormulaRow>({
    columns: COLUMNS,
    datasource: new AgridDataSource(ROWS),
    control: new AgridControl(),
    showFormulaBar: true,
    zebraStripes: true,
  });
}
