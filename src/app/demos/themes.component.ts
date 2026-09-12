import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider, AgridTheme } from '../agrid/agrid-provider';

type ThemeRow = {
  order: string;
  account: string;
  region: string;
  status: string;
  value: number;
  owner: string;
};

type ThemeCellClassParams = Parameters<NonNullable<ColDef<ThemeRow>['cellClass']>>[0];

const THEME_OPTIONS: { value: AgridTheme; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'space', label: 'Space' },
];

const COLUMNS: ColDef<ThemeRow>[] = [
  { field: 'order', header: 'Order', width: 110, editable: false, locked: true },
  { field: 'account', header: 'Account', width: 190, filterable: true },
  { field: 'region', header: 'Region', width: 120, values: ['EU', 'US', 'APAC', 'LATAM'], filterable: true },
  {
    field: 'status',
    header: 'Status',
    width: 130,
    values: ['Draft', 'Review', 'Approved', 'Blocked'],
    cellClass: (params: ThemeCellClassParams) => params.value === 'Blocked' ? 'theme-status-blocked' : '',
  },
  { field: 'value', header: 'Value', width: 120, type: 'number', aggregate: 'sum' },
  { field: 'owner', header: 'Owner', width: 150, filterable: true },
];

const ROWS: ThemeRow[] = [
  { order: 'SO-1029', account: 'Nordfeld Systems', region: 'EU', status: 'Approved', value: 12800, owner: 'Mira' },
  { order: 'SO-1030', account: 'Blueport Retail', region: 'US', status: 'Review', value: 8400, owner: 'Jonas' },
  { order: 'SO-1031', account: 'Cinder Labs', region: 'APAC', status: 'Draft', value: 6100, owner: 'Amara' },
  { order: 'SO-1032', account: 'Haven Medical', region: 'EU', status: 'Blocked', value: 15200, owner: 'Nora' },
  { order: 'SO-1033', account: 'Orbit Foods', region: 'LATAM', status: 'Approved', value: 9300, owner: 'Leo' },
  { order: 'SO-1034', account: 'Kite Analytics', region: 'US', status: 'Review', value: 11800, owner: 'Sam' },
];

@Component({
  selector: 'demo-themes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <div>
          <h1>Themes</h1>
          <p>Switch built-in grid presets at runtime without forcing the whole page into a competing light or dark mode.</p>
        </div>
        <div class="theme-switcher" role="group" aria-label="Grid theme">
          @for (option of themeOptions; track option.value) {
            <button
              type="button"
              [class.active]="theme() === option.value"
              [attr.aria-pressed]="theme() === option.value"
              (click)="setTheme(option.value)"
            >{{ option.label }}</button>
          }
        </div>
      </div>

      <div class="demo-body">
        <agrid class="demo-grid" [provider]="provider" />
        <aside>
          <div class="panel-title">API</div>
          <pre>{{ code() }}</pre>
        </aside>
      </div>
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--app-bg, #f7f9f7);
      color: var(--app-text, #17221b);
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

    .theme-switcher {
      display: inline-flex;
      flex: 0 0 auto;
      overflow: hidden;
      border: 1px solid var(--app-border, #dce5df);
      border-radius: 6px;
      background: var(--app-surface, #ffffff);
    }

    .theme-switcher button {
      min-width: 78px;
      height: 32px;
      border: 0;
      border-right: 1px solid var(--app-border, #dce5df);
      background: transparent;
      color: var(--app-text, #17221b);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .theme-switcher button:last-child {
      border-right: 0;
    }

    .theme-switcher button.active {
      background: var(--app-accent, #187443);
      color: var(--app-bg, #ffffff);
      font-weight: 700;
    }

    .demo-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 12px;
      flex: 1;
      min-height: 0;
    }

    .demo-grid {
      min-width: 0;
      min-height: 0;
    }

    aside {
      min-width: 0;
      overflow: auto;
      border: 1px solid var(--app-border, #dce5df);
      border-radius: 6px;
      background: var(--app-surface, #ffffff);
      color: var(--app-text, #17221b);
    }

    .panel-title {
      padding: 10px 12px;
      border-bottom: 1px solid var(--app-border, #dce5df);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--app-text-muted, #66736b);
      background: var(--app-surface-muted, #f1f5f2);
    }

    pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre-wrap;
    }

    :host ::ng-deep .theme-status-blocked {
      color: var(--agrid-color-danger);
      font-weight: 700;
    }

    @media (max-width: 900px) {
      .demo-header,
      .demo-body {
        display: flex;
        flex-direction: column;
      }

      aside {
        max-height: 220px;
      }
    }
  `],
})
export class ThemesDemoComponent {
  readonly themeOptions = THEME_OPTIONS;
  readonly theme = signal<AgridTheme>('morning');
  readonly datasource = new AgridDataSource(ROWS);
  readonly provider = new AgridProvider<ThemeRow>({
    columns: COLUMNS,
    datasource: this.datasource,
    control: new AgridControl({ pageSize: 10 }),
    theme: this.theme(),
    showSidebar: true,
    enableQuickFilter: true,
    showFormulaBar: true,
    zebraStripes: true,
  });

  readonly code = computed(() => `readonly provider = new AgridProvider({
  columns,
  datasource,
  theme: '${this.theme()}',
});

setTheme(theme: AgridTheme): void {
  this.provider.setTheme(theme);
}

/* Optional product override */
agrid {
  --agrid-color-accent: #0f766e;
}`);

  setTheme(theme: AgridTheme): void {
    this.theme.set(theme);
    this.provider.setTheme(theme);
  }
}
