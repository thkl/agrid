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
  templateUrl:'./agrid-chart.component.html',
  styleUrls: ['./agrid-chart.component.css'],
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
