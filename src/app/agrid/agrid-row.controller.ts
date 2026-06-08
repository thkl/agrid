import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { AgridDataSource } from './agrid-datasource';
import { CellPosition, ColDef, GridItem, RowClickEvent, RowRemovedEvent, RowSelectEvent } from './agrid.types';
import { buildSelectionRange, getDisplayForField, isDataRowItem } from './agrid.utils';

export interface AgridRowControllerOptions {
  dataSource: Signal<AgridDataSource>;
  filteredItems: Signal<GridItem[]>;
  visibleColDefs: Signal<ColDef[]>;
  rowSelection: Signal<'none' | 'single' | 'multi'>;
  selectedCell: WritableSignal<CellPosition | null>;
  editingCell: Signal<CellPosition | null>;
  insertRowAt: (index: number) => void;
  startDragSelect: (originalIndex: number) => void;
  onRowSelect: (event: RowSelectEvent | null) => void;
  onRowClick: (event: RowClickEvent) => void;
  onRowRemoved: (event: RowRemovedEvent) => void;
  onEditRowRemoved: (originalIndex: number) => void;
  closeFilterMenu: () => void;
  closeGroupActionsMenu: () => void;
}

export type AgridRowContextMenu = { x: number; y: number; rowIndex: number };

export type AgridCellContextMenu = {
  x: number;
  y: number;
  rowIndex: number;
  colIndex: number;
  field: string;
  value: unknown;
  row: Record<string, unknown>;
};

/** Owns row selection, row/cell context menus, and row-level operations. */
export class AgridRowController {
  readonly contextMenu = signal<AgridRowContextMenu | null>(null);
  readonly cellContextMenu = signal<AgridCellContextMenu | null>(null);
  readonly selectedIndices = signal<Set<number>>(new Set());
  readonly selectedRowIndices: Signal<ReadonlySet<number>> =
    this.selectedIndices.asReadonly() as Signal<ReadonlySet<number>>;
  readonly selectedRowIndex = computed<number | null>(() => {
    const selected = this.selectedIndices();
    return selected.size > 0 ? [...selected][0] : null;
  });

  private selectionPivot: number | null = null;

  constructor(private readonly opts: AgridRowControllerOptions) {}

  isRowSelected(originalIndex: number): boolean {
    return this.selectedIndices().has(originalIndex);
  }

  isPinnedPaneRowSelected(item: GridItem): boolean {
    return isDataRowItem(item) && this.isRowSelected(item.originalIndex);
  }

  clearSelection(): void {
    if (this.selectedIndices().size === 0) return;
    this.selectedIndices.set(new Set());
    this.opts.onRowSelect(null);
  }

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
      if (!(event.target instanceof HTMLSelectElement)) event.preventDefault();
      this.selectedIndices.set(new Set([originalIndex]));
      this.selectionPivot = originalIndex;
      if (allowDragSelect) this.opts.startDragSelect(originalIndex);
      else this.emitSelection();
    }
  }

  clickRow(item: { row: Record<string, unknown>; originalIndex: number }): void {
    if (this.opts.editingCell()) return;
    this.opts.onRowClick({ row: item.row, originalIndex: item.originalIndex });
  }

  openRowContextMenu(event: MouseEvent, originalIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, rowIndex: originalIndex });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

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
      value: row[col.field],
      row,
    });
  }

  closeCellContextMenu(): void {
    this.cellContextMenu.set(null);
  }

  copyCellToClipboard(value: unknown, col: ColDef): void {
    navigator.clipboard.writeText(getDisplayForField(col, value));
    this.closeCellContextMenu();
  }

  copyRowToClipboard(row: Record<string, unknown>): void {
    const text = this.opts.visibleColDefs()
      .map(col => getDisplayForField(col, row[col.field]))
      .join('\t');
    navigator.clipboard.writeText(text);
    this.closeCellContextMenu();
  }

  insertRowAt(index: number): void {
    this.opts.insertRowAt(index);
    this.closeCellContextMenu();
  }

  deleteRow(originalIndex: number): void {
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
    this.opts.onRowRemoved({ oldIndex: originalIndex });
  }

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
