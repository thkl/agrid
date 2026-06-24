/**
 * Zero-dependency chart geometry. Pure math that turns a typed dataset + a diagram type into flat
 * SVG primitives (bars, line/area paths, pie slices, gridlines, labels), so the chart component
 * only has to emit elements. No charting library — same hand-rolled approach as the xlsx writer
 * and the sparkline helper.
 */

/** Supported diagram types. */
export type AgridChartType = 'column' | 'bar' | 'line' | 'area' | 'pie' | 'donut';

/** One data series (a row of values aligned to {@link AgridChartData.categories}). */
export interface AgridChartSeries {
  /** Series name shown in the legend. */
  name?: string;
  /** Explicit colour; falls back to the palette by index. */
  color?: string;
  values: number[];
}

/** The dataset fed to a chart: one or more series sharing a category axis. */
export interface AgridChartData {
  /** Category labels (x-axis ticks, or pie/donut slice labels). */
  categories?: string[];
  series: AgridChartSeries[];
}

/** Box dimensions and styling knobs the dataset is laid out into. */
export interface AgridChartOptions {
  width: number;
  height: number;
  palette?: string[];
  /** Whether value/category axes and gridlines are produced (cartesian types only). */
  showAxis?: boolean;
}

export interface ChartBar {
  x: number; y: number; width: number; height: number;
  color: string; value: number; seriesIndex: number; categoryIndex: number;
}
export interface ChartPath { d: string; color: string; name: string; }
export interface ChartPoint { x: number; y: number; color: string; }
export interface ChartSlice {
  d: string; color: string; value: number; label: string;
  percentText: string; labelX: number; labelY: number; full: boolean;
}
export interface ChartGridline { x1: number; y1: number; x2: number; y2: number; }
export interface ChartLabel {
  x: number; y: number; text: string;
  anchor: 'start' | 'middle' | 'end'; baseline: 'auto' | 'middle' | 'hanging';
}
export interface ChartLegendItem { name: string; color: string; }

/** Flat, drawable primitives for a chart. */
export interface AgridChartLayout {
  type: AgridChartType;
  width: number;
  height: number;
  bars: ChartBar[];
  areas: ChartPath[];
  lines: ChartPath[];
  points: ChartPoint[];
  slices: ChartSlice[];
  gridlines: ChartGridline[];
  axisLabels: ChartLabel[];
  legend: ChartLegendItem[];
}

/** Default qualitative palette (colour-blind-friendly-ish, distinct hues). */
export const AGRID_CHART_PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

const round = (n: number): number => Math.round(n * 100) / 100;

function labelFor(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${round(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${round(value / 1_000)}k`;
  return String(round(value));
}

const EMPTY = (type: AgridChartType, width: number, height: number): AgridChartLayout => ({
  type, width, height,
  bars: [], areas: [], lines: [], points: [], slices: [], gridlines: [], axisLabels: [], legend: [],
});

/** Builds drawable geometry for a chart. Empty/invalid input yields an empty layout. */
export function buildChart(
  type: AgridChartType,
  data: AgridChartData,
  options: AgridChartOptions,
): AgridChartLayout {
  const { width, height } = options;
  const palette = options.palette ?? AGRID_CHART_PALETTE;
  const series = data.series?.filter(s => s.values?.length) ?? [];
  if (series.length === 0 || width <= 0 || height <= 0) return EMPTY(type, width, height);

  const categories = data.categories ?? series[0].values.map((_, i) => String(i + 1));
  const colorOf = (i: number, override?: string): string => override ?? palette[i % palette.length];

  if (type === 'pie' || type === 'donut') {
    return buildPie(type, series[0], categories, options, colorOf);
  }
  return buildCartesian(type, series, categories, options, colorOf);
}

function buildPie(
  type: AgridChartType,
  series: AgridChartSeries,
  categories: string[],
  options: AgridChartOptions,
  colorOf: (i: number, override?: string) => string,
): AgridChartLayout {
  const { width, height } = options;
  const values = series.values.map(v => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = values.reduce((sum, v) => sum + v, 0);
  const layout = EMPTY(type, width, height);
  if (total <= 0) return layout;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(0, Math.min(width, height) / 2 - 6);
  const innerR = type === 'donut' ? radius * 0.58 : 0;
  const labelR = (radius + innerR) / 2;

  let angle = 0; // radians, 0 at top, clockwise
  values.forEach((value, i) => {
    if (value <= 0) return;
    const percent = value / total;
    const start = angle;
    const end = angle + percent * Math.PI * 2;
    angle = end;
    const mid = (start + end) / 2;
    const color = colorOf(i);
    const full = percent >= 0.999;
    layout.slices.push({
      d: arcPath(cx, cy, radius, start, end, innerR, full),
      color,
      value,
      label: categories[i] ?? String(i + 1),
      percentText: `${Math.round(percent * 100)}%`,
      labelX: round(cx + labelR * Math.sin(mid)),
      labelY: round(cy - labelR * Math.cos(mid)),
      full,
    });
    layout.legend.push({ name: categories[i] ?? String(i + 1), color });
  });
  return layout;
}

function buildCartesian(
  type: AgridChartType,
  series: AgridChartSeries[],
  categories: string[],
  options: AgridChartOptions,
  colorOf: (i: number, override?: string) => string,
): AgridChartLayout {
  const { width, height } = options;
  const showAxis = options.showAxis ?? true;
  const horizontal = type === 'bar';
  const layout = EMPTY(type, width, height);

  const all = series.flatMap(s => s.values).filter(v => Number.isFinite(v));
  if (all.length === 0) return layout;
  const forceZero = type === 'column' || type === 'bar' || type === 'area';
  let vMin = forceZero ? Math.min(0, ...all) : Math.min(...all);
  let vMax = forceZero ? Math.max(0, ...all) : Math.max(...all);
  if (vMin === vMax) { vMax += 1; if (!forceZero) vMin -= 1; }

  const pad = {
    top: 10,
    right: 12,
    bottom: showAxis ? 22 : 6,
    left: showAxis ? (horizontal ? 70 : 44) : 6,
  };
  const plot = {
    x: pad.left, y: pad.top,
    width: Math.max(0, width - pad.left - pad.right),
    height: Math.max(0, height - pad.top - pad.bottom),
  };

  // Value axis: position along the value dimension (y for column/line/area, x for bar).
  const valuePos = (v: number): number => {
    const t = (v - vMin) / (vMax - vMin);
    return horizontal ? plot.x + t * plot.width : plot.y + plot.height - t * plot.height;
  };
  const baseline = valuePos(0 >= vMin && 0 <= vMax ? 0 : vMin);

  // Category axis: even slots across the category dimension.
  const n = categories.length;
  const slot = (horizontal ? plot.height : plot.width) / Math.max(1, n);
  const catStart = (i: number): number => (horizontal ? plot.y : plot.x) + i * slot;

  if (showAxis) {
    for (let i = 0; i <= 4; i++) {
      const v = vMin + (i / 4) * (vMax - vMin);
      const p = valuePos(v);
      if (horizontal) {
        layout.gridlines.push({ x1: round(p), y1: plot.y, x2: round(p), y2: plot.y + plot.height });
        layout.axisLabels.push({ x: round(p), y: plot.y + plot.height + 4, text: labelFor(v), anchor: 'middle', baseline: 'hanging' });
      } else {
        layout.gridlines.push({ x1: plot.x, y1: round(p), x2: plot.x + plot.width, y2: round(p) });
        layout.axisLabels.push({ x: plot.x - 6, y: round(p), text: labelFor(v), anchor: 'end', baseline: 'middle' });
      }
    }
    categories.forEach((label, i) => {
      const center = catStart(i) + slot / 2;
      if (horizontal) {
        layout.axisLabels.push({ x: plot.x - 6, y: round(center), text: label, anchor: 'end', baseline: 'middle' });
      } else {
        layout.axisLabels.push({ x: round(center), y: plot.y + plot.height + 4, text: label, anchor: 'middle', baseline: 'hanging' });
      }
    });
  }

  if (type === 'line' || type === 'area') {
    series.forEach((s, si) => {
      const color = colorOf(si, s.color);
      const pts = s.values.map((v, i) => ({
        x: horizontal ? valuePos(v) : catStart(i) + slot / 2,
        y: horizontal ? catStart(i) + slot / 2 : valuePos(v),
      }));
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ');
      layout.lines.push({ d, color, name: s.name ?? `Series ${si + 1}` });
      if (type === 'area') {
        const first = pts[0];
        const last = pts[pts.length - 1];
        const areaD = `${d} L ${round(last.x)} ${round(baseline)} L ${round(first.x)} ${round(baseline)} Z`;
        layout.areas.push({ d: areaD, color, name: s.name ?? `Series ${si + 1}` });
      }
      pts.forEach(p => layout.points.push({ x: round(p.x), y: round(p.y), color }));
      layout.legend.push({ name: s.name ?? `Series ${si + 1}`, color });
    });
    return layout;
  }

  // Grouped column / bar charts.
  const groupInset = slot * 0.15;
  const groupWidth = slot - groupInset * 2;
  const barThick = Math.max(1, groupWidth / series.length);
  series.forEach((s, si) => {
    const color = colorOf(si, s.color);
    s.values.forEach((value, ci) => {
      if (!Number.isFinite(value)) return;
      const v = valuePosClamped(value, vMin, vMax);
      const start = catStart(ci) + groupInset + si * barThick;
      const edge = valuePos(v);
      if (horizontal) {
        layout.bars.push({
          x: round(Math.min(edge, baseline)), y: round(start),
          width: round(Math.abs(edge - baseline)), height: round(barThick * 0.84),
          color, value, seriesIndex: si, categoryIndex: ci,
        });
      } else {
        layout.bars.push({
          x: round(start), y: round(Math.min(edge, baseline)),
          width: round(barThick * 0.84), height: round(Math.abs(edge - baseline)),
          color, value, seriesIndex: si, categoryIndex: ci,
        });
      }
    });
    layout.legend.push({ name: s.name ?? `Series ${si + 1}`, color });
  });
  return layout;
}

function valuePosClamped(value: number, vMin: number, vMax: number): number {
  return Math.max(vMin, Math.min(vMax, value));
}

/** SVG arc (pie wedge or donut segment). Angles in radians, 0 at top, clockwise. */
function arcPath(
  cx: number, cy: number, r: number,
  start: number, end: number, innerR: number, full: boolean,
): string {
  const point = (radius: number, angle: number): [number, number] =>
    [round(cx + radius * Math.sin(angle)), round(cy - radius * Math.cos(angle))];

  if (full) {
    // A single full-circle slice: two half arcs (and a hole for donuts).
    const outer = `M ${round(cx)} ${round(cy - r)} A ${r} ${r} 0 1 1 ${round(cx)} ${round(cy + r)} A ${r} ${r} 0 1 1 ${round(cx)} ${round(cy - r)} Z`;
    if (innerR <= 0) return outer;
    const hole = `M ${round(cx)} ${round(cy - innerR)} A ${innerR} ${innerR} 0 1 0 ${round(cx)} ${round(cy + innerR)} A ${innerR} ${innerR} 0 1 0 ${round(cx)} ${round(cy - innerR)} Z`;
    return `${outer} ${hole}`;
  }

  const large = end - start > Math.PI ? 1 : 0;
  const [x0, y0] = point(r, start);
  const [x1, y1] = point(r, end);
  if (innerR <= 0) {
    return `M ${round(cx)} ${round(cy)} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
  }
  const [ix1, iy1] = point(innerR, end);
  const [ix0, iy0] = point(innerR, start);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix0} ${iy0} Z`;
}
