import { DestroyRef, Signal, WritableSignal, signal } from '@angular/core';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { AgridDataSource } from '../agrid-datasource';
import { ColDef, GridItem, RowReorderEvent } from '../agrid.types';
import { buildSelectionRange, getCellValue, getDisplayForField } from '../agrid.utils';

/** Dependencies and callbacks required by {@link AgridDragHandler}. @internal */
export interface AgridDragHandlerOptions {
  dataSource: Signal<AgridDataSource>;
  filteredItems: () => GridItem[];
  locale: () => string | undefined;
  selectedIndices: WritableSignal<Set<number>>;
  onReorder: (event: RowReorderEvent) => void;
  onSelectionChange: () => void;
}

/**
 * Handles both row-reorder drag and drag-select. The two share `_getHoveredRow`
 * and the same pointer-event lifecycle pattern, so they live together.
 *
 * Signals exposed here are read by the component's `displayItems` computed
 * to render the ghost row during a reorder drag.
 *
 * @internal
 */
export class AgridDragHandler {
  readonly reorderOriginalIndex = signal<number | null>(null);
  readonly reorderOverIndex     = signal<number | null>(null);
  readonly reorderInsertBefore  = signal<boolean>(true);

  private _overlayEl: HTMLElement | null = null;
  private _offsetX = 0;
  private _offsetY = 0;
  private _dragSelAnchor: number | null = null;

  constructor(
    private readonly opts: AgridDragHandlerOptions,
    destroyRef: DestroyRef,
    private readonly browser = new AgridBrowserAdapter(),
  ) {
    destroyRef.onDestroy(() => this._cleanupReorder());
    destroyRef.onDestroy(() => this._cancelDragSelect());
  }

  /** Starts a row reorder gesture and creates its floating preview. */
  startReorder(event: PointerEvent, originalIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    const rowEl = (event.currentTarget as HTMLElement).closest<HTMLElement>('.ag-row');
    if (!rowEl) return;
    const rect = rowEl.getBoundingClientRect();
    this.reorderOriginalIndex.set(originalIndex);
    this._offsetX = event.clientX - rect.left;
    this._offsetY = event.clientY - rect.top;

    const overlay = rowEl.cloneNode(true) as HTMLElement;
    overlay.removeAttribute('data-original-index');
    Object.assign(overlay.style, {
      position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
      pointerEvents: 'none', zIndex: '9999', background: '#fff',
      border: '1px solid #1a73e8', borderRadius: '4px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)', overflow: 'hidden',
      opacity: '0.95', cursor: 'grabbing',
    });
    if (!this.browser.appendToBody(overlay)) {
      this._clearReorder();
      return;
    }
    this._overlayEl = overlay;
    this.browser.addDocumentListener('pointermove', this._reorderMove);
    this.browser.addDocumentListener('pointerup', this._reorderUp);
    this.browser.addDocumentListener('pointercancel', this._reorderCancel);
  }

  /** Returns the formatted value shown in a reorder ghost cell. */
  getGhostDisplay(col: ColDef): string {
    const idx = this.reorderOriginalIndex();
    if (idx === null) return '';
    const row = this.opts.dataSource().rows()[idx];
    return getDisplayForField(col, getCellValue(col, row, idx), this.opts.locale(), row);
  }

  private readonly _reorderMove = (e: PointerEvent): void => {
    if (this._overlayEl) {
      this._overlayEl.style.top  = `${e.clientY - this._offsetY}px`;
      this._overlayEl.style.left = `${e.clientX - this._offsetX}px`;
    }
    const hovered = this._getHoveredRow(e.clientX, e.clientY);
    if (hovered) {
      if (this.reorderOverIndex()    !== hovered.originalIndex) this.reorderOverIndex.set(hovered.originalIndex);
      if (this.reorderInsertBefore() !== hovered.insertBefore)  this.reorderInsertBefore.set(hovered.insertBefore);
    } else {
      this.reorderOverIndex.set(null);
    }
  };

  private readonly _reorderUp = (_e: PointerEvent): void => {
    this._removeReorderListeners();
    const overlay = this._overlayEl;
    this._overlayEl = null;
    if (overlay) {
      overlay.style.transition = 'opacity 80ms ease';
      overlay.style.opacity = '0';
      this.browser.schedule(() => overlay.remove(), 90);
    }
    const oldIndex = this.reorderOriginalIndex();
    const overIdx  = this.reorderOverIndex();
    if (oldIndex !== null && overIdx !== null) {
      const newIndex    = this.reorderInsertBefore() ? overIdx : overIdx + 1;
      const shouldEmit  = oldIndex !== newIndex;
      this._clearReorder();
      if (shouldEmit) {
        this.opts.onReorder({ row: { ...this.opts.dataSource().rows()[oldIndex] }, oldIndex, newIndex });
      }
    } else {
      this._clearReorder();
    }
  };

  private readonly _reorderCancel = (): void => this._cleanupReorder();

  private _cleanupReorder(): void {
    this._removeReorderListeners();
    this._overlayEl?.remove();
    this._overlayEl = null;
    this._clearReorder();
  }

  private _removeReorderListeners(): void {
    this.browser.removeDocumentListener('pointermove', this._reorderMove);
    this.browser.removeDocumentListener('pointerup', this._reorderUp);
    this.browser.removeDocumentListener('pointercancel', this._reorderCancel);
  }

  private _clearReorder(): void {
    this.reorderOriginalIndex.set(null);
    this.reorderOverIndex.set(null);
    this.reorderInsertBefore.set(true);
  }

  /** Starts pointer-driven multi-row selection from an anchor row. */
  startDragSelect(originalIndex: number): void {
    this._dragSelAnchor = originalIndex;
    this.browser.addDocumentListener('pointermove', this._dragSelMove);
    this.browser.addDocumentListener('pointerup', this._dragSelUp);
    this.browser.addDocumentListener('pointercancel', this._dragSelCancel);
  }

  private readonly _dragSelMove = (e: PointerEvent): void => {
    const anchor = this._dragSelAnchor;
    if (anchor === null) return;
    const hovered = this._getHoveredRow(e.clientX, e.clientY);
    if (!hovered) return;
    this.opts.selectedIndices.set(
      buildSelectionRange(anchor, hovered.originalIndex, this.opts.filteredItems())
    );
  };

  private readonly _dragSelUp = (): void => {
    this._removeDragSelectListeners();
    this._dragSelAnchor = null;
    this.opts.onSelectionChange();
  };

  private readonly _dragSelCancel = (): void => this._cancelDragSelect();

  private _cancelDragSelect(): void {
    this._removeDragSelectListeners();
    this._dragSelAnchor = null;
  }

  private _removeDragSelectListeners(): void {
    this.browser.removeDocumentListener('pointermove', this._dragSelMove);
    this.browser.removeDocumentListener('pointerup', this._dragSelUp);
    this.browser.removeDocumentListener('pointercancel', this._dragSelCancel);
  }

  private _getHoveredRow(x: number, y: number): { originalIndex: number; insertBefore: boolean } | null {
    for (const el of this.browser.elementsFromPoint(x, y)) {
      const rowEl = (el as HTMLElement).closest<HTMLElement>('.ag-row[data-original-index]');
      if (!rowEl) continue;
      const rect = rowEl.getBoundingClientRect();
      return {
        originalIndex: Number(rowEl.dataset['originalIndex']),
        insertBefore: y < rect.top + rect.height / 2,
      };
    }
    return null;
  }
}
