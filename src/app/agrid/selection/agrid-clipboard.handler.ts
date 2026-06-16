import { Signal, WritableSignal } from '@angular/core';
import { AgridControl, HistoryEntry } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { CellPosition, ColDef, GridEditEvent, GridItem } from '../agrid.types';
import { getDisplayForField, isDataRowItem } from '../agrid.utils';

/** Rectangular selection represented by source row and visible column positions. @internal */
export type CellRange = { anchor: CellPosition; focus: CellPosition };

type VisibleCellBounds = {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

/** Dependencies and callbacks required by {@link AgridClipboardHandler}. @internal */
export interface AgridClipboardHandlerOptions {
  control: Signal<AgridControl | null>;
  dataSource: Signal<AgridDataSource>;
  filteredItems: Signal<GridItem[]>;
  visibleColDefs: Signal<ColDef[]>;
  locale: Signal<string>;
  selectedCell: WritableSignal<CellPosition | null>;
  selectedRange: WritableSignal<CellRange | null>;
  markedRowIndices: Signal<ReadonlySet<number>>;
  isCellEditable: (col: ColDef, originalIndex: number) => boolean;
  onCellEdit: (event: GridEditEvent) => void;
  scrollToCell: (displayIndex: number, colIndex: number) => void;
}

/** Handles selection serialization and spreadsheet-style clipboard paste operations. @internal */
export class AgridClipboardHandler {
  constructor(private readonly opts: AgridClipboardHandlerOptions) {}

  /** Writes the current cell or range selection to a clipboard event as TSV. */
  copy(event: ClipboardEvent): void {
    const text = this.getSelectedTsv();
    if (!text) return;
    event.clipboardData?.setData('text/plain', text);
    event.preventDefault();
  }

  /** Reads plain text from a clipboard event and pastes it at the selection. */
  paste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text/plain');
    if (!text || !this.opts.selectedCell()) return;
    event.preventDefault();
    this.pasteTextAtSelection(text);
  }

  /** Serializes the current cell or range selection as tab-separated text. */
  getSelectedTsv(): string {
    const bounds = this.getVisibleRangeBounds();
    const selected = this.opts.selectedCell();
    const marked = this.opts.markedRowIndices();
    if (!bounds && !selected && marked.size === 0) return '';

    const rowStart = bounds?.rowStart ?? (
      selected ? this.findDisplayIndex(selected.rowIndex) : -1
    );
    const rowEnd = bounds?.rowEnd ?? rowStart;
    const colStart = bounds?.colStart ?? selected?.colIndex ?? 0;
    const colEnd = bounds?.colEnd ?? selected?.colIndex
      ?? this.opts.visibleColDefs().length - 1;
    const rows = this.opts.filteredItems();
    const cols = this.opts.visibleColDefs();
    const dataRows = this.opts.dataSource().rows();
    const lines: string[] = [];
    const copiedIndices = new Set<number>();

    if (rowStart >= 0) {
      for (let displayIndex = rowStart; displayIndex <= rowEnd; displayIndex++) {
        const item = rows[displayIndex];
        if (!isDataRowItem(item)) continue;
        lines.push(this.serializeRow(item.row, cols, colStart, colEnd));
        copiedIndices.add(item.originalIndex);
      }
    }

    for (const originalIndex of [...marked].sort((a, b) => a - b)) {
      if (copiedIndices.has(originalIndex)) continue;
      const row = dataRows[originalIndex];
      if (!row) continue;
      lines.push(this.serializeRow(row, cols, colStart, colEnd));
    }

    return lines.join('\n');
  }

  private serializeRow(
    row: Record<string, unknown>,
    cols: ColDef[],
    colStart: number,
    colEnd: number,
  ): string {
    const cells: string[] = [];
    for (let colIndex = colStart; colIndex <= colEnd; colIndex++) {
      const col = cols[colIndex];
      if (!col) continue;
      cells.push(this.escapeTsvValue(
        getDisplayForField(col, row[col.field], this.opts.locale())
      ));
    }
    return cells.join('\t');
  }

  /** Applies delimited text to editable cells beginning at the active selection. */
  pasteTextAtSelection(text: string): void {
    const bounds = this.getActiveSelectionBounds();
    if (!bounds) return;
    const start = this.positionFromVisibleCell(bounds.rowStart, bounds.colStart);
    const rows = this.parseDelimitedText(text);
    if (rows.length === 0) return;

    const items = this.opts.filteredItems();
    const cols = this.opts.visibleColDefs();
    const dataSource = this.opts.dataSource();
    let lastPosition = start;
    const historyEntries: HistoryEntry[] = [];

    for (let rowOffset = 0; rowOffset < rows.length; rowOffset++) {
      const item = items[bounds.rowStart + rowOffset];
      if (!isDataRowItem(item)) continue;
      for (let colOffset = 0; colOffset < rows[rowOffset].length; colOffset++) {
        const colIndex = start.colIndex + colOffset;
        const col = cols[colIndex];
        if (!col || !this.opts.isCellEditable(col, item.originalIndex)) continue;
        const oldValue = dataSource.getRow(item.originalIndex)[col.field];
        const newValue = this.coercePastedValue(rows[rowOffset][colOffset], col);
        if (oldValue === newValue) continue;

        dataSource.patchRow(item.originalIndex, { [col.field]: newValue });
        const edit = {
          rowIndex: item.originalIndex,
          field: col.field,
          oldValue,
          newValue,
        };
        historyEntries.push(edit);
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
    this.opts.selectedRange.set({ anchor: start, focus: lastPosition });
    this.opts.selectedCell.set(lastPosition);
    this.opts.scrollToCell(this.findDisplayIndex(lastPosition.rowIndex), lastPosition.colIndex);
  }

  private getVisibleRangeBounds(): VisibleCellBounds | null {
    const range = this.opts.selectedRange();
    if (!range) return null;
    const anchorDisplayIndex = this.findDisplayIndex(range.anchor.rowIndex);
    const focusDisplayIndex = this.findDisplayIndex(range.focus.rowIndex);
    if (anchorDisplayIndex < 0 || focusDisplayIndex < 0) return null;
    return {
      rowStart: Math.min(anchorDisplayIndex, focusDisplayIndex),
      rowEnd: Math.max(anchorDisplayIndex, focusDisplayIndex),
      colStart: Math.min(range.anchor.colIndex, range.focus.colIndex),
      colEnd: Math.max(range.anchor.colIndex, range.focus.colIndex),
    };
  }

  private getActiveSelectionBounds(): VisibleCellBounds | null {
    const range = this.getVisibleRangeBounds();
    if (range) return range;
    const selected = this.opts.selectedCell();
    if (!selected) return null;
    const displayIndex = this.findDisplayIndex(selected.rowIndex);
    if (displayIndex < 0) return null;
    return {
      rowStart: displayIndex,
      rowEnd: displayIndex,
      colStart: selected.colIndex,
      colEnd: selected.colIndex,
    };
  }

  private findDisplayIndex(originalIndex: number): number {
    return this.opts.filteredItems().findIndex(
      item => isDataRowItem(item) && item.originalIndex === originalIndex
    );
  }

  private positionFromVisibleCell(displayIndex: number, colIndex: number): CellPosition {
    const item = this.opts.filteredItems()[displayIndex];
    if (isDataRowItem(item)) return { rowIndex: item.originalIndex, colIndex };
    return this.opts.selectedCell() ?? { rowIndex: 0, colIndex };
  }

  private escapeTsvValue(value: string): string {
    return /["\t\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  private parseDelimitedText(text: string): string[][] {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '');
    const delimiter = normalized.includes('\t') ? '\t' : ',';
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (quoted) {
        if (char === '"' && normalized[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === delimiter) {
        row.push(cell);
        cell = '';
      } else if (char === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    row.push(cell);
    rows.push(row);
    return rows.filter(values => values.length > 1 || values[0] !== '');
  }

  private coercePastedValue(value: string, col: ColDef): unknown {
    if (col.values?.length) {
      const match = col.values.find(option =>
        typeof option === 'string'
          ? option === value
          : option.label === value || String(option.value) === value
      );
      if (match !== undefined) return typeof match === 'string' ? match : match.value;
    }
    if (col.type === 'number') {
      const numberValue = Number(value);
      return value.trim() === '' || Number.isNaN(numberValue) ? value : numberValue;
    }
    return value;
  }
}
