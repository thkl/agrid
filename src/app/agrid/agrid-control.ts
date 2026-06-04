import { Signal, computed, signal } from '@angular/core';

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

/**
 * Per-column filter state stored inside {@link AgridControl}.
 *
 * All three fields are independent — text, value selection, and sort are ANDed together
 * when computing the visible rows.
 */
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
}

/** Serializable snapshot of the grid's UI state. Used with `toJSON` / `fromJSON`. */
export interface AgridControlState {
  /** Per-field column width overrides in pixels. */
  columnWidths: Record<string, number>;
  /** Per-field filter and sort state. Fields with default state may be omitted. */
  filters: Record<string, ColumnFilter>;
  /** When `true`, rows can be reordered by dragging the control-column handle. */
  allowRowReorder?: boolean;
  /** Field to group rows by, or `null` / omitted for no grouping. */
  groupByField?: string | null;
  /** Fields that are currently hidden from the grid view. */
  hiddenColumns?: string[];
}

/**
 * Signal-based container for mutable grid UI state such as column widths and active filters.
 *
 * Pass an instance to `<agrid [control]="ctrl">` so the grid can store runtime state
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
  private readonly _allowRowReorder = signal<boolean>(false);
  private readonly _groupByField = signal<string | null>(null);
  private readonly _hiddenColumns = signal<Set<string>>(new Set());

  /** @param state Optional initial state, e.g. deserialized from storage. */
  constructor(state?: Partial<AgridControlState>) {
    if (state?.columnWidths) this._columnWidths.set({ ...state.columnWidths });
    if (state?.filters) this._filters.set({ ...state.filters });
    if (state?.allowRowReorder) this._allowRowReorder.set(state.allowRowReorder);
    if (state?.groupByField !== undefined) this._groupByField.set(state.groupByField ?? null);
    if (state?.hiddenColumns?.length) this._hiddenColumns.set(new Set(state.hiddenColumns));
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

  // ── Undo / redo history ────────────────────────────────────────────────────

  private readonly _history = signal<HistoryEntry[]>([]);
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
    const pointer = this._historyPointer();
    const base = this._history().slice(0, pointer + 1);
    base.push(entry);
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
  undo(): HistoryEntry | null {
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
  redo(): HistoryEntry | null {
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
   * Set the sort direction for a column.
   * Passing `null` removes the sort. Only one column may be sorted at a time —
   * activating sort on a field clears the sort from all other fields.
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
  }

  /** Remove all active filters and sorts for every column. */
  clearAllFilters(): void {
    this._filters.set({});
  }

  /**
   * Return `true` when the given field has any active filter or sort.
   * Useful for showing a visual indicator on the column header.
   */
  hasActiveFilter(field: string): boolean {
    const f = this.getFilter(field);
    return !!(f.text || f.selectedValues !== null || f.sort);
  }

  /** Return `true` when ANY column has an active filter or sort. */
  hasAnyActiveFilter(): boolean {
    return Object.values(this._filters()).some(
      f => f.text || f.selectedValues !== null || f.sort
    );
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  /** Serialize current state to a plain object suitable for JSON storage. */
  toJSON(): AgridControlState {
    return {
      columnWidths: { ...this._columnWidths() },
      filters: { ...this._filters() },
      allowRowReorder: this._allowRowReorder(),
      groupByField: this._groupByField() ?? undefined,
      hiddenColumns: [...this._hiddenColumns()],
    };
  }

  /** Restore an `AgridControl` from a previously serialized state. */
  static fromJSON(state: Partial<AgridControlState>): AgridControl {
    return new AgridControl(state);
  }
}
