import { Signal, WritableSignal, computed, signal } from '@angular/core';

/** @internal */
export interface ɵAgridControlRuntimeState {
  loading: WritableSignal<boolean>;
  readonly: WritableSignal<boolean>;
  autoAddRows: WritableSignal<boolean>;
}

const CONTROL_RUNTIME_STATE = new WeakMap<AgridControl, ɵAgridControlRuntimeState>();

/**
 * A single reversible cell edit stored in the undo/redo history.
 * Both `oldValue` and `newValue` are the raw values as stored in the data source.
 */
export interface HistoryEntry {
  rowIndex: number;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** A single undo/redo history item. Multi-cell operations are stored as one batch. */
export type HistoryItem = HistoryEntry | HistoryEntry[];

/**
 * Per-column filter state stored inside {@link AgridControl}.
 *
 * All three fields are independent — text, value selection, and sort are ANDed together
 * when computing the visible rows.
 */
/**
 * Comparison operator for a column condition filter.
 * For `date` columns `gt`/`lt`/`eq` read as after / before / on.
 */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'like'
  | 'startsWith'
  | 'endsWith'
  | 'includes'
  | 'notIncludes';

export interface ColumnFilter {
  /** Free-text substring filter (case-insensitive). Empty string = no text filter. */
  text: string;
  /**
   * Allowed values for the value-picker filter.
   * - `null` → all values pass (no value filter active)
   * - `string[]` → only rows whose field value is in this list are shown
   */
  selectedValues: string[] | null;
  /** Sort direction, or `null` when this column is not sorted. */
  sort: 'asc' | 'desc' | null;
  /**
   * Condition operator for text, number, or date columns, or `null`/omitted when none.
   * Combined with text and value filters using AND semantics.
   */
  operator?: FilterOperator | null;
  /** Primary comparison operand (number as string, or `yyyy-mm-dd`). */
  operand?: string | null;
  /** Upper-bound operand used only when {@link operator} is `'between'`. */
  operand2?: string | null;
}

/** Transient row indication state produced by {@link AgridControl.indicate}. */
export interface AgridRowIndication {
  /** CSS color shown while the row flash is active. */
  color: string;
  /** Fade duration in milliseconds. */
  durationMs: number;
  /** `true` while the row flash is present. */
  active: boolean;
}

/** Serializable snapshot of the grid's UI state. Used with `toJSON` / `fromJSON`. */
export interface AgridControlState {
  /** Per-field column width overrides in pixels. */
  columnWidths: Record<string, number>;
  /** Per-field filter and sort state. Fields with default state may be omitted. */
  filters: Record<string, ColumnFilter>;
  /** Global quick-filter text matched across all visible columns. Empty string when inactive. */
  quickFilter?: string;
  /** When `true`, rows can be reordered by dragging the control-column handle. */
  allowRowReorder?: boolean;
  /** Field to group rows by, or `null` / omitted for no grouping. */
  groupByField?: string | null;
  /** Fields that are currently hidden from the grid view. */
  hiddenColumns?: string[];
  /** Ordered list of field names defining the column display order. */
  columnOrder?: string[];
  /** Fields that are pinned to the left edge. */
  pinnedColumns?: string[];
  /** Fields that are pinned to the right edge. */
  pinnedRightColumns?: string[];
  /** Ordered list of field names currently sorted, from highest to lowest priority. */
  sortOrder?: string[];
  /** Number of rows per page. `0` means no pagination (show all rows). */
  pageSize?: number;
  /** Current page (1-based). */
  currentPage?: number;
  /**
   * Total row count supplied by the server. When greater than zero the grid enters
   * server-side pagination mode: it no longer slices rows locally and instead emits
   * a `(pageChange)` event so the host can fetch the correct slice.
   */
  totalRows?: number;
  /** Per-field aggregate function set via the column menu. Only built-in string values are serializable. */
  aggregates?: Record<string, 'sum' | 'avg' | 'min' | 'max' | 'count'>;
}

/**
 * Signal-based container for mutable grid UI state such as column widths and active filters.
 *
 * Assign an instance to `AgridProvider.control` so the grid can store runtime state
 * in a place the host component can persist across sessions.
 *
 * @example
 * ```ts
 * // Restore saved state:
 * readonly ctrl = AgridControl.fromJSON(
 *   JSON.parse(localStorage.getItem('grid') ?? '{}')
 * );
 *
 * // Save on demand:
 * localStorage.setItem('grid', JSON.stringify(this.ctrl.toJSON()));
 * ```
 */
export class AgridControl {
  private readonly _columnWidths = signal<Record<string, number>>({});
  private readonly _filters = signal<Record<string, ColumnFilter>>({});
  private readonly _quickFilter = signal<string>('');
  private readonly _allowRowReorder = signal<boolean>(false);
  private readonly _groupByField = signal<string | null>(null);
  private readonly _hiddenColumns  = signal<Set<string>>(new Set());
  private readonly _columnOrder    = signal<string[]>([]);
  private readonly _pinnedColumns      = signal<Set<string>>(new Set());
  private readonly _pinnedRightColumns = signal<Set<string>>(new Set());
  private readonly _pageSize = signal<number>(0);
  private readonly _currentPage = signal<number>(1);
  private readonly _totalRows = signal<number>(0);
  private readonly _aggregates = signal<Record<string, 'sum' | 'avg' | 'min' | 'max' | 'count'>>({});
  private readonly _sortOrder = signal<string[]>([]);
  private readonly _loading = signal(false);
  private readonly _readonly = signal(false);
  private readonly _autoAddRows = signal(false);
  private readonly _rowIndications = signal<ReadonlyMap<number, AgridRowIndication>>(new Map());
  private readonly rowIndicationTimers = new Map<number, ReturnType<typeof setTimeout>[]>();

  /** @param state Optional initial state, e.g. deserialized from storage. */
  constructor(state?: Partial<AgridControlState>) {
    CONTROL_RUNTIME_STATE.set(this, {
      loading: this._loading,
      readonly: this._readonly,
      autoAddRows: this._autoAddRows,
    });
    if (state) this.loadState(state);
  }

  // ── Runtime grid state ────────────────────────────────────────────────────

  /** Whether the grid displays its loading overlay. This transient state is not serialized. */
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  /** Show or hide the grid loading overlay. */
  setLoading(value: boolean): void {
    this._loading.set(value);
  }

  /** Transient row flash indicators keyed by original datasource row index. */
  readonly rowIndications: Signal<ReadonlyMap<number, AgridRowIndication>> =
    this._rowIndications.asReadonly();

  /**
   * Flash one datasource row with `color`, then fade back over `durationMs`.
   * This is transient UI state and is not serialized.
   */
  indicate(rowIndex: number, color: string, durationMs = 1000): void {
    const duration = Math.max(0, durationMs);
    this.clearRowIndicationTimers(rowIndex);
    this._rowIndications.update(current => {
      const next = new Map(current);
      next.set(rowIndex, { color, durationMs: duration, active: true });
      return next;
    });
    const removeTimer = setTimeout(() => {
      this._rowIndications.update(current => {
        if (!current.has(rowIndex)) return current;
        const next = new Map(current);
        next.delete(rowIndex);
        return next;
      });
      this.rowIndicationTimers.delete(rowIndex);
    }, duration);
    this.rowIndicationTimers.set(rowIndex, [removeTimer]);
  }

  private clearRowIndicationTimers(rowIndex: number): void {
    for (const timer of this.rowIndicationTimers.get(rowIndex) ?? []) clearTimeout(timer);
    this.rowIndicationTimers.delete(rowIndex);
  }

  /** Whether all grid editing and mutation UI is disabled. This transient state is not serialized. */
  readonly readonly: Signal<boolean> = this._readonly.asReadonly();

  /** Enable or disable readonly mode at runtime. */
  setReadonly(value: boolean): void {
    this._readonly.set(value);
  }

  /** Whether navigation beyond the final row automatically inserts a row. Not serialized. */
  readonly autoAddRows: Signal<boolean> = this._autoAddRows.asReadonly();

  /** Enable or disable automatic row insertion at runtime. */
  setAutoAddRows(value: boolean): void {
    this._autoAddRows.set(value);
  }

  /**
   * When `true`, the control column shows a drag handle and rows can be
   * reordered by dragging. Requires `showControlColumn` to be enabled on the grid.
   */
  readonly allowRowReorder: Signal<boolean> = this._allowRowReorder.asReadonly();

  /** Enable or disable row reordering at runtime. */
  setAllowRowReorder(value: boolean): void {
    this._allowRowReorder.set(value);
  }

  /**
   * The field currently used to group rows, or `null` when grouping is off.
   * When set, rows are bucketed by the display value of this field and a header
   * row is inserted before each group. Secondary sorts still apply within groups.
   */
  readonly groupByField: Signal<string | null> = this._groupByField.asReadonly();

  /**
   * Enable grouping by `field`, or pass `null` to turn grouping off.
   */
  setGroupBy(field: string | null): void {
    this._groupByField.set(field);
  }

  /**
   * Global quick-filter text. When non-empty (and not in server-side filtering mode),
   * the grid keeps only rows where at least one visible column's display value contains
   * this text (case-insensitive).
   */
  readonly quickFilter: Signal<string> = this._quickFilter.asReadonly();

  /** Set the global quick-filter text. Pass an empty string to clear it. */
  setQuickFilter(text: string): void {
    this._quickFilter.set(text);
  }

  /**
   * Reactive set of field names that are currently hidden.
   * An empty set means all columns are visible.
   */
  readonly hiddenColumns: Signal<Set<string>> = this._hiddenColumns.asReadonly();

  /** Return `true` when the given field is currently hidden. */
  isColumnHidden(field: string): boolean {
    return this._hiddenColumns().has(field);
  }

  /**
   * Show or hide a column by field name.
   * Hiding a column does not clear its filter or sort — they resume when it is shown again.
   */
  setColumnVisibility(field: string, visible: boolean): void {
    this._hiddenColumns.update(set => {
      const next = new Set(set);
      if (visible) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  /** Toggle the visibility of a column. */
  toggleColumnVisibility(field: string): void {
    this.setColumnVisibility(field, this.isColumnHidden(field));
  }

  // ── Column order ──────────────────────────────────────────────────────────

  /**
   * Ordered list of field names that defines the left-to-right column display order.
   * An empty array means "use the original `colDefs` order".
   */
  readonly columnOrder: Signal<string[]> = this._columnOrder.asReadonly();

  /** Replace the entire column order with a new list of field names. */
  setColumnOrder(fields: string[]): void {
    this._columnOrder.set([...fields]);
  }

  /**
   * Move `fromField` to a new position relative to `toField`.
   * `currentVisibleOrder` should be the current `visibleColDefs` field array so the
   * operation works correctly whether or not an order has been set before.
   */
  moveColumn(currentVisibleOrder: string[], fromField: string, toField: string, insertBefore: boolean): void {
    this.moveColumns(currentVisibleOrder, [fromField], toField, insertBefore);
  }

  /**
   * Move an ordered block of fields to a new position relative to `toField`.
   * Fields absent from `currentVisibleOrder` are ignored.
   */
  moveColumns(
    currentVisibleOrder: string[],
    fromFields: readonly string[],
    toField: string,
    insertBefore: boolean,
  ): void {
    const order = [...currentVisibleOrder];
    const moving = order.filter(field => fromFields.includes(field));
    if (moving.length === 0 || moving.includes(toField)) return;
    const remaining = order.filter(field => !moving.includes(field));
    const toIdx = remaining.indexOf(toField);
    if (toIdx === -1) return;
    remaining.splice(insertBefore ? toIdx : toIdx + 1, 0, ...moving);
    this._columnOrder.set(remaining);
  }

  // ── Pinned columns ────────────────────────────────────────────────────────

  /** Reactive set of field names currently pinned to the left edge. */
  readonly pinnedColumns: Signal<Set<string>> = this._pinnedColumns.asReadonly();

  /** Return `true` when the given field is pinned. */
  isPinned(field: string): boolean {
    return this._pinnedColumns().has(field);
  }

  /** Pin or unpin a column to the left edge. Pinning left auto-unpins right. */
  setPinned(field: string, pinned: boolean): void {
    this._pinnedColumns.update(set => {
      const next = new Set(set);
      if (pinned) next.add(field); else next.delete(field);
      return next;
    });
    if (pinned) this._pinnedRightColumns.update(s => { const n = new Set(s); n.delete(field); return n; });
  }

  /** Toggle left-pin state of a column. */
  togglePinned(field: string): void {
    this.setPinned(field, !this.isPinned(field));
  }

  // ── Right pinning ─────────────────────────────────────────────────────────

  /** Reactive set of field names currently pinned to the right edge. */
  readonly pinnedRightColumns: Signal<Set<string>> = this._pinnedRightColumns.asReadonly();

  /** Return `true` when the given field is pinned to the right edge. */
  isPinnedRight(field: string): boolean {
    return this._pinnedRightColumns().has(field);
  }

  /** Pin or unpin a column to the right edge. Pinning right auto-unpins left. */
  setPinnedRight(field: string, pinned: boolean): void {
    this._pinnedRightColumns.update(set => {
      const next = new Set(set);
      if (pinned) next.add(field); else next.delete(field);
      return next;
    });
    if (pinned) this._pinnedColumns.update(s => { const n = new Set(s); n.delete(field); return n; });
  }

  /** Toggle right-pin state of a column. */
  togglePinnedRight(field: string): void {
    this.setPinnedRight(field, !this.isPinnedRight(field));
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  /** Number of rows per page. `0` means all rows are shown (no pagination). */
  readonly pageSize: Signal<number> = this._pageSize.asReadonly();

  /** Current page number (1-based). */
  readonly currentPage: Signal<number> = this._currentPage.asReadonly();

  /** Set rows per page. Pass `0` to disable pagination. Resets to page 1. */
  setPageSize(size: number): void {
    this._pageSize.set(Math.max(0, size));
    this._currentPage.set(1);
  }

  /** Navigate to a specific page (1-based). Clamped to valid range by the grid. */
  setPage(page: number): void {
    this._currentPage.set(Math.max(1, page));
  }

  /**
   * Set the total number of rows available on the server.
   * When greater than zero the grid switches to **server-side pagination mode**:
   * - Rows in the data source are shown as-is (no local slicing).
   * - `totalPages` is derived from this value instead of the local row count.
   * - A `(pageChange)` event is emitted whenever the user navigates to a new page.
   *
   * Pass `0` to return to client-side pagination.
   */
  setTotalRows(count: number): void {
    this._totalRows.set(Math.max(0, count));
  }

  /**
   * Total server-side row count. `0` means client-side mode (grid slices locally).
   */
  readonly totalRows: Signal<number> = this._totalRows.asReadonly();

  // ── Aggregates ────────────────────────────────────────────────────────────

  /** Per-field aggregate overrides set via the column menu. */
  readonly aggregates: Signal<Record<string, 'sum' | 'avg' | 'min' | 'max' | 'count'>> = this._aggregates.asReadonly();

  /**
   * Set or clear the aggregate function for a column.
   * Pass `null` to remove the aggregate (hides the footer cell for that column).
   */
  setAggregate(field: string, fn: 'sum' | 'avg' | 'min' | 'max' | 'count' | null): void {
    this._aggregates.update(a => {
      const next = { ...a };
      if (fn === null) delete next[field];
      else next[field] = fn;
      return next;
    });
  }

  // ── Undo / redo history ────────────────────────────────────────────────────

  private readonly _history = signal<HistoryItem[]>([]);
  private readonly _historyPointer = signal<number>(-1);
  private static readonly MAX_HISTORY = 100;

  /** `true` when there is at least one edit that can be undone. */
  readonly canUndo = computed(() => this._historyPointer() >= 0);

  /** `true` when there is at least one edit that can be re-applied. */
  readonly canRedo = computed(() => this._historyPointer() < this._history().length - 1);

  /**
   * Record a committed cell edit in the history.
   * Calling this discards any redo entries that came after the current pointer.
   * Called automatically by the grid after every cell commit.
   */
  pushEdit(entry: HistoryEntry): void {
    this.pushHistoryItem(entry);
  }

  /** Record a multi-cell edit as one undo/redo step. */
  pushEditBatch(entries: HistoryEntry[]): void {
    if (entries.length === 0) return;
    this.pushHistoryItem(entries.length === 1 ? entries[0] : [...entries]);
  }

  private pushHistoryItem(item: HistoryItem): void {
    const pointer = this._historyPointer();
    const base = this._history().slice(0, pointer + 1);
    base.push(item);
    const trimmed = base.length > AgridControl.MAX_HISTORY
      ? base.slice(base.length - AgridControl.MAX_HISTORY)
      : base;
    this._history.set(trimmed);
    this._historyPointer.set(trimmed.length - 1);
  }

  /**
   * Move one step back in history and return the entry to reverse, or `null` if
   * already at the beginning. The caller is responsible for applying `oldValue`
   * back to the data source.
   */
  undo(): HistoryItem | null {
    const p = this._historyPointer();
    if (p < 0) return null;
    this._historyPointer.set(p - 1);
    return this._history()[p];
  }

  /**
   * Move one step forward in history and return the entry to re-apply, or `null`
   * if already at the end. The caller is responsible for applying `newValue` back
   * to the data source.
   */
  redo(): HistoryItem | null {
    const p = this._historyPointer();
    const h = this._history();
    if (p >= h.length - 1) return null;
    this._historyPointer.set(p + 1);
    return h[p + 1];
  }

  /** Clear the entire undo/redo history. */
  clearHistory(): void {
    this._history.set([]);
    this._historyPointer.set(-1);
  }

  /**
   * Reactive map of `field → pixel width`.
   * Only fields whose width was explicitly overridden are present; the grid falls
   * back to `ColDef.width` for fields not in this map.
   */
  readonly columnWidths: Signal<Record<string, number>> = this._columnWidths.asReadonly();

  /**
   * Reactive map of `field → ColumnFilter`.
   * Only fields with at least one active filter/sort condition are present.
   */
  readonly filters: Signal<Record<string, ColumnFilter>> = this._filters.asReadonly();

  // ── Column widths ──────────────────────────────────────────────────────────

  /**
   * Return the effective width for a column, falling back to `defaultWidth`
   * if no override exists.
   */
  getColumnWidth(field: string, defaultWidth: number): number {
    return this._columnWidths()[field] ?? defaultWidth;
  }

  /**
   * Set the width for a column. Enforces a minimum of 40 px.
   * Called by the grid when the user drags a resize handle.
   */
  setColumnWidth(field: string, width: number): void {
    this._columnWidths.update(w => ({ ...w, [field]: Math.max(40, width) }));
  }

  // ── Filters & sort ─────────────────────────────────────────────────────────

  /**
   * Return the current filter state for a field.
   * Returns a default (inactive) filter when no state is stored for the field.
   */
  getFilter(field: string): ColumnFilter {
    return this._filters()[field] ?? { text: '', selectedValues: null, sort: null };
  }

  /**
   * Set the free-text filter for a column.
   * An empty string removes the text filter for that column.
   */
  setTextFilter(field: string, text: string): void {
    this._filters.update(f => ({
      ...f,
      [field]: { ...this.getFilter(field), text },
    }));
  }

  /**
   * Set the value-picker selection for a column.
   * Pass `null` to show all values (clear the value filter).
   */
  setSelectedValues(field: string, values: string[] | null): void {
    this._filters.update(f => ({
      ...f,
      [field]: { ...this.getFilter(field), selectedValues: values },
    }));
  }

  /**
   * Set a column condition filter. Text columns support string operators while number/date
   * columns support comparison operators.
   * Pass `operator: null` (or an empty `operand`) to clear it. `operand2` is only used
   * by the `'between'` operator.
   */
  setRangeFilter(
    field: string,
    operator: FilterOperator | null,
    operand: string | null,
    operand2: string | null = null,
  ): void {
    this._filters.update(f => ({
      ...f,
      [field]: { ...this.getFilter(field), operator, operand, operand2 },
    }));
  }

  /** Ordered list of sorted field names, from highest to lowest priority. */
  readonly sortOrder: Signal<string[]> = this._sortOrder.asReadonly();

  /** Return the 1-based sort priority of a field, or `0` if it is not sorted. */
  getSortPriority(field: string): number {
    const idx = this._sortOrder().indexOf(field);
    return idx === -1 ? 0 : idx + 1;
  }

  /**
   * Set the sort direction for a column, clearing all other sorts.
   * Pass `null` to remove the sort entirely.
   * For multi-column sort use {@link addSort}.
   */
  setSort(field: string, sort: 'asc' | 'desc' | null): void {
    this._filters.update(f => {
      const next: Record<string, ColumnFilter> = {};
      for (const [k, v] of Object.entries(f)) {
        next[k] = k === field ? { ...v, sort } : { ...v, sort: null };
      }
      if (!next[field]) next[field] = { text: '', selectedValues: null, sort };
      return next;
    });
    this._sortOrder.set(sort ? [field] : []);
  }

  /**
   * Add a column to the multi-sort stack or update its direction.
   * If the column is already sorted, only its direction is updated (priority unchanged).
   * If not yet sorted, it is appended as the lowest-priority sort key.
   */
  addSort(field: string, sort: 'asc' | 'desc'): void {
    this._filters.update(f => ({
      ...f,
      [field]: { ...(f[field] ?? { text: '', selectedValues: null }), sort },
    }));
    this._sortOrder.update(order =>
      order.includes(field) ? order : [...order, field]
    );
  }

  /**
   * Remove all active filters and sort for a single column.
   */
  clearFilter(field: string): void {
    this._filters.update(f => {
      const next = { ...f };
      delete next[field];
      return next;
    });
    this._sortOrder.update(o => o.filter(f => f !== field));
  }

  /** Remove all active filters and sorts for every column, including the quick filter. */
  clearAllFilters(): void {
    this._filters.set({});
    this._sortOrder.set([]);
    this._quickFilter.set('');
  }

  /**
   * Return `true` when the given field has any active filter or sort.
   * Useful for showing a visual indicator on the column header.
   */
  hasActiveFilter(field: string): boolean {
    const f = this.getFilter(field);
    const hasRange = !!f.operator && f.operand != null && f.operand !== '';
    return !!(f.text || f.selectedValues !== null || f.sort || hasRange);
  }

  /** Return `true` when the quick filter or ANY column has an active filter or sort. */
  hasAnyActiveFilter(): boolean {
    return !!this._quickFilter() || Object.values(this._filters()).some(
      f => f.text || f.selectedValues !== null || f.sort
        || (!!f.operator && f.operand != null && f.operand !== '')
    );
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  /**
   * Replace the live serializable state from a plain object.
   * Missing properties reset to their defaults, making a loaded snapshot deterministic.
   * Transient loading, readonly, auto-add, selection, and edit-history state are preserved.
   */
  loadState(state: Partial<AgridControlState>): void {
    this._columnWidths.set({ ...(state.columnWidths ?? {}) });
    this._filters.set({ ...(state.filters ?? {}) });
    this._quickFilter.set(state.quickFilter ?? '');
    this._allowRowReorder.set(state.allowRowReorder ?? false);
    this._groupByField.set(state.groupByField ?? null);
    this._hiddenColumns.set(new Set(state.hiddenColumns ?? []));
    this._columnOrder.set([...(state.columnOrder ?? [])]);
    this._pinnedColumns.set(new Set(state.pinnedColumns ?? []));
    this._pinnedRightColumns.set(new Set(state.pinnedRightColumns ?? []));
    this._pageSize.set(state.pageSize ?? 0);
    this._currentPage.set(state.currentPage ?? 1);
    this._totalRows.set(state.totalRows ?? 0);
    this._aggregates.set({ ...(state.aggregates ?? {}) });
    this._sortOrder.set([...(state.sortOrder ?? [])]);
  }

  /** Serialize current state to a plain object suitable for JSON storage. */
  toJSON(): AgridControlState {
    return {
      columnWidths: { ...this._columnWidths() },
      filters: { ...this._filters() },
      quickFilter: this._quickFilter() || undefined,
      allowRowReorder: this._allowRowReorder(),
      groupByField: this._groupByField() ?? undefined,
      hiddenColumns: [...this._hiddenColumns()],
      columnOrder:   [...this._columnOrder()],
      pinnedColumns:      [...this._pinnedColumns()],
      pinnedRightColumns: [...this._pinnedRightColumns()],
      pageSize: this._pageSize(),
      currentPage: this._currentPage(),
      totalRows: this._totalRows(),
      aggregates: { ...this._aggregates() },
      sortOrder: [...this._sortOrder()],
    };
  }

  /** Restore an `AgridControl` from a previously serialized state. */
  static fromJSON(state: Partial<AgridControlState>): AgridControl {
    return new AgridControl(state);
  }
}

/** @internal Bridge for deprecated writable signals on AgridProvider. */
export function ɵgetAgridControlRuntimeState(control: AgridControl): ɵAgridControlRuntimeState {
  return CONTROL_RUNTIME_STATE.get(control)!;
}
