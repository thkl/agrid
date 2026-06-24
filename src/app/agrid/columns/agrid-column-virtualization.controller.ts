import { Signal, computed } from '@angular/core';

/**
 * The contiguous slice of scrollable columns to render, plus the pixel widths of the
 * hidden columns on either side (used to size leading/trailing spacer grid items so the
 * full column layout and scroll width are preserved).
 * @internal
 */
export interface AgridColumnWindow {
  /** Index of the first rendered scrollable column (inclusive). */
  start: number;
  /** Index just past the last rendered scrollable column (exclusive). */
  end: number;
  /** Combined width of the hidden columns before {@link start}. */
  leftWidth: number;
  /** Combined width of the hidden columns from {@link end} onward. */
  rightWidth: number;
}

/** Reactive inputs required by {@link AgridColumnVirtualizationController}. @internal */
export interface AgridColumnVirtualizationOptions {
  /** Ordered widths of the scrollable-pane columns. */
  columnWidths: Signal<number[]>;
  /** Current horizontal scroll offset of the scrollable pane. */
  scrollLeft: Signal<number>;
  /** Visible width of the scrollable pane viewport. */
  viewportWidth: Signal<number>;
  /**
   * At or below this scrollable-column count virtualization is skipped (the full set renders).
   * A very large value effectively disables virtualization.
   */
  minColumns: Signal<number>;
  /** Extra pixels rendered beyond each edge to avoid blank flashes while scrolling. */
  overscanPx?: number;
}

/**
 * Computes which scrollable columns are within (or near) the horizontal viewport, so the
 * grid can render only those cells per row instead of every visible column. Pure and
 * DOM-free — the component feeds it scroll metrics and consumes {@link window}.
 * @internal
 */
export class AgridColumnVirtualizationController {
  private readonly overscanPx: number;

  constructor(private readonly opts: AgridColumnVirtualizationOptions) {
    this.overscanPx = opts.overscanPx ?? 240;
  }

  /**
   * The current column window. When virtualization is inactive (too few columns or an
   * unmeasured viewport) this spans every column with zero-width spacers, so callers render
   * exactly as they would without virtualization.
   */
  readonly window = computed<AgridColumnWindow>(() => {
    const widths = this.opts.columnWidths();
    const count = widths.length;
    const viewportWidth = this.opts.viewportWidth();
    if (count <= this.opts.minColumns() || viewportWidth <= 0) {
      return { start: 0, end: count, leftWidth: 0, rightWidth: 0 };
    }

    // prefix[i] is the left edge of column i; prefix[count] is the total width.
    const prefix = new Array<number>(count + 1);
    prefix[0] = 0;
    for (let i = 0; i < count; i++) prefix[i + 1] = prefix[i] + widths[i];
    const total = prefix[count];

    const scrollLeft = this.opts.scrollLeft();
    const min = scrollLeft - this.overscanPx;
    const max = scrollLeft + viewportWidth + this.overscanPx;

    // First column whose right edge crosses the (overscanned) left boundary.
    let start = 0;
    while (start < count && prefix[start + 1] <= min) start++;
    if (start >= count) start = count - 1; // scrolled past the end — keep the last column
    // First column whose left edge is past the (overscanned) right boundary.
    let end = start;
    while (end < count && prefix[end] < max) end++;
    if (end <= start) end = Math.min(count, start + 1);

    return { start, end, leftWidth: prefix[start], rightWidth: total - prefix[end] };
  });
}
