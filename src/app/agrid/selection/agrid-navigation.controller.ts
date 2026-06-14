import { Signal, WritableSignal } from '@angular/core';
import { CellRange } from './agrid-clipboard.handler';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { CellPosition, ColDef, GridItem, NewRecord } from '../agrid.types';
import { isDataRowItem, isGroupHeaderItem } from '../agrid.utils';

/** Minimal vertical viewport API used by grid navigation. @internal */
export interface AgridVerticalViewport {
  /** Returns the current vertical scroll offset in pixels. */
  measureScrollOffset(): number;
  /** Returns the visible viewport height in pixels. */
  getViewportSize(): number;
  /** Scrolls the viewport to an absolute vertical offset. */
  scrollToOffset(offset: number): void;
}

/** Dependencies and callbacks required by {@link AgridNavigationController}. @internal */
export interface AgridNavigationControllerOptions {
  control: Signal<AgridControl | null>;
  dataSource: Signal<AgridDataSource>;
  filteredItems: Signal<GridItem[]>;
  filteredSortedIndices: Signal<number[]>;
  colDefs: Signal<ColDef[]>;
  visibleColDefs: Signal<ColDef[]>;
  rowHeight: Signal<number>;
  allowAddRows: Signal<boolean>;
  autoAddRows: Signal<boolean>;
  selectedCell: WritableSignal<CellPosition | null>;
  selectedRange: WritableSignal<CellRange | null>;
  editingCell: Signal<CellPosition | null>;
  isEditing: (originalIndex: number, colIndex: number) => boolean;
  toggleTreeCell: (originalIndex: number, colIndex: number) => boolean;
  startEdit: (originalIndex: number, colIndex: number, seedChar: string) => void;
  commitEdit: () => boolean;
  cancelEdit: () => void;
  undoEdit: () => void;
  redoEdit: () => void;
  extendRangeTo: (originalIndex: number, colIndex: number) => void;
  openFind: () => void;
  focusGrid: () => void;
  viewport: () => AgridVerticalViewport;
  scrollColumnToKeepVisible: (colIndex: number) => void;
  onPrepareAddRecord: (event: Pick<NewRecord, 'index' | 'data'>) => void;
}

/**
 * Owns grid keyboard navigation, cell activation, add-row creation, and visibility scrolling.
 * @internal
 */
export class AgridNavigationController {
  constructor(private readonly opts: AgridNavigationControllerOptions) {}

  /** Activates a cell, optionally extending the current range selection. */
  activateCell(originalIndex: number, colIndex: number, event?: MouseEvent): void {
    if (this.opts.isEditing(originalIndex, colIndex)) return;
    this.opts.cancelEdit();
    if (event?.shiftKey && this.opts.selectedCell()) {
      this.opts.extendRangeTo(originalIndex, colIndex);
      this.opts.focusGrid();
      return;
    }
    this.opts.selectedRange.set(null);
    this.opts.selectedCell.set({ rowIndex: originalIndex, colIndex });
    const col = this.opts.visibleColDefs()[colIndex];
    if (col.values?.length) this.opts.startEdit(originalIndex, colIndex, '');
    else this.opts.focusGrid();
  }

  /** Creates and selects a row from the add-row placeholder. */
  activateAddRow(): void {
    this.opts.cancelEdit();
    this.addRowAndSelect();
  }

  /** Clears cell and range navigation when focus moves to a grid control. */
  deactivateCell(): void {
    this.opts.cancelEdit();
    this.opts.selectedCell.set(null);
    this.opts.selectedRange.set(null);
  }

  /** Inserts an initialized blank row and emits the preparation callback. */
  insertRowAt(atIndex: number): void {
    const emptyRow = this.buildEmptyRow();
    const insertedIndex = this.opts.dataSource().addRow(emptyRow, atIndex);
    this.opts.onPrepareAddRecord({ index: insertedIndex, data: emptyRow });
  }

  /** Handles grid-level navigation, editing, history, find, and add-row shortcuts. */
  handleKeyDown(event: KeyboardEvent): void {
    if ((event.target as Element)?.closest('.ag-sidebar, .ag-filter-input, .ag-filter-menu')) return;

    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.opts.openFind();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      if (event.key === 'z') {
        event.preventDefault();
        event.shiftKey ? this.opts.redoEdit() : this.opts.undoEdit();
        return;
      }
      if (event.key === 'y') {
        event.preventDefault();
        this.opts.redoEdit();
        return;
      }
    }

    const sel = this.opts.selectedCell();
    if (
      event.key === 'Enter'
      && (event.ctrlKey || event.metaKey)
      && !event.altKey
      && !event.shiftKey
      && sel
      && this.opts.toggleTreeCell(sel.rowIndex, sel.colIndex)
    ) {
      event.preventDefault();
      return;
    }

    if (this.opts.editingCell()) {
      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          if (this.opts.commitEdit()) this.moveSelection(0, event.shiftKey ? -1 : 1);
          break;
        case 'Enter':
          event.preventDefault();
          if (this.opts.commitEdit()) this.moveSelection(1, 0);
          break;
        case 'Escape':
          event.preventDefault();
          this.opts.cancelEdit();
          this.opts.focusGrid();
          break;
      }
      return;
    }

    const isOnAddRow = this.opts.allowAddRows()
      && !this.opts.autoAddRows()
      && sel?.rowIndex === this.opts.dataSource().length;
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.moveSelection(-1, 0, event.shiftKey);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveSelection(1, 0, event.shiftKey);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.moveSelection(0, -1, event.shiftKey);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.moveSelection(0, 1, event.shiftKey);
        break;
      case 'Tab':
        event.preventDefault();
        this.moveSelection(0, event.shiftKey ? -1 : 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (sel) {
          if (isOnAddRow) this.addRowAndSelect();
          else this.opts.startEdit(sel.rowIndex, sel.colIndex, '');
        }
        break;
      case 'F2':
        event.preventDefault();
        if (sel) {
          if (isOnAddRow) this.addRowAndSelect();
          else this.opts.startEdit(sel.rowIndex, sel.colIndex, '');
        }
        break;
      default:
        if (sel && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if (isOnAddRow) this.addRowAndSelect();
          else this.opts.startEdit(sel.rowIndex, sel.colIndex, event.key);
        }
    }
  }

  /** Finds a data row's current index in the projected display items. */
  findDisplayIndex(originalIndex: number): number {
    return this.opts.filteredItems().findIndex(
      item => isDataRowItem(item) && item.originalIndex === originalIndex,
    );
  }

  /** Navigates client pagination as needed and reveals a data-source row. */
  revealRow(originalIndex: number): void {
    const filteredIndex = this.opts.filteredSortedIndices().indexOf(originalIndex);
    if (filteredIndex < 0) return;

    const ctrl = this.opts.control();
    const pageSize = ctrl?.pageSize() ?? 0;
    if (ctrl && pageSize > 0 && ctrl.totalRows() === 0 && !ctrl.groupByField()) {
      ctrl.setPage(Math.floor(filteredIndex / pageSize) + 1);
    }

    setTimeout(() => {
      const displayIndex = this.findDisplayIndex(originalIndex);
      if (displayIndex >= 0) this.scrollToKeepVisible(displayIndex, 0);
    });
  }

  /** Scrolls a display row and optional column into the visible viewport. */
  scrollToKeepVisible(displayIndex: number, colIndex: number | null = null): void {
    const viewport = this.opts.viewport();
    const itemSize = this.opts.rowHeight();
    const scrollOffset = viewport.measureScrollOffset();
    const viewportSize = viewport.getViewportSize();
    if (displayIndex * itemSize < scrollOffset) {
      viewport.scrollToOffset(displayIndex * itemSize);
    } else if ((displayIndex + 1) * itemSize > scrollOffset + viewportSize) {
      viewport.scrollToOffset((displayIndex + 1) * itemSize - viewportSize);
    }

    if (colIndex !== null) this.opts.scrollColumnToKeepVisible(colIndex);
  }

  private moveSelection(dRow: number, dCol: number, extendRange = false): void {
    const items = this.opts.filteredItems();
    if (items.length === 0) {
      if (
        this.opts.allowAddRows()
        && this.opts.autoAddRows()
        && this.opts.dataSource().length === 0
      ) {
        this.addRowAndSelect();
      }
      return;
    }
    const cols = this.opts.visibleColDefs().length;
    let di = this.selectedDisplayIndex();
    let ci = this.opts.selectedCell()?.colIndex ?? 0;
    if (di === -1) {
      di = 0;
      ci = 0;
    }
    let newDi = di + dRow;
    let newCi = ci + dCol;
    const onAddRow = items[newDi] === null;
    if (!onAddRow) {
      if (newCi < 0) {
        newDi--;
        newCi = cols - 1;
      }
      if (newCi >= cols) {
        newDi++;
        newCi = 0;
      }
    }

    const skipDir = dRow < 0 ? -1 : 1;
    let skipDi = newDi;
    while (skipDi >= 0 && skipDi < items.length && isGroupHeaderItem(items[skipDi])) skipDi += skipDir;
    if (skipDi >= 0 && skipDi < items.length) newDi = skipDi;

    if (this.opts.autoAddRows() && newDi >= items.length) {
      const emptyRow = this.buildEmptyRow();
      const insertedIndex = this.opts.dataSource().addRow(emptyRow);
      const colIndex = Math.min(newCi, cols - 1);
      const newDisplayIdx = this.findDisplayIndex(insertedIndex);
      this.opts.selectedCell.set({ rowIndex: insertedIndex, colIndex });
      if (newDisplayIdx >= 0) this.scrollToKeepVisible(newDisplayIdx, colIndex);
      this.opts.focusGrid();
      this.opts.onPrepareAddRecord({ index: insertedIndex, data: emptyRow });
      return;
    }

    newDi = Math.max(0, Math.min(items.length - 1, newDi));
    newCi = Math.max(0, Math.min(cols - 1, newCi));
    const newItem = items[newDi];
    if (newItem === null) {
      this.opts.selectedRange.set(null);
      this.opts.selectedCell.set({ rowIndex: this.opts.dataSource().length, colIndex: 0 });
    } else if (isDataRowItem(newItem)) {
      if (extendRange) {
        this.opts.extendRangeTo(newItem.originalIndex, newCi);
      } else {
        this.opts.selectedRange.set(null);
        this.opts.selectedCell.set({ rowIndex: newItem.originalIndex, colIndex: newCi });
      }
    }
    this.scrollToKeepVisible(newDi, newCi);
    this.opts.focusGrid();
  }

  private selectedDisplayIndex(): number {
    const sel = this.opts.selectedCell();
    if (!sel) return -1;
    const items = this.opts.filteredItems();
    if (sel.rowIndex >= this.opts.dataSource().length) return items.length - 1;
    return items.findIndex(item => isDataRowItem(item) && item.originalIndex === sel.rowIndex);
  }

  private addRowAndSelect(): void {
    const emptyRow = this.buildEmptyRow();
    const insertedIndex = this.opts.dataSource().addRow(emptyRow);
    this.opts.selectedRange.set(null);
    this.opts.selectedCell.set({ rowIndex: insertedIndex, colIndex: 0 });
    this.opts.focusGrid();
    const displayIdx = this.findDisplayIndex(insertedIndex);
    if (displayIdx >= 0) this.scrollToKeepVisible(displayIdx, 0);
    this.opts.onPrepareAddRecord({ index: insertedIndex, data: emptyRow });
  }

  private buildEmptyRow(): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const col of this.opts.colDefs()) row[col.field] = col.type === 'number' ? 0 : '';
    return row;
  }
}
