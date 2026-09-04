import { Signal, computed, signal } from '@angular/core';
import { AgridDataSource } from '../agrid-datasource';
import { AgridRowDensity } from '../agrid-control';
import { AgridProvider } from '../agrid-provider';
import {
  AgridMenuBarContext,
  AgridMenuBarItem,
  AgridMenuBarMenuItem,
  AgridMenuBarState,
  CellPosition,
} from '../agrid.types';

/** Synthetic id of the built-in "save configuration" entry. @internal */
export const AGRID_SAVE_CONFIG_ACTION = '_internal_save_config';
export const AGRID_EXPORT_ACTION = '_internal_export';
export const AGRID_EXPORT_CSV_ACTION = '_internal_export_csv';
export const AGRID_EXPORT_XLSX_ACTION = '_internal_export_xlsx';
export const AGRID_ROW_HEIGHT_ACTION = '_internal_row_height';
export const AGRID_ROW_HEIGHT_COMPACT_ACTION = '_internal_row_height_compact';
export const AGRID_ROW_HEIGHT_NORMAL_ACTION = '_internal_row_height_normal';
export const AGRID_ROW_HEIGHT_RELAXED_ACTION = '_internal_row_height_relaxed';


/** Dependencies and callbacks required by {@link AgridMenuBarController}. @internal */
export interface AgridMenuBarControllerOptions<T extends object = any> {
  dataSource: Signal<AgridDataSource>;
  provider: Signal<AgridProvider<T>>;
  selectedRowIndices: Signal<ReadonlySet<number>>;
  selectedCell: Signal<CellPosition | null>;
  menuBarItems: Signal<AgridMenuBarItem<T>[]>;
  /** Grid id used both to gate config persistence and to key the saved entry. */
  gridId: Signal<string | undefined>;
  /** Localized label for the built-in save-configuration entry. */
  saveConfigLabel: Signal<string>;
  /** Enable Export Menu */
  enableExportButtons: Signal<boolean | undefined>;
  /** Enable built-in row-height menu. */
  showRowHeightMenu: Signal<boolean>;
  /** Active row-height density preset. */
  rowDensity: Signal<AgridRowDensity>;
  /** Localized labels for the built-in export entry. */
  exportLabel: Signal<string>;
  exportCsvLabel: Signal<string>;
  exportXlsxLabel: Signal<string>;
  rowHeightLabel: Signal<string>;
  rowHeightCompactLabel: Signal<string>;
  rowHeightNormalLabel: Signal<string>;
  rowHeightRelaxedLabel: Signal<string>;

  /** Emits a user-defined menu-bar action id. */
  emitAction: (id: string) => void;
  /** Closes other grid menus when a dropdown opens. */
  closeOtherMenus: () => void;
  /** Persists the current grid configuration (e.g. to local storage). */
  persistSettings: () => void;
  /** the Export Action */
  exportData:(format:string)=>void;
  /** Applies a row-density preset. */
  setRowDensity: (density: AgridRowDensity) => void;
}

/**
 * Owns the menu-bar toolbar's open-dropdown state, the runtime context fed to
 * visibility/active/disabled resolvers, the resolved set of visible buttons, and
 * action dispatch (including the built-in save-configuration entry).
 * @internal
 */
export class AgridMenuBarController<T extends object = any> {
  /** Id of the menu-bar button whose dropdown is open, or `null`. */
  readonly openItemId = signal<string | null>(null);

  /** Runtime state passed to menu-bar visibility, active, and disabled resolvers. */
  readonly context = computed<AgridMenuBarContext<T>>(() => {
    const datasource = this.opts.dataSource();
    const rows = datasource.rows() as T[];
    const selectedRows = [...this.opts.selectedRowIndices()]
      .sort((a, b) => a - b)
      .map(originalIndex => ({ row: rows[originalIndex], originalIndex }))
      .filter((entry): entry is { row: T; originalIndex: number } => !!entry.row);
    return {
      rows,
      selectedRows,
      selectedCell: this.opts.selectedCell(),
      provider: this.opts.provider(),
      datasource,
    };
  });

  /** Menu-bar buttons currently allowed by their visibility resolvers. */
  readonly visibleItems = computed(() => {
    const userEntries = this.opts.menuBarItems().filter(item => this.isItemVisible(item));
    const buildInActions: AgridMenuBarItem[] = this.opts.gridId()
      ? [{ id: AGRID_SAVE_CONFIG_ACTION, label: this.opts.saveConfigLabel(), icon: '↓' }]
      : [];

    if (this.opts.enableExportButtons()) {
      buildInActions.push(
        {
          id: AGRID_EXPORT_ACTION, label: this.opts.exportLabel(),
          items: [
            { id: AGRID_EXPORT_CSV_ACTION, label: this.opts.exportCsvLabel() },
            { id: AGRID_EXPORT_XLSX_ACTION, label: this.opts.exportXlsxLabel() }
          ]
        });
    }
    if (this.opts.showRowHeightMenu()) {
      buildInActions.push({
        id: AGRID_ROW_HEIGHT_ACTION,
        label: this.opts.rowHeightLabel(),
        icon: '↕',
        items: [
          {
            id: AGRID_ROW_HEIGHT_COMPACT_ACTION,
            label: this.opts.rowHeightCompactLabel(),
            active: () => this.opts.rowDensity() === 'compact',
          },
          {
            id: AGRID_ROW_HEIGHT_NORMAL_ACTION,
            label: this.opts.rowHeightNormalLabel(),
            active: () => this.opts.rowDensity() === 'normal',
          },
          {
            id: AGRID_ROW_HEIGHT_RELAXED_ACTION,
            label: this.opts.rowHeightRelaxedLabel(),
            active: () => this.opts.rowDensity() === 'relaxed',
          },
        ],
      });
    }
    return [...buildInActions, ...userEntries];
  });

  constructor(private readonly opts: AgridMenuBarControllerOptions<T>) { }

  /** Whether a menu-bar button or dropdown item should be rendered. */
  isItemVisible(item: AgridMenuBarMenuItem<T>): boolean {
    return this.resolveState(item.visible, true);
  }

  /** Closes the currently open menu-bar dropdown. */
  close(): void {
    this.openItemId.set(null);
  }

  /** Synchronizes dropdown state and closes competing grid menus when one opens. */
  onOpenItemChange(id: string | null): void {
    if (id !== null) this.opts.closeOtherMenus();
    this.openItemId.set(id);
  }

  /** Dispatches a menu-bar action, persisting config for the built-in save entry. */
  runAction(id: string): void {

    if (id === AGRID_SAVE_CONFIG_ACTION && this.opts.gridId()) {
      this.opts.persistSettings();
      return;
    }

    if (id === AGRID_EXPORT_CSV_ACTION && this.opts.enableExportButtons()) {
      this.opts.exportData('csv');
      return;
    }

    if (id === AGRID_EXPORT_XLSX_ACTION && this.opts.enableExportButtons()) {
      this.opts.exportData('xlsx');
      return;
    }

    if (id === AGRID_ROW_HEIGHT_COMPACT_ACTION && this.opts.showRowHeightMenu()) {
      this.opts.setRowDensity('compact');
      return;
    }

    if (id === AGRID_ROW_HEIGHT_NORMAL_ACTION && this.opts.showRowHeightMenu()) {
      this.opts.setRowDensity('normal');
      return;
    }

    if (id === AGRID_ROW_HEIGHT_RELAXED_ACTION && this.opts.showRowHeightMenu()) {
      this.opts.setRowDensity('relaxed');
      return;
    }

    this.opts.emitAction(id);
  }

  private resolveState(state: AgridMenuBarState<T> | undefined, fallback: boolean): boolean {
    if (typeof state === 'function') return state(this.context());
    return state ?? fallback;
  }
}
