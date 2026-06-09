import { Signal, WritableSignal } from '@angular/core';
import { CellRange } from './agrid-clipboard.handler';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { CellPosition, ColDef, GridItem, NewRecord } from './agrid.types';
import { isDataRowItem, isGroupHeaderItem } from './agrid.utils';

export interface AgridVerticalViewport {
  measureScrollOffset(): number;
  getViewportSize(): number;
  scrollToOffset(offset: number): void;
}

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
  startEdit: (originalIndex: number, colIndex: number, seedChar: string) => void;
  commitEdit: () => void;
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

/** Owns grid keyboard navigation, cell activation, add-row creation, and visibility scrolling. */
export class AgridNavigationController {
  constructor(private readonly opts: AgridNavigationControllerOptions) {}

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

  activateAddRow(): void {
    this.opts.cancelEdit();
    this.addRowAndSelect();
  }

  insertRowAt(atIndex: number): void {
    const emptyRow = this.buildEmptyRow();
    const insertedIndex = this.opts.dataSource().addRow(emptyRow, atIndex);
    this.opts.onPrepareAddRecord({ index: insertedIndex, data: emptyRow });
  }

  handleKeyDown(event: KeyboardEvent): void {
    if ((event.target as Element)?.closest('.ag-sidebar')) return;

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

    if (this.opts.editingCell()) {
      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          this.opts.commitEdit();
          this.moveSelection(0, event.shiftKey ? -1 : 1);
          break;
        case 'Enter':
          event.preventDefault();
          this.opts.commitEdit();
          this.moveSelection(1, 0);
          break;
        case 'Escape':
          event.preventDefault();
          this.opts.cancelEdit();
          this.opts.focusGrid();
          break;
      }
      return;
    }

    const sel = this.opts.selectedCell();
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

  findDisplayIndex(originalIndex: number): number {
    return this.opts.filteredItems().findIndex(
      item => isDataRowItem(item) && item.originalIndex === originalIndex,
    );
  }

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
    if (items.length === 0) return;
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
