import { Signal } from '@angular/core';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { XLSX_CONTENT_TYPE, XlsxCell, XlsxRow, XlsxSheet, buildXlsx } from '../infrastructure/agrid-xlsx';
import { AgridControl } from '../agrid-control';
import { AgridExportGroup, ColDef } from '../agrid.types';
import { getDisplayForField } from '../agrid.utils';

/** Reactive display state required by {@link AgridPresentationService}. @internal */
export interface AgridPresentationOptions {
  control: Signal<AgridControl | null>;
  visibleColDefs: Signal<ColDef[]>;
  /**
   * Rows an export should contain: the full filtered + sorted set in display order, independent of
   * grouping, pagination, and collapsed-group state (which only affect what is rendered on screen).
   */
  exportRows: Signal<Record<string, unknown>[]>;
  /** Grouped export structure when the grid is grouped, or `null` for a flat export. */
  exportGroups?: Signal<AgridExportGroup[] | null>;
  locale: Signal<string>;
  /** Optional host callback returning CSS classes for a whole data row. */
  getRowClass?: Signal<((params: { row: Record<string, unknown>; index: number }) => string) | undefined>;
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

  /** Resolves dynamic CSS classes configured for a whole data row. */
  getRowClass(row: Record<string, unknown>, index: number): string {
    return this.opts.getRowClass?.()?.({ row, index }) ?? '';
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
    if (typeof value === 'number') return value.toLocaleString(this.opts.locale());
    return String(value);
  }

  /** Downloads the current filtered, sorted rows and visible columns as CSV. */
  exportCsv(filename: string): void {
    const cols = this.opts.visibleColDefs();
    const rows = this.opts.exportRows();
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

  /**
   * Downloads the current filtered, sorted rows and visible columns as an `.xlsx` workbook.
   * When the grid is grouped, emits a collapsible Excel row outline with per-group subtotal rows.
   */
  exportXlsx(filename: string, sheetName = 'Sheet1'): void {
    const cols = this.opts.visibleColDefs();
    const locale = this.opts.locale();
    const groups = this.opts.exportGroups?.() ?? null;
    const sheet = groups
      ? this.buildGroupedSheet(sheetName, cols, groups, locale)
      : this.buildFlatSheet(sheetName, cols, this.opts.exportRows(), locale);
    this.browser.downloadBytes(filename, buildXlsx([sheet]), XLSX_CONTENT_TYPE);
  }

  private buildFlatSheet(
    name: string,
    cols: ColDef[],
    rows: Record<string, unknown>[],
    locale: string,
  ): XlsxSheet {
    return {
      name,
      header: cols.map(col => col.header),
      rows: rows.map(row => ({ cells: cols.map(col => this.toXlsxCell(col, row[col.field], locale)) })),
    };
  }

  private buildGroupedSheet(
    name: string,
    cols: ColDef[],
    groups: AgridExportGroup[],
    locale: string,
  ): XlsxSheet {
    const rows: XlsxRow[] = [];
    for (const group of groups) {
      // Summary row (level 0): group label in the first column, subtotals in aggregate columns.
      const summary: XlsxCell[] = cols.map((col, index) => {
        if (index === 0) return { kind: 'string', value: `${group.label} (${group.rows.length})` };
        const value = group.aggregates[col.field];
        if (value == null) return { kind: 'empty' };
        return typeof value === 'number' && Number.isFinite(value)
          ? { kind: 'number', value }
          : { kind: 'string', value: String(value) };
      });
      rows.push({ cells: summary, level: 0, emphasized: true });
      for (const row of group.rows) {
        rows.push({ cells: cols.map(col => this.toXlsxCell(col, row[col.field], locale)), level: 1 });
      }
    }
    return { name, header: cols.map(col => col.header), rows, outline: true };
  }

  /**
   * Maps a raw cell value to a typed spreadsheet cell so Excel keeps numbers and dates native
   * (sortable, summable). Mapped value lists and custom formatters fall back to display text.
   */
  private toXlsxCell(col: ColDef, raw: unknown, locale: string): XlsxCell {
    if (raw == null || raw === '') return { kind: 'empty' };
    if (col.values?.length) return { kind: 'string', value: getDisplayForField(col, raw, locale) };
    if (col.type === 'number' && typeof raw === 'number' && Number.isFinite(raw)) {
      return { kind: 'number', value: raw };
    }
    if (col.type === 'boolean' && typeof raw === 'boolean') return { kind: 'boolean', value: raw };
    if (col.type === 'date') {
      const date = raw instanceof Date ? raw : new Date(raw as string | number);
      if (!Number.isNaN(date.getTime())) return { kind: 'date', value: date };
    }
    return { kind: 'string', value: getDisplayForField(col, raw, locale) };
  }
}
