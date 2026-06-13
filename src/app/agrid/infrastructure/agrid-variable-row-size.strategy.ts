import { ListRange } from '@angular/cdk/collections';
import {
  CdkVirtualScrollViewport,
  VIRTUAL_SCROLL_STRATEGY,
  VirtualScrollStrategy,
} from '@angular/cdk/scrolling';
import { Directive, OnChanges, forwardRef, input } from '@angular/core';
import { Observable, Subject, distinctUntilChanged } from 'rxjs';

/** Pixels rendered above and below the viewport so scrolling does not reveal blank rows. */
const BUFFER_PX = 200;

/**
 * A {@link VirtualScrollStrategy} that supports a different height per item instead of the single
 * fixed `itemSize` used by CDK's {@link FixedSizeVirtualScrollStrategy}.
 *
 * Item heights are supplied as a flat array (one entry per virtual item) and converted into a
 * prefix-sum offset table, so any row — a normal data row or a tall master/detail panel — can have
 * its own height while scroll position math stays O(log n) via binary search.
 *
 * When every item shares the same height (the common case with no detail rows open) the behavior
 * is equivalent to the fixed-size strategy, so the default code path is regression-safe.
 * @internal
 */
export class AgridVariableRowSizeStrategy implements VirtualScrollStrategy {
  private viewport: CdkVirtualScrollViewport | null = null;
  private sizes: number[] = [];
  /** Cumulative offsets; `offsets[i]` is the top of item `i`, `offsets[n]` is the total size. */
  private offsets: number[] = [0];

  private readonly indexChange = new Subject<number>();
  readonly scrolledIndexChange: Observable<number> = this.indexChange.pipe(distinctUntilChanged());

  attach(viewport: CdkVirtualScrollViewport): void {
    this.viewport = viewport;
    this.updateTotalContentSize();
    this.updateRenderedRange();
  }

  detach(): void {
    this.indexChange.complete();
    this.viewport = null;
  }

  /** Replace the per-item heights and re-measure. Called by the directive when inputs change. */
  updateItemSizes(sizes: number[]): void {
    this.sizes = sizes;
    const offsets = new Array<number>(sizes.length + 1);
    offsets[0] = 0;
    for (let i = 0; i < sizes.length; i++) offsets[i + 1] = offsets[i] + sizes[i];
    this.offsets = offsets;
    if (this.viewport) {
      this.updateTotalContentSize();
      this.updateRenderedRange();
    }
  }

  onContentScrolled(): void {
    this.updateRenderedRange();
  }

  onDataLengthChanged(): void {
    this.updateTotalContentSize();
    this.updateRenderedRange();
  }

  onContentRendered(): void {
    /* no-op: heights are supplied, not measured from the DOM */
  }

  onRenderedOffsetChanged(): void {
    /* no-op */
  }

  scrollToIndex(index: number, behavior: ScrollBehavior): void {
    if (!this.viewport) return;
    const clamped = Math.max(0, Math.min(index, this.sizes.length));
    this.viewport.scrollToOffset(this.offsets[clamped] ?? 0, behavior);
  }

  private get totalSize(): number {
    return this.offsets[this.offsets.length - 1] ?? 0;
  }

  private updateTotalContentSize(): void {
    this.viewport?.setTotalContentSize(this.totalSize);
  }

  /** Largest item index whose top offset is `<= offset` (binary search over the prefix sums). */
  private indexAt(offset: number): number {
    const o = this.offsets;
    let lo = 0;
    let hi = o.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (o[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private updateRenderedRange(): void {
    const viewport = this.viewport;
    if (!viewport) return;

    const dataLength = viewport.getDataLength();
    const n = Math.min(this.sizes.length, dataLength);
    if (n === 0) {
      viewport.setRenderedRange({ start: 0, end: 0 });
      viewport.setRenderedContentOffset(0);
      this.indexChange.next(0);
      return;
    }

    const scrollOffset = viewport.measureScrollOffset();
    const viewportSize = viewport.getViewportSize();
    const start = Math.max(0, this.indexAt(scrollOffset - BUFFER_PX));
    const end = Math.min(n, this.indexAt(scrollOffset + viewportSize + BUFFER_PX) + 1);

    const range: ListRange = { start, end };
    viewport.setRenderedRange(range);
    viewport.setRenderedContentOffset(this.offsets[start] ?? 0);
    this.indexChange.next(this.indexAt(scrollOffset));
  }
}

/**
 * Wires {@link AgridVariableRowSizeStrategy} into a `cdk-virtual-scroll-viewport`.
 *
 * Apply alongside an `agridVariableRowSize` binding carrying the per-item height array. Replaces
 * the viewport's `[itemSize]` binding. The same height array is fed to every (left/body/right)
 * viewport so the panes stay row-aligned.
 * @internal
 */
@Directive({
  selector: 'cdk-virtual-scroll-viewport[agridVariableRowSize]',
  providers: [
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: (d: AgridVariableRowSizeDirective) => d.strategy,
      deps: [forwardRef(() => AgridVariableRowSizeDirective)],
    },
  ],
})
export class AgridVariableRowSizeDirective implements OnChanges {
  /** Per-item heights in pixels, one entry per virtual-scroll item. */
  readonly itemSizes = input<number[]>([], { alias: 'agridVariableRowSize' });

  readonly strategy = new AgridVariableRowSizeStrategy();

  ngOnChanges(): void {
    this.strategy.updateItemSizes(this.itemSizes());
  }
}
