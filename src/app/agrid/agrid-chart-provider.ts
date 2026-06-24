import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { AgridChartData, AgridChartType } from './infrastructure/agrid-chart';

/**
 * Construction options for an {@link AgridChartProvider}.
 *
 * Provide a static {@link data} set, or link a live {@link source} (e.g. a grid provider's
 * `visibleRows`) together with a {@link transform} so the chart follows the grid's filtering and
 * sorting automatically.
 */
export interface AgridChartProviderConfig<T = any> {
  /** Diagram type: column, bar, line, area, pie, or donut. */
  type: AgridChartType;
  /** Static dataset. Ignored when {@link source} + {@link transform} are provided. */
  data?: AgridChartData;
  /**
   * A reactive row source to derive the dataset from — typically a grid provider's `visibleRows`,
   * which reflects the grid's current filters and sorting. Requires {@link transform}.
   */
  source?: Signal<readonly T[]>;
  /**
   * Turns the {@link source} rows (and the current chart type) into a chart dataset. Re-runs
   * whenever the source rows or the chart type change.
   */
  transform?: (rows: readonly T[], type: AgridChartType) => AgridChartData;
  /** Chart height in pixels (width follows the host). @default 220 */
  height?: number;
  /** Show the series/category legend below the chart. @default true */
  showLegend?: boolean;
  /** Draw value/category axes for cartesian types. @default true */
  showAxis?: boolean;
  /** Override the colour palette. */
  palette?: string[];
}

const EMPTY_DATA: AgridChartData = { series: [] };

/**
 * Bundles a chart's type, dataset, and display options behind one object, so a chart is configured
 * exactly like a grid: `<agrid-chart [provider]="chartProvider" />`.
 *
 * @example Static data
 * ```ts
 * new AgridChartProvider({ type: 'column', data: { categories: ['Q1','Q2'], series: [{ values: [10, 14] }] } });
 * ```
 *
 * @example Linked to a grid (follows filters/sorting)
 * ```ts
 * new AgridChartProvider({
 *   type: 'column',
 *   source: gridProvider.visibleRows,
 *   transform: (rows, type) => ({ categories: rows.map(r => r.region), series: [{ values: rows.map(r => r.total) }] }),
 * });
 * ```
 */
export class AgridChartProvider<T = any> {
  /** Diagram type. Writable — set it to switch chart type at runtime. */
  readonly type: WritableSignal<AgridChartType>;
  /** The dataset rendered by the chart (derived from the source when linked). */
  readonly data: Signal<AgridChartData>;
  /** Chart height in pixels. */
  readonly height: WritableSignal<number>;
  /** Whether the legend is shown. */
  readonly showLegend: WritableSignal<boolean>;
  /** Whether cartesian axes are drawn. */
  readonly showAxis: WritableSignal<boolean>;
  /** Colour palette override, or `undefined` for the default. */
  readonly palette: WritableSignal<string[] | undefined>;

  /** Writable backing store in static mode; `null` when the data is derived from a source. */
  private readonly _data: WritableSignal<AgridChartData> | null;

  constructor(config: AgridChartProviderConfig<T>) {
    this.type = signal(config.type);

    if (config.source) {
      const { source, transform } = config;
      if (!transform) {
        throw new Error('AgridChartProvider: `transform` is required when `source` is provided.');
      }
      this._data = null;
      this.data = computed(() => transform(source(), this.type()));
    } else {
      const data = signal(config.data ?? EMPTY_DATA);
      this._data = data;
      this.data = data;
    }

    this.height = signal(config.height ?? 220);
    this.showLegend = signal(config.showLegend ?? true);
    this.showAxis = signal(config.showAxis ?? true);
    this.palette = signal(config.palette);
  }

  /** Replace the dataset. Only valid in static mode (no linked {@link AgridChartProviderConfig.source}). */
  setData(data: AgridChartData): void {
    if (!this._data) {
      throw new Error('AgridChartProvider: setData() is unavailable when a `source` is linked — the dataset is derived from it.');
    }
    this._data.set(data);
  }
}
