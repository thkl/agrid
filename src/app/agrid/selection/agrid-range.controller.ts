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
  isCellEditable: (col: ColDef) => boolean;
  cancelEdit: () => void;
  findDisplayIndex: (originalIndex: number) => number;
  scrollToCell: (displayIndex: number, colIndex: number) => void;
  onCellEdit: (event: GridEditEvent) => void;
}

/** Owns cell-range calculations and fill-handle drag/application behavior. @internal */
export class AgridRangeController {
  readonly fillPreviewBounds = signal<VisibleCellBounds | null>(null);
  private fillDragSource: VisibleCellBounds | null = null;

  constructor(
    private readonly opts: AgridRangeControllerOptions,
    destroyRef: DestroyRef,
    private readonly browser = new AgridBrowserAdapter(),
  ) {
    destroyRef.onDestroy(() => this.cancelFill());
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
  startFill(event: PointerEvent, originalIndex: number, colIndex: number): void {
    if (event.button !== 0 || !this.isFillHandleCell(originalIndex, colIndex)) return;
    if (!this.isFillHandleHit(event)) return;
    const bounds = this.getActiveSelectionBounds();
    if (!bounds) return;
    event.preventDefault();
    event.stopPropagation();
    this.opts.cancelEdit();
    this.fillDragSource = bounds;
    this.fillPreviewBounds.set(null);
    this.browser.addDocumentListener('pointermove', this.fillDragMove);
    this.browser.addDocumentListener('pointerup', this.fillDragUp);
    this.browser.addDocumentListener('pointercancel', this.fillDragCancel);
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
        if (!col || !this.opts.isCellEditable(col)) continue;
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
