import { Signal, computed } from '@angular/core';
import { AgridControl, ColumnFilter } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { ColDef, GridItem } from './agrid.types';
import {
  applySortToIndices,
  applyTextAndValueFilters,
  buildGroupedItems,
} from './agrid.utils';

/** Expanded labels associated with the current grouping field. @internal */
export interface AgridGroupExpansionState {
  field: string | null;
  labels: Set<string>;
}

/** Reactive inputs required by {@link AgridProjectionModel}. @internal */
export interface AgridProjectionOptions {
  dataSource: Signal<AgridDataSource>;
  control: Signal<AgridControl | null>;
  colDefs: Signal<ColDef[]>;
  visibleColDefs: Signal<ColDef[]>;
  locale: Signal<string>;
  serverSideFiltering: Signal<boolean>;
  sortOption: Signal<'single' | 'multi' | 'none'>;
  allowAddRows: Signal<boolean>;
  autoAddRows: Signal<boolean>;
  expandedGroups: Signal<AgridGroupExpansionState>;
}

/**
 * Computes the visible row projection and aggregate state from grid data and controls.
 * @internal
 */
export class AgridProjectionModel {
  constructor(private readonly opts: AgridProjectionOptions) {}

  /** Filtered and sorted source indices before pagination or grouping. */
  readonly filteredSortedIndices = computed<number[]>(() => {
    const rows = this.opts.dataSource().rows();
    const control = this.opts.control();
    const colMap = this.columnMap();
    let indices = rows.map((_, index) => index);

    if (!control || this.opts.serverSideFiltering()) return indices;

    const filters = control.filters();
    indices = applyTextAndValueFilters(
      rows,
      indices,
      filters,
      colMap,
      this.opts.locale(),
    );
    if (control.groupByField()) return indices;

    const sortEntries = this.sortEntries(filters);
    return sortEntries.length
      ? applySortToIndices(rows, indices, sortEntries, colMap, this.opts.locale())
      : indices;
  });

  /** Total filtered row count, unaffected by client-side pagination. */
  readonly filteredRowCount = computed(() => this.filteredSortedIndices().length);

  /** Total page count using server total when server-side pagination is active. */
  readonly totalPages = computed(() => {
    const control = this.opts.control();
    const pageSize = control?.pageSize() ?? 0;
    if (pageSize <= 0) return 1;
    const count = (control?.totalRows() ?? 0) > 0
      ? control!.totalRows()
      : this.filteredSortedIndices().length;
    return Math.max(1, Math.ceil(count / pageSize));
  });

  /** Whether client or server pagination controls should be rendered. */
  readonly showPagination = computed(() => {
    const control = this.opts.control();
    return (control?.pageSize() ?? 0) > 0 && !control?.groupByField();
  });

  /** Whether at least one visible column has an aggregate footer. */
  readonly showFooter = computed(() => {
    const aggregates = this.opts.control()?.aggregates() ?? {};
    return this.opts.visibleColDefs().some(col => col.aggregate || aggregates[col.field]);
  });

  /** Aggregate values computed over all filtered rows, before pagination. */
  readonly footerValues = computed<Record<string, unknown>>(() => {
    const rows = this.opts.dataSource().rows();
    const indices = this.filteredSortedIndices();
    const controlAggregates = this.opts.control()?.aggregates() ?? {};
    const result: Record<string, unknown> = {};

    for (const col of this.opts.visibleColDefs()) {
      const aggregate: ColDef['aggregate'] = controlAggregates[col.field] ?? col.aggregate;
      if (!aggregate) continue;
      const values = indices.map(index => rows[index][col.field]);
      if (typeof aggregate === 'function') {
        result[col.field] = (aggregate as (values: unknown[]) => unknown)(values);
        continue;
      }

      const numbers = values.map(Number).filter(value => !Number.isNaN(value));
      switch (aggregate) {
        case 'sum':
          result[col.field] = numbers.reduce((sum, value) => sum + value, 0);
          break;
        case 'avg':
          result[col.field] = numbers.length
            ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
            : null;
          break;
        case 'min':
          result[col.field] = numbers.length ? Math.min(...numbers) : null;
          break;
        case 'max':
          result[col.field] = numbers.length ? Math.max(...numbers) : null;
          break;
        case 'count':
          result[col.field] = values.filter(value => value != null && value !== '').length;
          break;
      }
    }
    return result;
  });

  /** Filtered, sorted, paginated, and optionally grouped virtual-scroll items. */
  readonly filteredItems = computed<GridItem[]>(() => {
    const rows = this.opts.dataSource().rows();
    const control = this.opts.control();
    let indices = this.filteredSortedIndices();

    if (control) {
      const groupField = control.groupByField();
      const pageSize = control.pageSize();
      const serverPagination = control.totalRows() > 0;
      if (pageSize > 0 && !serverPagination && !groupField) {
        const page = Math.max(1, Math.min(control.currentPage(), this.totalPages()));
        indices = indices.slice((page - 1) * pageSize, page * pageSize);
      }

      if (groupField) {
        const expansion = this.opts.expandedGroups();
        const expandedLabels = expansion.field === groupField
          ? expansion.labels
          : new Set<string>();
        const filters = control.filters();
        const sortEntries = this.opts.serverSideFiltering()
          ? []
          : this.sortEntries(filters);
        const items = buildGroupedItems(
          rows,
          indices,
          groupField,
          this.columnMap(),
          sortEntries,
          expandedLabels,
          this.opts.locale(),
        );
        this.appendAddRow(items);
        return items;
      }
    }

    const items: GridItem[] = indices.map(originalIndex => ({
      row: rows[originalIndex],
      originalIndex,
    }));
    this.appendAddRow(items);
    return items;
  });

  /** Returns sorted fields after applying the configured sorting mode. */
  effectiveSortOrder(): string[] {
    const option = this.opts.sortOption();
    if (option === 'none') return [];
    const order = this.opts.control()?.sortOrder() ?? [];
    return option === 'single' ? order.slice(-1) : order;
  }

  private columnMap(): Map<string, ColDef> {
    return new Map(this.opts.colDefs().map(col => [col.field, col]));
  }

  private sortEntries(filters: Record<string, ColumnFilter>): [string, ColumnFilter][] {
    return this.effectiveSortOrder()
      .map(field => [field, filters[field]] as [string, ColumnFilter])
      .filter(([, filter]) => !!filter?.sort);
  }

  private appendAddRow(items: GridItem[]): void {
    if (this.opts.allowAddRows() && !this.opts.autoAddRows()) items.push(null);
  }
}
