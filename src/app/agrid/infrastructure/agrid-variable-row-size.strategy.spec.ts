import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { AgridVariableRowSizeStrategy } from './agrid-variable-row-size.strategy';

/** Minimal fake viewport capturing the values the strategy pushes into CDK. */
function fakeViewport(opts: { dataLength: number; viewportSize: number; scrollOffset: number }) {
  const state = {
    totalContentSize: 0,
    renderedRange: { start: 0, end: 0 },
    renderedContentOffset: 0,
    scrolledToOffset: -1,
  };
  const viewport = {
    getDataLength: () => opts.dataLength,
    getViewportSize: () => opts.viewportSize,
    measureScrollOffset: () => opts.scrollOffset,
    setTotalContentSize: (size: number) => (state.totalContentSize = size),
    setRenderedRange: (range: { start: number; end: number }) => (state.renderedRange = range),
    setRenderedContentOffset: (offset: number) => (state.renderedContentOffset = offset),
    scrollToOffset: (offset: number) => (state.scrolledToOffset = offset),
  } as unknown as CdkVirtualScrollViewport;
  return { viewport, state };
}

describe('AgridVariableRowSizeStrategy', () => {
  it('sums uniform heights into the total content size', () => {
    const strategy = new AgridVariableRowSizeStrategy();
    const { viewport, state } = fakeViewport({ dataLength: 10, viewportSize: 100, scrollOffset: 0 });
    strategy.updateItemSizes(new Array(10).fill(32));
    strategy.attach(viewport);

    expect(state.totalContentSize).toBe(320);
    expect(state.renderedRange.start).toBe(0);
  });

  it('accounts for a taller detail row in the total and in offsets', () => {
    const strategy = new AgridVariableRowSizeStrategy();
    // rows 0..4 are 32px, row 2 is followed by a 200px detail panel (index 3)
    const sizes = [32, 32, 32, 200, 32, 32];
    const { viewport, state } = fakeViewport({ dataLength: sizes.length, viewportSize: 500, scrollOffset: 0 });
    strategy.updateItemSizes(sizes);
    strategy.attach(viewport);

    expect(state.totalContentSize).toBe(360);
  });

  it('scrolls to the cumulative offset of an index (past a detail panel)', () => {
    const strategy = new AgridVariableRowSizeStrategy();
    const sizes = [32, 32, 200, 32, 32];
    const { viewport, state } = fakeViewport({ dataLength: sizes.length, viewportSize: 500, scrollOffset: 0 });
    strategy.updateItemSizes(sizes);
    strategy.attach(viewport);

    strategy.scrollToIndex(3, 'auto');
    // offset of index 3 = 32 + 32 + 200 = 264
    expect(state.scrolledToOffset).toBe(264);
  });

  it('renders only the windowed range when scrolled down', () => {
    const strategy = new AgridVariableRowSizeStrategy();
    const sizes = new Array(100).fill(32);
    const { viewport, state } = fakeViewport({ dataLength: 100, viewportSize: 100, scrollOffset: 1000 });
    strategy.updateItemSizes(sizes);
    strategy.attach(viewport);

    // window around offset 1000 (±200 buffer) sits well inside the list, not at the edges
    expect(state.renderedRange.start).toBeGreaterThan(0);
    expect(state.renderedRange.end).toBeLessThan(100);
    expect(state.renderedRange.end).toBeGreaterThan(state.renderedRange.start);
  });

  it('renders nothing for an empty list', () => {
    const strategy = new AgridVariableRowSizeStrategy();
    const { viewport, state } = fakeViewport({ dataLength: 0, viewportSize: 100, scrollOffset: 0 });
    strategy.updateItemSizes([]);
    strategy.attach(viewport);

    expect(state.renderedRange).toEqual({ start: 0, end: 0 });
    expect(state.totalContentSize).toBe(0);
  });
});
