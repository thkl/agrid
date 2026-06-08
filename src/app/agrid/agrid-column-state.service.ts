import { Signal } from '@angular/core';
import { AgridControl } from './agrid-control';
import { ColDef } from './agrid.types';

export interface AgridColumnStateOptions {
  control: Signal<AgridControl | null>;
  colDefs: Signal<ColDef[]>;
  visibleColDefs: Signal<ColDef[]>;
  pinnedColDefs: Signal<ColDef[]>;
  rightPinnedColDefs: Signal<ColDef[]>;
  showControlColumn: Signal<boolean>;
}

/** Provides template-facing column lookup, pinning, visibility, and ARIA state. */
export class AgridColumnStateService {
  constructor(private readonly opts: AgridColumnStateOptions) {}

  getColDef(field: string): ColDef | undefined {
    return this.opts.colDefs().find(col => col.field === field);
  }

  getVisibleColIndex(field: string): number {
    return this.opts.visibleColDefs().findIndex(col => col.field === field);
  }

  getAriaColIndex(colIndex: number): number {
    return colIndex + 1 + (this.opts.showControlColumn() ? 1 : 0);
  }

  isColumnHidden(field: string): boolean {
    return this.opts.control()?.isColumnHidden(field) ?? false;
  }

  isGroupedByField(field: string): boolean {
    return this.opts.control()?.groupByField() === field;
  }

  isColumnPinned(field: string): boolean {
    return this.opts.pinnedColDefs().some(col => col.field === field);
  }

  isColumnPinnedRight(field: string): boolean {
    return this.opts.rightPinnedColDefs().some(col => col.field === field);
  }

  getColumnPinState(field: string): 'left' | 'right' | false {
    if (this.isColumnPinned(field)) return 'left';
    if (this.isColumnPinnedRight(field)) return 'right';
    return false;
  }

  isFirstRightPinnedColumn(field: string): boolean {
    const cols = this.opts.rightPinnedColDefs();
    return cols.length > 0 && cols[0].field === field;
  }

  isLastPinnedColumn(field: string): boolean {
    const cols = this.opts.pinnedColDefs();
    return cols.length > 0 && cols[cols.length - 1].field === field;
  }
}
