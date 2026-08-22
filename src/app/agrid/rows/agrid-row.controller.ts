import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { AgridDataSource } from '../agrid-datasource';
import {
  AgridCellContextMenu,
  AgridRowContextMenu,
  CellPosition,
  ColDef,
  GridItem,
  RecordEditEvent,
  RowClickEvent,
  RowSelectEvent,
} from '../agrid.types';
import { buildSelectionRange, getCellValue, getDisplayForField, isDataRowItem } from '../agrid.utils';

/**
 * Whether a pointer event originated inside an editable form control. Used to avoid calling
 * `preventDefault()` on a row pointerdown, which would otherwise cancel native text selection
 * (and caret placement) inside an active cell editor.
 */
function isEditableEventTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

/** Dependencies and callbacks required by {@link AgridRowController}. @internal */
export interface AgridRowControllerOptions {
  dataSource: Signal<AgridDataSource>;
  filteredItems: Signal<GridItem[]>;
  visibleColDefs: Signal<ColDef[]>;
  locale: Signal<string>;
  markedRowIndices: Signal<ReadonlySet<number>>;
  rowSelection: Signal<'none' | 'single' | 'multi'>;
  selectedCell: WritableSignal<CellPosition | null>;
  editingCell: Signal<CellPosition | null>;
  insertRowAt: (index: number) => void;
  startDragSelect: (originalIndex: number) => void;
  onRowSelect: (event: RowSelectEvent | null) => void;
  onRowClick: (event: RowClickEvent) => void;
  onRowRemoved: (event: Pick<RecordEditEvent, 'index' | 'data'>) => void;
  onEditRowRemoved: (originalIndex: number) => void;
  closeFilterMenu: () => void;
  closeGroupActionsMenu: () => void;
  /** Whether row deletion requires an inline confirmation prompt. */
  confirmRowDelete: Signal<boolean>;
  /** Focuses the confirmation prompt's "No" button once it renders. */
  focusDeleteConfirmButton: () => void;
  /** Returns focus to the grid body (e.g. after cancelling a delete). */
  focusGrid: () => void;
  /** Current horizontal scroll offset and width used to position the prompt. */
  measureScroller: () => { left: number; width: number };
}



/**
 * Owns row selection, row/cell context menus, and row-level operations.
 * @internal
 */
export class AgridRowController {
  readonly contextMenu = signal<AgridRowContextMenu | null>(null);
  readonly cellContextMenu = signal<AgridCellContextMenu | null>(null);
  /** Original index of the row awaiting delete confirmation, or `null`. */
  readonly pendingDeleteRow = signal<number | null>(null);
  /** Left offset (px) of the inline delete-confirmation prompt. */
  readonly deleteConfirmationLeft = signal(0);
  /** Width (px) of the inline delete-confirmation prompt. */
  readonly deleteConfirmationWidth = signal(0);
  readonly selectedIndices = signal<Set<number>>(new Set());
  readonly selectedRowIndices: Signal<ReadonlySet<number>> =
    this.selectedIndices.asReadonly() as Signal<ReadonlySet<number>>;
  readonly selectedRowIndex = computed<number | null>(() => {
    const selected = this.selectedIndices();
    return selected.size > 0 ? [...selected][0] : null;
  });

  private selectionPivot: number | null = null;

  constructor(
    private readonly opts: AgridRowControllerOptions,
    private readonly browser = new AgridBrowserAdapter(),
  ) {}

  /** Returns whether the data-source row is currently selected. */
  isRowSelected(originalIndex: number): boolean {
    return this.selectedIndices().has(originalIndex);
  }

  /** Returns whether a virtual item is a selected data row. */
  isPinnedPaneRowSelected(item: GridItem): boolean {
    return isDataRowItem(item) && this.isRowSelected(item.originalIndex);
  }

  /** Clears all selected rows and emits the selection change. */
  clearSelection(): void {
    if (this.selectedIndices().size === 0) return;
    this.selectedIndices.set(new Set());
    this.opts.onRowSelect(null);
  }

  /** Applies pointer selection semantics for the configured selection mode. */
  selectFromPointer(event: PointerEvent, originalIndex: number, allowDragSelect: boolean): void {
    const mode = this.opts.rowSelection();
    if (mode === 'none' || event.button !== 0) return;

    if (mode === 'single') {
      const already = this.selectedIndices().has(originalIndex);
      this.selectedIndices.set(already ? new Set() : new Set([originalIndex]));
      this.emitSelection();
      return;
    }

    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    if (ctrl) {
      const next = new Set(this.selectedIndices());
      if (next.has(originalIndex)) next.delete(originalIndex);
      else next.add(originalIndex);
      this.selectedIndices.set(next);
      this.selectionPivot = originalIndex;
      this.emitSelection();
    } else if (shift && this.selectionPivot !== null) {
      this.selectedIndices.set(
        buildSelectionRange(this.selectionPivot, originalIndex, this.opts.filteredItems()),
      );
      this.emitSelection();
    } else {
      if (!isEditableEventTarget(event.target)) event.preventDefault();
      this.selectedIndices.set(new Set([originalIndex]));
      this.selectionPivot = originalIndex;

      if (allowDragSelect) this.opts.startDragSelect(originalIndex);
      else this.emitSelection();
    }
  }

  /** Emits a row click unless a cell edit is active. */
  clickRow(item: { row: Record<string, unknown>; originalIndex: number }): void {
    if (this.opts.editingCell()) return;
    this.opts.onRowClick({ row: item.row, originalIndex: item.originalIndex });
  }

  /** Opens the row context menu at the pointer position. */
  openRowContextMenu(event: MouseEvent, originalIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, rowIndex: originalIndex });
  }

  /** Closes the row context menu. */
  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  /** Opens the cell context menu and closes conflicting menus. */
  openCellContextMenu(
    event: MouseEvent,
    rowIndex: number,
    colIndex: number,
    col: ColDef,
    row: Record<string, unknown>,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeContextMenu();
    this.opts.closeFilterMenu();
    this.opts.closeGroupActionsMenu();
    this.cellContextMenu.set({
      x: event.clientX,
      y: event.clientY,
      rowIndex,
      colIndex,
      field: col.field,
      value: getCellValue(col, row, rowIndex),
      row,
    });
  }

  /** Closes the cell context menu. */
  closeCellContextMenu(): void {
    this.cellContextMenu.set(null);
  }

  /** Copies a cell plus the same field from marked rows to the clipboard. */
  copyCellToClipboard(originalIndex: number, col: ColDef): void {
    const rows = this.opts.dataSource().rows();
    const text = this.copyIndices(originalIndex)
      .map(index => getDisplayForField(col, getCellValue(col, rows[index], index), this.opts.locale(), rows[index]))
      .join('\n');
    void this.browser.writeClipboard(text);
    this.closeCellContextMenu();
  }

  /** Copies a row plus all marked rows as tab-separated text. */
  copyRowToClipboard(originalIndex: number): void {
    const rows = this.opts.dataSource().rows();
    const cols = this.opts.visibleColDefs();
    const text = this.copyIndices(originalIndex)
      .map(index => cols
        .map(col => getDisplayForField(col, getCellValue(col, rows[index], index), this.opts.locale(), rows[index]))
        .join('\t'))
      .join('\n');
    void this.browser.writeClipboard(text);
    this.closeCellContextMenu();
  }

  private copyIndices(primaryIndex: number): number[] {
    const length = this.opts.dataSource().length;
    const indices = [primaryIndex];
    for (const index of [...this.opts.markedRowIndices()].sort((a, b) => a - b)) {
      if (index !== primaryIndex && index >= 0 && index < length) indices.push(index);
    }
    return indices;
  }

  /** Inserts a row through the grid's central insertion callback. */
  insertRowAt(index: number): void {
    this.opts.insertRowAt(index);
    this.closeCellContextMenu();
  }

  /** Removes a row and reconciles selection and editing indices. */
  deleteRow(originalIndex: number): void {
    const removedRow = this.opts.dataSource().getRow(originalIndex);
    this.opts.dataSource().removeRow(originalIndex);

    const selectedCell = this.opts.selectedCell();
    if (selectedCell?.rowIndex === originalIndex) {
      this.opts.selectedCell.set(null);
    } else if (selectedCell && selectedCell.rowIndex > originalIndex) {
      this.opts.selectedCell.update(cell => cell ? { ...cell, rowIndex: cell.rowIndex - 1 } : null);
    }

    this.opts.onEditRowRemoved(originalIndex);

    if (this.selectedIndices().has(originalIndex)) {
      this.selectedIndices.update(indices => {
        const next = new Set(indices);
        next.delete(originalIndex);
        return next;
      });
      this.emitSelection();
    }
    this.contextMenu.set(null);
    this.opts.onRowRemoved({ index: originalIndex, data: removedRow });
  }

  /** Starts confirmation or immediately deletes the row at `originalIndex`. */
  requestDeleteRow(originalIndex: number): void {
    if (this.opts.confirmRowDelete()) {
      this.repositionDeleteConfirmation();
      this.pendingDeleteRow.set(originalIndex);
      this.closeContextMenu();
      this.closeCellContextMenu();
      this.browser.schedule(() => this.opts.focusDeleteConfirmButton());
      return;
    }
    this.deleteRowImmediately(originalIndex);
  }

  /** Returns whether this row is awaiting delete confirmation. */
  isRowPendingDelete(originalIndex: number): boolean {
    return this.pendingDeleteRow() === originalIndex;
  }

  /** Deletes the row currently awaiting confirmation. */
  confirmPendingRowDelete(): void {
    const originalIndex = this.pendingDeleteRow();
    if (originalIndex === null) return;
    this.pendingDeleteRow.set(null);
    this.deleteRowImmediately(originalIndex);
  }

  /** Cancels the active row-delete confirmation and restores grid focus. */
  cancelRowDelete(): void {
    this.pendingDeleteRow.set(null);
    this.opts.focusGrid();
  }

  /** Recomputes the prompt's offset/width so it tracks horizontal scrolling. */
  repositionDeleteConfirmation(): void {
    const { left, width } = this.opts.measureScroller();
    this.deleteConfirmationLeft.set(left);
    this.deleteConfirmationWidth.set(width);
  }

  private deleteRowImmediately(originalIndex: number): void {
    this.deleteRow(originalIndex);
    this.closeCellContextMenu();
  }

  /** Emits the current selected rows, or `null` when selection is empty. */
  emitSelection(): void {
    const indices = this.selectedIndices();
    if (indices.size === 0) {
      this.opts.onRowSelect(null);
      return;
    }
    const rows = this.opts.dataSource().rows();
    this.opts.onRowSelect({
      rows: [...indices].map(index => ({ row: rows[index], originalIndex: index })),
    });
  }
}
