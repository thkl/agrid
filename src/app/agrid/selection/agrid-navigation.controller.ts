import { Signal, WritableSignal } from '@angular/core';
import { CellRange } from './agrid-clipboard.handler';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { AgridEnterEditAction, CellPosition, ColDef, GridItem, NewRecord } from '../agrid.types';
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
  enterEditAction: Signal<AgridEnterEditAction>;
  selectedCell: WritableSignal<CellPosition | null>;
  selectedRange: WritableSignal<CellRange | null>;
  editingCell: Signal<CellPosition | null>;
  isEditing: (originalIndex: number, colIndex: number) => boolean;
  isCellEditable: (col: ColDef | undefined, originalIndex: number) => boolean;
  toggleTreeCell: (originalIndex: number, colIndex: number) => boolean;
  startEdit: (originalIndex: number, colIndex: number, seedChar: string, selectText?: boolean) => void;
  commitEdit: () => boolean;
  cancelEdit: () => void;
  undoEdit: () => void;
  redoEdit: () => void;
  extendRangeTo: (originalIndex: number, colIndex: number) => void;
  openFind: () => void;
  focusGrid: () => void;
  viewport: () => AgridVerticalViewport;
  scrollColumnToKeepVisible: (colIndex: number) => void;
  /** Maps a logical destination to its rendered span anchor or next visible cell. */
  resolveCellColumn?: (originalIndex: number, colIndex: number, direction: -1 | 0 | 1) => number;
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
    colIndex = this.opts.resolveCellColumn?.(originalIndex, colIndex, 0) ?? colIndex;
    if (this.opts.isEditing(originalIndex, colIndex)) return;
    if (this.opts.editingCell() && !this.opts.commitEdit()) return;
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
    if ((event.target as Element)?.closest(
      '.ag-sidebar, .ag-filter-input, .ag-filter-menu, .ag-menu-bar, .ag-detail-column-textarea',
    )) return;

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
          if (this.opts.commitEdit()) this.applyEnterEditAction(event.shiftKey);
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
      case 'PageUp':
        event.preventDefault();
        this.moveSelectionByPage(-1, event.shiftKey);
        break;
      case 'PageDown':
        event.preventDefault();
        this.moveSelectionByPage(1, event.shiftKey);
        break;
      case 'Home':
        event.preventDefault();
        this.moveSelectionToBoundary('start', event.ctrlKey || event.metaKey, event.shiftKey);
        break;
      case 'End':
        event.preventDefault();
        this.moveSelectionToBoundary('end', event.ctrlKey || event.metaKey, event.shiftKey);
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

  private applyEnterEditAction(reverse: boolean): void {
    switch (this.opts.enterEditAction()) {
      case 'nextColumn':
        this.moveToNextEditableColumn(reverse ? -1 : 1);
        break;
      case 'nextRow':
        this.moveSelection(reverse ? -1 : 1, 0);
        break;
      case 'nothing':
        this.opts.focusGrid();
        break;
    }
  }

  private moveToNextEditableColumn(direction: 1 | -1): void {
    const items = this.opts.filteredItems();
    const cols = this.opts.visibleColDefs();
    const selected = this.opts.selectedCell();
    if (!selected || items.length === 0 || cols.length === 0) {
      this.opts.focusGrid();
      return;
    }

    const currentDisplayIndex = this.selectedDisplayIndex();
    if (currentDisplayIndex < 0) {
      this.opts.focusGrid();
      return;
    }

    let displayIndex = currentDisplayIndex;
    let colIndex = selected.colIndex + direction;

    while (displayIndex >= 0 && displayIndex < items.length) {
      while (colIndex >= 0 && colIndex < cols.length) {
        const item = items[displayIndex];
        const col = cols[colIndex];
        if (isDataRowItem(item) && this.opts.isCellEditable(col, item.originalIndex)) {
          this.opts.selectedRange.set(null);
          this.opts.selectedCell.set({ rowIndex: item.originalIndex, colIndex });
          this.scrollToKeepVisible(displayIndex, colIndex);
          if (this.isTextColumn(col)) this.opts.startEdit(item.originalIndex, colIndex, '', false);
          else this.opts.focusGrid();
          return;
        }
        colIndex += direction;
      }
      displayIndex += direction;
      colIndex = direction > 0 ? 0 : cols.length - 1;
      while (
        displayIndex >= 0
        && displayIndex < items.length
        && isGroupHeaderItem(items[displayIndex])
      ) {
        displayIndex += direction;
      }
    }

    this.opts.focusGrid();
  }

  private isTextColumn(col: ColDef): boolean {
    return !col.values?.length && (col.type === undefined || col.type === 'text');
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

    const skipDir = dRow < 0 || (dRow === 0 && dCol < 0) ? -1 : 1;
    let skipDi = newDi;
    while (
      skipDi >= 0
      && skipDi < items.length
      && items[skipDi] !== null
      && !isDataRowItem(items[skipDi])
    ) {
      skipDi += skipDir;
    }
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
    let newItem = items[newDi];
    if (isDataRowItem(newItem)) {
      newCi = this.opts.resolveCellColumn?.(
        newItem.originalIndex,
        newCi,
        dCol === 0 ? 0 : dCol > 0 ? 1 : -1,
      ) ?? newCi;
      if (newCi >= cols && newDi < items.length - 1) {
        newDi++;
        newCi = 0;
        while (newDi < items.length - 1 && !isDataRowItem(items[newDi])) newDi++;
        newItem = items[newDi];
      } else if (newCi < 0 && newDi > 0) {
        newDi--;
        newCi = cols - 1;
        while (newDi > 0 && !isDataRowItem(items[newDi])) newDi--;
        newItem = items[newDi];
      }
      newCi = Math.max(0, Math.min(cols - 1, newCi));
    }
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

  /** Move by the number of complete data rows currently visible in the viewport. */
  private moveSelectionByPage(direction: -1 | 1, extendRange: boolean): void {
    const items = this.opts.filteredItems();
    const dataRows = items
      .map((item, displayIndex) => ({ item, displayIndex }))
      .filter((entry): entry is {
        item: Extract<GridItem, { row: object; originalIndex: number }>;
        displayIndex: number;
      } => isDataRowItem(entry.item));
    if (dataRows.length === 0) return;

    const selected = this.opts.selectedCell();
    const current = selected
      ? dataRows.findIndex(entry => entry.item.originalIndex === selected.rowIndex)
      : -1;
    const rowsPerPage = Math.max(
      1,
      Math.floor(this.opts.viewport().getViewportSize() / this.opts.rowHeight()),
    );
    const target = current < 0
      ? direction > 0 ? 0 : dataRows.length - 1
      : Math.max(0, Math.min(dataRows.length - 1, current + direction * rowsPerPage));
    this.selectProjectedRow(
      dataRows[target].item.originalIndex,
      dataRows[target].displayIndex,
      selected?.colIndex ?? 0,
      extendRange,
    );
  }

  /**
   * Home/End move horizontally within the selected row; Ctrl/Cmd moves to the corresponding
   * corner of the projected grid, matching common spreadsheet and ARIA-grid conventions.
   */
  private moveSelectionToBoundary(
    edge: 'start' | 'end',
    wholeGrid: boolean,
    extendRange: boolean,
  ): void {
    const items = this.opts.filteredItems();
    const cols = this.opts.visibleColDefs();
    if (items.length === 0 || cols.length === 0) return;

    const selected = this.opts.selectedCell();
    let displayIndex = selected ? this.selectedDisplayIndex() : -1;
    if (wholeGrid || displayIndex < 0 || !isDataRowItem(items[displayIndex])) {
      const step = edge === 'start' ? 1 : -1;
      displayIndex = edge === 'start' ? 0 : items.length - 1;
      while (displayIndex >= 0 && displayIndex < items.length && !isDataRowItem(items[displayIndex])) {
        displayIndex += step;
      }
    }
    const item = items[displayIndex];
    if (!isDataRowItem(item)) return;
    this.selectProjectedRow(
      item.originalIndex,
      displayIndex,
      edge === 'start' ? 0 : cols.length - 1,
      extendRange,
    );
  }

  /** Apply a projected keyboard destination and keep both axes visible. */
  private selectProjectedRow(
    originalIndex: number,
    displayIndex: number,
    colIndex: number,
    extendRange: boolean,
  ): void {
    colIndex = this.opts.resolveCellColumn?.(originalIndex, colIndex, 0) ?? colIndex;
    if (extendRange && this.opts.selectedCell()) {
      this.opts.extendRangeTo(originalIndex, colIndex);
    } else {
      this.opts.selectedRange.set(null);
      this.opts.selectedCell.set({ rowIndex: originalIndex, colIndex });
    }
    this.scrollToKeepVisible(displayIndex, colIndex);
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
