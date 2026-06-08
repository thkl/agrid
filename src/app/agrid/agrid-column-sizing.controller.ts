import { DestroyRef, Signal, signal } from '@angular/core';
import { AgridBrowserAdapter } from './agrid-browser.adapter';
import { AgridControl } from './agrid-control';
import { ColDef, GridItem } from './agrid.types';
import { getDisplayForField, isDataRowItem } from './agrid.utils';

export interface AgridColumnSizingOptions {
  control: Signal<AgridControl | null>;
  filteredItems: Signal<GridItem[]>;
  visibleColDefs: Signal<ColDef[]>;
  scrollableColDefs: Signal<ColDef[]>;
  locale: Signal<string>;
  isColumnPinned: (field: string) => boolean;
  wrapperElement: () => HTMLElement;
  scrollerElement: () => HTMLElement;
}

/** Owns column widths, resize interactions, autosizing, and horizontal visibility. */
export class AgridColumnSizingController {
  private readonly localWidths = signal<Record<string, number>>({});
  private resizeState: { field: string; startX: number; startWidth: number } | null = null;

  constructor(
    private readonly opts: AgridColumnSizingOptions,
    destroyRef: DestroyRef,
    private readonly browser = new AgridBrowserAdapter(),
  ) {
    destroyRef.onDestroy(() => this.finishResize());
  }

  getWidth(col: ColDef): number {
    const override = this.widthOverride(col.field);
    if (override !== undefined) return override;
    return col.width == null || col.width === -1 ? 0 : col.width;
  }

  getWidthToken(col: ColDef): string {
    const override = this.widthOverride(col.field);
    if (override !== undefined) return `${override}px`;
    return col.width == null || col.width === -1 ? '1fr' : `${col.width}px`;
  }

  setWidth(field: string, width: number): void {
    const control = this.opts.control();
    if (control) {
      control.setColumnWidth(field, width);
    } else {
      this.localWidths.update(widths => ({
        ...widths,
        [field]: Math.max(40, width),
      }));
    }
  }

  startResize(event: MouseEvent, col: ColDef): void {
    if (col.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const renderedWidth = (event.currentTarget as HTMLElement)
      .closest<HTMLElement>('.ag-header-cell')
      ?.getBoundingClientRect().width;
    this.resizeState = {
      field: col.field,
      startX: event.clientX,
      startWidth: this.getWidth(col) || renderedWidth || 100,
    };
    this.browser.setBodyInteraction('col-resize', 'none');
    this.browser.addDocumentListener('mousemove', this.resizeMove);
    this.browser.addDocumentListener('mouseup', this.resizeUp);
  }

  resizeFromKeyboard(event: KeyboardEvent, col: ColDef): void {
    if (col.locked || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -10 : 10;
    this.setWidth(col.field, this.getWidth(col) + delta);
  }

  autosizeColumn(col: ColDef): void {
    if (col.locked) return;
    const context = this.getAutosizeContext();
    if (!context) return;
    this.setWidth(col.field, this.measureAutosizeWidth(col, context));
  }

  autosizeAllColumns(): void {
    const context = this.getAutosizeContext();
    if (!context) return;
    for (const col of this.opts.visibleColDefs()) {
      if (!col.locked) this.setWidth(col.field, this.measureAutosizeWidth(col, context));
    }
  }

  scrollColumnToKeepVisible(colIndex: number): void {
    const col = this.opts.visibleColDefs()[colIndex];
    if (!col || this.opts.isColumnPinned(col.field)) return;

    const scroller = this.opts.scrollerElement();
    const { start, end } = this.getScrollableColumnBounds(col.field);
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    let nextScrollLeft = scroller.scrollLeft;

    if (start < nextScrollLeft) {
      nextScrollLeft = start;
    } else if (end > nextScrollLeft + scroller.clientWidth) {
      nextScrollLeft = end - scroller.clientWidth;
    }

    nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft));
    if (nextScrollLeft !== scroller.scrollLeft) scroller.scrollLeft = nextScrollLeft;
  }

  private readonly resizeMove = (event: MouseEvent): void => {
    if (!this.resizeState) return;
    this.setWidth(
      this.resizeState.field,
      this.resizeState.startWidth + (event.clientX - this.resizeState.startX),
    );
  };

  private readonly resizeUp = (): void => this.finishResize();

  private finishResize(): void {
    this.resizeState = null;
    this.browser.setBodyInteraction('', '');
    this.browser.removeDocumentListener('mousemove', this.resizeMove);
    this.browser.removeDocumentListener('mouseup', this.resizeUp);
  }

  private widthOverride(field: string): number | undefined {
    return this.opts.control()?.columnWidths()[field] ?? this.localWidths()[field];
  }

  private getScrollableColumnBounds(field: string): { start: number; end: number } {
    let start = 0;
    for (const col of this.opts.scrollableColDefs()) {
      const width = this.getWidth(col);
      if (col.field === field) return { start, end: start + width };
      start += width;
    }
    return { start: 0, end: 0 };
  }

  private measureAutosizeWidth(
    col: ColDef,
    context: CanvasRenderingContext2D,
  ): number {
    const values = [col.header];
    for (const item of this.opts.filteredItems()) {
      if (!isDataRowItem(item)) continue;
      values.push(getDisplayForField(col, item.row[col.field], this.opts.locale()));
    }
    const measured = values.reduce(
      (max, value) => Math.max(max, context.measureText(value).width),
      0,
    );
    return Math.max(40, Math.min(500, Math.ceil(measured + 42)));
  }

  private getAutosizeContext(): CanvasRenderingContext2D | null {
    const context = this.browser.createCanvasContext();
    if (!context) return null;
    const style = this.browser.computedStyle(this.opts.wrapperElement());
    if (style) context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return context;
  }
}
