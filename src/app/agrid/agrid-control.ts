import { Signal, signal } from '@angular/core';

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

  /** @param state Optional initial state, e.g. deserialized from storage. */
  constructor(state?: Partial<AgridControlState>) {
    if (state?.columnWidths) this._columnWidths.set({ ...state.columnWidths });
    if (state?.filters) this._filters.set({ ...state.filters });
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
    };
  }

  /** Restore an `AgridControl` from a previously serialized state. */
  static fromJSON(state: Partial<AgridControlState>): AgridControl {
    return new AgridControl(state);
  }
}
