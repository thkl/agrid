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
   * Fixed list of allowed values.
   * When provided, the cell editor renders a `<select>` dropdown instead of a free-text `<input>`.
   */
  values?: string[];
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
