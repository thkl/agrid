/**
 * Zero-dependency sparkline geometry. Pure math that maps a numeric series onto an SVG box, so a
 * thin renderer component only has to emit `<path>` / `<rect>` elements. Mirrors the project's
 * hand-rolled, dependency-free approach (see the xlsx writer) — no charting library required.
 */

/** A single scaled point in the sparkline box. */
export interface SparklinePoint {
  x: number;
  y: number;
}

/** A single column/bar in a bar sparkline. */
export interface SparklineBar {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The source value this bar represents. */
  value: number;
  /** Whether the value is below zero (renderers can colour it differently). */
  negative: boolean;
}

/** Scaled geometry for both line and bar sparklines plus emphasis markers. */
export interface SparklineGeometry {
  /** Scaled points, one per finite value. */
  points: SparklinePoint[];
  /** `M…L…` path string for a line sparkline. */
  linePath: string;
  /** Column rectangles for a bar sparkline, baselined at zero. */
  bars: SparklineBar[];
  /** The last point (line endpoint marker), or `null` when there is no data. */
  last: SparklinePoint | null;
  /** The lowest point, or `null` when there is no data. */
  min: SparklinePoint | null;
  /** The highest point, or `null` when there is no data. */
  max: SparklinePoint | null;
}

/** Box dimensions (in pixels) the series is scaled into. */
export interface SparklineOptions {
  width: number;
  height: number;
  /** Inset (px) kept on every edge so peaks, valleys, and markers are not clipped. @default 2 */
  padding?: number;
}

const round = (n: number): number => Math.round(n * 100) / 100;

const EMPTY: SparklineGeometry = { points: [], linePath: '', bars: [], last: null, min: null, max: null };

/**
 * Builds line + bar geometry for a numeric series. Non-finite entries are dropped. The line scale
 * fills the box from the data minimum to the data maximum; the bar scale is baselined at zero so
 * positive and negative columns read correctly.
 */
export function buildSparkline(rawValues: readonly number[], opts: SparklineOptions): SparklineGeometry {
  const { width, height } = opts;
  const padding = opts.padding ?? 2;
  const values = rawValues.filter((v): v is number => Number.isFinite(v));
  if (values.length === 0 || width <= 0 || height <= 0) return EMPTY;

  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);
  const n = values.length;
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  // Line scale: data range → full inner height (higher value = smaller y).
  // A flat series (no range) is centred vertically instead of collapsing to an edge.
  const flat = dataMax === dataMin;
  const span = dataMax - dataMin || 1;
  const xOf = (i: number): number => (n === 1 ? padding + innerW / 2 : padding + (i / (n - 1)) * innerW);
  const yOf = (v: number): number =>
    flat ? padding + innerH / 2 : padding + innerH - ((v - dataMin) / span) * innerH;

  const points = values.map((v, i) => ({ x: round(xOf(i)), y: round(yOf(v)) }));
  // A flat single-value series still draws a visible horizontal line.
  const linePoints = n === 1
    ? [{ x: round(padding), y: round(yOf(values[0])) }, { x: round(padding + innerW), y: round(yOf(values[0])) }]
    : points;
  const linePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Bar scale: baselined at zero so signs are visible.
  const top = Math.max(0, dataMax);
  const bottom = Math.min(0, dataMin);
  const barSpan = top - bottom || 1;
  const yOfBar = (v: number): number => padding + innerH - ((v - bottom) / barSpan) * innerH;
  const baselineY = yOfBar(0);
  const slot = n > 0 ? innerW / n : innerW;
  const barWidth = Math.max(1, slot * 0.7);
  const bars: SparklineBar[] = values.map((v, i) => {
    const barEdge = yOfBar(v);
    const y = Math.min(barEdge, baselineY);
    return {
      x: round(padding + i * slot + (slot - barWidth) / 2),
      y: round(y),
      width: round(barWidth),
      height: round(Math.max(0, Math.abs(barEdge - baselineY))),
      value: v,
      negative: v < 0,
    };
  });

  const minIndex = values.indexOf(dataMin);
  const maxIndex = values.indexOf(dataMax);

  return {
    points,
    linePath,
    bars,
    last: points[points.length - 1] ?? null,
    min: points[minIndex] ?? null,
    max: points[maxIndex] ?? null,
  };
}
