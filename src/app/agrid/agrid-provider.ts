import { signal, WritableSignal } from '@angular/core';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridLocaleTextOverrides } from './agrid-localization';
import { AGridOptions, CellContextMenuItem, ColDef, GroupAction } from './agrid.types';

export interface AgridProviderConfig<T extends Record<string, unknown> = Record<string, unknown>> extends Partial<AGridOptions> {
  datasource?: AgridDataSource<T>;
  control?: AgridControl;
  columns?: ColDef[];
  localization?: AgridLocaleTextOverrides;
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
  /** Show the sidebar panel. */
  showSidebar?: boolean;
  /** Automatically open the detail panel when a row is selected. */
  autoOpenDetail?: boolean;
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
  cellMenuItems?: (CellContextMenuItem | null)[];
  /** Shade every other row slightly for easier reading. @default false */
  zebraStripes?: boolean;
  /** Make the entire grid read-only. @default false */
  readonly?: boolean;
  /** Show a loading overlay over the grid body. @default false */
  loading?: boolean;
  /** Message shown when the grid has no rows to display. */
  emptyText?: string;
}

export class AgridProvider<T extends Record<string, unknown> = Record<string, unknown>> {
  datasource: AgridDataSource<T>;
  control: AgridControl;
  columns: ColDef[];
  options: AGridOptions;
  localization?: AgridLocaleTextOverrides;

  // Static display / behaviour options
  rowHeight: number;
  minHeight?: string;
  maxHeight?: string;
  allowAddRows: boolean;
  showControlColumn: boolean;
  showSidebar: boolean;
  autoOpenDetail: boolean;
  /** Toggle auto-add-rows without recreating the provider. @default signal(false) */
  readonly autoAddRows: WritableSignal<boolean>;
  rowSelection: 'single' | 'multi' | 'none';
  groupDescription: ((label: string) => string) | null;
  groupActions: GroupAction[];
  cellMenuItems: (CellContextMenuItem | null)[];
  zebraStripes: boolean;
  emptyText?: string;

  // Dynamic options exposed as signals so callers can update them without recreating the provider
  /** Toggle the loading overlay without recreating the provider. @default signal(false) */
  readonly loading: WritableSignal<boolean>;
  /** Toggle readonly mode without recreating the provider. @default signal(false) */
  readonly readonlyGrid: WritableSignal<boolean>;
  constructor(config: AgridProviderConfig<T> = {}) {
    this.options      = { locale: config.locale ?? 'en-US' };
    this.datasource   = config.datasource ?? new AgridDataSource<T>([]);
    this.control      = config.control ?? new AgridControl({ allowRowReorder: true });
    this.columns      = config.columns ?? [];
    this.localization = config.localization;

    this.rowHeight        = config.rowHeight ?? 32;
    this.minHeight        = config.minHeight;
    this.maxHeight        = config.maxHeight;
    this.allowAddRows     = config.allowAddRows ?? false;
    this.autoAddRows      = signal(config.autoAddRows ?? false);
    this.showControlColumn = config.showControlColumn ?? false;
    this.showSidebar      = config.showSidebar ?? false;
    this.autoOpenDetail   = config.autoOpenDetail ?? false;
    this.rowSelection     = config.rowSelection ?? 'none';
    this.groupDescription = config.groupDescription ?? null;
    this.groupActions     = config.groupActions ?? [];
    this.cellMenuItems    = config.cellMenuItems ?? [];
    this.zebraStripes     = config.zebraStripes ?? false;
    this.emptyText        = config.emptyText;
    this.loading          = signal(config.loading ?? false);
    this.readonlyGrid     = signal(config.readonly ?? false);
  }

  getGridData() {
    return this.datasource.rows();
  }
}
