import { ChangeDetectionStrategy, Component, afterNextRender, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef, ColDefAutoSize } from '@thkl/agrid';

const PREVIEW_COLUMNS: ColDef[] = [
  { field: 'name',       header: 'Name',       width: ColDefAutoSize, filterable: true },
  { field: 'role',       header: 'Role',        width: ColDefAutoSize, filterable: true },
  { field: 'department', header: 'Department',  width: ColDefAutoSize, filterable: true, groupable: true,
    values: [
      { value: 'eng',     label: 'Engineering' },
      { value: 'design',  label: 'Design' },
      { value: 'product', label: 'Product' },
      { value: 'sales',   label: 'Sales' },
    ],
  },
  { field: 'salary', header: 'Salary', width: ColDefAutoSize, type: 'number', aggregate: 'sum' },
  { field: 'joined', header: 'Joined', width: ColDefAutoSize, type: 'date' },
];

const PREVIEW_ROWS = [
  { name: 'Alice Chen',     role: 'Senior Engineer',  department: 'eng',     salary: 145000, joined: '2021-03-15' },
  { name: 'Bob Müller',     role: 'Product Designer', department: 'design',  salary: 118000, joined: '2020-07-22' },
  { name: 'Carol Park',     role: 'Product Manager',  department: 'product', salary: 132000, joined: '2022-01-10' },
  { name: 'David Osei',     role: 'Engineer',         department: 'eng',     salary: 128000, joined: '2023-02-28' },
  { name: 'Emma Torres',    role: 'Sales Lead',       department: 'sales',   salary: 105000, joined: '2019-11-05' },
  { name: 'Frank Liu',      role: 'Staff Engineer',   department: 'eng',     salary: 165000, joined: '2018-06-18' },
  { name: 'Grace Yamamoto', role: 'Designer',         department: 'design',  salary: 112000, joined: '2022-09-01' },
  { name: 'Henry Okafor',   role: 'Engineer',         department: 'eng',     salary: 122000, joined: '2023-06-12' },
  { name: 'Iris Svensson',  role: 'Sales Rep',        department: 'sales',   salary:  97000, joined: '2024-01-20' },
  { name: 'James Nguyen',   role: 'PM',               department: 'product', salary: 138000, joined: '2021-08-03' },
];

const FEATURES: { color: string; bg: string; label: string; title: string; desc: string }[] = [
  { color: '#4f46e5', bg: '#eef2ff', label: '⌨', title: 'Keyboard-driven editing',  desc: 'Enter / F2 to edit, Tab to confirm, Escape to cancel. No mouse required.' },
  { color: '#0891b2', bg: '#ecfeff', label: '⇅', title: 'Sorting & filtering',       desc: 'Multi-column sort with Shift-click. Per-column dropdown filters with label resolution.' },
  { color: '#7c3aed', bg: '#f5f3ff', label: '⊞', title: 'Grouping & aggregates',     desc: 'Group by any column with custom group descriptions and aggregate footer rows.' },
  { color: '#059669', bg: '#ecfdf5', label: '⚡', title: 'Client & server pagination', desc: 'Built-in page controls for both local datasets and remote API-driven sources.' },
  { color: '#d97706', bg: '#fffbeb', label: '◧', title: 'Custom cell renderers',      desc: 'Plug in any Angular component as a cell renderer for rich, interactive cells.' },
  { color: '#db2777', bg: '#fdf2f8', label: '⇆', title: 'Column reordering & pinning', desc: 'Drag headers to rearrange columns. Pin columns left or right to keep them visible.' },
  { color: '#0284c7', bg: '#f0f9ff', label: '☑', title: 'Multi-row selection',        desc: 'Click, Shift-click, and Ctrl-click for single or range selection.' },
  { color: '#16a34a', bg: '#f0fdf4', label: '↧', title: 'CSV export',                 desc: 'Export the current filtered and sorted view to CSV in a single call.' },
  { color: '#9333ea', bg: '#faf5ff', label: '⌕', title: 'Find panel',                 desc: 'Ctrl+F opens a live search bar that highlights matching cells across all columns.' },
  { color: '#0f766e', bg: '#f0fdfa', label: '⋮', title: 'Column sidebar',             desc: 'Slide-out panel to toggle visibility, reorder, and resize columns.' },
  { color: '#b45309', bg: '#fef3c7', label: '↕', title: 'Row drag-reorder',           desc: 'Optional drag handle lets users manually reorder rows.' },
  { color: '#7c3aed', bg: '#eff6ff', label: '◻', title: 'Virtual scrolling',          desc: 'Only visible rows are rendered — handles large datasets without slowdown.' },
];

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AgridComponent],
  template: `
    <div class="page">

      <!-- Hero -->
      <section class="hero">
        <div class="hero-inner">
          <div class="hero-badge">Angular · Signals · Zero deps</div>
          <h1 class="hero-title">The Angular data grid<br>that stays out of your way</h1>
          <p class="hero-sub">
            agrid is a fast, keyboard-first data grid built with Angular signals.<br>
            Sorting, filtering, editing, grouping — all wired up from a single provider.
          </p>
          <div class="hero-actions">
            <a class="btn btn-white" routerLink="/demo">Explore demos →</a>
            <a class="btn btn-outline" href="https://github.com/thkl/agrid" target="_blank" rel="noopener">
              <svg class="github-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                  0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                  -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                  .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                  -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
                  .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
                  .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
                  0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>

        <!-- Browser frame -->
        <div class="browser-frame">
          <div class="browser-bar">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
            <div class="browser-url">agrid demo — 10 rows · 5 columns</div>
          </div>
          <div class="browser-content">
            <agrid
              class="preview-grid"
              [provider]="previewProvider"
            />
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="features">
        <div class="features-inner">
          <div class="section-label">Features</div>
          <h2 class="section-title">Everything in the box</h2>
          <p class="section-sub">{{ features.length }} capabilities ready to use — configure what you need, ignore the rest.</p>
          <div class="feature-grid">
            @for (f of features; track f.title) {
              <div class="feature-card">
                <span class="feature-badge" [style.background]="f.bg" [style.color]="f.color">{{ f.label }}</span>
                <div class="feature-text">
                  <div class="feature-name">{{ f.title }}</div>
                  <div class="feature-desc">{{ f.desc }}</div>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Demo links -->
      <section class="demos">
        <div class="demos-inner">
          <div class="section-label">Live demos</div>
          <h2 class="section-title">See it in action</h2>
          <div class="demo-cards">
            <a class="demo-card" routerLink="/demo">
              <div class="demo-card-title">Overview</div>
              <div class="demo-card-desc">Full-featured grid with editing, grouping, filtering, and CSV export.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/custom-cells">
              <div class="demo-card-title">Custom cells</div>
              <div class="demo-card-desc">Angular components rendered directly inside grid cells.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/pagination">
              <div class="demo-card-title">Pagination</div>
              <div class="demo-card-desc">Client-side pagination with configurable page size.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/server-pagination">
              <div class="demo-card-title">Server pagination</div>
              <div class="demo-card-desc">Remote data source with simulated API latency.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/aggregates">
              <div class="demo-card-title">Aggregates</div>
              <div class="demo-card-desc">Sum, average, and count footers per column.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/pinning">
              <div class="demo-card-title">Column pinning</div>
              <div class="demo-card-desc">Freeze columns to the left or right edge while scrolling.</div>
              <span class="demo-card-link">Open →</span>

              
            </a>
            <a class="demo-card" routerLink="/performance">
              <div class="demo-card-title">Performance Test</div>
              <div class="demo-card-desc">Run a performance test with up to 250k Records</div>
              <span class="demo-card-link">Open →</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  `,
  styles: `
    :host { 
      display: block; 
      overflow:auto;
      scrollbar-width: thin,
    }

    :host::-webkit-scrollbar {
      height:8px
    }


    .page {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow-y: auto;
      height: 100%;
      background: #fff;
      color: #111827;
    }

    /* ── Hero ──────────────────────────────── */
    .hero {
      background: linear-gradient(145deg, #052e16 0%, #14532d 40%, #166534 100%);
      padding: 60px 48px 56px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
    }

    .hero-inner {
      text-align: center;
      max-width: 660px;
    }

    .hero-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #86efac;
      background: #ffffff18;
      border: 1px solid #ffffff30;
      border-radius: 20px;
      padding: 3px 12px;
      margin-bottom: 18px;
    }

    .hero-title {
      margin: 0 0 16px;
      font-size: 42px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.5px;
      color: #fff;
    }

    .hero-sub {
      margin: 0 0 28px;
      font-size: 15px;
      line-height: 1.7;
      color: #bbf7d0;
    }

    .hero-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      padding: 9px 22px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: transform 80ms, box-shadow 80ms;
    }

    .btn:hover { transform: translateY(-1px); }

    .btn-white {
      background: #fff;
      color: #166534;
      box-shadow: 0 2px 12px #00000020;
    }

    .btn-white:hover { box-shadow: 0 4px 20px #00000030; }

    .btn-outline {
      background: transparent;
      color: #fff;
      border: 1.5px solid #ffffff50;
    }

    .btn-outline:hover { background: #ffffff12; }

    .github-icon {
      width: 16px;
      height: 16px;
      margin-right: 7px;
      flex-shrink: 0;
    }

    /* ── Browser frame ────────────────────── */
    .browser-frame {
      width: 100%;
      max-width: 860px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 24px 64px #00000050, 0 0 0 1px #ffffff20;
    }

    .browser-bar {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 10px 14px;
      background: #e5e7eb;
    }

    .dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }
    .dot-red    { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green  { background: #10b981; }

    .browser-url {
      margin-left: 8px;
      flex: 1;
      background: #f9fafb;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 3px 12px;
      font-size: 12px;
      color: #6b7280;
    }

    .browser-content {
      height: 320px;
      background: #fff;
    }

    .preview-grid {
      width: 100%;
      height: 100%;
    }

    /* ── Sections shared ──────────────────── */
    .section-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #7c3aed;
      margin-bottom: 8px;
    }

    .section-title {
      margin: 0 0 8px;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #111827;
    }

    .section-sub {
      margin: 0 0 36px;
      font-size: 15px;
      color: #6b7280;
    }

    /* ── Features ─────────────────────────── */
    .features {
      border-bottom: 1px solid #f3f4f6;
    }

    .features-inner {
      max-width: 1040px;
      margin: 0 auto;
      padding: 64px 48px;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 14px;
    }

    .feature-card {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 18px;
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 1px 3px #0000000a;
      transition: box-shadow 120ms, border-color 120ms, transform 120ms;
    }

    .feature-card:hover {
      box-shadow: 0 4px 16px #0000001a;
      border-color: #e5e7eb;
      transform: translateY(-1px);
    }

    .feature-badge {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .feature-name {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }

    .feature-desc {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.55;
    }

    /* ── Demo cards ───────────────────────── */
    .demos {
      background: #fafafa;
    }

    .demos-inner {
      max-width: 1040px;
      margin: 0 auto;
      padding: 64px 48px 72px;
    }

    .demo-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 14px;
    }

    .demo-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 20px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      text-decoration: none;
      box-shadow: 0 1px 3px #0000000a;
      transition: box-shadow 120ms, border-color 120ms, transform 120ms;
    }

    .demo-card:hover {
      box-shadow: 0 6px 20px #0000001a;
      border-color: #a5b4fc;
      transform: translateY(-2px);
    }

    .demo-card-title {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }

    .demo-card-desc {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.55;
      flex: 1;
    }

    .demo-card-link {
      font-size: 12px;
      font-weight: 600;
      color: #4f46e5;
      margin-top: 4px;
    }
  `,
})
export class HomeComponent {
  readonly features = FEATURES;

  readonly ds = new AgridDataSource(PREVIEW_ROWS);
  readonly control = new AgridControl({ pageSize: 10 });
  readonly previewProvider = new AgridProvider({
    locale: 'auto',
    columns: PREVIEW_COLUMNS,
    datasource: this.ds,
    control: this.control,
    allowAddRows: false,
    showControlColumn: false,
    showSidebar: false,
    zebraStripes: true,
    rowSelection: 'single',
  });

  readonly _grid = viewChild(AgridComponent);

  constructor() {
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }
}
