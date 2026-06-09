import { Signal } from '@angular/core';
import { AgridBrowserAdapter } from './agrid-browser.adapter';
import { AgridControl } from './agrid-control';
import { ColDef, GridItem } from './agrid.types';
import { getDisplayForField, isDataRowItem } from './agrid.utils';

/** Reactive display state required by {@link AgridPresentationService}. @internal */
export interface AgridPresentationOptions {
  control: Signal<AgridControl | null>;
  visibleColDefs: Signal<ColDef[]>;
  filteredItems: Signal<GridItem[]>;
  locale: Signal<string>;
}

/**
 * Provides display formatting and CSV export without coupling them to the grid component.
 * @internal
 */
export class AgridPresentationService {
  constructor(
    private readonly opts: AgridPresentationOptions,
    private readonly browser = new AgridBrowserAdapter(),
  ) {}

  /** Returns the formatted tooltip text for a cell value. */
  getCellTitle(col: ColDef, value: unknown): string {
    return getDisplayForField(col, value, this.opts.locale());
  }

  /** Resolves dynamic CSS classes configured for a cell. */
  getCellClass(col: ColDef, value: unknown, row: Record<string, unknown>): string {
    return col.cellClass?.({ value, row }) ?? '';
  }

  /** Returns the compact label for a built-in aggregate. */
  getAggregateLabel(col: ColDef): string {
    const aggregate = this.opts.control()?.aggregates()[col.field] ?? col.aggregate;
    if (!aggregate || typeof aggregate === 'function') return '';
    return { sum: 'Σ', avg: 'Ø', min: '↓', max: '↑', count: '#' }[aggregate] ?? '';
  }

  /** Returns whether a column has a static or runtime aggregate. */
  hasAggregate(col: ColDef): boolean {
    return this.opts.control()?.aggregates()[col.field] !== undefined || !!col.aggregate;
  }

  /** Formats a computed footer value for display. */
  getFooterDisplay(col: ColDef, value: unknown): string {
    if (value == null || value === '') return '';
    if (col.formatter) return col.formatter(value);
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  }

  /** Downloads the currently projected rows and visible columns as CSV. */
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
    this.browser.downloadText(
      filename,
      `${header}\n${body}`,
      'text/csv;charset=utf-8;',
    );
  }
}
