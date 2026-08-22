import { Signal, WritableSignal, signal } from '@angular/core';
import { CellRange } from '../selection/agrid-clipboard.handler';
import { AgridControl, HistoryEntry, HistoryItem } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { CellPosition, ColDef, GridEditEvent } from '../agrid.types';
import { coerceNumberInputValue } from '../agrid.utils';

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
  /** Called when a `ColDef.validate` hook rejects a committed value. */
  onValidationFailed: (event: { rowIndex: number; field: string; value: unknown; message: string }) => void;
}

/** Active cell validation error: the rejecting cell position, field, and message. @internal */
export interface CellValidationError {
  rowIndex: number;
  colIndex: number;
  field: string;
  message: string;
}

/**
 * Owns cell edit state, commit/cancel transitions, and undo/redo application.
 * @internal
 */
export class AgridEditController {
  readonly editingCell = signal<CellPosition | null>(null);
  readonly currentDraft = signal<unknown>(null);
  readonly editSeedChar = signal<string>('');
  /** Whether a newly focused text editor should select all text. */
  readonly selectTextOnEdit = signal<boolean>(true);
  /** The active cell validation error, or `null` when the last commit was accepted. */
  readonly validationError = signal<CellValidationError | null>(null);

  constructor(private readonly opts: AgridEditControllerOptions) {}

  /** Returns whether a cell can be edited in the current grid state. */
  isCellEditable(col: ColDef | undefined, originalIndex?: number): boolean {
    if (!col || this.opts.readonlyGrid() || col.editable === false || col.valueGetter) return false;
    if (originalIndex === undefined || !col.cellReadonly) return true;
    const row = this.opts.dataSource().getRow(originalIndex);
    if (!row) return false;
    return !col.cellReadonly({
      row,
      value: row[col.field],
      column: col,
      originalIndex,
    });
  }

  /** Replaces the value currently staged by the active editor. */
  setDraft(value: unknown): void {
    this.currentDraft.set(value);
  }

  /** Starts editing a cell, optionally seeded by a typed character. */
  start(originalIndex: number, colIndex: number, seedChar: string, selectText = true): void {
    const col = this.opts.visibleColDefs()[colIndex];
    if (!this.isCellEditable(col, originalIndex)) return;
    this.validationError.set(null);
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
    this.selectTextOnEdit.set(selectText);
    this.editingCell.set({ rowIndex: originalIndex, colIndex });
    const displayIndex = this.opts.findDisplayIndex(originalIndex);
    if (displayIndex >= 0) this.opts.scrollToCell(displayIndex, colIndex);
  }

  /**
   * Commits the staged value and records the edit in history.
   * Returns `false` (keeping the cell in edit mode) when a `ColDef.validate` hook rejects the
   * value; `true` when the edit is committed or there was no change.
   */
  commit(): boolean {
    const position = this.editingCell();
    if (!position) return true;
    const col = this.opts.visibleColDefs()[position.colIndex];
    if (!col) {
      this.cancel();
      return true;
    }

    const row = this.opts.dataSource().getRow(position.rowIndex);
    if (!this.isCellEditable(col, position.rowIndex)) {
      this.cancel();
      return true;
    }
    const oldValue = row[col.field];
    const newValue = col.type === 'number'
      ? coerceNumberInputValue(this.currentDraft())
      : this.currentDraft();
    if (oldValue !== newValue) {
      const message = col.validate?.(newValue as never, row as never) ?? null;
      if (message) {
        this.validationError.set({ ...position, field: col.field, message });
        this.opts.onValidationFailed({ rowIndex: position.rowIndex, field: col.field, value: newValue, message });
        return false;
      }
      this.opts.dataSource().patchRow(position.rowIndex, { [col.field]: newValue });
      this.opts.control()?.pushEdit({
        rowIndex: position.rowIndex,
        field: col.field,
        oldValue,
        newValue,
      });
      this.opts.onCellEdit({ position, field: col.field, oldValue, newValue });
    }
    this.validationError.set(null);
    this.clearEditState();
    this.opts.focusGrid();
    return true;
  }

  /**
   * Commit a value directly to a cell without entering edit mode (e.g. a boolean checkbox
   * toggle). Records the change in history and emits the edit just like {@link commit}.
   */
  setCellValue(rowIndex: number, colIndex: number, newValue: unknown): boolean {
    const col = this.opts.visibleColDefs()[colIndex];
    if (!this.isCellEditable(col, rowIndex)) return false;
    const row = this.opts.dataSource().getRow(rowIndex);
    const oldValue = row[col.field];
    const storedValue = col.type === 'number'
      ? coerceNumberInputValue(newValue)
      : newValue;
    if (oldValue === storedValue) return true;
    const message = col.validate?.(storedValue as never, row as never) ?? null;
    if (message) {
      this.validationError.set({ rowIndex, colIndex, field: col.field, message });
      this.opts.onValidationFailed({ rowIndex, field: col.field, value: storedValue, message });
      return false;
    }
    this.opts.dataSource().patchRow(rowIndex, { [col.field]: storedValue });
    this.opts.control()?.pushEdit({ rowIndex, field: col.field, oldValue, newValue: storedValue });
    this.opts.onCellEdit({
      position: { rowIndex, colIndex },
      field: col.field,
      oldValue,
      newValue: storedValue,
    });
    this.validationError.set(null);
    return true;
  }

  /** Discards the active edit without changing row data. */
  cancel(): void {
    this.validationError.set(null);
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
    this.selectTextOnEdit.set(true);
  }
}
