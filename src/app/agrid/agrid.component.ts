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
import { AgridCellComponent } from './rendering/agrid-cell.component';
import { AgridBrowserAdapter } from './infrastructure/agrid-browser.adapter';
import { AgridClipboardHandler, CellRange } from './selection/agrid-clipboard.handler';
import { AgridColumnLayoutModel } from './columns/agrid-column-layout.model';
import { AgridColumnMenuComponent } from './columns/agrid-column-menu.component';
import { AgridColumnMenuController } from './columns/agrid-column-menu.controller';
import { AgridColumnReorderController } from './columns/agrid-column-reorder.controller';
import { AgridColumnSizingController } from './columns/agrid-column-sizing.controller';
import { AgridColumnStateService } from './columns/agrid-column-state.service';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridDragHandler } from './rows/agrid-drag.handler';
import { AgridEditController } from './editing/agrid-edit.controller';
import { AgridFindController } from './selection/agrid-find.controller';
import { AgridFindPanelComponent } from './selection/agrid-find-panel.component';
import { AgridGroupController } from './rows/agrid-group.controller';
import { AgridLocaleText, resolveAgridLocaleText, resolveLocale } from './agrid-localization';
import { AgridNavigationController } from './selection/agrid-navigation.controller';
import { AgridPresentationService } from './rendering/agrid-presentation.service';
import { AgridProvider } from './agrid-provider';
import { AgridProjectionModel } from './rows/agrid-projection.model';
import { AgridRangeController } from './selection/agrid-range.controller';
import { AgridCellContextMenu, AgridRowController } from './rows/agrid-row.controller';
import { AgridSidebarController } from './editing/agrid-sidebar.controller';
import {
  AgridSidebarComponent,
  AgridSidebarDetailField,
  AgridSidebarEdit,
} from './editing/agrid-sidebar.component';
import {
  isDataRowItem as isDataRowItemFn,
  isGroupHeaderItem as isGroupHeaderItemFn,
} from './agrid.utils';
import {
  AgridField, CellContextMenuItem, CellPosition, ColDef, FilterChangeEvent, GridEditEvent,
  GridItem, GroupAction, NewRecord, PageChangeEvent, RecordEditEvent, RowClickEvent,
  RowReorderEvent, RowSelectEvent, RowUpdateEvent, SortChangeEvent,
} from './agrid.types';

// Re-export for backward compatibility with existing imports of GridItem from this file.
export type { GridItem };

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
export class AgridComponent<T extends object = any> {

  // ── Inputs ───────────────────────────────────────────────────────────────────

  /** Grid provider containing columns, data source, control, and options. */
  provider = input<AgridProvider<T>>(new AgridProvider<T>());

  // All display / behaviour options are read from the provider.
  readonly rowHeight = computed(() => this.provider().rowHeight);
  readonly minHeight = computed(() => this.provider().minHeight);
  readonly maxHeight = computed(() => this.provider().maxHeight);
  readonly allowAddRows = computed(() => this.provider().allowAddRows);
  readonly autoAddRows = computed(() => this.provider().autoAddRows());
  readonly showControlColumn = computed(() => this.provider().showControlColumn);
  readonly showSidebar = computed(() => this.provider().showSidebar);
  readonly autoOpenDetail = computed(() => this.provider().autoOpenDetail);
  readonly serverSideFiltering = computed(() => this.provider().serverSideFiltering);
  readonly filterDebounceMs = computed(() => this.provider().filterDebounceMs);
  readonly sortOption = computed(() => this.provider().sortOption);
  readonly rowSelection = computed(() => this.provider().rowSelection);
  readonly groupDescription = computed(() => this.provider().groupDescription);
  readonly groupActions = computed(() => this.provider().groupActions);
  readonly cellMenuItems = computed(() => this.provider().cellMenuItems);
  readonly zebraStripes = computed(() => this.provider().zebraStripes);
  readonly readonlyGrid = computed(() => this.provider().readonlyGrid());
  readonly loading = computed(() => this.provider().loading());
  readonly emptyText = computed(() => this.provider().emptyText);
  readonly useSidebarEditor = computed(() => this.provider().useSidebarEditor);

  /** Column definitions from the active provider. */
  readonly colDefs = computed<ColDef[]>(
    () => this.provider().columns() as unknown as ColDef[],
  );

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
  cellEdit = output<GridEditEvent<T>>();

  /**
   * Emitted after an edit changes a row.
   * Includes the row index, current data, provider, and data source.
   */
  recordEdit = output<RecordEditEvent<T>>();

  /** Emitted after a row is removed, with its former index and captured row data. */
  rowRemoved = output<RecordEditEvent<T>>();

  /** Emitted when the grid inserts a blank row. Use `dataSource.patchRow()` to populate it. */
  prepareAddRecord = output<NewRecord<T>>();

  /** Emitted when the user finishes dragging a row. Call `dataSource.moveRow()` to apply. */
  rowReorder = output<RowReorderEvent<T>>();

  /** Emitted when the row selection changes. `null` = selection cleared. */
  rowSelect = output<RowSelectEvent<T> | null>();

  rowDoubleClicked = output<RowClickEvent<T>>();

  /** Emitted when the user single-clicks a data row. */
  rowClick = output<RowClickEvent<T>>();

  /** Emitted when the user has changed and saved a record via the sidebar editor save button */
  rowChanged = output<RowUpdateEvent<T>>();
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

  /** Position of the cell in edit mode, or `null`. */
  get editingCell() { return this.editController.editingCell; }

  /** Draft value while editing — committed on Tab/Enter, discarded on Escape. */
  get currentDraft() { return this.editController.currentDraft; }

  /** Seed character typed to enter edit mode (e.g. pressing 'A'). */
  get editSeedChar() { return this.editController.editSeedChar; }

  /** Toggle the sidebar open/closed. */
  toggleSidebar(): void { this.sidebarController.toggle(); }

  /** @internal */
  onSidebarStripClick(tab: 'columns' | 'detail'): void {
    this.sidebarController.selectTab(tab);
  }

  /** @internal */
  onSidebarDetailEdit(event: AgridSidebarEdit): void {
    this.sidebarController.edit(event);
  }

  /** @internal Commit an edit made via the detail panel. */
  commitDetailEdit(field: string, col: ColDef, stringValue: string): void {
    this.sidebarController.commitEdit(field, col, stringValue);
  }

  onSidebarDetailSave(_event: AgridSidebarDetailField[]): void {
    const originalIndex = this.sidebarController.selectedRowIndex();
    if (originalIndex === null) return;
    const row = this.dataSource().getRow(originalIndex);
    const saveEvent: RowUpdateEvent = { row, originalIndex };
    this.rowChanged.emit(saveEvent);
    this.emitRecordEdit(originalIndex);
    this.sidebarController.closeSidebar();
  }

  /**
   * Download the currently visible, filtered rows as a CSV file.
   * Uses display values (ValueOption labels, formatters) and respects column visibility.
   * Group header rows are excluded — only data rows are exported.
   *
   * @param filename  Output filename, defaults to `'export.csv'`.
   */
  exportCsv(filename = 'export.csv'): void {
    this.presentation.exportCsv(filename);
  }

  /** @internal */ goToFirstPage(): void { this.control()?.setPage(1); }
  /** @internal */ goToLastPage(): void { this.control()?.setPage(this.totalPages()); }
  /** @internal */ goToNextPage(): void { const c = this.control(); if (c) c.setPage(Math.min(c.currentPage() + 1, this.totalPages())); }
  /** @internal */ goToPrevPage(): void { const c = this.control(); if (c) c.setPage(Math.max(c.currentPage() - 1, 1)); }

  /** Resize every visible column to fit its header and current row values. */
  autosizeAllColumns(): void {
    this.columnSizing.autosizeAllColumns();
  }

  /** @internal Full display value for a cell — used as the `title` tooltip attribute. */
  getCellTitle(col: ColDef, value: unknown): string {
    return this.presentation.getCellTitle(col, value);
  }

  /** @internal Dynamic CSS class string for a cell from `ColDef.cellClass`. */
  getCellClass(col: ColDef, value: unknown, row: Record<string, unknown>): string {
    return this.presentation.getCellClass(col, value, row);
  }

  /** @internal Short symbol shown before the footer aggregate value. */
  getAggregateLabel(col: ColDef): string {
    return this.presentation.getAggregateLabel(col);
  }

  /** @internal Whether a column has a static or control-configured aggregate. */
  hasAggregate(col: ColDef): boolean {
    return this.presentation.hasAggregate(col);
  }

  /** @internal Formatted footer value — uses the column formatter when set, otherwise locale number. */
  getFooterDisplay(col: ColDef, value: unknown): string {
    return this.presentation.getFooterDisplay(col, value);
  }

  // ── Internal signals ─────────────────────────────────────────────────────────

  private readonly groupController = new AgridGroupController({
    control: this.control,
    groupDescription: this.groupDescription,
  });

  // ── Derived state ─────────────────────────────────────────────────────────────

  readonly allowRowReorder = computed(() =>
    (this.control()?.allowRowReorder() ?? false) && !this.control()?.groupByField()
  );

  /** `true` when there is a committed edit that can be undone (Ctrl+Z). */
  readonly canUndo = computed(() => this.control()?.canUndo() ?? false);

  /** `true` when there is a previously undone edit that can be re-applied (Ctrl+Y / Ctrl+Shift+Z). */
  readonly canRedo = computed(() => this.control()?.canRedo() ?? false);

  private readonly columnLayout = new AgridColumnLayoutModel({
    control: this.control,
    colDefs: this.colDefs,
    showControlColumn: this.showControlColumn,
    getColumnWidth: col => this.getColumnWidth(col),
    getColumnWidthToken: col => this.getColumnWidthToken(col),
  });

  /** Columns currently visible after hidden state, ordering, and pinning are applied. */
  readonly visibleColDefs = this.columnLayout.visibleColDefs;
  /** Columns currently pinned to the left in display order. */
  readonly pinnedColDefs = this.columnLayout.pinnedColDefs;
  /** Columns currently pinned to the right in display order. */
  readonly rightPinnedColDefs = this.columnLayout.rightPinnedColDefs;
  /** Columns rendered in the horizontally scrollable pane. */
  readonly scrollableColDefs = this.columnLayout.scrollableColDefs;
  readonly rightGridTemplateColumns = this.columnLayout.rightGridTemplateColumns;
  readonly rightPinnedPaneWidth = this.columnLayout.rightPinnedPaneWidth;
  readonly hasRightPinnedPane = this.columnLayout.hasRightPinnedPane;
  readonly hasPinnedPane = this.columnLayout.hasPinnedPane;
  readonly hasFilterableColumns = this.columnLayout.hasFilterableColumns;

  private readonly columnState = new AgridColumnStateService({
    control: this.control,
    colDefs: this.colDefs,
    visibleColDefs: this.visibleColDefs,
    pinnedColDefs: this.pinnedColDefs,
    rightPinnedColDefs: this.rightPinnedColDefs,
    showControlColumn: this.showControlColumn,
  });

  private readonly projection: AgridProjectionModel = new AgridProjectionModel({
    dataSource: this.dataSource,
    control: this.control,
    colDefs: this.colDefs,
    visibleColDefs: this.visibleColDefs,
    locale: this.locale,
    serverSideFiltering: this.serverSideFiltering,
    sortOption: this.sortOption,
    allowAddRows: this.allowAddRows,
    autoAddRows: this.autoAddRows,
    expandedGroups: this.groupController.expandedGroups,
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
    onCellEdit: event => this.emitEditEvents(event),
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

  readonly gridTemplateColumns = this.columnLayout.gridTemplateColumns;
  readonly pinnedGridTemplateColumns = this.columnLayout.pinnedGridTemplateColumns;
  readonly scrollableGridTemplateColumns = this.columnLayout.scrollableGridTemplateColumns;
  readonly totalWidth = this.columnLayout.totalWidth;
  readonly pinnedPaneWidth = this.columnLayout.pinnedPaneWidth;
  readonly scrollableTotalWidth = this.columnLayout.scrollableTotalWidth;

  /**
   * Filtered, sorted, and optionally grouped row list for `*cdkVirtualFor`.
   * Appends `null` when the explicit add-row placeholder is active.
   */
  readonly filteredItems: Signal<GridItem[]> = this.projection.filteredItems;

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

  readonly groupActionsMenu = this.groupController.actionsMenu;

  // ── Infrastructure ────────────────────────────────────────────────────────────

  private readonly viewport = viewChild.required<CdkVirtualScrollViewport>('scrollViewport');
  private readonly pinnedViewport = viewChild<CdkVirtualScrollViewport>('pinnedViewport');
  private readonly rightPinnedViewport = viewChild<CdkVirtualScrollViewport>('rightPinnedViewport');
  private readonly wrapperEl = viewChild.required<ElementRef<HTMLDivElement>>('wrapper');
  private readonly horizontalScrollerEl =
    viewChild.required<ElementRef<HTMLDivElement>>('horizontalScroller');
  private readonly destroyRef = inject(DestroyRef);
  private readonly _hostEl = inject(ElementRef<HTMLElement>);
  private readonly browser = new AgridBrowserAdapter();

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
    onCellEdit: event => this.emitEditEvents(event),
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

  private readonly columnMenuController = new AgridColumnMenuController({
    control: this.control,
    dataSource: this.dataSource,
    colDefs: this.colDefs,
    serverSideFiltering: this.serverSideFiltering,
    filterDebounceMs: this.filterDebounceMs,
    sortOption: this.sortOption,
    effectiveSortOrder: () => this.projection.effectiveSortOrder(),
    autosizeColumn: col => this.columnSizing.autosizeColumn(col),
    onFilterChange: event => this.filterChange.emit(event),
    onSortChange: event => this.sortChange.emit(event),
  }, this.destroyRef);

  readonly filterMenu = this.columnMenuController.menu;
  readonly filterMenuSearch = this.columnMenuController.search;
  readonly filterMenuItems = this.columnMenuController.items;
  readonly filterMenuVisibleItems = this.columnMenuController.visibleItems;
  readonly filterMenuActiveValues = this.columnMenuController.activeValues;
  readonly columnMenuValueItems = this.columnMenuController.valueItems;

  private readonly presentation = new AgridPresentationService({
    control: this.control,
    visibleColDefs: this.visibleColDefs,
    filteredItems: this.filteredItems,
    locale: this.locale,
  });

  private readonly findController = new AgridFindController({
    filteredItems: this.filteredItems,
    visibleColDefs: this.visibleColDefs,
    locale: this.locale,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    scrollToCell: (displayIndex, colIndex) =>
      this.navigationController.scrollToKeepVisible(displayIndex, colIndex),
    focusGrid: () => this.wrapperEl().nativeElement.focus(),
  });

  readonly findOpen = this.findController.open;
  readonly findQuery = this.findController.query;
  readonly findActiveIndex = this.findController.activeIndex;
  readonly findMatches = this.findController.matches;

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
    openFind: () => this.findController.show(),
    focusGrid: () => this.wrapperEl().nativeElement.focus(),
    viewport: () => this.viewport(),
    scrollColumnToKeepVisible: colIndex =>
      this.columnSizing.scrollColumnToKeepVisible(colIndex),
    onPrepareAddRecord: event => this.prepareAddRecord.emit({
      ...event,
      provider: this.provider(),
      datasource: this.dataSource(),
    }),
  });

  private readonly rowController = new AgridRowController({
    dataSource: this.dataSource,
    filteredItems: this.filteredItems,
    visibleColDefs: this.visibleColDefs,
    rowSelection: this.rowSelection,
    selectedCell: this.selectedCell,
    editingCell: this.editController.editingCell,
    insertRowAt: index => this.navigationController.insertRowAt(index),
    startDragSelect: originalIndex => this.dragHandler.startDragSelect(originalIndex),
    onRowSelect: event => this.rowSelect.emit(event),
    onRowClick: event => this.rowClick.emit(event),
    onRowRemoved: event => this.rowRemoved.emit(this.createRecordEvent(event.index, event.data)),
    onEditRowRemoved: originalIndex => this.editController.onRowRemoved(originalIndex),
    closeFilterMenu: () => this.columnMenuController.close(),
    closeGroupActionsMenu: () => this.closeGroupActionsMenu(),
  });

  readonly selectedRowIndices = this.rowController.selectedRowIndices;
  readonly selectedRowIndex = this.rowController.selectedRowIndex;
  readonly contextMenu = this.rowController.contextMenu;
  readonly cellContextMenuState = this.rowController.cellContextMenu;

  private readonly sidebarController = new AgridSidebarController({
    control: this.control,
    dataSource: this.dataSource,
    colDefs: this.colDefs,
    visibleColDefs: this.visibleColDefs,
    selectedRowIndex: this.selectedRowIndex,
    autoOpenDetail: this.autoOpenDetail,
    useSidebarEditor: this.useSidebarEditor,
    onCellEdit: event => this.emitEditEvents(event),
  });

  readonly sidebarOpen = this.sidebarController.open;
  readonly sidebarTab = this.sidebarController.tab;
  readonly sidebarRow = this.sidebarController.row;
  readonly sidebarHiddenColumns = this.sidebarController.hiddenColumns;

  private readonly clipboardHandler = new AgridClipboardHandler({
    control: this.control,
    dataSource: this.dataSource,
    filteredItems: this.filteredItems,
    visibleColDefs: this.visibleColDefs,
    locale: this.locale,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    isCellEditable: col => this.isCellEditable(col),
    onCellEdit: event => this.emitEditEvents(event),
    scrollToCell: (displayIndex, colIndex) => this.scrollToKeepVisible(displayIndex, colIndex),
  });

  readonly dragHandler = new AgridDragHandler({
    dataSource: this.dataSource,
    filteredItems: () => this.filteredItems(),
    locale: () => this.locale(),
    selectedIndices: this.rowController.selectedIndices,
    onReorder: e => this.rowReorder.emit(e),
    onSelectionChange: () => this.rowController.emitSelection(),
  }, this.destroyRef);

  private readonly columnReorder = new AgridColumnReorderController({
    control: this.control,
    visibleColDefs: this.visibleColDefs,
    getColDef: field => this.getColDef(field),
  }, this.destroyRef);

  /** @internal Start a column header drag. */
  onColHeaderPointerDown(event: PointerEvent, field: string): void {
    this.columnReorder.start(event, field);
  }

  /** @internal Whether the given column header is being dragged. */
  isColDragging(field: string): boolean {
    return this.columnReorder.isDragging(field);
  }

  /** @internal Template helper for drop-indicator class. */
  getColDropSide(field: string): 'before' | 'after' | null {
    return this.columnReorder.getDropSide(field);
  }

  // ── Setup ─────────────────────────────────────────────────────────────────────

  private readonly _seededControls = new WeakSet<AgridControl>();

  private emitEditEvents(event: GridEditEvent): void {
    this.cellEdit.emit(event as GridEditEvent<T>);
    this.emitRecordEdit(event.position.rowIndex);
  }

  private emitRecordEdit(index: number): void {
    const datasource = this.dataSource();
    const event = this.createRecordEvent(index, datasource.getRow(index));
    queueMicrotask(() => this.recordEdit.emit(event));
  }

  private createRecordEvent(index: number, data: Record<string, unknown>): RecordEditEvent {
    const datasource = this.dataSource();
    return {
      index,
      data,
      provider: this.provider(),
      datasource,
    };
  }

  constructor() {
    effect(() => this.sidebarController.syncAutoOpen());

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
      if (this.selectedRowIndices().size === 0) return;
      if (this._hostEl.nativeElement.contains(e.target as Node)) return;
      this.rowController.clearSelection();
    };
    this.browser.addDocumentListener('pointerdown', onOutsidePointerDown);
    this.destroyRef.onDestroy(() => {
      this.browser.removeDocumentListener('pointerdown', onOutsidePointerDown);
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
        if (col.pinned === 'left') ctrl.setPinned(col.field, true);
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
    return this.rowController.isRowSelected(originalIndex);
  }

  /** @internal Selection class for the separate pinned/control viewport. */
  isPinnedPaneRowSelected(item: GridItem): boolean {
    return this.rowController.isPinnedPaneRowSelected(item);
  }

  // ── Template helpers — filter menu ────────────────────────────────────────────

  /** @internal */
  /** @internal 1-based sort priority for a column, 0 if not sorted. */
  getSortPriority(field: string): number { return this.columnMenuController.getSortPriority(field); }

  /** @internal Whether more than one column is currently sorted. */
  hasMultiSort(): boolean {
    return this.columnMenuController.hasMultiSort();
  }

  getTextFilter(field: string): string { return this.columnMenuController.getTextFilter(field); }

  /** @internal */
  getSort(field: string): 'asc' | 'desc' | null {
    return this.columnMenuController.getSort(field);
  }

  /** @internal */
  isMenuAllSelected(field: string): boolean {
    return this.columnMenuController.isAllSelected(field);
  }

  /** @internal */
  isMenuValueActive(rawStr: string): boolean {
    return this.columnMenuController.isValueActive(rawStr);
  }

  /** @internal */
  isMenuValueSelected(field: string, value: string): boolean {
    return this.columnMenuController.isValueSelected(field, value);
  }

  /** @internal */
  hasActiveFilter(field: string): boolean {
    return this.columnMenuController.hasActiveFilter(field);
  }

  /** @internal */
  getColDef(field: string): ColDef | undefined { return this.columnState.getColDef(field); }

  /** @internal */
  getVisibleColIndex(field: string): number {
    return this.columnState.getVisibleColIndex(field);
  }

  /** @internal Convert a zero-based visible data-column index to a one-based ARIA index. */
  getAriaColIndex(colIndex: number): number {
    return this.columnState.getAriaColIndex(colIndex);
  }

  /** @internal */
  isColumnHidden(field: string): boolean { return this.columnState.isColumnHidden(field); }

  /** @internal */
  isGroupedByField(field: string): boolean { return this.columnState.isGroupedByField(field); }

  /** @internal */
  isColumnPinned(field: string): boolean {
    return this.columnState.isColumnPinned(field);
  }

  isColumnPinnedRight(field: string): boolean {
    return this.columnState.isColumnPinnedRight(field);
  }

  /** Returns `'left'`, `'right'`, or `false` — used by the column menu. */
  getColumnPinState(field: string): 'left' | 'right' | false {
    return this.columnState.getColumnPinState(field);
  }

  isFirstRightPinnedColumn(field: string): boolean {
    return this.columnState.isFirstRightPinnedColumn(field);
  }

  /** @internal Returns `true` for the rightmost pinned column (used to draw the separator shadow). */
  isLastPinnedColumn(field: string): boolean {
    return this.columnState.isLastPinnedColumn(field);
  }

  // ── Row selection ─────────────────────────────────────────────────────────────

  /** @internal */
  onRowPointerDown(event: PointerEvent, originalIndex: number): void {
    this.rowController.selectFromPointer(event, originalIndex, true);
  }

  /** @internal Emits rowClick when the user single-clicks a data row outside of a cell editor. */
  onRowClick(event: MouseEvent, item: { row: Record<string, unknown>; originalIndex: number }): void {
    this.rowController.clickRow(item);
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
    this.rowDoubleClicked.emit({ row, originalIndex });
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

  /** @internal Clears cell navigation while a header filter control owns focus. */
  onGridFocusIn(event: FocusEvent): void {
    if ((event.target as Element | null)?.closest('.ag-filter-input, .ag-filter-menu')) {
      this.navigationController.deactivateCell();
    }
  }

  /** Open the find panel and focus its input. */
  openFind(): void {
    this.findController.show();
  }

  /** @internal */
  closeFind(): void {
    this.findController.close();
  }

  /** @internal */
  onFindInput(value: string): void {
    this.findController.setQuery(value);
  }

  /** @internal */
  goToFindMatch(direction: 1 | -1): void {
    this.findController.goToMatch(direction);
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
    this.rowController.selectFromPointer(event, originalIndex, false);
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
    this.rowController.openRowContextMenu(event, originalIndex);
  }

  /** @internal */
  closeContextMenu(): void { this.rowController.closeContextMenu(); }

  /** @internal */
  onCellContextMenu(event: MouseEvent, rowIndex: number, colIndex: number, col: ColDef, row: Record<string, unknown>): void {
    this.rowController.openCellContextMenu(event, rowIndex, colIndex, col, row);
  }

  /** @internal */
  closeCellContextMenu(): void { this.rowController.closeCellContextMenu(); }

  /** @internal Runs a typed provider context-menu action against erased controller state. */
  runCellMenuItem(item: CellContextMenuItem<T>, menu: AgridCellContextMenu): void {
    item.action({
      value: menu.value as T[AgridField<T>],
      row: menu.row as unknown as T,
      field: menu.field as AgridField<T>,
      originalIndex: menu.rowIndex,
    });
    this.closeCellContextMenu();
  }

  /** @internal Copy the display value of one cell to the clipboard. */
  copyCellToClipboard(value: unknown, col: ColDef): void {
    this.rowController.copyCellToClipboard(value, col);
  }

  /** @internal Copy all visible column values of a row as TSV to the clipboard. */
  copyRowToClipboard(row: Record<string, unknown>): void {
    this.rowController.copyRowToClipboard(row);
  }

  /** @internal Insert a blank row at a specific position and emit prepareAddRecord. */
  insertRowAt(atIndex: number): void {
    this.rowController.insertRowAt(atIndex);
  }

  /** Delete the row at `originalIndex`, adjusting stale cell/edit pointers. */
  deleteRow(originalIndex: number): void {
    this.rowController.deleteRow(originalIndex);
  }

  // ── Group expand / collapse ───────────────────────────────────────────────────

  /** @internal */
  onGroupHeaderClick(label: string): void {
    this.groupController.toggle(label);
  }

  /** Expand all groups. No-op when grouping is not active. */
  expandGroups(): void {
    this.groupController.expandAll(this.filteredItems());
  }

  /** Collapse all groups. No-op when grouping is not active. */
  collapseGroups(): void {
    this.groupController.collapseAll();
  }

  /** @internal */
  getGroupDescription(label: string): string {
    return this.groupController.getDescription(label);
  }

  /** @internal */
  openGroupActionsMenu(event: MouseEvent, label: string): void {
    this.groupController.openActionsMenu(event, label);
  }

  /** @internal */
  closeGroupActionsMenu(): void { this.groupController.closeActionsMenu(); }

  /** @internal */
  onGroupAction(action: GroupAction, label: string): void {
    this.groupController.runAction(action, label);
  }

  // ── Filter row & menu ─────────────────────────────────────────────────────────

  /** @internal */
  onTextFilterChange(event: Event, field: string): void {
    this.columnMenuController.onTextFilterChange(event, field);
  }

  /** @internal */
  openFilterMenu(event: MouseEvent, field: string): void {
    this.columnMenuController.open(event, field);
  }

  /** @internal */
  closeFilterMenu(): void { this.columnMenuController.close(); }

  /** @internal */
  onFilterMenuSearch(value: string): void {
    this.columnMenuController.setSearch(value);
  }

  /** @internal */
  onMenuSort(field: string, dir: 'asc' | 'desc'): void {
    this.columnMenuController.sort(field, dir);
  }

  /** @internal */
  onMenuClearFilter(field: string): void {
    this.columnMenuController.clearFilter(field);
  }

  /** @internal */
  /** @internal Replace the entire sort stack with a single sort on this column. */
  onMenuResetSort(field: string, dir: 'asc' | 'desc'): void {
    this.columnMenuController.resetSort(field, dir);
  }

  onMenuToggleGroupBy(field: string): void {
    this.columnMenuController.toggleGroupBy(field);
  }

  /** @internal */
  onMenuClearAll(): void {
    this.columnMenuController.clearAll();
  }

  /** @internal */
  onMenuToggleAll(field: string): void {
    this.columnMenuController.toggleAll(field);
  }

  /** @internal */
  onMenuToggleValue(field: string, rawStr: string): void {
    this.columnMenuController.toggleValue(field, rawStr);
  }

  /** @internal */
  onSidebarToggleColumn(field: string): void {
    this.columnMenuController.toggleColumnVisibility(field);
  }

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
    this.columnMenuController.togglePin(field);
  }

  /** @internal */
  onMenuTogglePinRight(field: string): void {
    this.columnMenuController.togglePinRight(field);
  }

  /** @internal */
  onMenuAutosizeColumn(field: string): void {
    this.columnMenuController.autosize(field);
  }

  /** @internal */
  onMenuSetAggregate(field: string, agg: 'sum' | 'avg' | 'min' | 'max' | 'count' | null): void {
    this.columnMenuController.setAggregate(field, agg);
  }

  /** @internal */
  onMenuHideColumn(field: string): void {
    this.columnMenuController.hideColumn(field);
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
    return this.findController.isMatchCell(originalIndex, colIndex);
  }

  /** @internal */
  isActiveFindMatchCell(originalIndex: number, colIndex: number): boolean {
    return this.findController.isActiveMatchCell(originalIndex, colIndex);
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

}
