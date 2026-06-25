import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgridComponent, AgridControl, AgridDataSource, AgridProvider, ColDef, AgridChartComponent, AgridChartProvider, AgridChartType, AgridChartData } from '../agrid';
import { ColDefAutoSize } from '../agrid/agrid.types';
import { ThemeService } from '../theme.service';

const DEPARTEMENTS = [
  { value: 'eng', label: 'Engineering' },
  { value: 'design', label: 'Design' },
  { value: 'product', label: 'Product' },
  { value: 'sales', label: 'Sales' },
]


const PREVIEW_COLUMNS: ColDef[] = [
  { field: 'name', header: 'Name', width: ColDefAutoSize, filterable: true },
  { field: 'role', header: 'Role', width: ColDefAutoSize, filterable: true },
  {
    field: 'department', header: 'Department', width: ColDefAutoSize, filterable: true, groupable: true,
    values: DEPARTEMENTS,
  },
  { field: 'salary', header: 'Salary', width: ColDefAutoSize, type: 'number', aggregate: 'sum' },
  { field: 'joined', header: 'Joined', width: ColDefAutoSize, type: 'date' },
];

interface PreviewRecord {
  name: string,
  role: string,
  department: string,
  salary: number,
  joined: string
}


const PREVIEW_ROWS: PreviewRecord[] = [
  { name: 'Alice Chen', role: 'Senior Engineer', department: 'eng', salary: 145000, joined: '2021-03-15' },
  { name: 'Bob Müller', role: 'Product Designer', department: 'design', salary: 118000, joined: '2020-07-22' },
  { name: 'Carol Park', role: 'Product Manager', department: 'product', salary: 132000, joined: '2022-01-10' },
  { name: 'David Osei', role: 'Engineer', department: 'eng', salary: 128000, joined: '2023-02-28' },
  { name: 'Emma Torres', role: 'Sales Lead', department: 'sales', salary: 105000, joined: '2019-11-05' },
  { name: 'Frank Liu', role: 'Staff Engineer', department: 'eng', salary: 165000, joined: '2018-06-18' },
  { name: 'Grace Yamamoto', role: 'Designer', department: 'design', salary: 112000, joined: '2022-09-01' },
  { name: 'Henry Okafor', role: 'Engineer', department: 'eng', salary: 122000, joined: '2023-06-12' },
  { name: 'Iris Svensson', role: 'Sales Rep', department: 'sales', salary: 97000, joined: '2024-01-20' },
  { name: 'James Nguyen', role: 'PM', department: 'product', salary: 138000, joined: '2021-08-03' },
];

const FEATURES: { color: string; bg: string; label: string; title: string; desc: string; isNew?: boolean }[] = [
  { color: '#4f46e5', bg: '#eef2ff', label: '⌨', title: 'Keyboard-driven editing', desc: 'Enter or F2 to edit, Tab to confirm, Escape to cancel. No mouse required.' },
  { color: '#0891b2', bg: '#ecfeff', label: '⇅', title: 'Sorting & filtering', desc: 'Multi-column sort with Shift-click. Per-column dropdown filters with label resolution.' },
  { color: '#7c3aed', bg: '#f5f3ff', label: '⊞', title: 'Grouping & aggregates', desc: 'Group by any column with custom group descriptions and aggregate footer rows.' },
  { color: '#0d9488', bg: '#f0fdfa', label: '⊟', title: 'Tree data', desc: 'Hierarchical rows from flat parent/child data, with expand/collapse and filter-aware ancestors.' },
  { color: '#059669', bg: '#ecfdf5', label: '⚡', title: 'Client & server pagination', desc: 'Built-in page controls for both local datasets and remote API-driven sources.' },
  { color: '#d97706', bg: '#fffbeb', label: '◧', title: 'Custom cell renderers', desc: 'Plug in any Angular component as a cell renderer for rich, interactive cells.' },
  { color: '#d97706', bg: '#fffbeb', label: '◧', title: 'Custom cell editors', desc: 'Plug in any Angular component as a cell editor for rich, interactive cells.' },
  { color: '#db2777', bg: '#fdf2f8', label: '⇆', title: 'Column reordering & pinning', desc: 'Drag headers to rearrange columns. Pin columns left or right to keep them visible.' },
  { color: '#0284c7', bg: '#f0f9ff', label: '☑', title: 'Multi-row selection', desc: 'Click, Shift-click, and Ctrl-click for single or range selection.' },
  { color: '#16a34a', bg: '#f0fdf4', label: '↧', title: 'CSV export', desc: 'Export the current filtered and sorted view to CSV in a single call.' },
  { color: '#9333ea', bg: '#faf5ff', label: '⌕', title: 'Find panel', desc: 'Ctrl+F opens a live search bar that highlights matching cells across all columns.' },
  { color: '#0f766e', bg: '#f0fdfa', label: '⋮', title: 'Column sidebar', desc: 'Slide-out panel to toggle visibility, reorder, and resize columns.' },
  { color: '#b45309', bg: '#fef3c7', label: '↕', title: 'Row drag-reorder', desc: 'Optional drag handle lets users manually reorder rows.' },
  { color: '#7c3aed', bg: '#eff6ff', label: '◻', title: 'Virtual scrolling', desc: 'Only visible rows are rendered — handles large datasets without slowdown.' },
  { color: '#2563eb', bg: '#eff6ff', label: '▦', title: 'Clipboard & cell ranges', desc: 'Select rectangular ranges, copy and paste TSV data, or drag to fill adjacent cells.' },
  { color: '#c2410c', bg: '#fff7ed', label: '⊕', title: 'Master-detail & pinned rows', desc: 'Expand rich detail panels and keep summary rows fixed at the top or bottom.' },
  { color: '#be123c', bg: '#fff1f2', label: '✓', title: 'Readonly & validation', desc: 'Switch modes at runtime and reject invalid edits with field-level feedback.' },
  { color: '#6d28d9', bg: '#f5f3ff', label: '▥', title: 'Pivot tables', desc: 'Build cross-tab views from the grid sidebar, including row, column, value, aggregate, and generated-column controls.', isNew: true },
  { color: '#047857', bg: '#ecfdf5', label: '∑', title: 'Tree node aggregates', desc: 'Roll up sum, average, count, or custom aggregates from descendant entries into every expandable tree node.', isNew: true },
  { color: '#0369a1', bg: '#f0f9ff', label: '↻', title: 'Persistable grid settings', desc: 'Load and save one serializable settings object so user layouts and pivot choices can round-trip through your backend.', isNew: true },
  { color: '#a16207', bg: '#fefce8', label: '⇥', title: 'Extended keyboard navigation', desc: 'Move by viewport with Page Up and Page Down, or jump to row and grid edges with Home and End.', isNew: true },
  { color: '#2563eb', bg: '#eff6ff', label: '◐', title: 'Charts / graphs', desc: 'Zero-dependency SVG column, bar, line, area, pie, and donut diagrams. Link to the grid to follow filters and sorting live.', isNew: true },
  { color: '#0d9488', bg: '#f0fdfa', label: '∿', title: 'Sparklines', desc: 'Tiny inline line and bar charts drawn per row from a number[] field, using a custom cell renderer.', isNew: true },
];

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AgridComponent, AgridChartComponent],
  template: `
    <div class="page" [class.dark-theme]="theme.darkMode()">

      <!-- Hero -->
      <section class="hero">
        <div class="hero-glow hero-glow-one"></div>
        <div class="hero-glow hero-glow-two"></div>
        <div class="hero-layout">
          <div class="hero-inner">
            <div class="hero-badge"><span></span> Built for Angular 21</div>
            <h1 class="hero-title">A powerful data grid that feels <em>native</em> to Angular.</h1>
            <p class="hero-sub">
              Fast, keyboard-first, and signal-powered. Editing, pivoting, tree rollups,
              filtering, and persistable user settings are ready from a single provider.
            </p>
            <div class="hero-actions">
              <a class="btn btn-white" routerLink="/demo">Explore the grid <span>→</span></a>
              <a class="btn btn-outline" routerLink="/documentation">Read the docs</a>
              <a class="btn btn-icon" href="https://github.com/thkl/agrid" target="_blank" rel="noopener" aria-label="View aGrid on GitHub">
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
              </a>
            </div>
            <div class="hero-proof">
              <div><strong>Zero</strong><span>runtime dependencies</span></div>
              <div><strong>250k</strong><span>row demo</span></div>
              <div><strong>Signals</strong><span>at the core</span></div>
            </div>
          </div>

          <div class="live-demo">
          <!-- Browser frame -->
          
          <div class="browser-wrap" [class.browser-wrap-focus]="focusGrid()">
            <div class="browser-note browser-note-top">Signal-powered</div>
            <div class="browser-frame">
              <div class="browser-bar">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
                <div class="browser-url"><span class="url-lock">◆</span>thkl.github.io/agrid</div>
              </div>
              <div class="browser-content">
                <agrid class="preview-grid" [provider]="previewProvider" (click)="activate_grid()"/>
              </div>
            </div>
            <div class="browser-note browser-note-bottom">10 rows · 5 columns</div>
          </div>
        

        <div class="chart-wrap" [class.chart-wrap-focus]="focusChart()">
          <div class="browser-frame">
             <div class="browser-bar">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
                <div class="browser-url"><span class="url-lock">◆</span>Charts</div>
              </div>
          <div class="browser-content">
          <agrid-chart class="preview-chart" [provider]="chartProvider" (click)="activate_chart()"/>
          </div>
        </div>
          </div>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="features">
        <div class="features-inner">
          <div class="section-heading">
            <div>
              <div class="section-label">Built in, not bolted on</div>
              <h2 class="section-title">Everything you expect from a serious grid.</h2>
            </div>
            <p class="section-sub">{{ features.length }} focused capabilities. Configure what you need and leave the rest untouched.</p>
          </div>
          <div class="feature-grid">
            @for (f of features; track f.title) {
              <div class="feature-card">
                <span class="feature-badge" [style.background]="f.bg" [style.color]="f.color">{{ f.label }}</span>
                <div class="feature-text">
                  <div class="feature-name">
                    {{ f.title }}
                    @if (f.isNew) { <span class="feature-new">New</span> }
                  </div>
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
          <div class="section-heading">
            <div>
              <div class="section-label">Live examples</div>
              <h2 class="section-title">See the real grid, not a mockup.</h2>
            </div>
            <a class="text-link" routerLink="/documentation">Browse documentation <span>→</span></a>
          </div>
          <div class="demo-cards">
            <a class="demo-card" routerLink="/demo">
              <div class="demo-card-title">Overview</div>
              <div class="demo-card-desc">Full-featured grid with editing, grouping, filtering, and CSV export.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/filters">
              <div class="demo-card-title">Filters</div>
              <div class="demo-card-desc">Text, value, condition, number, date, boolean, quick, and server-query filters in one grid.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/custom-cells">
              <div class="demo-card-title">Custom cells</div>
              <div class="demo-card-desc">Angular components rendered directly inside grid cells.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/custom-editors">
              <div class="demo-card-title">Custom cell editors</div>
              <div class="demo-card-desc">Build a custom editor when your content differs from build in editors.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/charts">
              <div class="demo-card-title">Charts / graphs</div>
              <div class="demo-card-desc">Zero-dependency SVG diagrams driven by an AgridChartProvider, linked to the grid's filtered rows.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/sparklines">
              <div class="demo-card-title">Sparklines</div>
              <div class="demo-card-desc">Inline line and bar charts rendered per row from a number[] field.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/conditional-formatting">
              <div class="demo-card-title">Conditional formatting</div>
              <div class="demo-card-desc">Data-driven colors, borders, typography, and alignment for individual cells.</div>
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
            <a class="demo-card" routerLink="/server-side-row-model">
              <div class="demo-card-title">Server row model</div>
              <div class="demo-card-desc">Lazy block loading from a GitHub Pages JSON dataset.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/aggregates">
              <div class="demo-card-title">Aggregates</div>
              <div class="demo-card-desc">Sum, average, and count footers per column.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/pivot">
              <div class="demo-card-title">Pivot table</div>
              <div class="demo-card-desc">Configure row, column, value, aggregation, and visible result columns from one in-grid sidebar.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/pinning">
              <div class="demo-card-title">Column pinning</div>
              <div class="demo-card-desc">Freeze columns to the left or right edge while scrolling.</div>
              <span class="demo-card-link">Open →</span>


            </a>
            <a class="demo-card" routerLink="/tree">
              <div class="demo-card-title">Tree data</div>
              <div class="demo-card-desc">Hierarchical rows with expand/collapse and aggregate values rolled up from descendant entries.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/performance">
              <div class="demo-card-title">Performance test</div>
              <div class="demo-card-desc">Stress-test virtual scrolling with up to 250,000 records.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/readonly">
              <div class="demo-card-title">Readonly mode</div>
              <div class="demo-card-desc">Toggle a production-style dataset between viewing and editing.</div>
              <span class="demo-card-link">Open →</span>
            </a>
            <a class="demo-card" routerLink="/master-detail">
              <div class="demo-card-title">Master-detail</div>
              <div class="demo-card-desc">Expandable detail panels and rows pinned above or below the dataset.</div>
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
      height: 100%;
      min-height: 0;
      overflow: hidden;
      scrollbar-width: thin;
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

    .preview-chart {
      width: 100%;
      height: 100%;
      padding: 15px;
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

    .feature-new {
      display: inline-flex;
      align-items: center;
      min-height: 17px;
      margin-left: 5px;
      padding: 1px 6px;
      border: 1px solid #bbf7d0;
      border-radius: 999px;
      background: #f0fdf4;
      color: #15803d;
      font-size: 8px;
      font-weight: 750;
      letter-spacing: 0.5px;
      line-height: 1;
      text-transform: uppercase;
      vertical-align: 1px;
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

    /* ── Homepage refresh ─────────────────── */
    :host {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      scrollbar-width: thin;
    }

    :host::-webkit-scrollbar {
      width: 8px;
    }

    .page {
      background: #fbfcfa;
      color: #142019;
    }

    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      display: block;
      background:
        linear-gradient(#ffffff09 1px, transparent 1px),
        linear-gradient(90deg, #ffffff09 1px, transparent 1px),
        linear-gradient(135deg, #071b11 0%, #0a3320 48%, #0d4b2d 100%);
      background-size: 40px 40px, 40px 40px, auto;
      padding: 88px 48px 82px;
    }

    .hero-layout {
      position: relative;
      z-index: 1;
      max-width: 1180px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(360px, 0.9fr) minmax(520px, 1.1fr);
      align-items: center;
      gap: 68px;
    }

    .hero-glow {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }

    .hero-glow-one {
      width: 540px;
      height: 540px;
      right: -170px;
      top: -260px;
      background: radial-gradient(circle, #22c55e35 0%, transparent 70%);
    }

    .hero-glow-two {
      width: 420px;
      height: 420px;
      left: -220px;
      bottom: -250px;
      background: radial-gradient(circle, #4ade8024 0%, transparent 70%);
    }

    .hero-inner {
      max-width: 560px;
      text-align: left;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      margin-bottom: 22px;
      border-color: #ffffff1f;
      border-radius: 999px;
      background: #ffffff0d;
      box-shadow: inset 0 1px #ffffff14;
      color: #bbf7d0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.1px;
    }

    .hero-badge span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 0 4px #4ade801c;
    }

    .hero-title {
      margin-bottom: 22px;
      color: #fff;
      font-size: clamp(42px, 5vw, 64px);
      font-weight: 760;
      line-height: 1.02;
      letter-spacing: -2.6px;
    }

    .hero-title em {
      color: #86efac;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
    }

    .hero-sub {
      max-width: 520px;
      margin-bottom: 30px;
      color: #b9d8c4;
      font-size: 16px;
      line-height: 1.7;
    }

    .hero-actions {
      justify-content: flex-start;
      gap: 9px;
    }

    .btn {
      justify-content: center;
      gap: 10px;
      min-height: 42px;
      padding: 0 20px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 650;
      transition:
        transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
        box-shadow 160ms ease,
        background-color 160ms ease,
        border-color 160ms ease;
    }

    .btn:active {
      transform: scale(0.97);
    }

    .btn-white {
      color: #12552f;
      box-shadow: 0 8px 28px #020c0738, inset 0 -1px #00000012;
    }

    .btn-outline,
    .btn-icon {
      border: 1px solid #ffffff2b;
      background: #ffffff0b;
      color: #e7f7ec;
    }

    .btn-icon {
      width: 42px;
      padding: 0;
    }

    .github-icon {
      margin: 0;
      width: 17px;
      height: 17px;
    }

    .hero-proof {
      display: flex;
      margin-top: 36px;
      padding-top: 24px;
      border-top: 1px solid #ffffff17;
    }

    .hero-proof div {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 0 22px;
      border-right: 1px solid #ffffff17;
    }

    .hero-proof div:first-child { padding-left: 0; }
    .hero-proof div:last-child { border-right: 0; }
    .hero-proof strong { color: #f0fdf4; font-size: 14px; }
    .hero-proof span { color: #81a98f; font-size: 10px; }

    .chart-wrap {
      max-width: 560px;
      position: relative;
      min-width: 0;
      transform: perspective(1200px) rotateY(-2deg) rotateX(1deg) translateX(50%) translateY(-50%) scale(1);
      opacity: 0.95;
      transition:
      transform 300ms ease,
      opacity 300ms ease;;
    }

    .chart-wrap-focus {
      transform: perspective(1200px) rotateY(-2deg) rotateX(1deg) translateX(50%) translateY(-50%) scale(1.05);
      z-index: 1000;
      opacity: 1;
    }
    
    .browser-wrap {
      position: relative;
      min-width: 0;
      transform: perspective(1200px) rotateY(-2deg) rotateX(1deg) scale(1);
      opacity: 0.95;
      transition:
      transform 300ms ease,
      opacity 300ms ease;;
    }

    .browser-wrap-focus {
      transform: perspective(1200px) rotateY(-2deg) rotateX(1deg) scale(1.05);
      z-index: 1000;
      opacity: 1;
    }

    .browser-frame {
      max-width: none;
      border-radius: 14px;
      box-shadow: 0 34px 90px #020c0773, 0 0 0 1px #ffffff21, inset 0 1px #ffffff24;
    }

    .browser-bar {
      padding: 11px 14px;
      border-bottom: 1px solid #d9e0db;
      background: #edf1ee;
    }

    .dot {
      width: 9px;
      height: 9px;
    }

    .browser-url {
      width: min(64%, 310px);
      flex: none;
      margin: 0 auto;
      padding: 4px 12px;
      border-color: #d7ded9;
      background: #fff;
      box-shadow: 0 1px 2px #0000000a;
      color: #7b8980;
      font-size: 10px;
      text-align: center;
    }

    .url-lock {
      margin-right: 5px;
      color: #34a863;
      font-size: 7px;
    }

    .browser-content {
      height: 360px;
    }

    .browser-note {
      position: absolute;
      z-index: 2;
      padding: 8px 12px;
      border: 1px solid #ffffff2b;
      border-radius: 8px;
      background: #10291dcc;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px #020c0738;
      color: #d8f3e0;
      font-size: 10px;
      font-weight: 650;
      letter-spacing: 0.25px;
    }

    .browser-note-top { top: -18px; right: 28px; }
    .browser-note-bottom { right: -22px; bottom: 28px; }

    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 48px;
      margin-bottom: 38px;
    }

    .section-label {
      margin-bottom: 10px;
      color: #21844c;
      font-size: 10px;
      letter-spacing: 1.3px;
    }

    .section-title {
      max-width: 650px;
      margin: 0;
      color: #142019;
      font-size: clamp(30px, 3.5vw, 42px);
      font-weight: 750;
      line-height: 1.08;
      letter-spacing: -1.3px;
    }

    .section-sub {
      max-width: 340px;
      margin: 0 0 3px;
      color: #68756c;
      font-size: 13px;
      line-height: 1.65;
    }

    .text-link {
      flex-shrink: 0;
      margin-bottom: 5px;
      color: #26734a;
      font-size: 12px;
      font-weight: 650;
      text-decoration: none;
    }

    .text-link span { margin-left: 5px; }

    .text-link:focus-visible,
    .btn:focus-visible,
    .demo-card:focus-visible {
      outline: 3px solid #4ade80;
      outline-offset: 3px;
    }

    .features {
      border-bottom-color: #e8ede9;
      background: #fbfcfa;
    }

    .features-inner,
    .demos-inner {
      max-width: 1180px;
      padding: 92px 48px 96px;
    }

    .feature-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0;
      border-top: 1px solid #dfe6e1;
      border-left: 1px solid #dfe6e1;
    }

    .feature-card {
      min-height: 142px;
      padding: 22px 20px;
      border: 0;
      border-right: 1px solid #dfe6e1;
      border-bottom: 1px solid #dfe6e1;
      border-radius: 0;
      box-shadow: none;
      transition: background-color 180ms ease;
    }

    .feature-name {
      margin-bottom: 6px;
      color: #1a2820;
      font-size: 12px;
    }

    .feature-desc {
      color: #718078;
      font-size: 11px;
      line-height: 1.6;
    }

    .demos {
      background: #f2f6f3;
    }

    .demos-inner {
      padding-bottom: 110px;
    }

    .demo-cards {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }

    .demo-card {
      min-height: 154px;
      padding: 20px 18px 17px;
      border-color: #dfe7e1;
      border-radius: 12px;
      box-shadow: 0 1px 2px #0c2b1810;
      transition:
        box-shadow 180ms ease,
        border-color 180ms ease,
        transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .demo-card:active {
      transform: scale(0.98);
    }

    .demo-card-title {
      color: #1a2820;
      font-size: 13px;
    }

    .demo-card-desc {
      color: #758079;
      font-size: 10.5px;
    }

    .demo-card-link {
      display: flex;
      justify-content: space-between;
      padding-top: 11px;
      border-top: 1px solid #edf1ee;
      color: #2b754c;
      font-size: 10px;
    }

    .page,
    .features,
    .demos,
    .feature-card,
    .demo-card,
    .section-title,
    .section-sub,
    .feature-name,
    .feature-desc,
    .demo-card-title,
    .demo-card-desc,
    .demo-card-link,
    .text-link {
      transition:
        background-color 200ms ease,
        border-color 200ms ease,
        color 200ms ease,
        box-shadow 200ms ease;
    }

    .dark-theme {
      color-scheme: dark;
      background: #09110d;
      color: #e5eee8;
    }

    .dark-theme .features {
      border-bottom-color: #25332a;
      background: #0c1510;
    }

    .dark-theme .demos {
      background: #101b14;
    }

    .dark-theme .section-title {
      color: #f0f7f2;
    }

    .dark-theme .section-label,
    .dark-theme .text-link,
    .dark-theme .demo-card-link {
      color: #6ee7a0;
    }

    .dark-theme .section-sub,
    .dark-theme .feature-desc,
    .dark-theme .demo-card-desc {
      color: #91a399;
    }

    .dark-theme .feature-grid {
      border-color: #2a382f;
    }

    .dark-theme .feature-card,
    .dark-theme .demo-card {
      border-color: #2a382f;
      background: #131f17;
      box-shadow: 0 1px 2px #00000038;
    }

    .dark-theme .feature-name,
    .dark-theme .demo-card-title {
      color: #e5eee8;
    }

    .dark-theme .feature-new {
      border-color: #356e49;
      background: #163822;
      color: #86efac;
    }

    .dark-theme .feature-badge {
      background: #1c3023 !important;
      color: #86efac !important;
    }

    .dark-theme .demo-card-link {
      border-top-color: #2a382f;
    }

    .dark-theme .browser-frame {
      box-shadow: 0 34px 90px #00000099, 0 0 0 1px #ffffff1c, inset 0 1px #ffffff1c;
    }

    .dark-theme .browser-bar {
      border-bottom-color: #34443a;
      background: #1b2820;
    }

    .dark-theme .browser-url {
      border-color: #3a4b40;
      background: #111b15;
      color: #91a399;
    }

    .dark-theme .browser-content {
      background: #101713;
    }

    .dark-theme .preview-grid {
      --agrid-color-text: #dce8df;
      --agrid-color-text-muted: #91a399;
      --agrid-color-accent: #4ade80;
      --agrid-color-accent-subtle: #193c26;
      --agrid-color-accent-fg: #86efac;
      --agrid-color-accent-border: #2f6842;
      --agrid-color-danger: #fb7185;
      --agrid-color-danger-subtle: #3b171d;
      --agrid-color-border: #34443a;
      --agrid-color-bg: #111a14;
      --agrid-color-bg-subtle: #151f18;
      --agrid-color-bg-muted: #1b2820;
      --agrid-color-shadow: #00000073;
      --agrid-color-bg-stripe: #17231b;
      --agrid-color-cell-changed: #fbbf24;
      --agrid-color-row-marked: #3b3518;
    }

    @media (hover: hover) and (pointer: fine) {
      .btn:hover { transform: translateY(-1px); }
      .btn-white:hover { box-shadow: 0 12px 34px #020c0752, inset 0 -1px #00000012; }
      .btn-outline:hover, .btn-icon:hover { border-color: #ffffff42; background: #ffffff15; }
      .feature-card:hover {
        border-color: #dfe6e1;
        background: #f6faf7;
        box-shadow: none;
        transform: none;
      }
      .demo-card:hover {
        border-color: #a9c9b4;
        box-shadow: 0 10px 28px #12351f14;
        transform: translateY(-3px);
      }
      .dark-theme .feature-card:hover {
        border-color: #2a382f;
        background: #17261c;
      }
      .dark-theme .demo-card:hover {
        border-color: #477259;
        box-shadow: 0 10px 28px #00000047;
      }
    }

    @media (max-width: 1100px) {
      .hero-layout {
        grid-template-columns: 1fr;
        gap: 52px;
      }
      .hero-inner { max-width: 680px; }
      .browser-wrap { transform: none; }
      .feature-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .demo-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }

    @media (max-width: 760px) {
      .hero { padding: 64px 22px 58px; }
      .hero-title { font-size: 44px; letter-spacing: -1.8px; }
      .hero-proof { flex-wrap: wrap; gap: 18px 0; }
      .hero-proof div { padding: 0 16px; }
      .browser-content { height: 300px; }
      .browser-note { display: none; }
      .features-inner, .demos-inner { padding: 68px 22px 74px; }
      .section-heading { align-items: flex-start; flex-direction: column; gap: 18px; }
      .feature-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .demo-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 500px) {
      .hero-title { font-size: 38px; }
      .hero-sub { font-size: 14px; }
      .hero-actions .btn-white, .hero-actions .btn-outline { flex: 1; }
      .hero-proof div { width: 50%; padding: 0; border: 0; }
      .feature-grid, .demo-cards { grid-template-columns: 1fr; }
      .feature-card { min-height: auto; }
      .browser-content { height: 260px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .btn,
      .demo-card,
      .page,
      .features,
      .demos,
      .feature-card {
        transition-duration: 0.01ms;
      }
    }
  `,
})
export class HomeComponent {
  readonly theme = inject(ThemeService);
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

  focusGrid = signal<boolean>(true);
  focusChart = signal<boolean>(false);

  readonly chartProvider = new AgridChartProvider({
    type: "column",
    source: this.previewProvider.visibleRows,
    transform: (rows, type) => this.buildChartData(rows as PreviewRecord[], type),
    height: 300,
  });

  constructor() {
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }

  avgSalaryPerDepartment(rows: PreviewRecord[]) {
    return Object.values(
      rows.reduce((acc, employee) => {
        const department = employee.department;

        if (!acc[department]) {
          acc[department] = {
            department: department,
            salary: 0,
            count: 0,
          };
        }

        acc[department].salary += employee.salary;
        acc[department].count++;

        return acc;
      }, {} as Record<string, { department: string; salary: number; count: number }>)
    ).map(({ department, salary, count }) => { return { department: department, salary: salary / count } });

  }

  private buildChartData(rows: PreviewRecord[], type: AgridChartType): AgridChartData {
    // Multi-series: one line/column group per region across the quarters.
    const avr = this.avgSalaryPerDepartment(rows);
    console.log(avr);
    return {
      categories: DEPARTEMENTS.map(d => d.label),
      series: [{ name: "Average Salery", values: avr.map(a => a.salary) }],
    };
  }

  activate_grid() {
    this.focusGrid.set(true);
    this.focusChart.set(false);
  }

  activate_chart() {
    this.focusGrid.set(false);
    this.focusChart.set(true);
  }
}
