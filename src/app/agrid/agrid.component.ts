import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Signal,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { AgridCellComponent } from './agrid-cell.component';
import { AgridClipboardHandler, CellRange } from './agrid-clipboard.handler';
import { AgridColumnSizingController } from './agrid-column-sizing.controller';
import { AgridColumnMenuComponent, AgridColumnMenuValueItem } from './agrid-column-menu.component';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridDragHandler } from './agrid-drag.handler';
import { AgridEditController } from './agrid-edit.controller';
import { AgridFindPanelComponent } from './agrid-find-panel.component';
import { AgridLocaleText, resolveAgridLocaleText, resolveLocale } from './agrid-localization';
import { AgridNavigationController } from './agrid-navigation.controller';
import { AgridProvider } from './agrid-provider';
import { AgridProjectionModel } from './agrid-projection.model';
import { AgridRangeController } from './agrid-range.controller';
import {
  AgridSidebarComponent,
  AgridSidebarDetailField,
  AgridSidebarEdit,
} from './agrid-sidebar.component';
import {
  buildSelectionRange,
  getDisplayForField,
  isDataRowItem as isDataRowItemFn,
  isGroupHeaderItem as isGroupHeaderItemFn,
  looksLikeDate,
} from './agrid.utils';
import {
  CellContextMenuItem, CellPosition, ColDef, FilterChangeEvent, GridEditEvent, GridItem,
  GroupAction, NewRecord, PageChangeEvent, RowClickEvent, RowRemovedEvent, RowReorderEvent,
  RowSelectEvent, SortChangeEvent, ValueOption,
} from './agrid.types';

// Re-export for backward compatibility with existing imports of GridItem from this file.
export type { GridItem };

type FindMatch = { rowIndex: number; displayIndex: number; colIndex: number };

/**
 * Excel-like data grid for Angular 21.
 *
 * ## Minimal setup
 * ```html
 * <agrid [provider]="gridProvider" />
 * ```
 *
 * ### Keyboard shortcuts
 * | Key | Action |
 * |-----|--------|
 * | Arrow keys | Move selection |
 * | Tab / Shift+Tab | Move right / left (wraps rows) |
 * | Enter / F2 | Enter edit mode |
 * | Printable key | Enter edit mode with seeded character |
 * | Escape | Cancel edit |
 * | Tab / Enter (while editing) | Commit and move right / down |
 */
@Component({
  selector: 'agrid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollingModule,
    AgridCellComponent,
    AgridColumnMenuComponent,
    AgridFindPanelComponent,
    AgridSidebarComponent,
  ],
  templateUrl: './agrid.component.html',
  styleUrl: './agrid.component.css',
  host: {
    '[class.ag-zebra]': 'zebraStripes()',
    '[style.min-height]': 'minHeight()',
    '[style.max-height]': 'maxHeight()',
  },
})
export class AgridComponent {

  // ── Inputs ───────────────────────────────────────────────────────────────────

  /** Grid provider containing columns, data source, control, and options. */
  provider = input<AgridProvider>(new AgridProvider());

  // All display / behaviour options are read from the provider.
  readonly rowHeight        = computed(() => this.provider().rowHeight);
  readonly minHeight        = computed(() => this.provider().minHeight);
  readonly maxHeight        = computed(() => this.provider().maxHeight);
  readonly allowAddRows     = computed(() => this.provider().allowAddRows);
  readonly autoAddRows      = computed(() => this.provider().autoAddRows());
  readonly showControlColumn = computed(() => this.provider().showControlColumn);
  readonly showSidebar      = computed(() => this.provider().showSidebar);
  readonly autoOpenDetail   = computed(() => this.provider().autoOpenDetail);
  readonly serverSideFiltering = computed(() => this.provider().serverSideFiltering);
  readonly filterDebounceMs = computed(() => this.provider().filterDebounceMs);
  readonly sortOption = computed(() => this.provider().sortOption);
  readonly rowSelection     = computed(() => this.provider().rowSelection);
  readonly groupDescription = computed(() => this.provider().groupDescription);
  readonly groupActions     = computed(() => this.provider().groupActions);
  readonly cellMenuItems    = computed(() => this.provider().cellMenuItems);
  readonly zebraStripes     = computed(() => this.provider().zebraStripes);
  readonly readonlyGrid     = computed(() => this.provider().readonlyGrid());
  readonly loading          = computed(() => this.provider().loading());
  readonly emptyText        = computed(() => this.provider().emptyText);
  readonly useSidebarEditor = computed(()=> this.provider().useSidebarEditor);

  // Auto-open detail panel when a row is selected and autoOpenDetail is enabled.
  private readonly _autoDetailEffect = effect(() => {
    if (this.autoOpenDetail() && this.selectedRowIndex() !== null) {
      this.sidebarOpen.set(true);
      this.sidebarTab.set('detail');
    }
  });

  /** Column definitions from the active provider. */
  readonly colDefs = computed<ColDef[]>(() => this.provider().columns());

  /** Signal-based data container from the active provider. */
  readonly dataSource = computed<AgridDataSource>(() => this.provider().datasource);

  /** Grid UI state container from the active provider. */
  readonly control = computed<AgridControl | null>(() => this.provider().control);

  /** Resolved locale code used for date formatting and built-in localization lookup. 'auto' is replaced with navigator.language. */
  readonly locale = computed<string>(() => resolveLocale(this.provider().options.locale));

  /** Resolved built-in locale text merged with provider customizations. */
  readonly localeText = computed<AgridLocaleText>(() =>
    resolveAgridLocaleText(this.provider().options.locale, this.provider().localizations)
  );

  /** Effective empty-state label. */
  readonly emptyTextLabel = computed<string>(() => this.emptyText() ?? this.localeText().noRows);

  // ── Outputs ──────────────────────────────────────────────────────────────────

  /** Emitted after the user commits a cell edit. */
  cellEdit = output<GridEditEvent>();

  rowRemoved = output<RowRemovedEvent>();

  /** Emitted when the grid inserts a blank row. Use `dataSource.patchRow()` to populate it. */
  prepareAddRecord = output<NewRecord>();

  /** Emitted when the user finishes dragging a row. Call `dataSource.moveRow()` to apply. */
  rowReorder = output<RowReorderEvent>();

  /** Emitted when the row selection changes. `null` = selection cleared. */
  rowSelect = output<RowSelectEvent | null>();

  rowDoubleClicked = output<RowClickEvent>();

  /** Emitted when the user single-clicks a data row. */
  rowClick = output<RowClickEvent>();

  /**
   * Emitted when the user navigates to a new page in **server-side pagination mode**
   * (i.e. when `AgridControl.totalRows` is greater than zero).
   * The host should fetch the indicated row slice and update the data source.
   */
  pageChange = output<PageChangeEvent>();

  /** Emitted when a header filter changes in server-side filtering mode. */
  filterChange = output<FilterChangeEvent>();

  /** Emitted when a column sort changes in server-side filtering mode. */
  sortChange = output<SortChangeEvent>();

  // ── Public state ─────────────────────────────────────────────────────────────

  /** Currently focused cell, or `null`. */
  readonly selectedCell = signal<CellPosition | null>(null);

  /** Rectangular cell range selected by Shift+arrow or Shift+click. */
  readonly selectedRange = signal<CellRange | null>(null);

  /** Fill-handle drag preview bounds, in visible row/column coordinates. */
  get fillPreviewBounds() { return this.rangeController.fillPreviewBounds; }

  /** Whether the in-grid find box is visible. */
  readonly findOpen = signal<boolean>(false);

  /** Current find query. Matches are computed against visible formatted cell values. */
  readonly findQuery = signal<string>('');

  /** Index of the active match inside `findMatches`, or `-1` when no match is active. */
  readonly findActiveIndex = signal<number>(-1);

  /** Position of the cell in edit mode, or `null`. */
  get editingCell() { return this.editController.editingCell; }

  /** Draft value while editing — committed on Tab/Enter, discarded on Escape. */
  get currentDraft() { return this.editController.currentDraft; }

  /** Seed character typed to enter edit mode (e.g. pressing 'A'). */
  get editSeedChar() { return this.editController.editSeedChar; }

  /** Set of currently selected original row indices. */
  private readonly _selectedIndices = signal<Set<number>>(new Set());

  /** Reactive read-only view of selected indices. */
  readonly selectedRowIndices: Signal<ReadonlySet<number>> =
    this._selectedIndices.asReadonly() as Signal<ReadonlySet<number>>;

  /** First selected index, or `null` (convenience for `'single'` mode). */
  readonly selectedRowIndex = computed<number | null>(() => {
    const s = this._selectedIndices();
    return s.size > 0 ? [...s][0] : null;
  });

  /** Whether the sidebar panel is currently open. */
  readonly sidebarOpen = signal<boolean>(false);

  /** Which tab is active inside the sidebar. */
  readonly sidebarTab = signal<'columns' | 'detail'>('columns');

  /** Toggle the sidebar open/closed. */
  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }

  /** @internal */
  onSidebarStripClick(tab: 'columns' | 'detail'): void {
    if (this.sidebarOpen() && this.sidebarTab() === tab) {
      this.sidebarOpen.set(false);
    } else {
      this.sidebarTab.set(tab);
      this.sidebarOpen.set(true);
    }
  }

  readonly sidebarRow = computed<Record<string, unknown> | null>(() => {
    const idx = this.selectedRowIndex();
    return idx === null ? null : this.dataSource().rows()[idx] ?? null;
  });

  readonly sidebarHiddenColumns = computed<ReadonlySet<string>>(
    () => this.control()?.hiddenColumns() ?? new Set<string>()
  );

  /** @internal */
  onSidebarDetailEdit(event: AgridSidebarEdit): void {
    this.commitDetailEdit(event.field, event.col, event.value);
  }

  /** @internal Commit an edit made via the detail panel. */
  commitDetailEdit(field: string, col: ColDef, stringValue: string): void {
    const idx = this.selectedRowIndex();
    if (idx === null) return;
    let newValue: unknown = stringValue;
    if (col.type === 'number') {
      newValue = stringValue === '' ? null : Number(stringValue);
    } else if (col.values?.length) {
      const opt = col.values.find(v =>
        typeof v === 'string' ? v === stringValue : String((v as ValueOption).value) === stringValue
      );
      newValue = opt === undefined ? stringValue : (typeof opt === 'string' ? opt : (opt as ValueOption).value);
    }
    const oldValue = this.dataSource().getRow(idx)[field];
    if (oldValue === newValue) return;
    this.dataSource().patchRow(idx, { [field]: newValue });
    const ci = this.visibleColDefs().findIndex(c => c.field === field);
    this.control()?.pushEdit({ rowIndex: idx, field, oldValue, newValue });
    if (!this.useSidebarEditor()) {
      // Only emit a change when the edit came from the grid 
      this.cellEdit.emit({ position: { rowIndex: idx, colIndex: ci }, field, oldValue, newValue });
    }
  }

  /**
   * Download the currently visible, filtered rows as a CSV file.
   * Uses display values (ValueOption labels, formatters) and respects column visibility.
   * Group header rows are excluded — only data rows are exported.
   *
   * @param filename  Output filename, defaults to `'export.csv'`.
   */
  exportCsv(filename = 'export.csv'): void {
    const cols = this.visibleColDefs();
    const dataRows = this.filteredItems()
      .filter((item): item is { row: Record<string, unknown>; originalIndex: number } => isDataRowItemFn(item))
      .map(item => item.row);

    const esc = (v: string): string => /[,"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const header = cols.map(c => esc(c.header)).join(',');
    const locale = this.locale();
    const body   = dataRows.map(row => cols.map(c => esc(getDisplayForField(c, row[c.field], locale))).join(',')).join('\n');

    const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** @internal */ goToFirstPage(): void { this.control()?.setPage(1); }
  /** @internal */ goToLastPage(): void  { this.control()?.setPage(this.totalPages()); }
  /** @internal */ goToNextPage(): void  { const c = this.control(); if (c) c.setPage(Math.min(c.currentPage() + 1, this.totalPages())); }
  /** @internal */ goToPrevPage(): void  { const c = this.control(); if (c) c.setPage(Math.max(c.currentPage() - 1, 1)); }

  /** Resize every visible column to fit its header and current row values. */
  autosizeAllColumns(): void {
    this.columnSizing.autosizeAllColumns();
  }

  /** @internal Full display value for a cell — used as the `title` tooltip attribute. */
  getCellTitle(col: ColDef, value: unknown): string {
    return getDisplayForField(col, value, this.locale());
  }

  /** @internal Dynamic CSS class string for a cell from `ColDef.cellClass`. */
  getCellClass(col: ColDef, value: unknown, row: Record<string, unknown>): string {
    return col.cellClass?.({ value, row }) ?? '';
  }

  /** @internal Short symbol shown before the footer aggregate value. */
  getAggregateLabel(col: ColDef): string {
    const aggregate = this.control()?.aggregates()[col.field] ?? col.aggregate;
    if (!aggregate || typeof aggregate === 'function') return '';
    return { sum: 'Σ', avg: 'Ø', min: '↓', max: '↑', count: '#' }[aggregate] ?? '';
  }

  /** @internal Whether a column has a static or control-configured aggregate. */
  hasAggregate(col: ColDef): boolean {
    return this.control()?.aggregates()[col.field] !== undefined || !!col.aggregate;
  }

  /** @internal Formatted footer value — uses the column formatter when set, otherwise locale number. */
  getFooterDisplay(col: ColDef, value: unknown): string {
    if (value == null || value === '') return '';
    if (col.formatter) return col.formatter(value);
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  }

  // ── Internal signals ─────────────────────────────────────────────────────────

  private readonly _expandedGroups = signal<{ field: string | null; labels: Set<string> }>({
    field: null, labels: new Set(),
  });

  // ── Derived state ─────────────────────────────────────────────────────────────

  readonly allowRowReorder = computed(() =>
    (this.control()?.allowRowReorder() ?? false) && !this.control()?.groupByField()
  );

  /** `true` when there is a committed edit that can be undone (Ctrl+Z). */
  readonly canUndo = computed(() => this.control()?.canUndo() ?? false);

  /** `true` when there is a previously undone edit that can be re-applied (Ctrl+Y / Ctrl+Shift+Z). */
  readonly canRedo = computed(() => this.control()?.canRedo() ?? false);

  /**
   * Columns currently visible (hidden ones still participate in filter/sort/group logic).
   * Seeded from `ColDef.hidden` on first render via the constructor effect.
   */
  readonly visibleColDefs = computed(() => {
    const ctrl = this.control();
    let cols = ctrl
      ? this.colDefs().filter(c => !ctrl.hiddenColumns().has(c.field))
      : this.colDefs().filter(c => !c.hidden);

    if (ctrl) {
      const order = ctrl.columnOrder();
      if (order.length > 0) {
        const orderMap = new Map(order.map((f, i) => [f, i]));
        cols = [...cols].sort((a, b) =>
          (orderMap.get(a.field) ?? Infinity) - (orderMap.get(b.field) ?? Infinity)
        );
      }
      const pinned = ctrl.pinnedColumns();
      if (pinned.size > 0) {
        cols = [...cols.filter(c => pinned.has(c.field)), ...cols.filter(c => !pinned.has(c.field))];
      }
    } else {
      const pinnedCols = cols.filter(c => c.pinned === 'left');
      if (pinnedCols.length > 0) {
        cols = [...pinnedCols, ...cols.filter(c => c.pinned !== 'left')];
      }
    }
    return cols;
  });

  /** Columns currently pinned to the left (in display order). */
  readonly pinnedColDefs = computed(() => {
    const ctrl = this.control();
    if (ctrl) {
      const pinned = ctrl.pinnedColumns();
      return pinned.size > 0 ? this.visibleColDefs().filter(c => pinned.has(c.field)) : [];
    }
    return this.visibleColDefs().filter(c => c.pinned === 'left');
  });

  /** Columns pinned to the right edge. */
  readonly rightPinnedColDefs = computed(() => {
    const ctrl = this.control();
    if (ctrl) {
      const pinned = ctrl.pinnedRightColumns();
      return pinned.size > 0 ? this.visibleColDefs().filter(c => pinned.has(c.field)) : [];
    }
    return this.visibleColDefs().filter(c => c.pinned === 'right');
  });

  readonly rightGridTemplateColumns = computed(() =>
    this.rightPinnedColDefs().map(c => this.getColumnWidthToken(c)).join(' ')
  );

  readonly rightPinnedPaneWidth = computed(() =>
    this.rightPinnedColDefs().reduce((sum, c) => sum + this.getColumnWidth(c), 0)
  );

  readonly hasRightPinnedPane = computed(() => this.rightPinnedColDefs().length > 0);

  /** Columns rendered in the horizontally scrollable pane. */
  readonly scrollableColDefs = computed(() =>
    this.visibleColDefs().filter(c => !this.isColumnPinned(c.field) && !this.isColumnPinnedRight(c.field))
  );

  readonly hasPinnedPane = computed(() =>
    this.showControlColumn() || this.pinnedColDefs().length > 0
  );

  readonly hasFilterableColumns = computed(() => this.visibleColDefs().some(c => c.filterable));

  private readonly projection = new AgridProjectionModel({
    dataSource: this.dataSource,
    control: this.control,
    colDefs: this.colDefs,
    visibleColDefs: this.visibleColDefs,
    locale: this.locale,
    serverSideFiltering: this.serverSideFiltering,
    sortOption: this.sortOption,
    allowAddRows: this.allowAddRows,
    autoAddRows: this.autoAddRows,
    expandedGroups: this._expandedGroups,
  });

  private readonly editController = new AgridEditController({
    control: this.control,
    dataSource: this.dataSource,
    visibleColDefs: this.visibleColDefs,
    readonlyGrid: this.readonlyGrid,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    findDisplayIndex: originalIndex => this.findDisplayIndex(originalIndex),
    scrollToCell: (displayIndex, colIndex) => this.scrollToKeepVisible(displayIndex, colIndex),
    focusGrid: () => this.wrapperEl().nativeElement.focus(),
    onCellEdit: event => this.cellEdit.emit(event),
  });

  /** Total filtered row count regardless of current page. */
  readonly filteredRowCount = this.projection.filteredRowCount;

  /** Total number of pages given the current filter and page size. */
  readonly totalPages = this.projection.totalPages;

  readonly showPagination = this.projection.showPagination;

  /** Number of rendered semantic rows, including the header row. */
  readonly ariaRowCount = computed(() =>
    this.displayItems().length + 1 + (this.showFooter() ? 1 : 0)
  );

  /** Number of visible semantic columns, including the optional control column. */
  readonly ariaColCount = computed(() =>
    this.visibleColDefs().length + (this.showControlColumn() ? 1 : 0)
  );

  /** True when no rows or group headers are visible (ignores add-row sentinel and ghost). */
  readonly isEmpty = computed(() =>
    !this.loading() && this.filteredItems().every(item => item === null || item === 'ghost')
  );

  /**
   * @internal Effective aggregate for the column menu — string values only.
   * Custom function aggregates from ColDef can't be represented in the menu so they return null.
   */
  getEffectiveAggregate(col: ColDef): 'sum' | 'avg' | 'min' | 'max' | 'count' | null {
    const ctrlAgg = this.control()?.aggregates()[col.field];
    if (ctrlAgg !== undefined) return ctrlAgg;
    const colAgg = col.aggregate;
    return typeof colAgg === 'string' ? colAgg : null;
  }

  /** True when at least one visible column has an aggregate function (from ColDef or control). */
  readonly showFooter = this.projection.showFooter;

  /** Computed aggregate value per column field, over currently filtered rows. */
  readonly footerValues = this.projection.footerValues;

  readonly gridTemplateColumns = computed(() => {
    const cols = this.visibleColDefs().map(c => this.getColumnWidthToken(c)).join(' ');
    return this.showControlColumn() ? `24px ${cols}` : cols;
  });

  readonly pinnedGridTemplateColumns = computed(() => {
    const cols = this.pinnedColDefs().map(c => this.getColumnWidthToken(c)).join(' ');
    if (this.showControlColumn()) return cols ? `24px ${cols}` : '24px';
    return cols;
  });

  readonly scrollableGridTemplateColumns = computed(() =>
    this.scrollableColDefs().map(c => this.getColumnWidthToken(c)).join(' ')
  );

  readonly totalWidth = computed(() => {
    const w = this.visibleColDefs().reduce((sum, c) => sum + this.getColumnWidth(c), 0);
    return this.showControlColumn() ? w + 24 : w;
  });

  readonly pinnedPaneWidth = computed(() =>
    (this.showControlColumn() ? 24 : 0)
      + this.pinnedColDefs().reduce((sum, c) => sum + this.getColumnWidth(c), 0)
  );

  readonly scrollableTotalWidth = computed(() =>
    this.scrollableColDefs().reduce((sum, c) => sum + this.getColumnWidth(c), 0)
  );

  /**
   * Filtered, sorted, and optionally grouped row list for `*cdkVirtualFor`.
   * Appends `null` when the explicit add-row placeholder is active.
   */
  readonly filteredItems = this.projection.filteredItems;

  /** Virtual scroll source — injects ghost row during a reorder drag. */
  /** Maps originalIndex → true if the data row should receive the odd-row stripe. Counts only data rows, so group headers don't shift the pattern. */
  readonly dataRowIsOdd = computed<Map<number, boolean>>(() => {
    const map = new Map<number, boolean>();
    let rank = 0;
    for (const item of this.filteredItems()) {
      if (isDataRowItemFn(item)) map.set(item.originalIndex, (rank++ % 2) !== 0);
    }
    return map;
  });

  readonly displayItems = computed<GridItem[]>(() => {
    const items = this.filteredItems();
    const dragIdx = this.dragHandler.reorderOriginalIndex();
    if (dragIdx === null) return items;

    const sourcePos = items.findIndex(item => isDataRowItemFn(item) && item.originalIndex === dragIdx);
    const withoutSource: GridItem[] = sourcePos === -1
      ? [...items]
      : [...items.slice(0, sourcePos), ...items.slice(sourcePos + 1)];

    const overIdx = this.dragHandler.reorderOverIndex();
    if (overIdx === null) return withoutSource;

    const targetPos = withoutSource.findIndex(item => isDataRowItemFn(item) && item.originalIndex === overIdx);
    if (targetPos === -1) return withoutSource;

    const insertAt = this.dragHandler.reorderInsertBefore() ? targetPos : targetPos + 1;
    const result = [...withoutSource];
    result.splice(insertAt, 0, 'ghost');
    return result;
  });

  // ── Menu signals ─────────────────────────────────────────────────────────────

  readonly contextMenu    = signal<{ x: number; y: number; rowIndex: number } | null>(null);
  readonly cellContextMenuState = signal<{
    x: number; y: number;
    rowIndex: number; colIndex: number;
    field: string; value: unknown;
    row: Record<string, unknown>;
  } | null>(null);
  readonly filterMenu     = signal<{ field: string; x: number; y: number } | null>(null);
  readonly groupActionsMenu = signal<{ x: number; y: number; label: string } | null>(null);
  readonly filterMenuSearch = signal<string>('');

  readonly filterMenuItems = computed<{ label: string; rawStr: string }[]>(() => {
    const menu = this.filterMenu();
    if (!menu) return [];
    const col = this.colDefs().find(c => c.field === menu.field);
    const vals = col?.values;
    if (vals?.length) {
      return vals
        .map(v => typeof v === 'string'
          ? { label: v, rawStr: v }
          : { label: (v as ValueOption).label, rawStr: String((v as ValueOption).value) })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }
    const rows = this.dataSource().rows();
    const rawStrs = [...new Set(rows.map(r => String(r[menu.field] ?? '')))];
    return rawStrs
      .map(rawStr => ({ label: col?.formatter ? col.formatter(rawStr) : rawStr, rawStr }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
  });

  readonly filterMenuVisibleItems = computed(() => {
    const search = this.filterMenuSearch().toLowerCase();
    return this.filterMenuItems().filter(item => !search || item.label.toLowerCase().includes(search));
  });

  readonly columnMenuValueItems = computed<AgridColumnMenuValueItem[]>(() => {
    const menu = this.filterMenu();
    if (!menu) return [];
    return this.filterMenuVisibleItems().map(item => ({
      ...item,
      active: this.isMenuValueActive(item.rawStr),
      selected: this.isMenuValueSelected(menu.field, item.rawStr),
    }));
  });

  readonly filterMenuActiveValues = computed(() => {
    const menu = this.filterMenu();
    if (!menu) return new Set<string>();
    const rows = this.dataSource().rows();
    const ctrl = this.control();
    const openField = menu.field;
    let indices = rows.map((_, i) => i);
    if (ctrl) {
      const filters = ctrl.filters();
      for (const [field, filter] of Object.entries(filters)) {
        if (field === openField) continue;
        if (filter.text) {
          const lc = filter.text.toLowerCase();
          indices = indices.filter(i => String(rows[i][field] ?? '').toLowerCase().includes(lc));
        }
        if (filter.selectedValues !== null) {
          const allowed = new Set(filter.selectedValues);
          indices = indices.filter(i => allowed.has(String(rows[i][field] ?? '')));
        }
      }
    }
    return new Set(indices.map(i => String(rows[i][openField] ?? '')));
  });

  readonly findMatches = computed<FindMatch[]>(() => {
    const query = this.findQuery().trim().toLowerCase();
    if (!query) return [];
    const cols = this.visibleColDefs();
    const matches: FindMatch[] = [];
    this.filteredItems().forEach((item, displayIndex) => {
      if (!isDataRowItemFn(item)) return;
      for (let colIndex = 0; colIndex < cols.length; colIndex++) {
        const col = cols[colIndex];
        const value = getDisplayForField(col, item.row[col.field], this.locale()).toLowerCase();
        if (value.includes(query)) {
          matches.push({ rowIndex: item.originalIndex, displayIndex, colIndex });
        }
      }
    });
    return matches;
  });

  // ── Infrastructure ────────────────────────────────────────────────────────────

  private readonly viewport    = viewChild.required<CdkVirtualScrollViewport>('scrollViewport');
  private readonly pinnedViewport      = viewChild<CdkVirtualScrollViewport>('pinnedViewport');
  private readonly rightPinnedViewport = viewChild<CdkVirtualScrollViewport>('rightPinnedViewport');
  private readonly wrapperEl   = viewChild.required<ElementRef<HTMLDivElement>>('wrapper');
  private readonly horizontalScrollerEl =
    viewChild.required<ElementRef<HTMLDivElement>>('horizontalScroller');
  private readonly destroyRef  = inject(DestroyRef);
  private readonly _hostEl     = inject(ElementRef<HTMLElement>);

  private readonly rangeController = new AgridRangeController({
    control: this.control,
    dataSource: this.dataSource,
    filteredItems: this.filteredItems,
    visibleColDefs: this.visibleColDefs,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    isCellEditable: col => this.isCellEditable(col),
    cancelEdit: () => this.cancelCurrent(),
    findDisplayIndex: originalIndex => this.findDisplayIndex(originalIndex),
    scrollToCell: (displayIndex, colIndex) => this.scrollToKeepVisible(displayIndex, colIndex),
    onCellEdit: event => this.cellEdit.emit(event),
  }, this.destroyRef);

  private readonly columnSizing = new AgridColumnSizingController({
    control: this.control,
    filteredItems: this.filteredItems,
    visibleColDefs: this.visibleColDefs,
    scrollableColDefs: this.scrollableColDefs,
    locale: this.locale,
    isColumnPinned: field => this.isColumnPinned(field),
    wrapperElement: () => this.wrapperEl().nativeElement,
    scrollerElement: () => this.horizontalScrollerEl().nativeElement,
  }, this.destroyRef);

  private readonly navigationController = new AgridNavigationController({
    control: this.control,
    dataSource: this.dataSource,
    filteredItems: this.filteredItems,
    filteredSortedIndices: this.projection.filteredSortedIndices,
    colDefs: this.colDefs,
    visibleColDefs: this.visibleColDefs,
    rowHeight: this.rowHeight,
    allowAddRows: this.allowAddRows,
    autoAddRows: this.autoAddRows,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    editingCell: this.editController.editingCell,
    isEditing: (originalIndex, colIndex) => this.isEditing(originalIndex, colIndex),
    startEdit: (originalIndex, colIndex, seedChar) =>
      this.editController.start(originalIndex, colIndex, seedChar),
    commitEdit: () => this.editController.commit(),
    cancelEdit: () => this.editController.cancel(),
    undoEdit: () => this.editController.undo(),
    redoEdit: () => this.editController.redo(),
    extendRangeTo: (originalIndex, colIndex) =>
      this.rangeController.extendTo(originalIndex, colIndex),
    openFind: () => this.openFind(),
    focusGrid: () => this.wrapperEl().nativeElement.focus(),
    viewport: () => this.viewport(),
    scrollColumnToKeepVisible: colIndex =>
      this.columnSizing.scrollColumnToKeepVisible(colIndex),
    onPrepareAddRecord: event => this.prepareAddRecord.emit(event),
  });

  private readonly clipboardHandler = new AgridClipboardHandler({
    control: this.control,
    dataSource: this.dataSource,
    filteredItems: this.filteredItems,
    visibleColDefs: this.visibleColDefs,
    locale: this.locale,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    isCellEditable: col => this.isCellEditable(col),
    onCellEdit: event => this.cellEdit.emit(event),
    scrollToCell: (displayIndex, colIndex) => this.scrollToKeepVisible(displayIndex, colIndex),
  });

  readonly dragHandler = new AgridDragHandler({
    dataSource: this.dataSource,
    filteredItems: () => this.filteredItems(),
    locale: () => this.locale(),
    selectedIndices: this._selectedIndices,
    onReorder: e => this.rowReorder.emit(e),
    onSelectionChange: () => this._emitRowSelect(),
  }, this.destroyRef);

  // ── Column reorder drag ───────────────────────────────────────────────────────

  private readonly _colDragField        = signal<string | null>(null);
  private readonly _colDragOverField    = signal<string | null>(null);
  private readonly _colDragInsertBefore = signal<boolean>(true);
  private _colDragStartField: string | null = null;
  private _colDragStartX = 0;

  private readonly _filterDebounces = new Map<string, ReturnType<typeof setTimeout>>();

  /** @internal Start a column header drag. */
  onColHeaderPointerDown(event: PointerEvent, field: string): void {
    if (!this.control() || event.button !== 0) return;
    if (this.getColDef(field)?.locked) return;
    this._colDragStartField = field;
    this._colDragStartX = event.clientX;
    document.addEventListener('pointermove', this._colDragMove);
    document.addEventListener('pointerup',   this._colDragUp);
  }

  private readonly _colDragMove = (e: PointerEvent): void => {
    if (!this._colDragStartField) return;
    if (this._colDragField() === null) {
      if (Math.abs(e.clientX - this._colDragStartX) < 5) return;
      this._colDragField.set(this._colDragStartField);
    }
    const hovered = this._getHoveredHeaderCell(e.clientX, e.clientY);
    if (hovered && hovered.field !== this._colDragField()) {
      this._colDragOverField.set(hovered.field);
      this._colDragInsertBefore.set(hovered.insertBefore);
    } else {
      this._colDragOverField.set(null);
    }
  };

  private readonly _colDragUp = (): void => {
    document.removeEventListener('pointermove', this._colDragMove);
    document.removeEventListener('pointerup',   this._colDragUp);
    const from = this._colDragField();
    const to   = this._colDragOverField();
    if (from && to) {
      this.control()?.moveColumn(
        this.visibleColDefs().map(c => c.field), from, to, this._colDragInsertBefore()
      );
    }
    this._colDragField.set(null);
    this._colDragOverField.set(null);
    this._colDragStartField = null;
  };

  private _getHoveredHeaderCell(x: number, y: number): { field: string; insertBefore: boolean } | null {
    for (const el of document.elementsFromPoint(x, y)) {
      const headerEl = (el as HTMLElement).closest<HTMLElement>('.ag-header-cell[data-col-field]');
      if (!headerEl?.dataset['colField']) continue;
      const rect = headerEl.getBoundingClientRect();
      return { field: headerEl.dataset['colField'], insertBefore: x < rect.left + rect.width / 2 };
    }
    return null;
  }

  /** @internal Whether the given column header is being dragged. */
  isColDragging(field: string): boolean {
    return this._colDragField() === field;
  }

  /** @internal Template helper for drop-indicator class. */
  getColDropSide(field: string): 'before' | 'after' | null {
    if (this._colDragOverField() !== field || this._colDragField() === field) return null;
    return this._colDragInsertBefore() ? 'before' : 'after';
  }

  // ── Setup ─────────────────────────────────────────────────────────────────────

  private readonly _seededControls = new WeakSet<AgridControl>();

  constructor() {
    afterNextRender(() => {
      const wrapper = this.wrapperEl().nativeElement;
      const onKeyDown = (event: KeyboardEvent) => this.onKeyDown(event);
      wrapper.addEventListener('keydown', onKeyDown, { capture: true });
      this.destroyRef.onDestroy(() =>
        wrapper.removeEventListener('keydown', onKeyDown, { capture: true })
      );
    });

    // Emit pageChange whenever page or pageSize changes in server-side pagination mode.
    effect(() => {
      const ctrl = this.control();
      if (!ctrl || ctrl.totalRows() <= 0 || ctrl.pageSize() <= 0) return;
      const page = ctrl.currentPage();
      const pageSize = ctrl.pageSize();
      const totalRows = ctrl.totalRows();
      const startRow = (page - 1) * pageSize;
      const endRow = Math.min(page * pageSize, totalRows) - 1;
      this.pageChange.emit({ page, pageSize, startRow, endRow });
    });

    effect(() => {
      const added = this.dataSource().rowAdded();
      if (!added) return;
      this.navigationController.revealRow(added.index);
    });

    // Deselect when clicking outside the grid.
    const onOutsidePointerDown = (e: PointerEvent) => {
      if (this.rowSelection() === 'none') return;
      if (this._selectedIndices().size === 0) return;
      if (this._hostEl.nativeElement.contains(e.target as Node)) return;
      this._selectedIndices.set(new Set());
      this.rowSelect.emit(null);
    };
    document.addEventListener('pointerdown', onOutsidePointerDown);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('pointerdown', onOutsidePointerDown);
      document.removeEventListener('pointermove', this._colDragMove);
      document.removeEventListener('pointerup',   this._colDragUp);
      for (const timer of this._filterDebounces.values()) clearTimeout(timer);
      this._filterDebounces.clear();
    });

    // Re-sync pinned pane scroll after displayItems changes — CDK independently adjusts
    // each viewport when item count changes (group/ungroup, collapse), which can leave
    // the panes offset by one row.
    effect(() => {
      this.displayItems();
      setTimeout(() => {
        const viewport = this.viewport();
        viewport.checkViewportSize();
        this.pinnedViewport()?.checkViewportSize();
        this.rightPinnedViewport()?.checkViewportSize();

        const offset = viewport.measureScrollOffset();
        this.pinnedViewport()?.scrollToOffset(offset);
        this.rightPinnedViewport()?.scrollToOffset(offset);
      }, 0);
    });

    // Seed ColDef.hidden and ColDef.pinned into the control once per control instance.
    effect(() => {
      const ctrl = this.control();
      const cols = this.colDefs();
      if (!ctrl || this._seededControls.has(ctrl)) return;
      this._seededControls.add(ctrl);
      for (const col of cols) {
        if (col.hidden) ctrl.setColumnVisibility(col.field, false);
        if (col.pinned === 'left')  ctrl.setPinned(col.field, true);
        if (col.pinned === 'right') ctrl.setPinnedRight(col.field, true);
      }
    });
  }

  // ── Template helpers — type guards ────────────────────────────────────────────

  /** @internal */
  isDataRowItem(item: GridItem): item is { row: Record<string, unknown>; originalIndex: number } {
    return isDataRowItemFn(item);
  }

  /** @internal */
  isGroupHeaderItem(item: GridItem): item is { groupLabel: string; count: number; collapsed: boolean } {
    return isGroupHeaderItemFn(item);
  }

  /** @internal */
  getItemOriginalIndex(item: GridItem): number | null {
    return isDataRowItemFn(item) ? item.originalIndex : null;
  }

  /** @internal CDK trackBy — arrow to preserve `this`. */
  readonly trackByItem = (_di: number, item: GridItem): string | number => {
    if (item === 'ghost') return '__ghost__';
    if (item === null) return -1;
    if (isGroupHeaderItemFn(item)) return `__group__${item.groupLabel}`;
    return item.originalIndex;
  };

  // ── Template helpers — cell/selection state ───────────────────────────────────

  /** @internal */
  isSelected(originalIndex: number, ci: number): boolean {
    const sel = this.selectedCell();
    return sel?.rowIndex === originalIndex && sel?.colIndex === ci;
  }

  /** @internal */
  isEditing(originalIndex: number, ci: number): boolean {
    const ed = this.editingCell();
    return ed?.rowIndex === originalIndex && ed?.colIndex === ci;
  }

  /** @internal */
  getSeedChar(originalIndex: number, ci: number): string {
    return this.isEditing(originalIndex, ci) ? this.editSeedChar() : '';
  }

  /** @internal */
  isAddRowSelected(): boolean {
    const sel = this.selectedCell();
    return this.allowAddRows() && sel?.rowIndex === this.dataSource().length;
  }

  /** @internal */
  isRowSelected(originalIndex: number): boolean {
    return this._selectedIndices().has(originalIndex);
  }

  /** @internal Selection class for the separate pinned/control viewport. */
  isPinnedPaneRowSelected(item: GridItem): boolean {
    return isDataRowItemFn(item) && this.isRowSelected(item.originalIndex);
  }

  // ── Template helpers — filter menu ────────────────────────────────────────────

  /** @internal */
  /** @internal 1-based sort priority for a column, 0 if not sorted. */
  getSortPriority(field: string): number { return this.control()?.getSortPriority(field) ?? 0; }

  /** @internal Whether more than one column is currently sorted. */
  hasMultiSort(): boolean {
    return this.sortOption() === 'multi' && this.effectiveSortOrder().length > 1;
  }

  getTextFilter(field: string): string { return this.control()?.getFilter(field).text ?? ''; }

  /** @internal */
  getSort(field: string): 'asc' | 'desc' | null {
    return this.sortOption() === 'none' ? null : this.control()?.getFilter(field).sort ?? null;
  }

  /** @internal */
  isMenuAllSelected(field: string): boolean {
    return this.control()?.getFilter(field).selectedValues === null;
  }

  /** @internal */
  isMenuValueActive(rawStr: string): boolean { return this.filterMenuActiveValues().has(rawStr); }

  /** @internal */
  isMenuValueSelected(field: string, value: string): boolean {
    const selected = this.control()?.getFilter(field).selectedValues;
    if (selected == null) return true;
    return selected.includes(value);
  }

  /** @internal */
  hasActiveFilter(field: string): boolean { return this.control()?.hasActiveFilter(field) ?? false; }

  /** @internal */
  getColDef(field: string): ColDef | undefined { return this.colDefs().find(c => c.field === field); }

  /** @internal */
  getVisibleColIndex(field: string): number {
    return this.visibleColDefs().findIndex(c => c.field === field);
  }

  /** @internal Convert a zero-based visible data-column index to a one-based ARIA index. */
  getAriaColIndex(colIndex: number): number {
    return colIndex + 1 + (this.showControlColumn() ? 1 : 0);
  }

  /** @internal */
  isColumnHidden(field: string): boolean { return this.control()?.isColumnHidden(field) ?? false; }

  /** @internal */
  isGroupedByField(field: string): boolean { return this.control()?.groupByField() === field; }

  /** @internal */
  isColumnPinned(field: string): boolean {
    return this.pinnedColDefs().some(c => c.field === field);
  }

  isColumnPinnedRight(field: string): boolean {
    return this.rightPinnedColDefs().some(c => c.field === field);
  }

  /** Returns `'left'`, `'right'`, or `false` — used by the column menu. */
  getColumnPinState(field: string): 'left' | 'right' | false {
    if (this.isColumnPinned(field)) return 'left';
    if (this.isColumnPinnedRight(field)) return 'right';
    return false;
  }

  isFirstRightPinnedColumn(field: string): boolean {
    const cols = this.rightPinnedColDefs();
    return cols.length > 0 && cols[0].field === field;
  }

  /** @internal Returns `true` for the rightmost pinned column (used to draw the separator shadow). */
  isLastPinnedColumn(field: string): boolean {
    const cols = this.pinnedColDefs();
    return cols.length > 0 && cols[cols.length - 1].field === field;
  }

  // ── Row selection ─────────────────────────────────────────────────────────────

  private _selectionPivot: number | null = null;

  /** @internal */
  onRowPointerDown(event: PointerEvent, originalIndex: number): void {
    this.selectRowFromPointer(event, originalIndex, true);
  }

  /** @internal Emits rowClick when the user single-clicks a data row outside of a cell editor. */
  onRowClick(event: MouseEvent, item: { row: Record<string, unknown>; originalIndex: number }): void {
    if (this.editingCell()) return;
    this.rowClick.emit({ row: item.row, originalIndex: item.originalIndex });
  }

  private selectRowFromPointer(event: PointerEvent, originalIndex: number, allowDragSelect: boolean): void {
    const mode = this.rowSelection();
    if (mode === 'none' || event.button !== 0) return;

    if (mode === 'single') {
      const already = this._selectedIndices().has(originalIndex);
      this._selectedIndices.set(already ? new Set() : new Set([originalIndex]));
      this._emitRowSelect();
      return;
    }

    const ctrl  = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    if (ctrl) {
      const next = new Set(this._selectedIndices());
      if (next.has(originalIndex)) next.delete(originalIndex); else next.add(originalIndex);
      this._selectedIndices.set(next);
      this._selectionPivot = originalIndex;
      this._emitRowSelect();
    } else if (shift && this._selectionPivot !== null) {
      this._selectedIndices.set(
        buildSelectionRange(this._selectionPivot, originalIndex, this.filteredItems())
      );
      this._emitRowSelect();
    } else {
      if (!(event.target instanceof HTMLSelectElement)) event.preventDefault();
      this._selectedIndices.set(new Set([originalIndex]));
      this._selectionPivot = originalIndex;
      if (allowDragSelect) this.dragHandler.startDragSelect(originalIndex);
      else this._emitRowSelect();
    }
  }

  private _emitRowSelect(): void {
    const indices = this._selectedIndices();
    if (indices.size === 0) { this.rowSelect.emit(null); return; }
    const rows = this.dataSource().rows();
    this.rowSelect.emit({ rows: [...indices].map(i => ({ row: rows[i], originalIndex: i })) });
  }

  // ── Cell interaction ──────────────────────────────────────────────────────────

  /** @internal */
  onActivate(originalIndex: number, ci: number, event?: MouseEvent): void {
    this.navigationController.activateCell(originalIndex, ci, event);
  }

  /** @internal */
  onActivateAddRow(): void {
    this.navigationController.activateAddRow();
  }

  /** @internal */
  onStartEdit(originalIndex: number, ci: number): void {
    const row = this.dataSource().rows()[originalIndex];
    this.rowDoubleClicked.emit({row,originalIndex});
    if (this.isEditing(originalIndex, ci)) return;
    this.enterEdit(originalIndex, ci, '');
  }

  /** @internal */
  onDraftChange(value: unknown): void { this.editController.setDraft(value); }

  /** @internal Starts a fill-handle drag from the bottom-right corner of the selection. */
  onCellPointerDown(event: PointerEvent, originalIndex: number, colIndex: number): void {
    this.rangeController.startFill(event, originalIndex, colIndex);
  }

  /** @internal Main keyboard handler delegated from the wrapper div. */
  onKeyDown(event: KeyboardEvent): void {
    this.navigationController.handleKeyDown(event);
  }

  /** Open the find panel and focus its input. */
  openFind(): void {
    this.findOpen.set(true);
  }

  /** @internal */
  closeFind(): void {
    this.findOpen.set(false);
    this.wrapperEl().nativeElement.focus();
  }

  /** @internal */
  onFindInput(value: string): void {
    this.findQuery.set(value);
    this.findActiveIndex.set(-1);
    this.goToFindMatch(1);
  }

  /** @internal */
  goToFindMatch(direction: 1 | -1): void {
    const matches = this.findMatches();
    if (matches.length === 0) {
      this.findActiveIndex.set(-1);
      return;
    }
    const current = this.findActiveIndex();
    const next = current < 0
      ? (direction === 1 ? 0 : matches.length - 1)
      : (current + direction + matches.length) % matches.length;
    this.findActiveIndex.set(next);
    const match = matches[next];
    this.selectedRange.set(null);
    this.selectedCell.set({ rowIndex: match.rowIndex, colIndex: match.colIndex });
    this.scrollToKeepVisible(match.displayIndex, match.colIndex);
  }

  // ── Row reorder ───────────────────────────────────────────────────────────────

  /** @internal Ghost cell display during a reorder drag. */
  getGhostCellDisplay(col: ColDef): string { return this.dragHandler.getGhostDisplay(col); }

  /** @internal Delegates to AgridDragHandler. */
  onHandlePointerDown(event: PointerEvent, originalIndex: number): void {
    if (!this.allowRowReorder()) return;
    this.dragHandler.startReorder(event, originalIndex);
  }

  /** @internal Handles the control column without letting the row receive a second pointer event. */
  onControlPointerDown(event: PointerEvent, originalIndex: number): void {
    event.stopPropagation();
    if (this.allowRowReorder()) {
      this.onHandlePointerDown(event, originalIndex);
      return;
    }
    this.selectRowFromPointer(event, originalIndex, false);
  }

  /** @internal Copy the active range or cell as TSV. */
  onCopy(event: ClipboardEvent): void {
    this.clipboardHandler.copy(event);
  }

  /** @internal Paste TSV/CSV-like plain text into the current cell. */
  onPaste(event: ClipboardEvent): void {
    if (this.editingCell()) return;
    this.clipboardHandler.paste(event);
  }

  // ── Column resize ─────────────────────────────────────────────────────────────

  /** @internal Starts pointer-based column resizing. */
  onResizeStart(event: MouseEvent, col: ColDef): void {
    this.columnSizing.startResize(event, col);
  }

  /** @internal Resize a column from its keyboard-accessible separator handle. */
  onResizeKeyDown(event: KeyboardEvent, col: ColDef): void {
    this.columnSizing.resizeFromKeyboard(event, col);
  }

  /** @internal Autosize a column to fit its header and currently visible row values. */
  onAutosizeColumn(event: MouseEvent, col: ColDef): void {
    if (col.locked) return;
    event.preventDefault();
    event.stopPropagation();
    this.columnSizing.autosizeColumn(col);
    const selected = this.selectedCell();
    if (selected) this.columnSizing.scrollColumnToKeepVisible(selected.colIndex);
  }

  // ── Row context menu ──────────────────────────────────────────────────────────

  /** @internal */
  onControlContextMenu(event: MouseEvent, originalIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({
      x: event.clientX,
      y: event.clientY,
      rowIndex: originalIndex,
    });
  }

  /** @internal */
  closeContextMenu(): void { this.contextMenu.set(null); }

  /** @internal */
  onCellContextMenu(event: MouseEvent, rowIndex: number, colIndex: number, col: ColDef, row: Record<string, unknown>): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeContextMenu();
    this.closeFilterMenu();
    this.closeGroupActionsMenu();
    this.cellContextMenuState.set({ x: event.clientX, y: event.clientY, rowIndex, colIndex, field: col.field, value: row[col.field], row });
  }

  /** @internal */
  closeCellContextMenu(): void { this.cellContextMenuState.set(null); }

  /** @internal Copy the display value of one cell to the clipboard. */
  copyCellToClipboard(value: unknown, col: ColDef): void {
    navigator.clipboard.writeText(getDisplayForField(col, value));
    this.closeCellContextMenu();
  }

  /** @internal Copy all visible column values of a row as TSV to the clipboard. */
  copyRowToClipboard(row: Record<string, unknown>): void {
    const text = this.visibleColDefs().map(c => getDisplayForField(c, row[c.field])).join('\t');
    navigator.clipboard.writeText(text);
    this.closeCellContextMenu();
  }

  /** @internal Insert a blank row at a specific position and emit prepareAddRecord. */
  insertRowAt(atIndex: number): void {
    this.navigationController.insertRowAt(atIndex);
    this.closeCellContextMenu();
  }

  /** Delete the row at `originalIndex`, adjusting stale cell/edit pointers. */
  deleteRow(originalIndex: number): void {
    this.dataSource().removeRow(originalIndex);

    const sel = this.selectedCell();
    if (sel?.rowIndex === originalIndex) this.selectedCell.set(null);
    else if (sel && sel.rowIndex > originalIndex)
      this.selectedCell.update(s => s ? { ...s, rowIndex: s.rowIndex - 1 } : null);

    this.editController.onRowRemoved(originalIndex);

    if (this._selectedIndices().has(originalIndex)) {
      this._selectedIndices.update(s => { const n = new Set(s); n.delete(originalIndex); return n; });
      this._emitRowSelect();
    }
    this.contextMenu.set(null);
    this.rowRemoved.emit({ oldIndex: originalIndex });
  }

  // ── Group expand / collapse ───────────────────────────────────────────────────

  /** @internal */
  onGroupHeaderClick(label: string): void {
    const groupField = this.control()?.groupByField() ?? null;
    this._expandedGroups.update(state => {
      const labels = state.field === groupField ? new Set(state.labels) : new Set<string>();
      if (labels.has(label)) labels.delete(label); else labels.add(label);
      return { field: groupField, labels };
    });
  }

  /** Expand all groups. No-op when grouping is not active. */
  expandGroups(): void {
    const groupField = this.control()?.groupByField() ?? null;
    if (!groupField) return;
    const labels = new Set<string>();
    for (const item of this.filteredItems()) {
      if (isGroupHeaderItemFn(item)) labels.add(item.groupLabel);
    }
    this._expandedGroups.set({ field: groupField, labels });
  }

  /** Collapse all groups. No-op when grouping is not active. */
  collapseGroups(): void {
    const groupField = this.control()?.groupByField() ?? null;
    this._expandedGroups.set({ field: groupField, labels: new Set() });
  }

  /** @internal */
  getGroupDescription(label: string): string { return this.groupDescription()?.(label) ?? ''; }

  /** @internal */
  openGroupActionsMenu(event: MouseEvent, label: string): void {
    event.stopPropagation();
    this.groupActionsMenu.set({ x: event.clientX, y: event.clientY, label });
  }

  /** @internal */
  closeGroupActionsMenu(): void { this.groupActionsMenu.set(null); }

  /** @internal */
  onGroupAction(action: GroupAction, label: string): void {
    action.action(label);
    this.closeGroupActionsMenu();
  }

  // ── Filter row & menu ─────────────────────────────────────────────────────────

  /** @internal */
  onTextFilterChange(event: Event, field: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.control()?.setTextFilter(field, value);
    if (!this.serverSideFiltering()) return;

    this.cancelFilterDebounce(field);
    const delay = this.filterDebounceMs();
    if (delay === 0) {
      this.filterChange.emit({ field, value });
      return;
    }
    this._filterDebounces.set(field, setTimeout(() => {
      this._filterDebounces.delete(field);
      this.filterChange.emit({ field, value });
    }, delay));
  }

  /** @internal */
  openFilterMenu(event: MouseEvent, field: string): void {
    event.stopPropagation();
    this.filterMenuSearch.set('');
    const x = Math.min(event.clientX, window.innerWidth - 220);
    this.filterMenu.set({ field, x, y: event.clientY });
  }

  /** @internal */
  closeFilterMenu(): void { this.filterMenu.set(null); }

  /** @internal */
  onFilterMenuSearch(value: string): void {
    this.filterMenuSearch.set(value);
  }

  /** @internal */
  onMenuSort(field: string, dir: 'asc' | 'desc'): void {
    const ctrl = this.control();
    if (!ctrl || this.sortOption() === 'none') return;
    if (ctrl.getFilter(field).sort === dir) {
      const previous = ctrl.getFilter(field);
      ctrl.clearFilter(field);   // toggle off — remove from stack
      if (previous.text) ctrl.setTextFilter(field, previous.text);
      if (previous.selectedValues !== null) {
        ctrl.setSelectedValues(field, previous.selectedValues);
      }
      if (this.serverSideFiltering()) this.sortChange.emit({ field, direction: null });
    } else if (this.sortOption() === 'single') {
      const previousFields = ctrl.sortOrder().filter(sortedField => sortedField !== field);
      ctrl.setSort(field, dir);
      if (this.serverSideFiltering()) {
        for (const previousField of previousFields) {
          this.sortChange.emit({ field: previousField, direction: null });
        }
        this.sortChange.emit({ field, direction: dir });
      }
    } else {
      ctrl.addSort(field, dir);  // add to stack or switch direction
      if (this.serverSideFiltering()) this.sortChange.emit({ field, direction: dir });
    }
    this.closeFilterMenu();
  }

  /** @internal */
  onMenuClearFilter(field: string): void {
    const ctrl = this.control();
    if (!ctrl) return;
    this.cancelFilterDebounce(field);
    const previous = ctrl.getFilter(field);
    ctrl.clearFilter(field);
    if (this.serverSideFiltering()) {
      if (previous.text) this.filterChange.emit({ field, value: '' });
      if (previous.sort) this.sortChange.emit({ field, direction: null });
    }
    this.closeFilterMenu();
  }

  /** @internal */
  /** @internal Replace the entire sort stack with a single sort on this column. */
  onMenuResetSort(field: string, dir: 'asc' | 'desc'): void {
    const ctrl = this.control();
    if (!ctrl || this.sortOption() !== 'multi') return;
    const previousFields = ctrl.sortOrder().filter(sortedField => sortedField !== field);
    ctrl.setSort(field, dir);
    if (this.serverSideFiltering()) {
      for (const previousField of previousFields) {
        this.sortChange.emit({ field: previousField, direction: null });
      }
      this.sortChange.emit({ field, direction: dir });
    }
    this.closeFilterMenu();
  }

  onMenuToggleGroupBy(field: string): void {
    const ctrl = this.control();
    if (!ctrl) return;
    ctrl.setGroupBy(ctrl.groupByField() === field ? null : field);
    this.closeFilterMenu();
  }

  /** @internal */
  onMenuClearAll(): void {
    const ctrl = this.control();
    if (!ctrl) return;
    for (const field of this._filterDebounces.keys()) this.cancelFilterDebounce(field);
    const previous = ctrl.filters();
    ctrl.clearAllFilters();
    if (this.serverSideFiltering()) {
      for (const [field, filter] of Object.entries(previous)) {
        if (filter.text) this.filterChange.emit({ field, value: '' });
        if (filter.sort) this.sortChange.emit({ field, direction: null });
      }
    }
    this.closeFilterMenu();
  }

  private cancelFilterDebounce(field: string): void {
    const timer = this._filterDebounces.get(field);
    if (timer === undefined) return;
    clearTimeout(timer);
    this._filterDebounces.delete(field);
  }

  private effectiveSortOrder(): string[] {
    return this.projection.effectiveSortOrder();
  }

  /** @internal */
  onMenuToggleAll(field: string): void {
    const ctrl = this.control();
    if (!ctrl) return;
    ctrl.setSelectedValues(field, ctrl.getFilter(field).selectedValues === null ? [] : null);
  }

  /** @internal */
  onMenuToggleValue(field: string, rawStr: string): void {
    const ctrl = this.control();
    if (!ctrl) return;
    const allRawStrs = this.filterMenuItems().map(i => i.rawStr);
    const current = ctrl.getFilter(field).selectedValues ?? allRawStrs;
    const next = current.includes(rawStr) ? current.filter(v => v !== rawStr) : [...current, rawStr];
    ctrl.setSelectedValues(field, next.length === allRawStrs.length ? null : next);
  }

  /** @internal */
  onSidebarToggleColumn(field: string): void { this.control()?.toggleColumnVisibility(field); }

  /** @internal Mirrors vertical scrolling from the main viewport into both pinned panes. */
  onBodyScroll(): void {
    const offset = this.viewport().measureScrollOffset();
    this.pinnedViewport()?.scrollToOffset(offset);
    this.rightPinnedViewport()?.scrollToOffset(offset);
  }

  /** @internal */
  onRightPinnedBodyScroll(): void {
    const right = this.rightPinnedViewport();
    if (!right) return;
    const offset = right.measureScrollOffset();
    if (Math.abs(offset - this.viewport().measureScrollOffset()) < 1) return;
    this.viewport().scrollToOffset(offset);
    this.pinnedViewport()?.scrollToOffset(offset);
  }

  /** @internal */
  onMenuTogglePin(field: string): void {
    this.control()?.togglePinned(field);
    this.closeFilterMenu();
  }

  /** @internal */
  onMenuTogglePinRight(field: string): void {
    this.control()?.togglePinnedRight(field);
    this.closeFilterMenu();
  }

  /** @internal */
  onMenuAutosizeColumn(field: string): void {
    const col = this.getColDef(field);
    if (!col) return;
    this.columnSizing.autosizeColumn(col);
    this.closeFilterMenu();
  }

  /** @internal */
  onMenuSetAggregate(field: string, agg: 'sum' | 'avg' | 'min' | 'max' | 'count' | null): void {
    this.control()?.setAggregate(field, agg);
    this.closeFilterMenu();
  }

  /** @internal */
  onMenuHideColumn(field: string): void {
    this.control()?.setColumnVisibility(field, false);
    this.closeFilterMenu();
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private findDisplayIndex(originalIndex: number): number {
    return this.navigationController.findDisplayIndex(originalIndex);
  }

  private isCellEditable(col: ColDef): boolean {
    return this.editController.isCellEditable(col);
  }

  private enterEdit(originalIndex: number, ci: number, seedChar: string): void {
    this.editController.start(originalIndex, ci, seedChar);
  }

  private cancelCurrent(): void {
    this.editController.cancel();
  }

  /** @internal */
  isRangeSelected(originalIndex: number, colIndex: number): boolean {
    return this.rangeController.isRangeSelected(originalIndex, colIndex);
  }

  /** @internal */
  isFindMatchCell(originalIndex: number, colIndex: number): boolean {
    return this.findMatches().some(match =>
      match.rowIndex === originalIndex && match.colIndex === colIndex
    );
  }

  /** @internal */
  isActiveFindMatchCell(originalIndex: number, colIndex: number): boolean {
    const match = this.findMatches()[this.findActiveIndex()];
    return !!match && match.rowIndex === originalIndex && match.colIndex === colIndex;
  }

  /** @internal */
  isFillHandleCell(originalIndex: number, colIndex: number): boolean {
    return this.rangeController.isFillHandleCell(originalIndex, colIndex);
  }

  /** @internal */
  isFillPreviewCell(originalIndex: number, colIndex: number): boolean {
    return this.rangeController.isFillPreviewCell(originalIndex, colIndex);
  }

  private scrollToKeepVisible(displayIndex: number, colIndex: number | null = null): void {
    this.navigationController.scrollToKeepVisible(displayIndex, colIndex);
  }

  /** @internal Current rendered width for a column. */
  getColumnWidth(col: ColDef): number {
    return this.columnSizing.getWidth(col);
  }

  private getColumnWidthToken(col: ColDef): string {
    return this.columnSizing.getWidthToken(col);
  }

  public saveFromSidebar(event: AgridSidebarDetailField[]) {
    console.log(event);
  }
}
