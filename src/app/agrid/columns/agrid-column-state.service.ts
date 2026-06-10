import { Signal } from '@angular/core';
import { AgridControl } from '../agrid-control';
import { ColDef } from '../agrid.types';

/** Reactive column state consumed by {@link AgridColumnStateService}. @internal */
export interface AgridColumnStateOptions {
  control: Signal<AgridControl | null>;
  colDefs: Signal<ColDef[]>;
  visibleColDefs: Signal<ColDef[]>;
  pinnedColDefs: Signal<ColDef[]>;
  rightPinnedColDefs: Signal<ColDef[]>;
  showControlColumn: Signal<boolean>;
}

/** Provides template-facing column lookup, pinning, visibility, and ARIA state. @internal */
export class AgridColumnStateService {
  constructor(private readonly opts: AgridColumnStateOptions) {}

  /** Finds a column definition by field name. */
  getColDef(field: string): ColDef | undefined {
    return this.opts.colDefs().find(col => col.field === field);
  }

  /** Returns a field's zero-based index among visible columns. */
  getVisibleColIndex(field: string): number {
    return this.opts.visibleColDefs().findIndex(col => col.field === field);
  }

  /** Converts a visible data-column index to a one-based ARIA index. */
  getAriaColIndex(colIndex: number): number {
    return colIndex + 1 + (this.opts.showControlColumn() ? 1 : 0);
  }

  /** Returns whether a field is hidden by the grid control. */
  isColumnHidden(field: string): boolean {
    return this.opts.control()?.isColumnHidden(field) ?? false;
  }

  /** Returns whether the grid is grouped by the field. */
  isGroupedByField(field: string): boolean {
    return this.opts.control()?.groupByField() === field;
  }

  /** Returns whether a field is pinned to the left. */
  isColumnPinned(field: string): boolean {
    return this.opts.pinnedColDefs().some(col => col.field === field);
  }

  /** Returns whether a field is pinned to the right. */
  isColumnPinnedRight(field: string): boolean {
    return this.opts.rightPinnedColDefs().some(col => col.field === field);
  }

  /** Returns the field's current pin side, or `false` when unpinned. */
  getColumnPinState(field: string): 'left' | 'right' | false {
    if (this.isColumnPinned(field)) return 'left';
    if (this.isColumnPinnedRight(field)) return 'right';
    return false;
  }

  /** Returns whether the field is the first right-pinned column. */
  isFirstRightPinnedColumn(field: string): boolean {
    const cols = this.opts.rightPinnedColDefs();
    return cols.length > 0 && cols[0].field === field;
  }

  /** Returns whether the field is the last left-pinned column. */
  isLastPinnedColumn(field: string): boolean {
    const cols = this.opts.pinnedColDefs();
    return cols.length > 0 && cols[cols.length - 1].field === field;
  }
}
