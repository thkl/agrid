import { Signal, computed, signal } from '@angular/core';
import { AgridDataSource } from '../agrid-datasource';
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
  /** Emits a user-defined menu-bar action id. */
  emitAction: (id: string) => void;
  /** Closes other grid menus when a dropdown opens. */
  closeOtherMenus: () => void;
  /** Persists the current grid configuration (e.g. to local storage). */
  persistSettings: () => void;
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
    const savedEntry = this.opts.gridId()
      ? [{ id: AGRID_SAVE_CONFIG_ACTION, label: this.opts.saveConfigLabel(), icon: '↓' }]
      : [];
    return [...savedEntry, ...userEntries];
  });

  constructor(private readonly opts: AgridMenuBarControllerOptions<T>) {}

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
    this.opts.emitAction(id);
  }

  private resolveState(state: AgridMenuBarState<T> | undefined, fallback: boolean): boolean {
    if (typeof state === 'function') return state(this.context());
    return state ?? fallback;
  }
}
