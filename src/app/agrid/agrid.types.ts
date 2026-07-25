import type { AgridDataSource } from './agrid-datasource';
import type { AgridProvider } from './agrid-provider';
import type { ColumnFilter, FilterOperator } from './agrid-control';
import type { Signal, Type } from '@angular/core';

/** String-valued property names available on a row type. */
export type AgridField<T extends object> = Extract<keyof T, string>;

/** Aggregate functions shared by footers, groups, tree rollups, and pivot values. */
export type AgridAggregate =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | ((values: unknown[]) => unknown);

/**
 * Client-side pivot-table configuration.
 *
 * The initial pivot implementation supports one row dimension, one column dimension, and one
 * value field. The resulting table is derived from the datasource and is always read-only.
 */
export interface AgridPivotConfig<T extends object = any> {
  /** Source field whose distinct values become pivot rows. */
  rowField: AgridField<T>;
  /** Source field whose distinct values become generated pivot columns. */
  columnField: AgridField<T>;
  /** Source field aggregated at each row/column intersection. */
  valueField: AgridField<T>;
  /** Aggregate applied to each intersection. Defaults to `'sum'`. */
  aggregate?: AgridAggregate;
}

/** Behavior after pressing Enter while an inline cell editor is active. */
export type AgridEnterEditAction = 'nothing' | 'nextColumn' | 'nextRow';

/** Parameters passed to a row-aware cell readonly resolver. */
export interface CellReadonlyParams<
  T extends object = any,
  K extends AgridField<T> = AgridField<T>,
> {
  /** Datasource row containing the cell. */
  row: T;
  /** Current raw field value. */
  value: T[K];
  /** Column definition for the cell. */
  column: ColDef<T, K>;
  /** Zero-based index of the row in the datasource. */
  originalIndex: number;
}

/** Parameters passed to a row-aware cell formatting resolver. */
export type CellFormatParams<
  T extends object = any,
  K extends AgridField<T> = AgridField<T>,
> = CellReadonlyParams<T, K>;

/** Parameters passed to a row-aware horizontal cell-span resolver. */
export type CellSpanParams<
  T extends object = any,
  K extends AgridField<T> = AgridField<T>,
> = CellReadonlyParams<T, K>;

/** Supported visual overrides returned by {@link ColDefBase.cellFormat}. */
export interface CellFormat {
  /** CSS background color, such as `'#fff4cc'` or `'var(--warning-bg)'`. */
  backgroundColor?: string;
  /** CSS border color. The cell's existing right and bottom borders use this color. */
  borderColor?: string;
  /** CSS text color. */
  color?: string;
  /** CSS `font` shorthand. Individual font properties below can override parts of it. */
  font?: string;
  /** CSS font family. */
  fontFamily?: string;
  /** CSS font size, including its unit (for example `'0.875rem'`). */
  fontSize?: string;
  /** CSS font style. */
  fontStyle?: 'normal' | 'italic' | 'oblique' | string;
  /** CSS font weight. */
  fontWeight?: string | number;
  /** CSS text decoration. */
  textDecoration?: string;
  /** CSS horizontal text alignment. */
  textAlign?: 'left' | 'right' | 'center' | 'justify' | string;
}

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

/** Cell and row context used to resolve dynamic cell right-click menu items. */
export interface CellContextMenuParams<T extends object = any> {
  /** Row object that owns the cell. */
  row: T;
  /** Cell identity and current value. */
  cell: {
    value: T[AgridField<T>];
    field: AgridField<T>;
    colIndex: number;
    originalIndex: number;
  };
}

/** Current grid state supplied to menu-bar visibility, active, and disabled resolvers. */
export interface AgridMenuBarContext<T extends object = any> {
  /** Current datasource rows. */
  rows: readonly T[];
  /** Currently selected rows with their original datasource indices. */
  selectedRows: readonly { row: T; originalIndex: number }[];
  /** Currently selected cell, or `null`. */
  selectedCell: CellPosition | null;
  /** Provider that owns the menu bar. */
  provider: AgridProvider<T>;
  /** Datasource that owns the current rows. */
  datasource: AgridDataSource<T>;
}

/** Static or runtime-resolved menu-bar state. */
export type AgridMenuBarState<T extends object = any> =
  | boolean
  | ((context: AgridMenuBarContext<T>) => boolean);

/** Shared configuration for menu-bar buttons and dropdown items. */
export interface AgridMenuBarMenuItem<T extends object = any> {
  /** Stable command id emitted through `(menuBarAction)`. */
  id: string;
  /** Visible command label. */
  label: string;
  /** Optional compact icon or glyph shown before the label. */
  icon?: string;
  /** Whether the command is rendered. Defaults to `true`. */
  visible?: AgridMenuBarState<T>;
  /** Whether the command receives active styling. Defaults to `false`. */
  active?: AgridMenuBarState<T>;
  /** Whether the command is disabled. Defaults to `false`. */
  disabled?: AgridMenuBarState<T>;
  /** Additional classes */
  class?:string;
}

/** Top-level menu-bar button with optional additional dropdown commands. */
export interface AgridMenuBarItem<T extends object = any>
  extends AgridMenuBarMenuItem<T> {
  /** Additional commands opened from the button's dropdown chevron. */
  items?: AgridMenuBarMenuItem<T>[];
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

/**
 * Built-in editor surfaces available without registering a custom Angular component.
 *
 * - `'text'` uses the default single-line input.
 * - `'largeText'` uses a multiline textarea for longer content.
 * - `'richSelect'` uses a searchable select surface backed by `values` or `asyncValues`.
 * - `'formula'` uses a formula-friendly input. Pair it with {@link ColDefBase.formula} to
 *   evaluate strings that start with `=`.
 */
export type AgridBuiltInEditor = 'text' | 'largeText' | 'richSelect' | 'formula';

/** Parameters passed to {@link ColDefBase.asyncValues} when the rich-select editor opens. */
export interface AsyncValueOptionsParams<
  T extends object = any,
  K extends AgridField<T> = AgridField<T>,
> {
  /** Row currently being edited. */
  row: T;
  /** Current raw value stored in the edited cell. */
  value: T[K];
  /** Column definition for the edited cell. */
  column: ColDef<T, K>;
  /** Original datasource index for the edited row. */
  originalIndex: number;
}

/**
 * Sync or async value options used by the built-in rich-select editor.
 *
 * Strings are stored and displayed as-is. {@link ValueOption} entries display `label` while
 * committing `value` into the datasource.
 */
export type AgridAsyncValues<TValue = unknown> =
  | readonly (string | ValueOption<TValue>)[]
  | Promise<readonly (string | ValueOption<TValue>)[]>;

/** Width sentinel that makes a column fill the remaining horizontal space. */
export const ColDefAutoSize = -1;

/** Label definition for a group displayed above contiguous column headers. */
export interface HeaderGroup {
  /** Stable identifier referenced by {@link ColDefBase.group}. */
  id: string;
  /** Text displayed in the grouped header row. */
  label: string;
}

/** Custom command appended to a column's header menu. */
export interface AgridColumnHeaderMenuItem {
  /** Stable key emitted through `(columnHeaderAction)`. */
  key: string;
  /** Visible command label. */
  label: string;
  /** Optional compact icon or glyph shown before the label. */
  icon?: string;
  /** Disable the command without hiding it. */
  disabled?: boolean;
  /** Class a optional classes for the icon */
  iconClasses?: string[];
  /** Classes to apply on the complete button */
  itemClasses?: string[];
}

/** Defines the behavior shared by every typed column. */
export interface ColDefBase<T extends object, K extends AgridField<T>> {
  /** Data field name — must match a key in the row object. */
  field: K;
  /** Text displayed in the column header. */
  header: string;
  /** Optional header-group identifier configured through `AgridProvider.headerGroups`. */
  group?: string;
  /** Custom commands appended to this column's header menu. */
  headerMenuItems?: AgridColumnHeaderMenuItem[];
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
   * Return `true` to make this specific cell read-only at runtime.
   * Runs with the current row, value, column definition, and original datasource index.
   * `editable: false` still makes the whole column read-only before this callback is checked.
   *
   * @example
   * ```ts
   * { field: 'approval', cellReadonly: ({ row }) => row.status !== 'Draft' }
   * ```
   */
  cellReadonly?: (params: CellReadonlyParams<T, K>) => boolean;
  /**
   * Return visual overrides for this specific cell at runtime.
   * Runs with the current row, value, column definition, and original datasource index.
   * Return `null` or `undefined` to use the grid's normal styling.
   *
   * @example
   * ```ts
   * {
   *   field: 'balance',
   *   cellFormat: ({ value }) => value < 0
   *     ? { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 600 }
   *     : undefined,
   * }
   * ```
   */
  cellFormat?: (params: CellFormatParams<T, K>) => CellFormat | null | undefined;
  /**
   * Default horizontal alignment for every cell in this column.
   * A `textAlign` returned by {@link cellFormat} overrides this value for that cell.
   */
  textAlign?: 'left' | 'center' | 'right' | Signal<'left' | 'center' | 'right'>;
  /**
   * Number of adjacent visible columns occupied by this cell.
   *
   * Spans are clamped to the current left-pinned, scrollable, or right-pinned pane and never
   * cross a pane boundary. Covered cells remain part of the data model but are not rendered.
   * Return `1` (the default) to render a normal cell.
   *
   * @example
   * ```ts
   * { field: 'name', colSpan: ({ row }) => row.isSummary ? 3 : 1 }
   * ```
   */
  colSpan?: number | ((params: CellSpanParams<T, K>) => number);
  /**
   * Fixed list of allowed values shown in a `<select>` dropdown when editing.
   *
   * - `string[]` — simple list; the stored value equals the displayed label.
   * - `ValueOption[]` — structured list; the stored value (`value`) differs from the
   *   displayed label (`label`). Useful when the dataset stores IDs but should show names.
   */
  values?: string[] | ValueOption<T[K]>[];
  /**
   * Built-in editor to use for this column.
   * - `'richSelect'` renders a searchable select surface and can load async values.
   * - `'largeText'` renders a multiline textarea for longer notes.
   * - `'formula'` renders a formula input. Pair with `formula: true` to evaluate formulas.
   * - `'text'` forces the default text input.
   */
  editor?: AgridBuiltInEditor;
  /**
   * Values loaded when the built-in rich-select editor opens. Use this for large or remote option
   * lists. Static `values` are used immediately; `asyncValues` can return a Promise.
   */
  asyncValues?: (params: AsyncValueOptionsParams<T, K>) => AgridAsyncValues<T[K]>;
  /**
   * Evaluate strings beginning with `=` as row-local formulas for display, filtering, and export.
   * Formulas support arithmetic, parentheses, and field-name references from the same row.
   */
  formula?: boolean;
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
   * Resolve an input mask for this specific string cell. The callback receives the current
   * row, cell value, and column definition, so different rows in one column can use different
   * regular expressions. Return `null` or `undefined` to leave the cell unrestricted.
   *
   * The expression is matched against the complete proposed editor value. It should accept
   * partial values so the user can build the final value one character at a time.
   *
   * @example
   * ```ts
   * {
   *   field: 'reference',
   *   inputMask: ({ row }) => row.numeric
   *     ? /\d{0,3}(?:-\d{0,5}(?:-\d{0,5})?)?/
   *     : /[a-z0-9]{0,3}(?: [a-z0-9]{0,3}(?: [a-z0-9]{0,5})?)?/i,
   * }
   * ```
   */
  inputMask?: (params: InputMaskParams<T, K>) => RegExp | null | undefined;
  /**
   * Set to `true` to show a filter input and value-picker in the filter row for this column.
   * At least one filterable column must exist for the filter row to appear.
   */
  filterable?: boolean;
  /**
   * Custom component rendered inside this column's filter menu.
   * The component injects `AGRID_FILTER_CONTEXT` to read and update the field filter.
   */
  filterComponent?: Type<unknown>;
  /**
   * Maximum number of value-filter choices rendered at once. Search still runs against the full
   * value list, then caps the displayed matches. Defaults to `250`.
   */
  filterValueLimit?: number;
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
  aggregate?: AgridAggregate;
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
   * Custom component rendered for the cell's display (read) state, instead of the plain text value.
   * The component injects {@link AGRID_RENDERER_CONTEXT} to read the value, row, and column. Unlike
   * {@link cellRenderer}, this supports full Angular bindings, event handlers, and child components
   * with no manual escaping.
   *
   * @example
   * ```ts
   * { field: 'status', cellRendererComponent: StatusBadgeComponent }
   * ```
   */
  cellRendererComponent?: Type<unknown>;
  /**
   * Custom cell renderer. Returns an HTML string displayed instead of the plain text value.
   * Angular's built-in HTML sanitization is applied automatically.
   *
   * @deprecated Use {@link cellRendererComponent} instead. A component renderer supports Angular
   * bindings and event handlers, and avoids the HTML-string escaping/sanitization caveats. The
   * string renderer remains supported for now but will be removed in a future release.
   *
   * @example
   * ```ts
   * { field: 'status', cellRenderer: ({ value }) =>
   *   `<span class="badge badge-${value}">${value}</span>` }
   * ```
   */
  cellRenderer?: (params: { value: T[K]; row: T }) => string;
  /**
   * Custom editor component shown while the cell is in edit mode, instead of the built-in
   * text input / dropdown / checkbox. The component injects {@link AGRID_EDITOR_CONTEXT} to read
   * the current value and stage drafts; the grid keeps ownership of validation, history, and the
   * commit/cancel lifecycle, so Tab, Enter, and Escape work without extra wiring.
   *
   * @example
   * ```ts
   * { field: 'rating', cellEditor: RatingEditor }
   * ```
   */
  cellEditor?: Type<unknown>;
  /**
   * Show a right-aligned info button in this column's cells.
   * Pass a predicate to show it only for selected rows or values.
   */
  infoIcon?: boolean | ((params: { value: T[K]; row: T }) => boolean);
}

/**
 * Defines a column whose `field`, formatter value, renderer value, and row are
 * derived from the supplied row type.
 */
export type ColDef<
  T extends object = any,
  K extends AgridField<T> = AgridField<T>,
> = K extends AgridField<T> ? ColDefBase<T, K> : never;

/** Parameters passed to a row-aware {@link ColDefBase.inputMask} resolver. */
export interface InputMaskParams<
  T extends object = any,
  K extends AgridField<T> = AgridField<T>,
> {
  row: T;
  value: T[K];
  column: ColDef<T, K>;
}

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

/** Parameters passed to a master/detail text-template action. */
export interface DetailActionParams<T extends object = any> {
  /** Row shown by the expanded detail panel. */
  row: T;
  /** Original datasource index of the row. */
  rowIndex: number;
}

/**
 * One group's export payload: its label, member rows in display order, and the per-column
 * subtotal map. Produced for grouped exports so formats that support it (e.g. `.xlsx`) can emit
 * collapsible outlines with subtotal rows. @internal
 */
export interface AgridExportGroup {
  label: string;
  rows: Record<string, unknown>[];
  /** Per-column aggregate values (field → value), only for columns with a configured aggregate. */
  aggregates: Record<string, unknown>;
}

/** Text-template button shown above the editable master/detail textarea. */
export interface DetailAction<T extends object = any> {
  id: string;
  /** Button text. */
  label: string;
  /** Text inserted into the detail textarea, or a row-aware resolver. */
  text?: string | ((params: DetailActionParams<T>) => string);
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
  | { loading: true; originalIndex: number }
  | null
  | 'ghost'
  | { groupLabel: string; count: number; collapsed: boolean; aggregates?: Record<string, unknown> }
  | TreeRowItem<T>
  | PathTreeNodeItem
  | DetailRowItem<T>;

/** A generated, display-only branch node produced by path-based tree data. */
export interface PathTreeNodeItem {
  /** Stable UUID for this generated branch node. */
  uuid: string;
  /** Stable expansion id derived from the complete path to this node. */
  pathNodeId: string;
  /** Segment label shown for this branch. */
  pathLabel: string;
  /** Zero-based depth in the generated tree. */
  level: number;
  /** Path branch nodes always have descendants. */
  expandable: true;
  /** Whether the branch's descendants are currently visible. */
  expanded: boolean;
  /**
   * Field-to-value rollups computed from all datasource leaves below this generated branch.
   * Present only when the grid enables {@link AgridTreeConfig.aggregateTreeNodes}; standalone
   * trees do not compute column aggregates.
   * @internal
   */
  aggregates?: Record<string, unknown>;
}

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
  /** Optional display-only label for the tree cell, used by path-based trees. */
  treeLabel?: string;
  /**
   * Field-to-value rollups computed from this node's descendant leaves. Parent rows are excluded
   * so a stored subtotal is not counted again. Present only for expandable rows when enabled.
   * @internal
   */
  aggregates?: Record<string, unknown>;
}

/**
 * Host-supplied configuration that turns the grid into a tree.
 *
 * Hierarchy is expressed over the existing flat row array using either stable id/parent-id
 * accessors or a path accessor. Path mode creates display-only branch nodes while leaves retain
 * their original datasource indices, so selection, editing, and persistence remain row-based.
 *
 * @example
 * ```ts
 * treeConfig: {
 *   getId: row => row.id,
 *   getParentId: row => row.managerId,
 *   treeField: 'name',
 * }
 *
 * // Or derive branches from a delimited field:
 * treeConfig: {
 *   getPath: row => row.oz.split('.'),
 *   treeField: 'oz',
 * }
 * ```
 */
interface AgridTreeConfigBase<T extends object> {
  /** Field whose cell shows the indentation and expand/collapse twisty. */
  treeField: AgridField<T>;
  /**
   * Expand nodes when the tree first renders. Defaults to `false` (all collapsed).
   *
   * Pass `true` to expand every expandable node, or a row predicate to choose which
   * datasource-backed nodes start expanded. In path-tree mode, a matching row expands the
   * generated branch path that contains that row.
   */
  defaultExpanded?: boolean | ((row: T) => boolean);
  /**
   * When filtering, keep the ancestors of any matching row visible even if they don't match.
   * Defaults to `true`. (Applied by the projection layer, not by {@link GridItem} flattening.)
   */
  keepAncestorsOnFilter?: boolean;
  /**
   * Display aggregate-column rollups on expandable nodes in `AgridComponent` tree mode.
   *
   * Parent/id trees aggregate descendant leaves and deliberately exclude intermediate parent
   * values to avoid counting stored subtotals twice. Generated path branches aggregate every
   * datasource leaf below that branch. Expansion does not affect the result, while active filters
   * limit the contributing leaves. Aggregate cells on datasource-backed parents are display-only.
   *
   * The function comes from {@link ColDef.aggregate} or a runtime
   * `AgridControl.setAggregate()` override. The standalone `AgridTreeComponent` has no columns and
   * therefore ignores this option.
   *
   * @default false
   * @example
   * ```ts
   * const columns = [
   *   { field: 'name', header: 'Name' },
   *   { field: 'amount', header: 'Amount', aggregate: 'sum' },
   * ];
   *
   * const treeConfig = {
   *   getId: row => row.id,
   *   getParentId: row => row.parentId,
   *   treeField: 'name',
   *   aggregateTreeNodes: true,
   * };
   * ```
   */
  aggregateTreeNodes?: boolean;
}

/** Tree configuration for rows that already expose stable id and parent-id values. */
export interface AgridParentTreeConfig<T extends object = any> extends AgridTreeConfigBase<T> {
  /** Return a stable, unique id for a row. Used as the expansion key and for parent lookups. */
  getId: (row: T) => string | number;
  /** Return the id of a row's parent, or `null`/`undefined` for a root row. */
  getParentId: (row: T) => string | number | null | undefined;
  getPath?: never;
}

/** Values supplied when formatting one path-tree segment for display. */
export interface AgridPathSegmentParams<T extends object = any> {
  /** Datasource row that produced this path. Shared branches use the first matching row. */
  row: T;
  /** Raw segment returned by `getPath`. */
  segment: string | number;
  /** Zero-based position of the segment in the path. */
  level: number;
  /** Raw path prefix ending at this segment. */
  path: readonly (string | number)[];
  /** Whether this segment represents the datasource-backed leaf row. */
  leaf: boolean;
}

/** Tree configuration that derives display-only branch nodes from each row's path segments. */
export interface AgridPathTreeConfig<T extends object = any> extends AgridTreeConfigBase<T> {
  /** Return ordered path segments, for example `['01', '01', '0001']`. */
  getPath: (row: T) => readonly (string | number)[];
  /**
   * Return a stable UUID for generated branch nodes created from this row.
   * Shared branches use the first matching row, matching {@link formatPathSegment}.
   */
  nodeUuid?: (row: T) => string | number;
  /**
   * Return a stable UUID for generated branch nodes created from this row.
   * @deprecated Use {@link nodeUuid}. Kept as a compatibility alias for the original typo.
   */
  nodeUUid?: (row: T) => string | number;
  /** Format a segment for display without changing its identity, grouping, or sort order. */
  formatPathSegment?: (params: AgridPathSegmentParams<T>) => string;
  getId?: never;
  getParentId?: never;
}

/** Supported tree data modes: explicit parent links or generated path segments. */
export type AgridTreeConfig<T extends object = any> =
  | AgridParentTreeConfig<T>
  | AgridPathTreeConfig<T>;

/** Selection behavior for the standalone tree control. */
export type AgridTreeSelectionMode = 'none' | 'single' | 'multi';

/** Normalized row or generated-branch event emitted by the standalone tree control. */
export interface AgridTreeNodeEvent<T extends object = any> {
  kind: 'row' | 'branch';
  id: string | number;
  uuid?: string;
  label: string;
  level: number;
  expandable: boolean;
  expanded: boolean;
  row?: T;
  originalIndex?: number;
}

/** Context-menu item rendered for a standalone tree node. */
export interface AgridTreeContextMenuItem {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  confirm?: {
    title?: string;
    message: string;
    confirmLabel?: string;
  };
}

/** Emitted when a standalone tree context-menu item is selected. */
export interface AgridTreeNodeMenuAction<T extends object = any> {
  id: string;
  node: AgridTreeNodeEvent<T>;
}

/** Current standalone-tree selection after a user interaction. */
export interface AgridTreeSelectionEvent<T extends object = any> {
  nodes: AgridTreeNodeEvent<T>[];
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
  source: 'inline' | 'sidebar' | 'detail';
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

/** Emitted when the optional info button inside a cell is clicked. */
export type CellInfoEvent<T extends object = any> = {
  [K in AgridField<T>]: {
    /** Datasource row containing the clicked cell. */
    row: T;
    /** Column field containing the clicked info button. */
    field: K;
    /** Current raw field value. */
    value: T[K];
    /** Zero-based index of the row in the datasource. */
    originalIndex: number;
    /** Column definition for the clicked cell. */
    column: ColDef<T, K>;
  }
}[AgridField<T>];

/** Current selected row returned by {@link AgridComponent.getCurrentRow}. */
export interface AgridCurrentRow<T extends object = any> {
  /** Selected datasource row. */
  row: T;
  /** Zero-based row index in the datasource. */
  originalIndex: number;
}

/** Current selected cell returned by {@link AgridComponent.getCurrentCell} and emitted by `(cellSelect)`. */
export type AgridCurrentCell<T extends object = any> = {
  [K in AgridField<T>]: {
    /** Selected cell position. */
    position: CellPosition;
    /** Datasource row containing the selected cell. */
    row: T;
    /** Zero-based row index in the datasource. */
    originalIndex: number;
    /** Selected column field. */
    field: K;
    /** Current raw field value. */
    value: T[K];
    /** Column definition for the selected cell. */
    column: ColDef<T, K>;
  }
}[AgridField<T>];

/** Emitted when the selected cell changes. `null` means the cell selection was cleared. */
export type CellSelectEvent<T extends object = any> = AgridCurrentCell<T>;

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

/** Emitted when a row is marked or unmarked through the row header or marker checkbox. */
export interface RowMarkEvent<T extends object = any> {
  /** Row whose mark state changed. */
  row: T;
  /** Zero-based index of the row in the data source. */
  originalIndex: number;
  /** Current mark state after the interaction. */
  marked: boolean;
}

/** Emitted when a column is marked or unmarked from its header. */
export interface ColumnMarkEvent<T extends object = any> {
  column: ColDef<T>;
  field: AgridField<T>;
  marked: boolean;
}

/** Emitted when a custom column-header menu command is selected. */
export interface ColumnHeaderActionEvent<T extends object = any> {
  column: ColDef<T>;
  key: string;
}

/** Emitted once after the grid first renders with rows from its active datasource. */
export interface FirstDataRenderedEvent<T extends object = any> {
  /** Rows present in the datasource for the first non-empty render. */
  rows: readonly T[];
  /** Number of rows present for that render. */
  rowCount: number;
  /** Provider attached to the rendered grid. */
  provider: AgridProvider<T>;
  /** Active datasource that supplied the rows. */
  datasource: AgridDataSource<T>;
}

/** Live numeric statistics for the active cell or range selection. */
export interface AgridSelectionSummary {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

/** Emitted when the user clicks a data row. */
export interface RowClickEvent<T extends object = any> {
  /** Snapshot of the clicked row. */
  row: T;
  /** Zero-based index of the row in the data source. */
  originalIndex: number;
}

/** Emitted when the user clicks or double-clicks a generated path-tree branch node. */
export interface TreeNodeClickEvent {
  /** Stable UUID for the generated branch node. */
  uuid: string;
  /** Stable expansion id derived from the complete path to this node. */
  pathNodeId: string;
  /** Segment label shown for this branch. */
  pathLabel: string;
  /** Zero-based depth in the generated tree. */
  level: number;
  /** Whether the branch's descendants are currently visible. */
  expanded: boolean;
  /** Snapshot of the generated branch node. */
  node: PathTreeNodeItem;
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

export interface RowDetailActionEvent<T extends object = any> {
  /** the id of the button */
  id: string;
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

/** Sort entry used by server-side query snapshots. */
export interface AgridServerSort {
  /** Field name of the sorted column. */
  field: string;
  /** Sort direction for this field. */
  direction: 'asc' | 'desc';
}

/**
 * Complete server-side query snapshot derived from `AgridControl`.
 *
 * It is emitted by `(serverQueryChange)` and published as `AgridProvider.serverQuery` whenever
 * `serverSideFiltering` is enabled or `AgridControl.totalRows` enables server-side pagination.
 * `endRow` follows the existing `(pageChange)` event: it is inclusive. Server totals are not part
 * of the query so updating `control.setTotalRows(...)` after a response does not itself trigger a
 * second fetch.
 */
export interface AgridServerQuery {
  /** Active column filters keyed by field. */
  filters: Readonly<Record<string, ColumnFilter>>;
  /** Ordered sort stack after the grid's `sortOption` is applied. */
  sort: readonly AgridServerSort[];
  /** Global quick-filter text. Empty string when inactive. */
  quickFilter: string;
  /** Current page number (1-based). */
  page: number;
  /** Rows per page. `0` means no page size is configured. */
  pageSize: number;
  /** Zero-based index of the first requested row. */
  startRow: number;
  /** Zero-based index of the last requested row (inclusive), or `-1` when no rows are known. */
  endRow: number;
}

/** Emitted when a header text, value, or column-menu condition changes server-side. */
export interface FilterChangeEvent {
  /** Field name of the filtered column. */
  field: string;
  /** Current free-text filter value. An empty string clears the text filter. */
  value: string;
  /**
   * Current value-checklist selection.
   * `null` means all values are selected / no value filter is active.
   */
  selectedValues?: readonly string[] | null;
  /**
   * Text, number, or date condition operator from the column-menu UI.
   * `null` clears the condition.
   * When set, `value` is empty and the operands live in {@link operand} / {@link operand2}.
   */
  operator?: FilterOperator | null;
  /** Primary condition operand. Present with {@link operator}. */
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

/**
 * Precomputed per-column header state. @internal
 *
 * The header/filter rows would otherwise call a dozen helpers per column on every
 * change-detection pass (e.g. `getSort`, `hasActiveFilter`, `isColDragging`). The header
 * view-model computeds resolve all of that once per column — and only when an underlying
 * signal changes — so the template reads plain fields instead.
 */
export interface AgridHeaderColumn {
  col: ColDef;
  field: string;
  ariaColIndex: number;
  sort: 'asc' | 'desc' | null;
  sortPriority: number;
  hasFilter: boolean;
  dragging: boolean;
  dropSide: 'before' | 'after' | null;
  reorderOffset: number;
  grouped: boolean;
  lastPinned: boolean;
  firstRightPinned: boolean;
  columnWidth: number;
  textFilter: string;
  menuFilterType: 'text' | 'number' | 'date' | null;
  hasCondition: boolean;
  conditionLabel: string;
}

/**
 * Precomputed per-column state for the data-row, footer, and ghost cell loops. @internal
 *
 * Deliberately leaner than {@link AgridHeaderColumn}: it omits sort/filter state so the body
 * view-model only changes on column layout, drag, or pinning — sorting or filtering does not
 * invalidate it (and therefore does not force every rendered cell to re-render).
 */
export interface AgridBodyColumn {
  col: ColDef;
  field: string;
  visibleColIndex: number;
  ariaColIndex: number;
  dragging: boolean;
  reorderOffset: number;
  lastPinned: boolean;
  firstRightPinned: boolean;
}
