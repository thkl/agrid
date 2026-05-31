import { Signal, signal } from '@angular/core';

/** Serializable snapshot of the grid's UI state. Used with `toJSON` / `fromJSON`. */
export interface AgridControlState {
  /** Per-field column width overrides in pixels. */
  columnWidths: Record<string, number>;
}

/**
 * Signal-based container for mutable grid UI state such as column widths.
 *
 * Pass an instance to `<agrid [control]="ctrl">` so the grid can store
 * runtime state (e.g. widths set by dragging the resize handle) in a place
 * the host component can persist across sessions.
 *
 * Without a control the grid still supports resizing, but the widths are stored
 * in ephemeral local state that is lost when the component is destroyed.
 *
 * @example
 * ```ts
 * // Restore saved state from localStorage:
 * readonly ctrl = AgridControl.fromJSON(
 *   JSON.parse(localStorage.getItem('grid-control') ?? '{}')
 * );
 *
 * // Save on demand:
 * localStorage.setItem('grid-control', JSON.stringify(this.ctrl.toJSON()));
 * ```
 */
export class AgridControl {
  private readonly _columnWidths = signal<Record<string, number>>({});

  /** @param state Optional initial state, e.g. deserialized from storage. */
  constructor(state?: Partial<AgridControlState>) {
    if (state?.columnWidths) {
      this._columnWidths.set({ ...state.columnWidths });
    }
  }

  /**
   * Reactive map of `field → pixel width`.
   * Only fields whose width was explicitly overridden are present.
   * The grid falls back to `ColDef.width` for fields not in this map.
   */
  readonly columnWidths: Signal<Record<string, number>> = this._columnWidths.asReadonly();

  /**
   * Return the effective width for a column, falling back to `defaultWidth`
   * if no override exists.
   */
  getColumnWidth(field: string, defaultWidth: number): number {
    return this._columnWidths()[field] ?? defaultWidth;
  }

  /**
   * Set the width for a column.
   * Enforces a minimum of 40 px.
   * Called by the grid when the user drags a resize handle.
   */
  setColumnWidth(field: string, width: number): void {
    this._columnWidths.update(w => ({ ...w, [field]: Math.max(40, width) }));
  }

  /** Serialize current state to a plain object suitable for JSON storage. */
  toJSON(): AgridControlState {
    return { columnWidths: { ...this._columnWidths() } };
  }

  /** Restore an `AgridControl` from a previously serialized state. */
  static fromJSON(state: AgridControlState): AgridControl {
    return new AgridControl(state);
  }
}
