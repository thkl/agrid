import { DestroyRef, Signal, WritableSignal, signal } from '@angular/core';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { CellRange } from './agrid-clipboard.handler';
import { AgridControl, HistoryEntry } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { CellPosition, ColDef, GridEditEvent, GridItem } from '../agrid.types';
import { isDataRowItem } from '../agrid.utils';

/** Rectangular bounds in projected row and visible column coordinates. @internal */
export type VisibleCellBounds = {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

/** Dependencies and callbacks required by {@link AgridRangeController}. @internal */
export interface AgridRangeControllerOptions {
  control: Signal<AgridControl | null>;
  dataSource: Signal<AgridDataSource>;
  filteredItems: Signal<GridItem[]>;
  visibleColDefs: Signal<ColDef[]>;
  selectedCell: WritableSignal<CellPosition | null>;
  selectedRange: WritableSignal<CellRange | null>;
  isCellEditable: (col: ColDef, originalIndex: number) => boolean;
  cancelEdit: () => void;
  findDisplayIndex: (originalIndex: number) => number;
  scrollToCell: (displayIndex: number, colIndex: number) => void;
  verticalViewportElement: () => HTMLElement;
  horizontalViewportElement: () => HTMLElement;
  onCellEdit: (event: GridEditEvent) => void;
}

/** Owns cell-range calculations and fill-handle drag/application behavior. @internal */
export class AgridRangeController {
  readonly fillPreviewBounds = signal<VisibleCellBounds | null>(null);
  private fillDragSource: VisibleCellBounds | null = null;
  private selectionDragAnchor: CellPosition | null = null;
  private selectionDragMoved = false;
  private suppressActivation = false;
  private dragPointer: { x: number; y: number } | null = null;
  private autoScrollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly opts: AgridRangeControllerOptions,
    destroyRef: DestroyRef,
    private readonly browser = new AgridBrowserAdapter(),
  ) {
    destroyRef.onDestroy(() => this.cancelFill());
    destroyRef.onDestroy(() => this.cancelSelectionDrag());
  }

  /** Starts a pointer-driven rectangular selection from a data cell. */
  startSelection(event: PointerEvent, rowIndex: number, colIndex: number): void {
    if (event.button !== 0 || this.selectionDragAnchor) return;
    this.opts.cancelEdit();
    if (event.shiftKey && this.opts.selectedCell()) {
      this.extendTo(rowIndex, colIndex);
      this.suppressActivation = true;
      return;
    }
    const anchor = { rowIndex, colIndex };
    this.selectionDragAnchor = anchor;
    this.selectionDragMoved = false;
    this.suppressActivation = false;
    this.dragPointer = { x: event.clientX, y: event.clientY };
    this.opts.selectedCell.set(anchor);
    this.opts.selectedRange.set(null);
    this.browser.setBodyInteraction('cell', 'none');
    this.browser.addDocumentListener('pointermove', this.selectionDragMove);
    this.browser.addDocumentListener('pointerup', this.selectionDragUp);
    this.browser.addDocumentListener('pointercancel', this.selectionDragCancel);
  }

  /** Consumes the click generated after a completed range drag. */
  consumeSuppressedActivation(): boolean {
    if (!this.suppressActivation) return false;
    this.suppressActivation = false;
    return true;
  }

  /** Extends the current range focus to a source row and visible column. */
  extendTo(rowIndex: number, colIndex: number): void {
    const selected = this.opts.selectedCell();
    const anchor = this.opts.selectedRange()?.anchor ?? selected ?? { rowIndex, colIndex };
    const focus = { rowIndex, colIndex };
    this.opts.selectedCell.set(focus);
    this.opts.selectedRange.set({ anchor, focus });
  }

  /** Returns selected range bounds in projected display coordinates. */
  getVisibleRangeBounds(): VisibleCellBounds | null {
    const range = this.opts.selectedRange();
    if (!range) return null;
    const anchorDisplayIndex = this.opts.findDisplayIndex(range.anchor.rowIndex);
    const focusDisplayIndex = this.opts.findDisplayIndex(range.focus.rowIndex);
    if (anchorDisplayIndex < 0 || focusDisplayIndex < 0) return null;
    return {
      rowStart: Math.min(anchorDisplayIndex, focusDisplayIndex),
      rowEnd: Math.max(anchorDisplayIndex, focusDisplayIndex),
      colStart: Math.min(range.anchor.colIndex, range.focus.colIndex),
      colEnd: Math.max(range.anchor.colIndex, range.focus.colIndex),
    };
  }

  /** Returns range bounds, falling back to the active cell. */
  getActiveSelectionBounds(): VisibleCellBounds | null {
    const range = this.getVisibleRangeBounds();
    if (range) return range;
    const selected = this.opts.selectedCell();
    if (!selected) return null;
    const displayIndex = this.opts.findDisplayIndex(selected.rowIndex);
    if (displayIndex < 0) return null;
    return {
      rowStart: displayIndex,
      rowEnd: displayIndex,
      colStart: selected.colIndex,
      colEnd: selected.colIndex,
    };
  }

  /** Returns whether a cell is inside the selected range. */
  isRangeSelected(originalIndex: number, colIndex: number): boolean {
    const range = this.getVisibleRangeBounds();
    if (!range) return false;
    const displayIndex = this.opts.findDisplayIndex(originalIndex);
    return displayIndex >= range.rowStart && displayIndex <= range.rowEnd
      && colIndex >= range.colStart && colIndex <= range.colEnd;
  }

  /** Returns whether a cell owns the selection's fill handle. */
  isFillHandleCell(originalIndex: number, colIndex: number): boolean {
    const bounds = this.getActiveSelectionBounds();
    if (!bounds) return false;
    const displayIndex = this.opts.findDisplayIndex(originalIndex);
    return displayIndex === bounds.rowEnd && colIndex === bounds.colEnd;
  }

  /** Returns whether a cell is inside the pending fill extension. */
  isFillPreviewCell(originalIndex: number, colIndex: number): boolean {
    const source = this.fillDragSource;
    const target = this.fillPreviewBounds();
    if (!source || !target) return false;
    const displayIndex = this.opts.findDisplayIndex(originalIndex);
    const insideTarget = displayIndex >= target.rowStart && displayIndex <= target.rowEnd
      && colIndex >= target.colStart && colIndex <= target.colEnd;
    const insideSource = displayIndex >= source.rowStart && displayIndex <= source.rowEnd
      && colIndex >= source.colStart && colIndex <= source.colEnd;
    return insideTarget && !insideSource;
  }

  /** Starts a fill-handle drag from the active selection corner. */
  startFill(event: PointerEvent, originalIndex: number, colIndex: number): boolean {
    if (event.button !== 0 || !this.isFillHandleCell(originalIndex, colIndex)) return false;
    if (!this.isFillHandleHit(event)) return false;
    const bounds = this.getActiveSelectionBounds();
    if (!bounds) return false;
    event.preventDefault();
    event.stopPropagation();
    this.opts.cancelEdit();
    this.fillDragSource = bounds;
    this.fillPreviewBounds.set(null);
    this.browser.addDocumentListener('pointermove', this.fillDragMove);
    this.browser.addDocumentListener('pointerup', this.fillDragUp);
    this.browser.addDocumentListener('pointercancel', this.fillDragCancel);
    return true;
  }

  /** Repeats source values across the target range as one history operation. */
  applyFill(source: VisibleCellBounds, target: VisibleCellBounds): void {
    const items = this.opts.filteredItems();
    const cols = this.opts.visibleColDefs();
    const sourceRows = this.getDataDisplayIndices(source.rowStart, source.rowEnd);
    const targetRows = this.getDataDisplayIndices(target.rowStart, target.rowEnd);
    if (sourceRows.length === 0 || targetRows.length === 0) return;

    const sourceValues = sourceRows.map(displayIndex => {
      const item = items[displayIndex];
      return isDataRowItem(item)
        ? cols.slice(source.colStart, source.colEnd + 1).map(col => item.row[col.field])
        : [];
    });

    let lastPosition: CellPosition | null = null;
    const historyEntries: HistoryEntry[] = [];
    for (let rowOffset = 0; rowOffset < targetRows.length; rowOffset++) {
      const displayIndex = targetRows[rowOffset];
      const item = items[displayIndex];
      if (!isDataRowItem(item)) continue;
      for (let colIndex = target.colStart; colIndex <= target.colEnd; colIndex++) {
        const insideSource = displayIndex >= source.rowStart && displayIndex <= source.rowEnd
          && colIndex >= source.colStart && colIndex <= source.colEnd;
        if (insideSource) continue;
        const col = cols[colIndex];
        if (!col || !this.opts.isCellEditable(col, item.originalIndex)) continue;
        const sourceRowIndex = rowOffset % sourceValues.length;
        const sourceRowValues = sourceValues[sourceRowIndex];
        if (sourceRowValues.length === 0) continue;
        const sourceColIndex = (colIndex - source.colStart) % sourceRowValues.length;
        const oldValue = this.opts.dataSource().getRow(item.originalIndex)[col.field];
        const newValue = sourceRowValues[sourceColIndex];
        if (oldValue === newValue) continue;

        this.opts.dataSource().patchRow(item.originalIndex, { [col.field]: newValue });
        historyEntries.push({
          rowIndex: item.originalIndex,
          field: col.field,
          oldValue,
          newValue,
        });
        this.opts.onCellEdit({
          position: { rowIndex: item.originalIndex, colIndex },
          field: col.field,
          oldValue,
          newValue,
        });
        lastPosition = { rowIndex: item.originalIndex, colIndex };
      }
    }

    this.opts.control()?.pushEditBatch(historyEntries);
    const targetItem = items[target.rowEnd];
    if (isDataRowItem(targetItem)) {
      this.opts.selectedCell.set({ rowIndex: targetItem.originalIndex, colIndex: target.colEnd });
      this.opts.selectedRange.set({
        anchor: this.positionFromVisibleCell(source.rowStart, source.colStart),
        focus: { rowIndex: targetItem.originalIndex, colIndex: target.colEnd },
      });
    } else if (lastPosition) {
      this.opts.selectedCell.set(lastPosition);
    }
  }

  private readonly fillDragMove = (event: PointerEvent): void => {
    const source = this.fillDragSource;
    if (!source) return;
    const target = this.getHoveredCellPosition(event.clientX, event.clientY);
    if (!target) {
      this.fillPreviewBounds.set(null);
      return;
    }
    const targetDisplayIndex = this.opts.findDisplayIndex(target.rowIndex);
    if (targetDisplayIndex < 0) {
      this.fillPreviewBounds.set(null);
      return;
    }
    const rowEnd = Math.max(source.rowEnd, targetDisplayIndex);
    const colEnd = Math.max(source.colEnd, target.colIndex);
    if (rowEnd === source.rowEnd && colEnd === source.colEnd) {
      this.fillPreviewBounds.set(null);
      return;
    }
    this.fillPreviewBounds.set({
      rowStart: source.rowStart,
      rowEnd,
      colStart: source.colStart,
      colEnd,
    });
    this.opts.scrollToCell(rowEnd, colEnd);
  };

  private readonly fillDragUp = (): void => {
    this.stopFillListeners();
    const source = this.fillDragSource;
    const target = this.fillPreviewBounds();
    this.fillDragSource = null;
    this.fillPreviewBounds.set(null);
    if (source && target) this.applyFill(source, target);
  };

  private readonly fillDragCancel = (): void => this.cancelFill();

  private cancelFill(): void {
    this.stopFillListeners();
    this.fillDragSource = null;
    this.fillPreviewBounds.set(null);
  }

  private stopFillListeners(): void {
    this.browser.removeDocumentListener('pointermove', this.fillDragMove);
    this.browser.removeDocumentListener('pointerup', this.fillDragUp);
    this.browser.removeDocumentListener('pointercancel', this.fillDragCancel);
  }

  private readonly selectionDragMove = (event: PointerEvent): void => {
    if (!this.selectionDragAnchor) return;
    event.preventDefault();
    this.dragPointer = { x: event.clientX, y: event.clientY };
    this.updateSelectionFromPointer();
    this.updateAutoScroll();
  };

  private readonly selectionDragUp = (): void => {
    this.suppressActivation = this.selectionDragMoved;
    this.stopSelectionDrag();
  };

  private readonly selectionDragCancel = (): void => this.cancelSelectionDrag();

  private cancelSelectionDrag(): void {
    this.suppressActivation = false;
    this.stopSelectionDrag();
  }

  private stopSelectionDrag(): void {
    this.browser.removeDocumentListener('pointermove', this.selectionDragMove);
    this.browser.removeDocumentListener('pointerup', this.selectionDragUp);
    this.browser.removeDocumentListener('pointercancel', this.selectionDragCancel);
    if (this.autoScrollTimer !== null) clearTimeout(this.autoScrollTimer);
    this.autoScrollTimer = null;
    this.selectionDragAnchor = null;
    this.selectionDragMoved = false;
    this.dragPointer = null;
    this.browser.setBodyInteraction('', '');
  }

  private updateSelectionFromPointer(): void {
    const anchor = this.selectionDragAnchor;
    const pointer = this.dragPointer;
    if (!anchor || !pointer) return;
    const verticalRect = this.opts.verticalViewportElement().getBoundingClientRect();
    const horizontalRect = this.opts.horizontalViewportElement().getBoundingClientRect();
    const x = Math.max(horizontalRect.left + 1, Math.min(horizontalRect.right - 1, pointer.x));
    const y = Math.max(verticalRect.top + 1, Math.min(verticalRect.bottom - 1, pointer.y));
    const target = this.getHoveredCellPosition(x, y);
    if (!target || (target.rowIndex === anchor.rowIndex && target.colIndex === anchor.colIndex)) return;
    this.selectionDragMoved = true;
    this.opts.selectedCell.set(target);
    this.opts.selectedRange.set({ anchor, focus: target });
  }

  private updateAutoScroll(): void {
    if (!this.selectionDragAnchor || !this.dragPointer) return;
    const { x, y } = this.dragPointer;
    const verticalRect = this.opts.verticalViewportElement().getBoundingClientRect();
    const horizontalEl = this.opts.horizontalViewportElement();
    const horizontalRect = horizontalEl.getBoundingClientRect();
    const verticalDelta = this.edgeScrollDelta(y, verticalRect.top, verticalRect.bottom);
    const horizontalDelta = this.edgeScrollDelta(x, horizontalRect.left, horizontalRect.right);
    if (verticalDelta === 0 && horizontalDelta === 0) {
      if (this.autoScrollTimer !== null) clearTimeout(this.autoScrollTimer);
      this.autoScrollTimer = null;
      return;
    }
    if (this.autoScrollTimer !== null) return;
    const tick = (): void => {
      if (!this.selectionDragAnchor || !this.dragPointer) {
        this.autoScrollTimer = null;
        return;
      }
      const pointer = this.dragPointer;
      const vRect = this.opts.verticalViewportElement().getBoundingClientRect();
      const hEl = this.opts.horizontalViewportElement();
      const hRect = hEl.getBoundingClientRect();
      const dy = this.edgeScrollDelta(pointer.y, vRect.top, vRect.bottom);
      const dx = this.edgeScrollDelta(pointer.x, hRect.left, hRect.right);
      if (dy === 0 && dx === 0) {
        this.autoScrollTimer = null;
        return;
      }
      if (dy !== 0) this.opts.verticalViewportElement().scrollTop += dy;
      if (dx !== 0) hEl.scrollLeft += dx;
      this.updateSelectionFromPointer();
      this.autoScrollTimer = this.browser.schedule(tick, 16);
    };
    this.autoScrollTimer = this.browser.schedule(tick, 16);
  }

  private edgeScrollDelta(position: number, start: number, end: number): number {
    if (position < start) return -Math.min(32, Math.max(6, Math.ceil((start - position) / 3)));
    if (position > end) return Math.min(32, Math.max(6, Math.ceil((position - end) / 3)));
    return 0;
  }

  private isFillHandleHit(event: PointerEvent): boolean {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientX >= rect.right - 8 && event.clientY >= rect.bottom - 8;
  }

  private getHoveredCellPosition(x: number, y: number): CellPosition | null {
    for (const element of this.browser.elementsFromPoint(x, y)) {
      const cell = (element as HTMLElement)
        .closest<HTMLElement>('agrid-cell[data-cell-row][data-cell-col]');
      if (!cell) continue;
      const rowIndex = Number(cell.dataset['cellRow']);
      const colIndex = Number(cell.dataset['cellCol']);
      if (Number.isFinite(rowIndex) && Number.isFinite(colIndex)) {
        return { rowIndex, colIndex };
      }
    }
    return null;
  }

  private getDataDisplayIndices(start: number, end: number): number[] {
    const items = this.opts.filteredItems();
    const indices: number[] = [];
    for (let displayIndex = start; displayIndex <= end; displayIndex++) {
      if (isDataRowItem(items[displayIndex])) indices.push(displayIndex);
    }
    return indices;
  }

  private positionFromVisibleCell(displayIndex: number, colIndex: number): CellPosition {
    const item = this.opts.filteredItems()[displayIndex];
    if (isDataRowItem(item)) return { rowIndex: item.originalIndex, colIndex };
    return this.opts.selectedCell() ?? { rowIndex: 0, colIndex };
  }
}
