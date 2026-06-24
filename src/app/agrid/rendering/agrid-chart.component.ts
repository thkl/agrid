import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { buildChart } from '../infrastructure/agrid-chart';
import { AgridChartProvider } from '../agrid-chart-provider';

/**
 * Zero-dependency chart component. Configured exactly like the grid — hand it an
 * {@link AgridChartProvider} and it renders an SVG column / bar / line / area / pie / donut chart
 * with no charting library. The chart sizes itself to the host width (observed) and the provider's
 * height.
 *
 * @example
 * ```html
 * <agrid-chart [provider]="chartProvider" />
 * ```
 */
@Component({
  selector: 'agrid-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="agrid-chart__svg"
      role="img"
      [attr.width]="width()"
      [attr.height]="height()"
    >
      @for (g of layout().gridlines; track $index) {
        <line class="agrid-chart__grid" [attr.x1]="g.x1" [attr.y1]="g.y1" [attr.x2]="g.x2" [attr.y2]="g.y2" />
      }
      @for (a of layout().areas; track $index) {
        <path [attr.d]="a.d" [attr.fill]="a.color" fill-opacity="0.15" />
      }
      @for (l of layout().lines; track $index) {
        <path
          class="agrid-chart__line"
          fill="none"
          [attr.d]="l.d"
          [attr.stroke]="l.color"
        />
      }
      @for (p of layout().points; track $index) {
        <circle [attr.cx]="p.x" [attr.cy]="p.y" r="2" [attr.fill]="p.color" />
      }
      @for (b of layout().bars; track $index) {
        <rect rx="1" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.width" [attr.height]="b.height" [attr.fill]="b.color" />
      }
      @for (s of layout().slices; track $index) {
        <path class="agrid-chart__slice" [attr.d]="s.d" [attr.fill]="s.color" />
      }
      @for (lbl of layout().axisLabels; track $index) {
        <text
          class="agrid-chart__axis"
          [attr.x]="lbl.x"
          [attr.y]="lbl.y"
          [attr.text-anchor]="lbl.anchor"
          [attr.dominant-baseline]="lbl.baseline"
        >{{ lbl.text }}</text>
      }
      @if (sliceLabels()) {
        @for (s of layout().slices; track $index) {
          <text
            class="agrid-chart__slice-label"
            [attr.x]="s.labelX"
            [attr.y]="s.labelY"
            text-anchor="middle"
            dominant-baseline="middle"
          >{{ s.percentText }}</text>
        }
      }
    </svg>
    @if (showLegend() && layout().legend.length) {
      <ul class="agrid-chart__legend">
        @for (item of layout().legend; track $index) {
          <li>
            <span class="agrid-chart__swatch" [style.background-color]="item.color"></span>
            {{ item.name }}
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; width: 100%; font-family: inherit; }
    .agrid-chart__svg { display: block; }
    .agrid-chart__grid { stroke: var(--agrid-chart-grid, #e5e7eb); stroke-width: 1; }
    .agrid-chart__line { stroke-width: 1.75; stroke-linejoin: round; stroke-linecap: round; }
    .agrid-chart__slice { stroke: var(--agrid-chart-slice-stroke, #fff); stroke-width: 1; }
    .agrid-chart__axis { fill: var(--agrid-chart-axis, #6b7280); font-size: 10px; }
    .agrid-chart__slice-label { fill: #fff; font-size: 10px; font-weight: 600; }
    .agrid-chart__legend {
      display: flex; flex-wrap: wrap; gap: 4px 14px;
      margin: 6px 0 0; padding: 0; list-style: none;
      font-size: 12px; color: var(--agrid-chart-axis, #4b5563);
    }
    .agrid-chart__legend li { display: inline-flex; align-items: center; gap: 5px; }
    .agrid-chart__swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  `,
})
export class AgridChartComponent {
  /** All chart configuration — type, data, and display options. */
  readonly provider = input.required<AgridChartProvider>();

  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly width = signal(0);

  protected readonly height = computed(() => this.provider().height());
  protected readonly showLegend = computed(() => this.provider().showLegend());
  protected readonly sliceLabels = computed(
    () => this.provider().type() === 'pie' || this.provider().type() === 'donut',
  );

  protected readonly layout = computed(() => {
    const provider = this.provider();
    return buildChart(provider.type(), provider.data(), {
      width: this.width(),
      height: provider.height(),
      palette: provider.palette(),
      showAxis: provider.showAxis(),
    });
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const measure = () => this.width.set(el.clientWidth);
      measure();
      const ResizeObserverCtor = globalThis.ResizeObserver;
      const observer = ResizeObserverCtor ? new ResizeObserverCtor(measure) : null;
      observer?.observe(el);
      destroyRef.onDestroy(() => observer?.disconnect());
    });
  }
}

// Re-exported chart types/helpers live with the component for a single import surface.
export { AgridChartProvider } from '../agrid-chart-provider';
export type { AgridChartProviderConfig } from '../agrid-chart-provider';
export type {
  AgridChartData,
  AgridChartLayout,
  AgridChartOptions,
  AgridChartSeries,
  AgridChartType,
} from '../infrastructure/agrid-chart';
export { AGRID_CHART_PALETTE, buildChart } from '../infrastructure/agrid-chart';
