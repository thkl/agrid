import { Signal, WritableSignal, signal } from '@angular/core';
import { CellRange } from './agrid-clipboard.handler';
import { AgridControl, HistoryEntry, HistoryItem } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { CellPosition, ColDef, GridEditEvent } from './agrid.types';

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

/** Owns cell edit state, commit/cancel transitions, and undo/redo application. */
export class AgridEditController {
  readonly editingCell = signal<CellPosition | null>(null);
  readonly currentDraft = signal<unknown>(null);
  readonly editSeedChar = signal<string>('');

  constructor(private readonly opts: AgridEditControllerOptions) {}

  isCellEditable(col: ColDef | undefined): boolean {
    return !!col && !this.opts.readonlyGrid() && col.editable !== false;
  }

  setDraft(value: unknown): void {
    this.currentDraft.set(value);
  }

  start(originalIndex: number, colIndex: number, seedChar: string): void {
    const col = this.opts.visibleColDefs()[colIndex];
    if (!this.isCellEditable(col)) return;
    const currentValue = this.opts.dataSource().getRow(originalIndex)[col.field];
    this.opts.selectedRange.set(null);
    this.opts.selectedCell.set({ rowIndex: originalIndex, colIndex });
    this.currentDraft.set(seedChar !== '' ? seedChar : currentValue);
    this.editSeedChar.set(seedChar);
    this.editingCell.set({ rowIndex: originalIndex, colIndex });
    const displayIndex = this.opts.findDisplayIndex(originalIndex);
    if (displayIndex >= 0) this.opts.scrollToCell(displayIndex, colIndex);
  }

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

  cancel(): void {
    this.clearEditState();
  }

  undo(): void {
    const item = this.opts.control()?.undo();
    if (item) this.applyHistoryItem(item, 'oldValue');
  }

  redo(): void {
    const item = this.opts.control()?.redo();
    if (item) this.applyHistoryItem(item, 'newValue');
  }

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
