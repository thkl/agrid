import { Signal, WritableSignal, signal } from '@angular/core';
import { CellRange } from '../selection/agrid-clipboard.handler';
import { AgridControl, HistoryEntry, HistoryItem } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { CellPosition, ColDef, GridEditEvent } from '../agrid.types';

/** Dependencies and callbacks required by {@link AgridEditController}. @internal */
export interface AgridEditControllerOptions {
  control: Signal<AgridControl | null>;
  dataSource: Signal<AgridDataSource>;
  visibleColDefs: Signal<ColDef[]>;
  readonlyGrid: Signal<boolean>;
  selectedCell: WritableSignal<CellPosition | null>;
  selectedRange: WritableSignal<CellRange | null>;
  findDisplayIndex: (originalIndex: number) => number;
  scrollToCell: (displayIndex: number, colIndex: number) => void;
  focusGrid: () => void;
  onCellEdit: (event: GridEditEvent) => void;
}

/**
 * Owns cell edit state, commit/cancel transitions, and undo/redo application.
 * @internal
 */
export class AgridEditController {
  readonly editingCell = signal<CellPosition | null>(null);
  readonly currentDraft = signal<unknown>(null);
  readonly editSeedChar = signal<string>('');

  constructor(private readonly opts: AgridEditControllerOptions) {}

  /** Returns whether a column can be edited in the current grid state. */
  isCellEditable(col: ColDef | undefined): boolean {
    return !!col && !this.opts.readonlyGrid() && col.editable !== false;
  }

  /** Replaces the value currently staged by the active editor. */
  setDraft(value: unknown): void {
    this.currentDraft.set(value);
  }

  /** Starts editing a cell, optionally seeded by a typed character. */
  start(originalIndex: number, colIndex: number, seedChar: string): void {
    const col = this.opts.visibleColDefs()[colIndex];
    if (!this.isCellEditable(col)) return;
    const currentValue = this.opts.dataSource().getRow(originalIndex)[col.field];
    this.opts.selectedRange.set(null);
    this.opts.selectedCell.set({ rowIndex: originalIndex, colIndex });
    let initialDraft: unknown;
    if (seedChar !== '') {
      initialDraft = seedChar;
    } else if (col.type === 'date' && (currentValue == null || currentValue === '')) {
      initialDraft = new Date().toISOString().slice(0, 10);
    } else {
      initialDraft = currentValue;
    }
    this.currentDraft.set(initialDraft);
    this.editSeedChar.set(seedChar);
    this.editingCell.set({ rowIndex: originalIndex, colIndex });
    const displayIndex = this.opts.findDisplayIndex(originalIndex);
    if (displayIndex >= 0) this.opts.scrollToCell(displayIndex, colIndex);
  }

  /** Commits the staged value and records the edit in history. */
  commit(): void {
    const position = this.editingCell();
    if (!position) return;
    const col = this.opts.visibleColDefs()[position.colIndex];
    if (!col) {
      this.cancel();
      return;
    }

    const oldValue = this.opts.dataSource().getRow(position.rowIndex)[col.field];
    const newValue = this.currentDraft();
    if (oldValue !== newValue) {
      this.opts.dataSource().patchRow(position.rowIndex, { [col.field]: newValue });
      this.opts.control()?.pushEdit({
        rowIndex: position.rowIndex,
        field: col.field,
        oldValue,
        newValue,
      });
      this.opts.onCellEdit({ position, field: col.field, oldValue, newValue });
    }
    this.clearEditState();
    this.opts.focusGrid();
  }

  /**
   * Commit a value directly to a cell without entering edit mode (e.g. a boolean checkbox
   * toggle). Records the change in history and emits the edit just like {@link commit}.
   */
  setCellValue(rowIndex: number, colIndex: number, newValue: unknown): void {
    const col = this.opts.visibleColDefs()[colIndex];
    if (!this.isCellEditable(col)) return;
    const oldValue = this.opts.dataSource().getRow(rowIndex)[col.field];
    if (oldValue === newValue) return;
    this.opts.dataSource().patchRow(rowIndex, { [col.field]: newValue });
    this.opts.control()?.pushEdit({ rowIndex, field: col.field, oldValue, newValue });
    this.opts.onCellEdit({
      position: { rowIndex, colIndex },
      field: col.field,
      oldValue,
      newValue,
    });
  }

  /** Discards the active edit without changing row data. */
  cancel(): void {
    this.clearEditState();
  }

  /** Applies the previous edit-history value to the data source. */
  undo(): void {
    const item = this.opts.control()?.undo();
    if (item) this.applyHistoryItem(item, 'oldValue');
  }

  /** Reapplies the next edit-history value to the data source. */
  redo(): void {
    const item = this.opts.control()?.redo();
    if (item) this.applyHistoryItem(item, 'newValue');
  }

  /** Reconciles active edit coordinates after a row is removed. */
  onRowRemoved(originalIndex: number): void {
    const editing = this.editingCell();
    if (editing?.rowIndex === originalIndex) {
      this.clearEditState();
    } else if (editing && editing.rowIndex > originalIndex) {
      this.editingCell.set({ ...editing, rowIndex: editing.rowIndex - 1 });
    }
  }

  private applyHistoryItem(item: HistoryItem, valueKey: 'oldValue' | 'newValue'): void {
    const entries = Array.isArray(item) ? item : [item];
    const ordered = valueKey === 'oldValue' ? [...entries].reverse() : entries;
    for (const entry of ordered) this.applyHistoryEntry(entry, entry[valueKey]);
  }

  private applyHistoryEntry(entry: HistoryEntry, value: unknown): void {
    const oldValue = this.opts.dataSource().getRow(entry.rowIndex)[entry.field];
    this.opts.dataSource().patchRow(entry.rowIndex, { [entry.field]: value });
    const colIndex = this.opts.visibleColDefs().findIndex(col => col.field === entry.field);
    this.opts.onCellEdit({
      position: { rowIndex: entry.rowIndex, colIndex },
      field: entry.field,
      oldValue,
      newValue: value,
    });
  }

  private clearEditState(): void {
    this.editingCell.set(null);
    this.editSeedChar.set('');
  }
}
