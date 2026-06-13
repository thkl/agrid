import type { AgridDataSource } from './agrid-datasource';
import type { AgridProvider } from './agrid-provider';
import type { FilterOperator } from './agrid-control';

/** String-valued property names available on a row type. */
export type AgridField<T extends object> = Extract<keyof T, string>;

/** Global options shared by grid providers. */
export interface AGridOptions {
  /**
   * Locale used for built-in labels, date formatting, and comparisons.
   * Use `'auto'` to resolve the browser locale.
   */
  locale: string;
}

/**
 * A single item in the cell right-click context menu.
 * Pass `null` in the array to render a separator line.
 */
export interface CellContextMenuItem<T extends object = any> {
  /** Label shown in the menu. */
  label: string;
  /** Called when the item is clicked. */
  action: (params: {
    value: T[AgridField<T>];
    row: T;
    field: AgridField<T>;
    originalIndex: number;
  }) => void;
  /** Grays out the item and prevents clicks. */
  disabled?: boolean;
  /** Renders the item in red (destructive action). */
  danger?: boolean;
}

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
export interface ValueOption<TValue = unknown> {
  /** Raw value stored in the data source (e.g. `1`, `'ENG'`). */
  value: TValue;
  /** Human-readable label shown in the cell, dropdown, and filter menu. */
  label: string;
}

/** Width sentinel that makes a column fill the remaining horizontal space. */
export const ColDefAutoSize = -1;

/** Label definition for a group displayed above contiguous column headers. */
export interface HeaderGroup {
  /** Stable identifier referenced by {@link ColDefBase.group}. */
  id: string;
  /** Text displayed in the grouped header row. */
  label: string;
}

/** Defines the behavior shared by every typed column. */
export interface ColDefBase<T extends object, K extends AgridField<T>> {
  /** Data field name — must match a key in the row object. */
  field: K;
  /** Text displayed in the column header. */
  header: string;
  /** Optional header-group identifier configured through `AgridProvider.headerGroups`. */
  group?: string;
  /**
   * Default column width in pixels. Can be overridden at runtime via {@link AgridControl}.
   * Use `-1` (or omit) to make the column auto-scale and fill available space (`1fr`).
   */
  width?: number;
  /**
   * Semantic type of the field.
   * - `'number'` — blank rows initialize this field to `0` instead of `''`; enables numeric
   *   range filters (`>`, `<`, `between`, …) in the column menu.
   * - `'date'` — uses a native date editor and built-in localized display formatting; enables
   *   date range filters (before / after / between) in the column menu.
   * - `'boolean'` — renders an inline checkbox that toggles the value on click (no edit mode).
   */
  type?: 'text' | 'number' | 'date' | 'boolean';
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
  values?: string[] | ValueOption<T[K]>[];
  /**
   * Optional display formatter applied when the column has no `values` list.
   * Receives the raw cell value and returns the string to display in the cell.
   *
   * @example
   * ```ts
   * { field: 'salary', formatter: v => `$${Number(v).toLocaleString()}` }
   * ```
   */
  formatter?: (value: T[K]) => string;
  /**
   * Set to `true` to show a filter input and value-picker in the filter row for this column.
   * At least one filterable column must exist for the filter row to appear.
   */
  filterable?: boolean;
  /**
   * Set to `true` to allow grouping the grid by this column.
   * When set, the filter dropdown shows a "Group by" toggle for this column.
   */
  groupable?: boolean;
  /**
   * Set to `true` to hide this column when the grid first renders.
   * The column remains in the dataset and can be re-shown via the sidebar column picker
   * or programmatically via `AgridControl.setColumnVisibility()`.
   */
  hidden?: boolean;
  /**
   * Pin this column to the left edge of the grid so it stays visible during horizontal scroll.
   * Can also be toggled at runtime via `AgridControl.setPinned()`.
   */
  pinned?: 'left' | 'right';
  /**
   * Aggregate function shown in the footer row for this column.
   * Built-in: `'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`.
   * Pass a custom function to compute any value from the visible row values.
   * The footer only appears when at least one column has `aggregate` set.
   *
   * @example
   * ```ts
   * { field: 'salary', aggregate: 'sum' }
   * { field: 'score',  aggregate: values => values.filter(v => Number(v) > 90).length }
   * ```
   */
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count' | ((values: unknown[]) => unknown);
  /**
   * Return one or more CSS class names to apply to every cell in this column based on the
   * cell's value and row data. Useful for conditional highlighting without a custom renderer.
   *
   * @example
   * ```ts
   * { field: 'score', cellClass: ({ value }) => Number(value) < 50 ? 'cell-danger' : '' }
   * ```
   */
  cellClass?: (params: { value: T[K]; row: T }) => string;
  /**
   * Set to `true` to prevent the column from being resized, reordered, or autosized.
   * The column can still be hidden, filtered, and sorted.
   */
  locked?: boolean;
  /**
   * Validate a committed value before it is written to the row. Return an error message to
   * reject the edit (the value is not written and the message is shown), or `null`/`undefined`
   * to accept it. Runs on inline commit, boolean-checkbox toggle, and sidebar save.
   *
   * @example
   * ```ts
   * { field: 'email', validate: v => /@/.test(String(v)) ? null : 'Invalid email' }
   * ```
   */
  validate?: (value: T[K], row: T) => string | null | undefined;
  /**
   * Custom cell renderer. Returns an HTML string displayed instead of the plain text value.
   * Angular's built-in HTML sanitization is applied automatically.
   *
   * @example
   * ```ts
   * { field: 'status', cellRenderer: ({ value }) =>
   *   `<span class="badge badge-${value}">${value}</span>` }
   * ```
   */
  cellRenderer?: (params: { value: T[K]; row: T }) => string;
}

/**
 * Defines a column whose `field`, formatter value, renderer value, and row are
 * derived from the supplied row type.
 */
export type ColDef<
  T extends object = any,
  K extends AgridField<T> = AgridField<T>,
> = K extends AgridField<T> ? ColDefBase<T, K> : never;

/**
 * Defines a single action shown in the group header's action menu.
 * Pass an array of these to `<agrid [groupActions]="...">`.
 */
export interface GroupAction {
  /** Label shown in the dropdown. */
  label: string;
  /** Called with the group's display label when the item is clicked. */
  action: (groupLabel: string) => void;
}

/**
 * Internal row item used in the virtual scroll list.
 * - `{ row, originalIndex }` — a real data row
 * - `null` — the add-row placeholder
 * - `'ghost'` — the drop-target ghost inserted while dragging
 * - `{ groupLabel, count, collapsed, aggregates? }` — group header row when grouping is active
 *   (`aggregates` holds per-group subtotals when aggregated columns exist)
 * - `{ row, originalIndex, level, expandable, expanded }` — a tree row when tree mode is active
 */
export type GridItem<T extends object = Record<string, unknown>> =
  | { row: T; originalIndex: number }
  | null
  | 'ghost'
  | { groupLabel: string; count: number; collapsed: boolean; aggregates?: Record<string, unknown> }
  | TreeRowItem<T>
  | DetailRowItem<T>;

/**
 * A master/detail panel row rendered immediately beneath its expanded parent data row.
 *
 * Carries the parent's `originalIndex` (so the panel can be re-collapsed and tracked) and the
 * parent `row` (passed to `detailRenderer`). It is intentionally *not* a data-row item — selection,
 * editing, and cell rendering skip it.
 */
export interface DetailRowItem<T extends object = Record<string, unknown>> {
  /** Original index of the parent data row this detail panel belongs to. */
  detailFor: number;
  /** The parent row's data, passed to `detailRenderer`. */
  row: T;
}

/**
 * A data row rendered inside a hierarchical tree.
 *
 * Structurally a superset of the plain `{ row, originalIndex }` data-row item, so it also
 * satisfies {@link GridItem}'s data-row checks — selection, editing, and cell rendering treat
 * it exactly like a flat row. The extra fields drive indentation and the expand/collapse twisty.
 */
export interface TreeRowItem<T extends object = Record<string, unknown>> {
  /** The underlying row object from the data source. */
  row: T;
  /** Zero-based index of the row in the (flat) data source. */
  originalIndex: number;
  /** Depth in the tree. Root rows are `0`; each level of nesting adds `1`. */
  level: number;
  /** `true` when this row has at least one child row in the current projection. */
  expandable: boolean;
  /** `true` when this row is expandable and currently expanded (its children are visible). */
  expanded: boolean;
}

/**
 * Host-supplied configuration that turns the grid into a tree.
 *
 * Hierarchy is expressed over the existing flat row array: every row exposes a stable id and a
 * parent id, so no nested `children` arrays are required and `originalIndex`-based selection and
 * editing keep working unchanged. A row whose `getParentId` is `null`/`undefined` — or whose
 * parent id is not present in the data — is treated as a root.
 *
 * @example
 * ```ts
 * treeConfig: {
 *   getId: row => row.id,
 *   getParentId: row => row.managerId,
 *   treeField: 'name',
 * }
 * ```
 */
export interface AgridTreeConfig<T extends object = any> {
  /** Return a stable, unique id for a row. Used as the expansion key and for parent lookups. */
  getId: (row: T) => string | number;
  /** Return the id of a row's parent, or `null`/`undefined` for a root row. */
  getParentId: (row: T) => string | number | null | undefined;
  /** Field whose cell shows the indentation and expand/collapse twisty. */
  treeField: AgridField<T>;
  /** Expand all nodes when the tree first renders. Defaults to `false` (all collapsed). */
  defaultExpanded?: boolean;
  /**
   * When filtering, keep the ancestors of any matching row visible even if they don't match.
   * Defaults to `true`. (Applied by the projection layer, not by {@link GridItem} flattening.)
   */
  keepAncestorsOnFilter?: boolean;
}

/** Zero-based position of a cell inside the grid. */
export interface CellPosition {
  /** Zero-based row index in the data array. */
  rowIndex: number;
  /** Zero-based column index in {@link ColDef} order. */
  colIndex: number;
}

/**
 * Emitted by `(validationFailed)` when a {@link ColDefBase.validate} hook rejects a committed
 * value. The value is not written to the row.
 */
export interface ValidationFailedEvent<T extends object = any> {
  /** Zero-based index of the row whose edit was rejected. */
  rowIndex: number;
  /** Field that failed validation. */
  field: AgridField<T>;
  /** The rejected value. */
  value: unknown;
  /** Message returned by the `validate` hook. */
  message: string;
  /** Which editing surface produced the rejected edit. */
  source: 'inline' | 'sidebar';
}

/** Emitted by `(cellEdit)` after the user commits a cell change. */
export type GridEditEvent<T extends object = any> = {
  [K in AgridField<T>]: {
    /** Position of the edited cell. */
    position: CellPosition;
    /** The `ColDef.field` that was changed. */
    field: K;
    /** Previous field value before the edit. */
    oldValue: T[K];
    /** New field value after the edit. */
    newValue: T[K];
  }
}[AgridField<T>];

/**
 * Emitted asynchronously after an edit changes a row and the data source has been updated.
 *
 * Unlike {@link GridEditEvent}, this row-level event identifies the provider and
 * data source that own the edited record, which is useful when rendering multiple grids.
 */
export interface RecordEditEvent<T extends object = any> {
  /** Zero-based index of the edited row in the data source. */
  index: number;
  /** Current row data after the edit has been applied. */
  data: T;
  /** Exact provider instance that emitted the event. */
  provider: AgridProvider<T>;
  /** Exact data source containing the edited row. */
  datasource: AgridDataSource<T>;
}

/**
 * Compatibility alias for the provider-aware event emitted by `(rowRemoved)`.
 * @deprecated Use {@link RecordEditEvent}.
 */
export type RowRemovedEvent<T extends object = any> = RecordEditEvent<T>;

/**
 * Emitted by `(rowSelect)` when the selection changes. `null` means all rows were deselected.
 * In `'single'` mode `rows` always has at most one entry.
 */
export interface RowSelectEvent<T extends object = any> {
  /** Selected rows and their original data-source indices. */
  rows: { row: T; originalIndex: number }[];
}

/** Emitted when the user clicks a data row. */
export interface RowClickEvent<T extends object = any> {
  /** Snapshot of the clicked row. */
  row: T;
  /** Zero-based index of the row in the data source. */
  originalIndex: number;
}

/**
 * Emitted after an inline-edited row is left, or after the user saves through the sidebar editor.
 */
export interface RowUpdateEvent<T extends object = any> {
  /** Updated row data. */
  row: T;
  /** Zero-based index of the updated row in the data source. */
  originalIndex: number;
}

/**
 * Emitted by `(rowReorder)` when the user finishes dragging a row to a new position.
 * The grid does **not** reorder data itself — call `dataSource.moveRow(oldIndex, newIndex)`
 * (or your own equivalent) inside the handler.
 */
export interface RowReorderEvent<T extends object = any> {
  /** Snapshot of the row data at drag time. */
  row: T;
  /** Index of the row in the data source before the move. */
  oldIndex: number;
  /**
   * Target position in the data source (insert-before semantics).
   * Pass both `oldIndex` and `newIndex` to {@link AgridDataSource.moveRow}.
   */
  newIndex: number;
}

/**
 * Emitted by `(pageChange)` when the user navigates to a different page in server-side
 * pagination mode (i.e. when `AgridControl.totalRows` is set to a value greater than zero).
 * The host should fetch the rows for `startRow..endRow` from the server and push them into
 * the data source — the grid itself does not slice or filter the data in this mode.
 */
export interface PageChangeEvent {
  /** New page number (1-based). */
  page: number;
  /** Rows per page as configured on `AgridControl`. */
  pageSize: number;
  /** Zero-based index of the first row on this page. */
  startRow: number;
  /** Zero-based index of the last row on this page (inclusive). */
  endRow: number;
}

/** Emitted when a text filter changes in server-side filtering mode. */
export interface FilterChangeEvent {
  /** Field name of the filtered column. */
  field: string;
  /** Current free-text filter value. An empty string clears the text filter. */
  value: string;
  /**
   * Typed range-filter operator for `number` / `date` columns, present only when the change
   * came from the column-menu condition UI. `null` clears the range condition.
   * When set, `value` is empty and the operands live in {@link operand} / {@link operand2}.
   */
  operator?: FilterOperator | null;
  /** Primary range operand (number as string, or `yyyy-mm-dd`). Present with {@link operator}. */
  operand?: string | null;
  /** Upper-bound operand, present only when {@link operator} is `'between'`. */
  operand2?: string | null;
}

/** Emitted when a sort changes in server-side filtering mode. */
export interface SortChangeEvent {
  /** Field name of the sorted column. */
  field: string;
  /** Current direction. `null` clears the sort. */
  direction: 'asc' | 'desc' | null;
}

/**
 * Emitted by `(prepareAddRecord)` when the grid has inserted a blank row.
 * Use this to populate the new row with real defaults via {@link AgridDataSource.updateRow} or
 * {@link AgridDataSource.patchRow}.
 */
export interface NewRecord<T extends object = any> {
  /** Index at which the blank row was inserted in the data source. */
  index: number;
  /** The empty row object the grid created (field values are `''` / `0` by type). */
  data: T;
  /** Exact provider instance that emitted this event. Useful when rendering multiple grids. */
  provider: AgridProvider<T>;
  /** Exact data source containing the inserted row. */
  datasource: AgridDataSource<T>;
}
