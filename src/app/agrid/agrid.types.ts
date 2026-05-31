/**
 * A structured value option used when the data field stores a raw value (e.g. a numeric ID)
 * but the cell should display a human-readable label.
 *
 * @example
 * ```ts
 * values: [
 *   { value: 1, label: 'Engineering' },
 *   { value: 2, label: 'Sales' },
 * ]
 * ```
 */
export interface ValueOption {
  /** Raw value stored in the data source (e.g. `1`, `'ENG'`). */
  value: unknown;
  /** Human-readable label shown in the cell, dropdown, and filter menu. */
  label: string;
}

/** Defines a single column in the grid. */
export interface ColDef {
  /** Data field name — must match a key in the row object. */
  field: string;
  /** Text displayed in the column header. */
  header: string;
  /** Default column width in pixels. Can be overridden at runtime via {@link AgridControl}. */
  width: number;
  /**
   * Semantic type of the field.
   * - `'number'` — blank rows initialize this field to `0` instead of `''`.
   * - `'date'` — reserved for future typed editors.
   */
  type?: 'text' | 'number' | 'date';
  /**
   * Set to `false` to make the column read-only.
   * Defaults to `true` (editable) when omitted.
   */
  editable?: boolean;
  /**
   * Fixed list of allowed values shown in a `<select>` dropdown when editing.
   *
   * - `string[]` — simple list; the stored value equals the displayed label.
   * - `ValueOption[]` — structured list; the stored value (`value`) differs from the
   *   displayed label (`label`). Useful when the dataset stores IDs but should show names.
   */
  values?: string[] | ValueOption[];
  /**
   * Optional display formatter applied when the column has no `values` list.
   * Receives the raw cell value and returns the string to display in the cell.
   *
   * @example
   * ```ts
   * { field: 'salary', formatter: v => `$${Number(v).toLocaleString()}` }
   * ```
   */
  formatter?: (value: unknown) => string;
  /**
   * Set to `true` to show a filter input and value-picker in the filter row for this column.
   * At least one filterable column must exist for the filter row to appear.
   */
  filterable?: boolean;
}

/** Zero-based position of a cell inside the grid. */
export interface CellPosition {
  /** Zero-based row index in the data array. */
  rowIndex: number;
  /** Zero-based column index in {@link ColDef} order. */
  colIndex: number;
}

/** Emitted by `(cellEdit)` after the user commits a cell change. */
export interface GridEditEvent {
  /** Position of the edited cell. */
  position: CellPosition;
  /** The `ColDef.field` that was changed. */
  field: string;
  /** Previous field value before the edit. */
  oldValue: unknown;
  /** New field value after the edit. */
  newValue: unknown;
}

/**
 * Emitted by `(rowReorder)` when the user finishes dragging a row to a new position.
 * The grid does **not** reorder data itself — call `dataSource.moveRow(oldIndex, newIndex)`
 * (or your own equivalent) inside the handler.
 */
export interface RowReorderEvent {
  /** Snapshot of the row data at drag time. */
  row: Record<string, unknown>;
  /** Index of the row in the data source before the move. */
  oldIndex: number;
  /**
   * Target position in the data source (insert-before semantics).
   * Pass both `oldIndex` and `newIndex` to {@link AgridDataSource.moveRow}.
   */
  newIndex: number;
}

/**
 * Emitted by `(prepareAddRecord)` when the grid has inserted a blank row.
 * Use this to populate the new row with real defaults via {@link AgridDataSource.updateRow} or
 * {@link AgridDataSource.patchRow}.
 */
export interface NewRecord {
  /** Index at which the blank row was inserted in the data source. */
  index: number;
  /** The empty row object the grid created (field values are `''` / `0` by type). */
  data: Record<string, unknown>;
}
