import { Signal, computed } from '@angular/core';
import { AgridControl, ColumnFilter } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { AgridServerSideRowModel } from '../agrid-server-side-row-model';
import { AgridTreeConfig, ColDef, GridItem } from '../agrid.types';
import {
  applyQuickFilter,
  applySortToIndices,
  applyTextAndValueFilters,
  buildGroupedItems,
  buildPathTreeItems,
  buildTreeItems,
  computeAggregates,
  isPathTreeConfig,
} from '../agrid.utils';

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
  /** Tree configuration, or `null` when the grid is not in tree mode. */
  treeConfig: Signal<AgridTreeConfig | null>;
  /** Whether rows/columns are already reduced into a derived pivot table. */
  pivotMode?: Signal<boolean>;
  /** Expanded node ids when tree mode is active. */
  expandedTreeIds: Signal<Set<string | number>>;
  /** Host callback designating rows pinned to the top/bottom, or `undefined` when not pinning. */
  pinRow?: Signal<((row: Record<string, unknown>, index: number) => 'top' | 'bottom' | undefined) | undefined>;
  /** Whether master/detail expandable rows are enabled. */
  masterDetail?: Signal<boolean>;
  /** Original indices of rows whose detail panel is currently expanded. */
  expandedDetailIds?: Signal<Set<number>>;
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
    const hasRowFilter = this.hasActiveRowFilter(filters, control.quickFilter());
    indices = applyTextAndValueFilters(
      rows,
      indices,
      filters,
      colMap,
      this.opts.locale(),
    );
    const quick = control.quickFilter();
    if (quick) {
      indices = applyQuickFilter(rows, indices, quick, this.opts.visibleColDefs(), this.opts.locale());
    }
    if (hasRowFilter) indices = this.includeUnfilteredAddedRows(indices, rows.length);
    if (control.groupByField() && !this.opts.pivotMode?.()) return indices;

    const sortEntries = this.sortEntries(filters);
    if (!sortEntries.length) return indices;

    const addedRows = this.opts.dataSource().ɵunfilteredAddedRows();
    if (addedRows.size === 0) {
      return applySortToIndices(rows, indices, sortEntries, colMap, this.opts.locale());
    }

    const added = indices.filter(index => addedRows.has(index));
    const regular = indices.filter(index => !addedRows.has(index));
    return [
      ...applySortToIndices(rows, regular, sortEntries, colMap, this.opts.locale()),
      ...added,
    ];
  });

  /** Total filtered row count, unaffected by client-side pagination. */
  readonly filteredRowCount = computed(() => this.filteredSortedIndices().length);

  /** Whether row pinning is active: a `pinRow` callback is supplied and not in tree mode. */
  private readonly pinningActive = computed(() =>
    !(this.opts.dataSource() instanceof AgridServerSideRowModel)
    && !!this.opts.pinRow?.()
    && !this.opts.treeConfig()
  );

  /**
   * Partitions the filtered+sorted indices into top-pinned, bottom-pinned, and a body set.
   * Pinned rows keep their real source index, so editing/selection over them is unchanged.
   */
  private readonly partitionPinned = computed<{ top: number[]; bottom: number[]; bodySet: Set<number> }>(() => {
    if (!this.pinningActive()) return { top: [], bottom: [], bodySet: new Set<number>() };
    const rows = this.opts.dataSource().rows();
    const pinRow = this.opts.pinRow!()!;
    const top: number[] = [];
    const bottom: number[] = [];
    const bodySet = new Set<number>();
    for (const index of this.filteredSortedIndices()) {
      const where = pinRow(rows[index], index);
      if (where === 'top') top.push(index);
      else if (where === 'bottom') bottom.push(index);
      else bodySet.add(index);
    }
    return { top, bottom, bodySet };
  });

  /** Top-pinned rows as data-row items, in filtered+sorted order. */
  readonly pinnedTopItems = computed<{ row: Record<string, unknown>; originalIndex: number }[]>(() => {
    const rows = this.opts.dataSource().rows();
    return this.partitionPinned().top.map(originalIndex => ({ row: rows[originalIndex], originalIndex }));
  });

  /** Bottom-pinned rows as data-row items, in filtered+sorted order. */
  readonly pinnedBottomItems = computed<{ row: Record<string, unknown>; originalIndex: number }[]>(() => {
    const rows = this.opts.dataSource().rows();
    return this.partitionPinned().bottom.map(originalIndex => ({ row: rows[originalIndex], originalIndex }));
  });

  /** All source indices in active sort order, ignoring filters. Used for tree ancestor ordering. */
  private readonly allSortedIndices = computed<number[]>(() => {
    const rows = this.opts.dataSource().rows();
    const control = this.opts.control();
    const indices = rows.map((_, index) => index);
    if (!control || this.opts.serverSideFiltering()) return indices;
    const sortEntries = this.sortEntries(control.filters());
    return sortEntries.length
      ? applySortToIndices(rows, indices, sortEntries, this.columnMap(), this.opts.locale())
      : indices;
  });

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
    if (this.opts.dataSource() instanceof AgridServerSideRowModel) return false;
    const control = this.opts.control();
    if (this.opts.treeConfig()) return false;
    return (control?.pageSize() ?? 0) > 0
      && (!control?.groupByField() || !!this.opts.pivotMode?.());
  });

  /** Whether at least one visible column has an aggregate footer. */
  readonly showFooter = computed(() => {
    if (this.opts.dataSource() instanceof AgridServerSideRowModel) return false;
    // Aggregating already-aggregated pivot cells is not generally valid (for example avg of avg).
    if (this.opts.pivotMode?.()) return false;
    const aggregates = this.opts.control()?.aggregates() ?? {};
    return this.opts.visibleColDefs().some(col => col.aggregate || aggregates[col.field]);
  });

  /** Aggregate values computed over all filtered rows, before pagination. */
  readonly footerValues = computed<Record<string, unknown>>(() =>
    computeAggregates(
      this.opts.dataSource().rows(),
      this.filteredSortedIndices(),
      this.opts.visibleColDefs(),
      this.opts.control()?.aggregates() ?? {},
    ),
  );

  /** Filtered, sorted, paginated, and optionally grouped virtual-scroll items. */
  readonly filteredItems = computed<GridItem[]>(() => {
    const rows = this.opts.dataSource().rows();
    const serverModel = this.opts.dataSource() instanceof AgridServerSideRowModel
      ? this.opts.dataSource() as AgridServerSideRowModel
      : null;
    const control = this.opts.control();
    let indices = this.filteredSortedIndices();

    // Server-side blocks already arrive filtered and sorted. Preserve their global indices and
    // represent unloaded sparse slots as non-interactive virtual rows.
    if (serverModel) {
      return indices.map(originalIndex => serverModel.isPlaceholder(originalIndex)
        ? { loading: true, originalIndex }
        : { row: rows[originalIndex], originalIndex });
    }

    // Tree mode takes precedence over grouping/pagination: the already filtered-and-sorted
    // indices are flattened into a hierarchy honoring the expanded-id set.
    const treeConfig = this.opts.treeConfig();
    if (treeConfig) {
      const expandedIds = this.opts.expandedTreeIds();
      // Passing no columns keeps the tree builders allocation-free when rollups are disabled.
      // Runtime control aggregates override static ColDef.aggregate values inside the builders.
      const treeAggregateCols = treeConfig.aggregateTreeNodes
        ? this.opts.visibleColDefs()
        : [];
      const treeControlAggregates = treeConfig.aggregateTreeNodes
        ? control?.aggregates() ?? {}
        : {};

      // When a text/value filter is active, keep the ancestors of every match visible (and
      // force their path open) so deep matches don't vanish under filtered-out parents.
      const filters = control?.filters() ?? {};
      const filterActive = !this.opts.serverSideFiltering()
        && Object.values(filters).some(f => f.text || f.selectedValues !== null);

      if (isPathTreeConfig(treeConfig)) {
        const items = this.appendTreeDetailItems(
          buildPathTreeItems(
            rows,
            indices,
            treeConfig,
            expandedIds,
            filterActive && treeConfig.keepAncestorsOnFilter !== false,
            treeAggregateCols,
            treeControlAggregates,
          ),
          rows,
          treeConfig,
        );
        this.appendAddRow(items);
        return items;
      }

      if (filterActive && treeConfig.keepAncestorsOnFilter !== false) {
        const { getId, getParentId } = treeConfig;
        const idToIndex = new Map<string | number, number>();
        rows.forEach((row, index) => idToIndex.set(getId(row), index));

        const visible = new Set<number>(indices);
        const forced = new Set<string | number>();
        for (const matched of indices) {
          let parentId = getParentId(rows[matched]);
          while (parentId != null && idToIndex.has(parentId)) {
            const parentIndex = idToIndex.get(parentId)!;
            forced.add(parentId);
            if (visible.has(parentIndex)) break; // chain already added by an earlier match
            visible.add(parentIndex);
            parentId = getParentId(rows[parentIndex]);
          }
        }

        const ordered = this.allSortedIndices().filter(index => visible.has(index));
        const items = this.appendTreeDetailItems(
          buildTreeItems(
            rows,
            ordered,
            treeConfig,
            expandedIds,
            forced,
            treeAggregateCols,
            treeControlAggregates,
          ),
          rows,
          treeConfig,
        );
        this.appendAddRow(items);
        return items;
      }

      const items = this.appendTreeDetailItems(
        buildTreeItems(
          rows,
          indices,
          treeConfig,
          expandedIds,
          undefined,
          treeAggregateCols,
          treeControlAggregates,
        ),
        rows,
        treeConfig,
      );
      this.appendAddRow(items);
      return items;
    }

    // Pull pinned rows out of the body; they render in fixed top/bottom containers instead.
    if (this.pinningActive()) {
      const bodySet = this.partitionPinned().bodySet;
      indices = indices.filter(index => bodySet.has(index));
    }

    if (control) {
      const groupField = control.groupByField();
      const pageSize = control.pageSize();
      const serverPagination = control.totalRows() > 0;
      if (pageSize > 0 && !serverPagination && !groupField) {
        const page = Math.max(1, Math.min(control.currentPage(), this.totalPages()));
        indices = indices.slice((page - 1) * pageSize, page * pageSize);
      }

      if (groupField && !this.opts.pivotMode?.()) {
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
          this.opts.visibleColDefs(),
          control.aggregates(),
        );
        this.appendAddRow(items);
        return items;
      }
    }

    // Flat mode: optionally interleave a master/detail panel item after each expanded row.
    const expandedDetail = this.opts.masterDetail?.() ? this.opts.expandedDetailIds?.() : null;
    const items: GridItem[] = [];
    for (const originalIndex of indices) {
      const row = rows[originalIndex];
      items.push({ row, originalIndex });
      if (expandedDetail?.has(originalIndex)) items.push({ detailFor: originalIndex, row });
    }
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

  private hasActiveRowFilter(filters: Record<string, ColumnFilter>, quickFilter: string): boolean {
    return !!quickFilter || Object.values(filters).some(filter =>
      !!filter.text
      || filter.selectedValues !== null
      || (!!filter.operator && filter.operand != null && filter.operand !== '')
    );
  }

  private includeUnfilteredAddedRows(indices: number[], rowCount: number): number[] {
    const addedRows = this.opts.dataSource().ɵunfilteredAddedRows();
    if (addedRows.size === 0) return indices;
    const visible = new Set(indices);
    const next = [...indices];
    for (const index of addedRows) {
      if (index >= 0 && index < rowCount && !visible.has(index)) {
        visible.add(index);
        next.push(index);
      }
    }
    return next;
  }

  private appendTreeDetailItems(
    items: GridItem[],
    rows: Record<string, unknown>[],
    treeConfig: AgridTreeConfig,
  ): GridItem[] {
    const expandedDetail = this.opts.masterDetail?.() ? this.opts.expandedDetailIds?.() : null;
    if (!expandedDetail?.size) return items;

    const parentIds = !isPathTreeConfig(treeConfig)
      ? new Set(
        rows
          .map(row => treeConfig.getParentId(row))
          .filter((id): id is string | number => id !== null && id !== undefined),
      )
      : new Set<string | number>();
    const result: GridItem[] = [];
    for (const item of items) {
      result.push(item);
      if (
        item
        && typeof item === 'object'
        && 'originalIndex' in item
        && 'row' in item
        && (
          isPathTreeConfig(treeConfig)
          || !parentIds.has(treeConfig.getId(item.row))
        )
        && expandedDetail.has(item.originalIndex)
      ) {
        result.push({ detailFor: item.originalIndex, row: item.row });
      }
    }
    return result;
  }

  private appendAddRow(items: GridItem[]): void {
    if (this.opts.allowAddRows() && !this.opts.autoAddRows()) items.push(null);
  }
}
