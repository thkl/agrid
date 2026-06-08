import { Signal } from '@angular/core';
import { AgridControl } from './agrid-control';
import { ColDef, GridItem } from './agrid.types';
import { getDisplayForField, isDataRowItem } from './agrid.utils';

export interface AgridPresentationOptions {
  control: Signal<AgridControl | null>;
  visibleColDefs: Signal<ColDef[]>;
  filteredItems: Signal<GridItem[]>;
  locale: Signal<string>;
}

/** Provides display formatting and CSV export without coupling them to the grid component. */
export class AgridPresentationService {
  constructor(private readonly opts: AgridPresentationOptions) {}

  getCellTitle(col: ColDef, value: unknown): string {
    return getDisplayForField(col, value, this.opts.locale());
  }

  getCellClass(col: ColDef, value: unknown, row: Record<string, unknown>): string {
    return col.cellClass?.({ value, row }) ?? '';
  }

  getAggregateLabel(col: ColDef): string {
    const aggregate = this.opts.control()?.aggregates()[col.field] ?? col.aggregate;
    if (!aggregate || typeof aggregate === 'function') return '';
    return { sum: 'Σ', avg: 'Ø', min: '↓', max: '↑', count: '#' }[aggregate] ?? '';
  }

  hasAggregate(col: ColDef): boolean {
    return this.opts.control()?.aggregates()[col.field] !== undefined || !!col.aggregate;
  }

  getFooterDisplay(col: ColDef, value: unknown): string {
    if (value == null || value === '') return '';
    if (col.formatter) return col.formatter(value);
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  }

  exportCsv(filename: string): void {
    const cols = this.opts.visibleColDefs();
    const rows = this.opts.filteredItems()
      .filter(isDataRowItem)
      .map(item => item.row);
    const escape = (value: string): string =>
      /[,"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const header = cols.map(col => escape(col.header)).join(',');
    const locale = this.opts.locale();
    const body = rows
      .map(row => cols
        .map(col => escape(getDisplayForField(col, row[col.field], locale)))
        .join(','))
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
