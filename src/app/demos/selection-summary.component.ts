import { ChangeDetectionStrategy, Component, computed, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef } from '../agrid';

interface RevenueRow {
  month: string;
  north: number;
  south: number;
  east: number;
  west: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currency = (value: unknown): string =>
  Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const COLUMNS: ColDef<RevenueRow>[] = [
  { field: 'month', header: 'Month', width: 130, editable: false, locked: true },
  { field: 'north', header: 'North', width: 135, type: 'number', formatter: currency, textAlign: 'right' },
  { field: 'south', header: 'South', width: 135, type: 'number', formatter: currency, textAlign: 'right' },
  { field: 'east', header: 'East', width: 135, type: 'number', formatter: currency, textAlign: 'right' },
  { field: 'west', header: 'West', width: 135, type: 'number', formatter: currency, textAlign: 'right' },
];

const ROWS: RevenueRow[] = MONTHS.map((month, index) => ({
  month,
  north: 42_000 + ((index * 7_900) % 31_000),
  south: 36_000 + ((index * 5_300) % 29_000),
  east: 48_000 + ((index * 6_700) % 33_000),
  west: 39_000 + ((index * 8_100) % 35_000),
}));

@Component({
  selector: 'demo-selection-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <main class="demo-wrap">
      <header class="demo-header">
        <div>
          <h2>Selection status bar</h2>
          <p>Select a rectangle of revenue cells to calculate live spreadsheet statistics.</p>
        </div>
        @if (summary(); as value) {
          <div class="signal-preview" aria-label="Selection summary signal">
            <span>selectionSummary()</span>
            <strong>{{ value.count }} numeric cells · {{ format(value.sum) }} total</strong>
          </div>
        }
      </header>

      <aside class="demo-hint">
        Click a revenue cell, then <strong>Shift+click</strong> another cell—or drag across cells.
        Edit a selected value to see the summary update immediately.
      </aside>

      <agrid #grid class="demo-grid" [provider]="provider" />
    </main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex: 1; flex-direction: column; min-height: 0; gap: 10px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0; color: #57606a; font-size: 13px; }
    .demo-hint { padding: 9px 12px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; color: #57606a; font-size: 12px; }
    .signal-preview { display: grid; gap: 2px; min-width: 220px; padding: 8px 12px; border: 1px solid #c8d8f8; border-radius: 6px; background: #eef4ff; text-align: right; }
    .signal-preview span { color: #57606a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .signal-preview strong { color: #1558b0; font-size: 12px; }
    .demo-grid { flex: 1; min-height: 0; }
    :host-context(.dark-theme) p { color: #9ca3af; }
    :host-context(.dark-theme) .demo-hint { border-color: #30363d; background: #161b22; color: #9ca3af; }
    :host-context(.dark-theme) .signal-preview { border-color: #315a91; background: #13233a; }
    :host-context(.dark-theme) .signal-preview span { color: #9ca3af; }
    :host-context(.dark-theme) .signal-preview strong { color: #8ab4f8; }
    @media (max-width: 720px) { .demo-header { align-items: stretch; flex-direction: column; } .signal-preview { text-align: left; } }
  `],
})
export class SelectionSummaryDemoComponent {
  readonly grid = viewChild<AgridComponent<RevenueRow>>('grid');
  readonly summary = computed(() => this.grid()?.selectionSummary() ?? null);

  readonly provider = new AgridProvider<RevenueRow>({
    columns: COLUMNS,
    datasource: new AgridDataSource(ROWS),
    control: new AgridControl(),
    zebraStripes: true,
  });

  format(value: number): string {
    return currency(value);
  }
}
