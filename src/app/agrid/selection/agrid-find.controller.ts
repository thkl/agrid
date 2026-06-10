import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { CellRange } from './agrid-clipboard.handler';
import { CellPosition, ColDef, GridItem } from '../agrid.types';
import { getDisplayForField, isDataRowItem } from '../agrid.utils';

/** Location of a formatted-value match in source and display coordinates. @internal */
export type AgridFindMatch = {
  rowIndex: number;
  displayIndex: number;
  colIndex: number;
};

/** Dependencies and callbacks required by {@link AgridFindController}. @internal */
export interface AgridFindControllerOptions {
  filteredItems: Signal<GridItem[]>;
  visibleColDefs: Signal<ColDef[]>;
  locale: Signal<string>;
  selectedCell: WritableSignal<CellPosition | null>;
  selectedRange: WritableSignal<CellRange | null>;
  scrollToCell: (displayIndex: number, colIndex: number) => void;
  focusGrid: () => void;
}

/** Owns in-grid find state, formatted-value matching, and match navigation. @internal */
export class AgridFindController {
  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(-1);

  readonly matches = computed<AgridFindMatch[]>(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) return [];
    const cols = this.opts.visibleColDefs();
    const matches: AgridFindMatch[] = [];
    this.opts.filteredItems().forEach((item, displayIndex) => {
      if (!isDataRowItem(item)) return;
      for (let colIndex = 0; colIndex < cols.length; colIndex++) {
        const col = cols[colIndex];
        const value = getDisplayForField(col, item.row[col.field], this.opts.locale()).toLowerCase();
        if (value.includes(query)) {
          matches.push({ rowIndex: item.originalIndex, displayIndex, colIndex });
        }
      }
    });
    return matches;
  });

  constructor(private readonly opts: AgridFindControllerOptions) {}

  /** Opens the find panel. */
  show(): void {
    this.open.set(true);
  }

  /** Closes the find panel and returns focus to the grid. */
  close(): void {
    this.open.set(false);
    this.opts.focusGrid();
  }

  /** Replaces the search query and selects its first match. */
  setQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(-1);
    this.goToMatch(1);
  }

  /** Selects the next or previous match, wrapping at either end. */
  goToMatch(direction: 1 | -1): void {
    const matches = this.matches();
    if (matches.length === 0) {
      this.activeIndex.set(-1);
      return;
    }
    const current = this.activeIndex();
    const next = current < 0
      ? (direction === 1 ? 0 : matches.length - 1)
      : (current + direction + matches.length) % matches.length;
    this.activeIndex.set(next);
    const match = matches[next];
    this.opts.selectedRange.set(null);
    this.opts.selectedCell.set({ rowIndex: match.rowIndex, colIndex: match.colIndex });
    this.opts.scrollToCell(match.displayIndex, match.colIndex);
  }

  /** Returns whether a cell matches the current query. */
  isMatchCell(originalIndex: number, colIndex: number): boolean {
    return this.matches().some(
      match => match.rowIndex === originalIndex && match.colIndex === colIndex,
    );
  }

  /** Returns whether a cell is the currently active match. */
  isActiveMatchCell(originalIndex: number, colIndex: number): boolean {
    const match = this.matches()[this.activeIndex()];
    return !!match && match.rowIndex === originalIndex && match.colIndex === colIndex;
  }
}
