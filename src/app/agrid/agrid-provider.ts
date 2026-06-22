import { signal, WritableSignal } from '@angular/core';
import { AgridControl, AgridControlState, ɵgetAgridControlRuntimeState } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridServerSideRowModel } from './agrid-server-side-row-model';
import { AgridLocaleTextOverrides } from './agrid-localization';
import {
  AGridOptions,
  AgridEnterEditAction,
  AgridMenuBarItem,
  AgridPivotConfig,
  AgridTreeConfig,
  CellContextMenuItem,
  ColDef,
  GroupAction,
  HeaderGroup,
} from './agrid.types';

/** JSON-safe pivot subset used by persisted grid settings. */
export interface AgridPivotSettings {
  rowField: string;
  columnField: string;
  valueField: string;
  aggregate: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

/**
 * Versioned, JSON-safe snapshot that can be stored in local storage or a backend.
 * Functions, datasource rows, selection, loading state, and edit history are intentionally absent.
 */
export interface AgridSettings {
  version: 1;
  control: AgridControlState;
  pivotConfig: AgridPivotSettings | null;
}

/** Configuration used to create an {@link AgridProvider}. */
export interface AgridProviderConfig<T extends object = any> extends Partial<AGridOptions> {
  /** Row data source. A new empty data source is created when omitted. */
  datasource?: AgridDataSource<T>;
  /**
   * Lazy block-based server-side row model. When supplied it becomes the provider datasource and
   * filtering, sorting, and quick filtering are included in block requests automatically.
   */
  serverSideRowModel?: AgridServerSideRowModel<T>;
  /** Stateful grid control. A default control is created when omitted. */
  control?: AgridControl;
  /** Initial column definitions in display order. */
  columns?: ColDef<T>[];
  /**
   * Derive a read-only client-side pivot table from the datasource.
   * The first release supports one row field, one column field, and one value field.
   * Enable `showSidebar` to let users change this configuration from the grid's Pivot tab.
   */
  pivotConfig?: AgridPivotConfig<T>;
  /** Labels used by columns with a matching `group` identifier. */
  headerGroups?: HeaderGroup[];
  /**
   * Render rows as a hierarchical tree. When set, rows are nested by the configured
   * parent/child accessors and an expand/collapse twisty is shown on `treeField`.
   *
   * Set `aggregateTreeNodes` in this configuration to display each aggregate column's
   * descendant-leaf rollup on expandable nodes. Tree mode is mutually exclusive with grouping
   * and pagination.
   */
  treeConfig?: AgridTreeConfig<T>;
  /** Row height in pixels. Must be fixed for CDK virtual scroll. @default 32 */
  rowHeight?: number;
  /** Minimum height of the grid host element (e.g. `'200px'`). */
  minHeight?: string;
  /** Maximum height of the grid host element (e.g. `'500px'`). */
  maxHeight?: string;
  /** Show a `+ Add row` placeholder at the bottom. */
  allowAddRows?: boolean;
  /** Automatically insert a blank row when navigating past the last real row. */
  autoAddRows?: boolean;
  /** Show a 24 px control column with a drag handle and right-click context menu. */
  showControlColumn?: boolean;
  /** Show row-marking checkboxes in a 48 px control column for clipboard inclusion. @default false */
  enableRowMarking?: boolean;
  /** Allow clicking column headers to mark complete columns. @default false */
  enableColumnMarking?: boolean;
  /** Show the sidebar panel. */
  showSidebar?: boolean;
  /** Automatically open the detail panel when a row is selected. */
  autoOpenDetail?: boolean;
  /**
   * Emit filter and sort changes for server processing instead of applying them locally.
   * The distinct-value picker is hidden unless the column supplies an explicit `values` list.
   * @default false
   */
  serverSideFiltering?: boolean;
  /** Delay before emitting server-side text filter changes. Set to `0` to disable. @default 300 */
  filterDebounceMs?: number;
  /**
   * Show the global quick-filter box above the grid. In client mode it filters rows whose
   * visible columns contain the text; in `serverSideFiltering` mode it emits `(quickFilterChange)`
   * instead of filtering locally. @default false
   */
  enableQuickFilter?: boolean;
  /**
   * Optional command bar rendered above the column headers. Buttons and dropdown items emit
   * their id through the grid's single `(menuBarAction)` output.
   */
  menuBarItems?: AgridMenuBarItem<T>[];
  /**
   * Sorting behavior: one active column, multiple columns, or disabled entirely.
   * @default 'multi'
   */
  sortOption?: 'single' | 'multi' | 'none';
  /**
   * Row selection mode.
   * - `'none'` — no selection (default)
   * - `'single'` — click to select/deselect
   * - `'multi'` — Ctrl+click toggles, Shift+click extends range, click+drag sweeps
   */
  rowSelection?: 'single' | 'multi' | 'none';
  /**
   * Behavior after pressing Enter while an inline cell editor is active.
   * - `'nothing'` — commit and keep the current cell selected
   * - `'nextColumn'` — commit and move to the next column in the same row
   * - `'nextRow'` — commit and move to the same column one row down
   * @default 'nextRow'
   */
  enterEditAction?: AgridEnterEditAction;
  /** Returns a short description string shown next to the group label. */
  groupDescription?: ((label: string) => string) | null;
  /** Actions shown in the group header's `⋮` menu. */
  groupActions?: GroupAction[];
  /**
   * Extra items appended to the cell right-click context menu.
   * Pass `null` entries to insert separator lines.
   */
  cellMenuItems?: (CellContextMenuItem<T> | null)[];
  /** Shade every other row slightly for easier reading. @default false */
  zebraStripes?: boolean;
  /** Show a color marker on cells changed through grid editing. @default false */
  showChangedCellIndicator?: boolean;
  /** Ask for confirmation before grid row-delete actions. @default false */
  confirmRowDelete?: boolean;
  /** Make the entire grid read-only. @default false */
  readonly?: boolean;

  /** Restrict editing to the sidebar editor instead of inline cells. */
  useSidebarEditor?: boolean;

  /** Show a loading overlay over the grid body. @default false */
  loading?: boolean;
  /** Message shown when the grid has no rows to display. */
  emptyText?: string;

  /**
   * Return one or more CSS class names applied to a whole data row, based on its data and index.
   * Complements the per-cell {@link ColDef.cellClass}.
   *
   * @example
   * ```ts
   * getRowClass: ({ row }) => row.status === 'overdue' ? 'row-danger' : ''
   * ```
   */
  getRowClass?: (params: { row: T; index: number }) => string;

  /**
   * Designate rows to pin to the top or bottom of the grid body. Pinned rows stay visible during
   * vertical scroll and are excluded from grouping and pagination, but remain fully interactive
   * (editable/selectable) because they keep their real data-source index.
   *
   * Return `'top'`, `'bottom'`, or `undefined` (a normal scrolling row).
   *
   * @example
   * ```ts
   * pinRow: row => row.isSummary ? 'bottom' : undefined
   * ```
   */
  pinRow?: (row: T, index: number) => 'top' | 'bottom' | undefined;

  /**
   * Enable master/detail rows: each flat data row, or each leaf row in tree mode, can expand to
   * reveal a detail panel rendered beneath it. Requires {@link detailRenderer}. Grouped mode is
   * not supported. @default false
   */
  masterDetail?: boolean;
  /**
   * Returns the HTML shown inside an expanded detail panel. Angular's built-in HTML sanitization
   * is applied automatically (same as {@link ColDef.cellRenderer}).
   *
   * @example
   * ```ts
   * detailRenderer: ({ row }) => `<div class="detail">${row.notes}</div>`
   * ```
   */
  detailRenderer?: (params: { row: T }) => string;
  /** Fixed height in pixels of an expanded detail panel row. @default 200 */
  detailRowHeight?: number;

  /** this is the id of the grid its stored in the provider the grid will read it as signal */
  gridId?:string;

}

/**
 * Bundles a grid's data source, control state, columns, and display options.
 *
 * Create one provider per independent grid instance. A provider may be selected
 * from an array when a component renders multiple grids.
 */
export class AgridProvider<T extends object = any> {
  /** Mutable row data consumed by the grid. */
  datasource: AgridDataSource<T>;
  /** Lazy server-side model, or `null` for the regular client-side datasource. */
  serverSideRowModel: AgridServerSideRowModel<T> | null;
  /** Runtime UI state and imperative grid controls. */
  control: AgridControl;
  /** Reactive column definitions in display order. */
  readonly columns: WritableSignal<ColDef<T>[]>;
  private readonly _pivotConfig = signal<AgridPivotConfig<T> | null>(null);
  /**
   * Client-side pivot configuration, or `null` for the normal row view.
   * Assigning a new configuration reactively rebuilds the derived pivot rows and columns.
   */
  get pivotConfig(): AgridPivotConfig<T> | null {
    return this._pivotConfig();
  }
  set pivotConfig(config: AgridPivotConfig<T> | null) {
    this._pivotConfig.set(config);
  }
  /** Header-group labels referenced by column definitions. */
  headerGroups: HeaderGroup[];
  /** Tree configuration, or `null` when the grid is not in tree mode. */
  treeConfig: AgridTreeConfig<T> | null;
  /** Shared grid options such as locale. */
  options: AGridOptions;

  private readonly _localizations = new Map<string, AgridLocaleTextOverrides>();

  /** Read-only view of registered per-locale text overrides. Used by the grid to resolve locale text. */
  get localizations(): ReadonlyMap<string, AgridLocaleTextOverrides> {
    return this._localizations;
  }

  /**
   * Register locale-specific label overrides. Call multiple times for multiple locales.
   * When `locale` is `'auto'`, the grid matches the browser language against registered locales
   * (exact match first, then primary-language match, e.g. `'fr'` matches a browser locale of `'fr-FR'`).
   *
   * @example
   * provider.addLocalization('fr-FR', { addRow: 'Ajouter une ligne', noRows: 'Aucune donnée' });
   */
  addLocalization(locale: string, overrides: AgridLocaleTextOverrides): this {
    this._localizations.set(locale, overrides);
    return this;
  }

  /** Fixed virtual-scroll row height in pixels. */
  rowHeight: number;
  /** Minimum CSS height of the grid host. */
  minHeight?: string;
  /** Maximum CSS height of the grid host. */
  maxHeight?: string;
  /** Whether the add-row placeholder is shown. */
  allowAddRows: boolean;
  /** Whether the control column is rendered. */
  showControlColumn: boolean;
  /** Whether rows can be marked for inclusion in clipboard copies. */
  enableRowMarking: boolean;
  /** Whether complete columns can be marked from their headers. */
  enableColumnMarking: boolean;
  /** Whether the sidebar is available. */
  showSidebar: boolean;
  /** Whether selecting a row automatically opens its detail panel. */
  autoOpenDetail: boolean;
  /** Whether filter and sort operations are delegated to the host. */
  serverSideFiltering: boolean;
  /** Delay before server-side filter events are emitted. */
  filterDebounceMs: number;
  /** Whether the global quick-filter box is shown above the grid. */
  enableQuickFilter: boolean;
  /** Commands rendered in the optional menu bar above the column headers. */
  menuBarItems: AgridMenuBarItem<T>[];
  /** Enabled sorting mode. */
  sortOption: 'single' | 'multi' | 'none';
  /** @deprecated Use `control.autoAddRows` and `control.setAutoAddRows()` instead. */
  readonly autoAddRows: WritableSignal<boolean>;
  /** Enabled row-selection mode. */
  rowSelection: 'single' | 'multi' | 'none';
  /** Behavior after pressing Enter while an inline cell editor is active. */
  enterEditAction: AgridEnterEditAction;
  /** Optional description shown beside each group heading. */
  groupDescription: ((label: string) => string) | null;
  /** Actions available from group headers. */
  groupActions: GroupAction[];
  /** Additional cell context-menu entries. */
  cellMenuItems: (CellContextMenuItem<T> | null)[];
  /** Whether alternating data rows receive stripe styling. */
  zebraStripes: boolean;
  /** Whether committed cell changes receive a visual marker. */
  showChangedCellIndicator: boolean;
  /** Whether grid row-delete actions require in-row confirmation. */
  confirmRowDelete: boolean;
  /** Optional empty-state text override. */
  emptyText?: string;
  /** Whether edits are restricted to the sidebar editor. */
  useSidebarEditor: boolean;

  /** Optional callback returning CSS classes for a whole data row. */
  getRowClass?: (params: { row: T; index: number }) => string;
  /** Optional callback designating rows pinned to the top or bottom of the body. */
  pinRow?: (row: T, index: number) => 'top' | 'bottom' | undefined;
  /** Whether master/detail expandable detail rows are enabled. */
  masterDetail: boolean;
  /** Returns the sanitized HTML rendered inside an expanded detail panel. */
  detailRenderer?: (params: { row: T }) => string;
  /** Fixed height in pixels of an expanded detail panel row. */
  detailRowHeight: number;

  /** its used to save the config  */
  gridId?:string;

  /** @deprecated Use `control.loading` and `control.setLoading()` instead. */
  readonly loading: WritableSignal<boolean>;
  /** @deprecated Use `control.readonly` and `control.setReadonly()` instead. */
  readonly readonlyGrid: WritableSignal<boolean>;

  /** Creates a provider from the supplied data, state, columns, and display options. */
  constructor(config: AgridProviderConfig<T> = {}) {
    if (config.serverSideRowModel && (config.treeConfig || config.pivotConfig)) {
      throw new Error('AgridServerSideRowModel does not support treeConfig or pivotConfig.');
    }
    if (config.treeConfig && config.pivotConfig) {
      throw new Error('treeConfig and pivotConfig are mutually exclusive.');
    }
    this.options      = { locale: config.locale ?? 'auto' };
    this.serverSideRowModel = config.serverSideRowModel ?? null;
    this.datasource   = this.serverSideRowModel ?? config.datasource ?? new AgridDataSource<T>([]);
    this.control      = config.control ?? new AgridControl({ allowRowReorder: true });
    const runtimeState = ɵgetAgridControlRuntimeState(this.control);
    this.columns      = signal(config.columns ?? []);
    this.pivotConfig  = config.pivotConfig ?? null;
    this.headerGroups = config.headerGroups ?? [];
    this.treeConfig   = config.treeConfig ?? null;

    this.rowHeight        = config.rowHeight ?? 32;
    this.minHeight        = config.minHeight;
    this.maxHeight        = config.maxHeight;
    this.allowAddRows     = config.allowAddRows ?? false;
    if (config.autoAddRows !== undefined) this.control.setAutoAddRows(config.autoAddRows);
    this.autoAddRows      = runtimeState.autoAddRows;
    this.showControlColumn = config.showControlColumn ?? false;
    this.enableRowMarking = config.enableRowMarking ?? false;
    this.enableColumnMarking = config.enableColumnMarking ?? false;
    this.showSidebar      = config.showSidebar ?? false;
    this.autoOpenDetail   = config.autoOpenDetail ?? false;
    this.serverSideFiltering = this.serverSideRowModel ? true : config.serverSideFiltering ?? false;
    this.filterDebounceMs = Math.max(0, config.filterDebounceMs ?? 300);
    this.enableQuickFilter = config.enableQuickFilter ?? false;
    this.menuBarItems = config.menuBarItems ?? [];
    this.sortOption = config.sortOption ?? 'multi';
    this.rowSelection     = config.rowSelection ?? 'none';
    this.enterEditAction  = config.enterEditAction ?? 'nextRow';
    this.groupDescription = config.groupDescription ?? null;
    this.groupActions     = config.groupActions ?? [];
    this.cellMenuItems    = config.cellMenuItems ?? [];
    this.zebraStripes     = config.zebraStripes ?? false;
    this.showChangedCellIndicator = config.showChangedCellIndicator ?? false;
    this.confirmRowDelete = config.confirmRowDelete ?? false;
    this.emptyText        = config.emptyText;
    if (config.loading !== undefined) this.control.setLoading(config.loading);
    if (config.readonly !== undefined) this.control.setReadonly(config.readonly);
    this.loading          = runtimeState.loading;
    this.readonlyGrid     = runtimeState.readonly;
    this.useSidebarEditor = config.useSidebarEditor ?? false;
    this.getRowClass      = config.getRowClass;
    this.pinRow           = config.pinRow;
    this.masterDetail     = config.masterDetail ?? false;
    this.detailRenderer   = config.detailRenderer;
    this.detailRowHeight  = config.detailRowHeight ?? 200;
    this.gridId = config.gridId;
  }

  /** Returns the current reactive row array. */
  getGridData(): T[] {
    return this.datasource.rows();
  }

  /**
   * Return a detached, JSON-safe snapshot of persistent grid and pivot settings.
   * Custom pivot aggregate functions cannot be serialized and produce an explicit error.
   */
  saveSettings(): AgridSettings {
    const pivot = this.pivotConfig;
    const aggregate = pivot?.aggregate;
    if (typeof aggregate === 'function') {
      throw new Error('Custom pivot aggregate functions cannot be saved as JSON settings.');
    }
    return {
      version: 1,
      control: this.control.toJSON(),
      pivotConfig: pivot
        ? {
          rowField: pivot.rowField,
          columnField: pivot.columnField,
          valueField: pivot.valueField,
          aggregate: aggregate ?? 'sum',
        }
        : null,
    };
  }

  /**
   * Apply a previously saved snapshot to this live provider.
   * Existing component instances update immediately because both control and pivot state are
   * signal-backed. Unknown versions and pivot fields fail early with actionable errors.
   */
  loadSettings(settings: AgridSettings): void {
    if (settings.version !== 1) {
      throw new Error(`Unsupported aGrid settings version: ${settings.version}`);
    }
    if (settings.pivotConfig) {
      if (this.serverSideRowModel || this.treeConfig) {
        throw new Error('Saved pivot settings cannot be loaded with treeConfig or a server-side row model.');
      }
      const fields = new Set<string>(this.columns().map(column => column.field as string));
      const pivotFields = [
        settings.pivotConfig.rowField,
        settings.pivotConfig.columnField,
        settings.pivotConfig.valueField,
      ];
      if (pivotFields.some(field => !fields.has(field))) {
        throw new Error('Saved pivot settings reference a column that is not configured.');
      }
    }
    this.control.loadState(settings.control);
    this.pivotConfig = settings.pivotConfig as AgridPivotConfig<T> | null;
  }
}
