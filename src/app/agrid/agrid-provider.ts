import { signal, WritableSignal } from '@angular/core';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridLocaleTextOverrides } from './agrid-localization';
import {
  AGridOptions,
  AgridTreeConfig,
  CellContextMenuItem,
  ColDef,
  GroupAction,
  HeaderGroup,
} from './agrid.types';

/** Configuration used to create an {@link AgridProvider}. */
export interface AgridProviderConfig<T extends object = any> extends Partial<AGridOptions> {
  /** Row data source. A new empty data source is created when omitted. */
  datasource?: AgridDataSource<T>;
  /** Stateful grid control. A default control is created when omitted. */
  control?: AgridControl;
  /** Initial column definitions in display order. */
  columns?: ColDef<T>[];
  /** Labels used by columns with a matching `group` identifier. */
  headerGroups?: HeaderGroup[];
  /**
   * Render rows as a hierarchical tree. When set, rows are nested by the configured
   * parent/child accessors and an expand/collapse twisty is shown on `treeField`.
   * Mutually exclusive with grouping and pagination.
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
  /** Show the sidebar panel. */
  showSidebar?: boolean;
  /** Automatically open the detail panel when a row is selected. */
  autoOpenDetail?: boolean;
  /**
   * Emit filter and sort changes for server processing instead of applying them locally.
   * The Excel-style value picker is hidden in this mode. @default false
   */
  serverSideFiltering?: boolean;
  /** Delay before emitting server-side text filter changes. Set to `0` to disable. @default 300 */
  filterDebounceMs?: number;
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
  /** Runtime UI state and imperative grid controls. */
  control: AgridControl;
  /** Reactive column definitions in display order. */
  readonly columns: WritableSignal<ColDef<T>[]>;
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
  /** Whether the sidebar is available. */
  showSidebar: boolean;
  /** Whether selecting a row automatically opens its detail panel. */
  autoOpenDetail: boolean;
  /** Whether filter and sort operations are delegated to the host. */
  serverSideFiltering: boolean;
  /** Delay before server-side filter events are emitted. */
  filterDebounceMs: number;
  /** Enabled sorting mode. */
  sortOption: 'single' | 'multi' | 'none';
  /** Toggle auto-add-rows without recreating the provider. @default signal(false) */
  readonly autoAddRows: WritableSignal<boolean>;
  /** Enabled row-selection mode. */
  rowSelection: 'single' | 'multi' | 'none';
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

  /** Toggle the loading overlay without recreating the provider. @default signal(false) */
  readonly loading: WritableSignal<boolean>;
  /** Toggle readonly mode without recreating the provider. @default signal(false) */
  readonly readonlyGrid: WritableSignal<boolean>;

  /** Creates a provider from the supplied data, state, columns, and display options. */
  constructor(config: AgridProviderConfig<T> = {}) {
    this.options      = { locale: config.locale ?? 'auto' };
    this.datasource   = config.datasource ?? new AgridDataSource<T>([]);
    this.control      = config.control ?? new AgridControl({ allowRowReorder: true });
    this.columns      = signal(config.columns ?? []);
    this.headerGroups = config.headerGroups ?? [];
    this.treeConfig   = config.treeConfig ?? null;

    this.rowHeight        = config.rowHeight ?? 32;
    this.minHeight        = config.minHeight;
    this.maxHeight        = config.maxHeight;
    this.allowAddRows     = config.allowAddRows ?? false;
    this.autoAddRows      = signal(config.autoAddRows ?? false);
    this.showControlColumn = config.showControlColumn ?? false;
    this.enableRowMarking = config.enableRowMarking ?? false;
    this.showSidebar      = config.showSidebar ?? false;
    this.autoOpenDetail   = config.autoOpenDetail ?? false;
    this.serverSideFiltering = config.serverSideFiltering ?? false;
    this.filterDebounceMs = Math.max(0, config.filterDebounceMs ?? 300);
    this.sortOption = config.sortOption ?? 'multi';
    this.rowSelection     = config.rowSelection ?? 'none';
    this.groupDescription = config.groupDescription ?? null;
    this.groupActions     = config.groupActions ?? [];
    this.cellMenuItems    = config.cellMenuItems ?? [];
    this.zebraStripes     = config.zebraStripes ?? false;
    this.showChangedCellIndicator = config.showChangedCellIndicator ?? false;
    this.confirmRowDelete = config.confirmRowDelete ?? false;
    this.emptyText        = config.emptyText;
    this.loading          = signal(config.loading ?? false);
    this.readonlyGrid     = signal(config.readonly ?? false);
    this.useSidebarEditor = config.useSidebarEditor ?? false;
  }

  /** Returns the current reactive row array. */
  getGridData(): T[] {
    return this.datasource.rows();
  }
}
