import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';
import { AGRID_RENDERER_CONTEXT } from '../agrid/rendering/agrid-cell-renderer';
import { buildSparkline } from '../agrid/infrastructure/agrid-sparkline';

function asNumbers(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number) : [];
}

const W = 96;
const H = 26;

/* ------------------------------------------------------------------ *
 * Line sparkline — reads a number[] from the renderer context and
 * draws an inline SVG with high/low/last markers. Excel-style in-cell.
 * ------------------------------------------------------------------ */
@Component({
  selector: 'demo-line-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="spark" [attr.width]="w" [attr.height]="h" aria-hidden="true">
      <path class="spark__line" fill="none" [attr.d]="geo().linePath" />
      @if (geo().max; as m) { <circle class="spark__max" [attr.cx]="m.x" [attr.cy]="m.y" r="1.7" /> }
      @if (geo().min; as m) { <circle class="spark__min" [attr.cx]="m.x" [attr.cy]="m.y" r="1.7" /> }
      @if (geo().last; as l) { <circle class="spark__last" [attr.cx]="l.x" [attr.cy]="l.y" r="2" /> }
    </svg>
  `,
  styles: `
    .spark { display: block; overflow: visible; }
    .spark__line { stroke: #3b82f6; stroke-width: 1.25; stroke-linejoin: round; stroke-linecap: round; }
    .spark__last { fill: #1d4ed8; }
    .spark__max { fill: #16a34a; }
    .spark__min { fill: #dc2626; }
  `,
})
export class LineSparklineRenderer {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly w = W;
  readonly h = H;
  readonly geo = computed(() => buildSparkline(asNumbers(this.ctx.value()), { width: W, height: H }));
}

/* ------------------------------------------------------------------ *
 * Bar sparkline — zero-baselined columns, negatives coloured apart.
 * ------------------------------------------------------------------ */
@Component({
  selector: 'demo-bar-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="spark" [attr.width]="w" [attr.height]="h" aria-hidden="true">
      @for (bar of geo().bars; track $index) {
        <rect
          class="spark__bar"
          [class.spark__bar--neg]="bar.negative"
          [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height"
        />
      }
    </svg>
  `,
  styles: `
    .spark { display: block; }
    .spark__bar { fill: #60a5fa; }
    .spark__bar--neg { fill: #f87171; }
  `,
})
export class BarSparklineRenderer {
  private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
  readonly w = W;
  readonly h = H;
  readonly geo = computed(() => buildSparkline(asNumbers(this.ctx.value()), { width: W, height: H }));
}

interface ProductRow {
  name: string;
  price: number;
  trend: number[];
  flow: number[];
  change: number;
}

const COLUMNS: ColDef<ProductRow>[] = [
  { field: 'name', header: 'Product', width: 150, filterable: true },
  { field: 'price', header: 'Price', width: 90, type: 'number', formatter: (v: unknown) => `$${Number(v).toFixed(2)}` },
  { field: 'trend', header: 'Trend (12 mo)', width: 130, editable: false, cellRendererComponent: LineSparklineRenderer },
  { field: 'flow', header: 'Net flow', width: 130, editable: false, cellRendererComponent: BarSparklineRenderer },
  {
    field: 'change', header: 'Δ', width: 80, type: 'number', editable: false,
    formatter: (v: unknown) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(0)}%`,
    cellClass: ({ value }: { value: unknown }) => (Number(value) >= 0 ? 'cell-up' : 'cell-down'),
  },
];

const NAMES = ['Aurora Lamp', 'Bronze Kettle', 'Cedar Chair', 'Delta Mug', 'Ember Vase',
  'Frost Bowl', 'Glade Clock', 'Harbor Rug', 'Iris Frame', 'Jade Tray',
  'Kelp Pillow', 'Lunar Plate'];

function trend(seed: number): number[] {
  let v = 40 + (seed * 7) % 30;
  return Array.from({ length: 12 }, (_, i) => {
    v += Math.round(Math.sin(seed + i * 0.9) * 12 + ((seed * (i + 3)) % 9) - 4);
    return Math.max(5, v);
  });
}

function flow(seed: number): number[] {
  return Array.from({ length: 9 }, (_, i) => Math.round(Math.sin(seed * 1.3 + i) * 50 + ((seed * (i + 1)) % 40) - 20));
}

function makeRows(): ProductRow[] {
  return NAMES.map((name, i) => {
    const series = trend(i + 1);
    const change = ((series[series.length - 1] - series[0]) / series[0]) * 100;
    return {
      name,
      price: 12 + ((i * 37) % 80) + (i % 3) * 0.5,
      trend: series,
      flow: flow(i + 1),
      change: Math.round(change),
    };
  });
}

@Component({
  selector: 'demo-sparklines',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Sparklines</h2>
        <span class="demo-meta">
          Zero-dependency inline charts — a cellRendererComponent draws SVG from a number[] field
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
    :host ::ng-deep .cell-up { color: #16a34a; font-weight: 600; }
    :host ::ng-deep .cell-down { color: #dc2626; font-weight: 600; }
  `],
})
export class SparklinesDemoComponent {
  readonly provider = new AgridProvider<ProductRow>({
    columns: COLUMNS,
    datasource: new AgridDataSource(makeRows()),
    control: new AgridControl(),
    zebraStripes: true,
    rowSelection: 'single',
  });

  readonly _grid = viewChild(AgridComponent);
}
