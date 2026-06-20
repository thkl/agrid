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
import { NgTemplateOutlet } from '@angular/common';
import { AgridCellComponent } from './rendering/agrid-cell.component';
import { AgridBrowserAdapter } from './infrastructure/agrid-browser.adapter';
import { AgridClipboardHandler, CellRange } from './selection/agrid-clipboard.handler';
import { AgridColumnLayoutModel } from './columns/agrid-column-layout.model';
import { AgridColumnMenuComponent } from './columns/agrid-column-menu.component';
import { AgridColumnMenuController } from './columns/agrid-column-menu.controller';
import { AgridColumnReorderController } from './columns/agrid-column-reorder.controller';
import { AgridColumnSizingController } from './columns/agrid-column-sizing.controller';
import { AgridColumnStateService } from './columns/agrid-column-state.service';
import { AgridControl, FilterOperator } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridDragHandler } from './rows/agrid-drag.handler';
import { AgridEditController } from './editing/agrid-edit.controller';
import { AgridFindController } from './selection/agrid-find.controller';
import { AgridFindPanelComponent } from './selection/agrid-find-panel.component';
import { AgridGroupController } from './rows/agrid-group.controller';
import { AgridTreeController } from './rows/agrid-tree.controller';
import { AgridLocaleText, resolveAgridLocaleText, resolveLocale } from './agrid-localization';
import { AgridNavigationController } from './selection/agrid-navigation.controller';
import { AgridPresentationService } from './rendering/agrid-presentation.service';
import { AgridMenuBarComponent } from './rendering/agrid-menu-bar.component';
import { AgridProvider, AgridSettings } from './agrid-provider';
import { buildPivotResult } from './agrid-pivot';
import { AgridProjectionModel } from './rows/agrid-projection.model';
import { AgridRangeController } from './selection/agrid-range.controller';
import { AgridCellContextMenu, AgridRowController } from './rows/agrid-row.controller';
import { AgridSidebarController } from './editing/agrid-sidebar.controller';
import {
  AgridSidebarComponent,
  AgridSidebarDetailField,
  AgridSidebarEdit,
  AgridSidebarTab,
} from './editing/agrid-sidebar.component';
import {
  isDataRowItem as isDataRowItemFn,
  isDetailRowItem as isDetailRowItemFn,
  isGroupHeaderItem as isGroupHeaderItemFn,
  isPathTreeNodeItem as isPathTreeNodeItemFn,
  isPathTreeConfig,
  isTreeRowItem as isTreeRowItemFn,
  pathTreeNodeId,
} from './agrid.utils';
import { AgridVariableRowSizeDirective } from './infrastructure/agrid-variable-row-size.strategy';
import {
  AgridAggregate,
  AgridField, AgridMenuBarContext, AgridMenuBarItem, AgridMenuBarMenuItem, AgridMenuBarState, AgridPivotConfig,
  CellContextMenuItem, CellInfoEvent, CellPosition, ColDef, DetailRowItem, FilterChangeEvent, GridEditEvent,
  GridItem, GroupAction, NewRecord, PageChangeEvent, PathTreeNodeItem, RecordEditEvent, RowClickEvent,
  RowReorderEvent, RowSelectEvent, RowUpdateEvent, SortChangeEvent, TreeNodeClickEvent, ValidationFailedEvent,
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
 * | Page Up / Page Down | Move by one visible viewport page |
 * | Home / End | Move to the first / last cell in the current row |
 * | Ctrl/Cmd+Home / Ctrl/Cmd+End | Move to the first / last cell in the grid |
 * | Tab / Shift+Tab | Move right / left (wraps rows) |
 * | Enter | Enter edit mode |
 * | Ctrl/Cmd+Enter | Toggle an expandable tree node |
 * | F2 | Enter edit mode |
 * | Printable key | Enter edit mode with seeded character |
 * | Escape | Close any open menu or cancel edit |
 * | Tab / Enter (while editing) | Commit and move according to navigation settings |
 */
@Component({
  selector: 'agrid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollingModule,
    NgTemplateOutlet,
    AgridVariableRowSizeDirective,
    AgridCellComponent,
    AgridMenuBarComponent,
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
  readonly allowAddRows = computed(() => this.provider().allowAddRows && !this.provider().pivotConfig);
  readonly autoAddRows = computed(() =>
    !this.provider().pivotConfig && (this.control()?.autoAddRows() ?? false)
  );
  readonly enableRowMarking = computed(() => this.provider().enableRowMarking);
  readonly showControlColumn = computed(() =>
    this.provider().showControlColumn || this.enableRowMarking() || this.masterDetail()
  );
  readonly controlColumnWidth = computed(() => this.enableRowMarking() ? 48 : 24);
  readonly showSidebar = computed(() => this.provider().showSidebar);
  readonly autoOpenDetail = computed(() => this.provider().autoOpenDetail);
  readonly serverSideFiltering = computed(() => this.provider().serverSideFiltering);
  readonly filterDebounceMs = computed(() => this.provider().filterDebounceMs);
  readonly enableQuickFilter = computed(() => this.provider().enableQuickFilter);
  readonly menuBarItems = computed(() => this.provider().menuBarItems);
  readonly quickFilterValue = computed(() => this.control()?.quickFilter() ?? '');
  readonly sortOption = computed(() => this.provider().sortOption);
  readonly rowSelection = computed(() => this.provider().rowSelection);
  readonly enterEditAction = computed(() => this.provider().enterEditAction);
  readonly groupDescription = computed(() => this.provider().groupDescription);
  readonly groupActions = computed(() => this.provider().groupActions);
  readonly cellMenuItems = computed(() => this.provider().cellMenuItems);
  readonly headerGroups = computed(() => this.provider().headerGroups);
  readonly treeConfig = computed(() => this.provider().treeConfig);
  /** Whether the provider is rendering a derived client-side pivot table. */
  readonly pivotMode = computed(() => !!this.provider().pivotConfig);
  readonly zebraStripes = computed(() => this.provider().zebraStripes);
  readonly showChangedCellIndicator = computed(
    () => this.provider().showChangedCellIndicator,
  );
  readonly confirmRowDelete = computed(() => this.provider().confirmRowDelete);
  readonly readonlyGrid = computed(() =>
    !!this.provider().pivotConfig || (this.control()?.readonly() ?? false)
  );
  readonly loading = computed(() => this.control()?.loading() ?? false);
  readonly emptyText = computed(() => this.provider().emptyText);
  readonly useSidebarEditor = computed(() => this.provider().useSidebarEditor);

  /** Host callback for per-row CSS classes, or `undefined`. */
  readonly rowClassFn = computed(() => this.provider().getRowClass as
    | ((params: { row: Record<string, unknown>; index: number }) => string)
    | undefined);
  /** Host callback designating pinned rows, or `undefined`. */
  readonly pinRowFn = computed(() => this.provider().pinRow as
    | ((row: Record<string, unknown>, index: number) => 'top' | 'bottom' | undefined)
    | undefined);

  readonly pivotRowColumnField = computed(()=>{
    return this.provider().pivotConfig?.rowField;
  })

  readonly pivotHeaderLabel = computed (()=> {
    const aggr : AgridAggregate | undefined = this.provider().pivotConfig?.aggregate;
    const vcfield = this.provider().pivotConfig?.valueField;
    const valueColumn = this.provider().columns().find(c=>c.field === vcfield);
    switch (aggr) {
         case "sum":
         return `${this.localeText().aggregateSum} ${valueColumn?.header ?? ''}`;
         case "avg":
         return `${this.localeText().aggregateAvg} ${valueColumn?.header ?? ''}`;
         case "count":
         return `${this.localeText().aggregateCount} ${valueColumn?.header ?? ''}`;
         case "max":
         return `${this.localeText().aggregateMax} ${valueColumn?.header ?? ''}`;
         case "min":
         return `${this.localeText().aggregateMin} ${valueColumn?.header ?? ''}`;
         default: 
          return undefined;
    }
  });
  /**
   * Effective pin resolver fed to the projection: a runtime UI override wins (including an explicit
   * `null` unpin), otherwise the provider `pinRow` predicate decides. Returns `undefined` when
   * neither pinning source is active, so the projection's pinning path stays off.
   */
  readonly effectivePinRow = computed(() => {
    const predicate = this.pinRowFn();
    const overrides = this._pinnedRows();
    if (!predicate && overrides.size === 0) return undefined;
    return (row: Record<string, unknown>, index: number): 'top' | 'bottom' | undefined => {
      const override = overrides.get(index);
      if (override !== undefined) return override ?? undefined;
      return predicate?.(row, index);
    };
  });
  /** Whether master/detail is enabled and applicable (flat rows or tree leaves; not grouped). */
  readonly masterDetail = computed(
    () => this.provider().masterDetail && !!this.provider().detailRenderer
      && !this.control()?.groupByField() && !this.provider().pivotConfig,
  );
  /** Fixed detail-panel height in pixels. */
  readonly detailRowHeight = computed(() => this.provider().detailRowHeight);

  /** Read-only pivot rows and generated columns, or `null` in the normal datasource view. */
  private readonly pivotResult = computed(() => {
    const provider = this.provider();
    if (!provider.pivotConfig) return null;
    return buildPivotResult(
      provider.datasource.rows(),
      provider.columns(),
      provider.pivotConfig,
      resolveLocale(provider.options.locale),
    );
  });
  /** Reactive row projection linked into a stable datasource instance for pivot mode. */
  private readonly pivotRows = computed(() => this.pivotResult()?.rows ?? []);
  private readonly pivotDataSource = new AgridDataSource<Record<string, unknown>>();

  /** Column definitions from the active provider or generated by the active pivot. */
  readonly colDefs = computed<ColDef[]>(
    () => this.pivotResult()?.columns
      ?? this.provider().columns() as unknown as ColDef[],
  );

  /** Signal-based source rows or a derived, read-only pivot datasource. */
  readonly dataSource = computed<AgridDataSource>(() => {
    return this.pivotResult() ? this.pivotDataSource : this.provider().datasource;
  });

  /** Active lazy server-side row model, when configured on the provider. */
  readonly serverSideRowModel = computed(() => this.provider().serverSideRowModel);

  private readonly treeParentIds = computed(() => {
    const config = this.treeConfig();
    if (!config || isPathTreeConfig(config)) return new Set<string | number>();
    const ids = new Set<string | number>();
    for (const row of this.dataSource().rows()) {
      const parentId = config.getParentId(row as T);
      if (parentId !== null && parentId !== undefined) ids.add(parentId);
    }
    return ids;
  });

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

  /** Emitted when the user single-clicks a generated path-tree branch node. */
  treeNodeClick = output<TreeNodeClickEvent>();

  /** Emitted after sidebar changes produce a new persistable grid settings snapshot. */
  settingsChange = output<AgridSettings>();

  /** Emitted when the user double-clicks a generated path-tree branch node. */
  treeNodeDoubleClicked = output<TreeNodeClickEvent>();

  /**
   * Emitted once after a changed row is left during inline editing, or when the sidebar editor
   * save button is used.
   */
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

  /**
   * Emitted (debounced) when the global quick-filter text changes in server-side filtering mode.
   * The host should refetch rows matching the text. Not emitted in client mode, where the grid
   * filters locally.
   */
  quickFilterChange = output<string>();

  /** Emitted when a `ColDef.validate` hook rejects a committed value (inline or sidebar). */
  validationFailed = output<ValidationFailedEvent>();

  /** Emitted when a column's optional cell information button is clicked. */
  cellInfo = output<CellInfoEvent<T>>();

  /** Emitted for every enabled menu-bar button or dropdown item, carrying its configured id. */
  menuBarAction = output<string>();

  // ── Public state ─────────────────────────────────────────────────────────────

  /** Currently focused cell, or `null`. */
  readonly selectedCell = signal<CellPosition | null>(null);

  /** Original index of the row awaiting delete confirmation, or `null`. */
  readonly pendingDeleteRow = signal<number | null>(null);

  /** Original indices of rows whose master/detail panel is currently expanded. */
  private readonly _expandedDetailIds = signal<Set<number>>(new Set());

  /**
   * Runtime per-row pin overrides set through the UI (keyed by original index). A `null` value
   * explicitly unpins a row that the `pinRow` predicate would otherwise pin. Merged with the
   * provider predicate by {@link effectivePinRow}.
   */
  private readonly _pinnedRows = signal<Map<number, 'top' | 'bottom' | null>>(new Map());

  private readonly markedIndices = signal<Set<number>>(new Set());

  /** Original datasource indices marked for inclusion in copy operations. */
  readonly markedRowIndices: Signal<ReadonlySet<number>> =
    this.markedIndices.asReadonly() as Signal<ReadonlySet<number>>;

  /** Horizontal position of the delete prompt inside the scrollable row. */
  readonly deleteConfirmationLeft = signal(0);

  /** Visible width available to the delete prompt. */
  readonly deleteConfirmationWidth = signal(0);

  /** Rectangular cell range selected by Shift+arrow or Shift+click. */
  readonly selectedRange = signal<CellRange | null>(null);

  /** @internal Stable callback passed to child components for row-aware editability checks. */
  readonly isCellEditableForRow = (col: ColDef, originalIndex: number): boolean =>
    this.isCellEditable(col, originalIndex);

  /** Fill-handle drag preview bounds, in visible row/column coordinates. */
  get fillPreviewBounds() { return this.rangeController.fillPreviewBounds; }

  /** Position of the cell in edit mode, or `null`. */
  get editingCell() { return this.editController.editingCell; }

  /** Draft value while editing — committed on Tab/Enter, discarded on Escape. */
  get currentDraft() { return this.editController.currentDraft; }

  /** Seed character typed to enter edit mode (e.g. pressing 'A'). */
  get editSeedChar() { return this.editController.editSeedChar; }

  /** Whether the active text editor should select all text when it opens. */
  get selectTextOnEdit() { return this.editController.selectTextOnEdit; }

  /** Toggle the sidebar open/closed. */
  toggleSidebar(): void { this.sidebarController.toggle(); }

  /** @internal */
  onSidebarStripClick(tab: AgridSidebarTab): void {
    this.sidebarController.selectTab(tab);
  }

  /** @internal Replace the active pivot configuration from the sidebar controls. */
  onSidebarPivotChange(config: AgridPivotConfig): void {
    this.provider().pivotConfig = config;
    this.emitSettingsChange();
  }

  /** Return a detached, JSON-safe snapshot suitable for persistence by the host application. */
  saveSettings(): AgridSettings {
    return this.provider().saveSettings();
  }

  /** Apply a saved settings snapshot to this live grid. */
  loadSettings(settings: AgridSettings): void {
    this.provider().loadSettings(settings);
  }

  /** Emit when the active state is JSON-safe; custom function aggregates remain host-owned. */
  private emitSettingsChange(): void {
    try {
      this.settingsChange.emit(this.saveSettings());
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('cannot be saved')) throw error;
    }
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
    this.emitRowChanged(originalIndex);
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

  /**
   * Clears changed-cell markers after persistence succeeds.
   * Omit `originalIndex` to clear every marker; omit `fields` to clear the whole row.
   */
  clearChangedCells(originalIndex?: number, fields?: readonly string[]): void {
    if (originalIndex === undefined) {
      this.changedCells.set(new Set());
      return;
    }

    const fieldSet = fields ? new Set(fields) : null;
    this.changedCells.update(current => {
      const next = new Set(current);
      for (const key of current) {
        const marker = this.parseChangedCellKey(key);
        if (marker.rowIndex === originalIndex && (!fieldSet || fieldSet.has(marker.field))) {
          next.delete(key);
        }
      }
      return next;
    });
  }

  /** @internal Whether a cell has an unsaved-change marker. */
  isCellChanged(originalIndex: number, field: string): boolean {
    return this.changedCells().has(this.changedCellKey(originalIndex, field));
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

  readonly treeController = new AgridTreeController();

  // ── Derived state ─────────────────────────────────────────────────────────────

  readonly allowRowReorder = computed(() =>
    (this.control()?.allowRowReorder() ?? false)
      && !this.control()?.groupByField()
      && !this.provider().pivotConfig
  );

  /** `true` when there is a committed edit that can be undone (Ctrl+Z). */
  readonly canUndo = computed(() => this.control()?.canUndo() ?? false);

  /** `true` when there is a previously undone edit that can be re-applied (Ctrl+Y / Ctrl+Shift+Z). */
  readonly canRedo = computed(() => this.control()?.canRedo() ?? false);

  private readonly columnLayout = new AgridColumnLayoutModel({
    control: this.control,
    colDefs: this.colDefs,
    headerGroups: this.headerGroups,
    showControlColumn: this.showControlColumn,
    controlColumnWidth: this.controlColumnWidth,
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
  readonly hasHeaderGroups = this.columnLayout.hasHeaderGroups;
  readonly pinnedHeaderGroupRuns = this.columnLayout.pinnedHeaderGroupRuns;
  readonly scrollableHeaderGroupRuns = this.columnLayout.scrollableHeaderGroupRuns;
  readonly rightHeaderGroupRuns = this.columnLayout.rightHeaderGroupRuns;


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
    treeConfig: this.treeConfig,
    pivotMode: this.pivotMode,
    expandedTreeIds: this.treeController.expandedIds,
    pinRow: this.effectivePinRow,
    masterDetail: this.masterDetail,
    expandedDetailIds: this._expandedDetailIds,
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
    onValidationFailed: event => this.validationFailed.emit({ ...event, source: 'inline' }),
  });

  /** Total filtered row count regardless of current page. */
  readonly filteredRowCount = this.projection.filteredRowCount;

  /** Total number of pages given the current filter and page size. */
  readonly totalPages = this.projection.totalPages;

  readonly showPagination = this.projection.showPagination;

  /** Number of semantic header rows currently rendered. */
  readonly headerRowCount = computed(() => this.hasHeaderGroups() ? 2 : 1);

  /** Number of rendered semantic rows, including header and pinned rows. */
  readonly ariaRowCount = computed(() =>
    this.displayItems().length + this.headerRowCount() + (this.showFooter() ? 1 : 0)
    + this.pinnedTopItems().length + this.pinnedBottomItems().length
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

  /** Rows pinned to the top of the body (rendered in a fixed container, outside virtual scroll). */
  readonly pinnedTopItems = this.projection.pinnedTopItems;
  /** Rows pinned to the bottom of the body (rendered in a fixed container, outside virtual scroll). */
  readonly pinnedBottomItems = this.projection.pinnedBottomItems;
  /** Whether any top-pinned rows are present. */
  readonly hasPinnedTopRows = computed(() => this.pinnedTopItems().length > 0);
  /** Whether any bottom-pinned rows are present. */
  readonly hasPinnedBottomRows = computed(() => this.pinnedBottomItems().length > 0);

  /**
   * Per-item heights fed to the variable-size virtual-scroll strategy: a detail panel uses the
   * configured detail height, every other row uses the standard row height. With no detail rows
   * open the array is uniform, so scrolling matches the fixed-size strategy.
   */
  readonly itemSizes = computed<number[]>(() => {
    const h = this.rowHeight();
    const dh = this.detailRowHeight();
    return this.displayItems().map(item => (isDetailRowItemFn(item) ? dh : h));
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
  private viewReady = false;

  private readonly rangeController = new AgridRangeController({
    control: this.control,
    dataSource: this.dataSource,
    filteredItems: this.filteredItems,
    visibleColDefs: this.visibleColDefs,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    isCellEditable: (col, originalIndex) => this.isCellEditable(col, originalIndex),
    cancelEdit: () => this.cancelCurrent(),
    findDisplayIndex: originalIndex => this.findDisplayIndex(originalIndex),
    scrollToCell: (displayIndex, colIndex) => this.scrollToKeepVisible(displayIndex, colIndex),
    verticalViewportElement: () => this.viewport().elementRef.nativeElement,
    horizontalViewportElement: () => this.horizontalScrollerEl().nativeElement,
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
    getRowClass: this.rowClassFn,
  });

  private readonly findController = new AgridFindController({
    dataSource: this.dataSource,
    filteredSortedIndices: this.projection.filteredSortedIndices,
    visibleColDefs: this.visibleColDefs,
    locale: this.locale,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    revealMatch: (originalIndex, colIndex) => this.revealFindMatch(originalIndex, colIndex),
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
    enterEditAction: this.enterEditAction,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    editingCell: this.editController.editingCell,
    isEditing: (originalIndex, colIndex) => this.isEditing(originalIndex, colIndex),
    isCellEditable: (col, originalIndex) => this.editController.isCellEditable(col, originalIndex),
    toggleTreeCell: (originalIndex, colIndex) =>
      this.toggleTreeCell(originalIndex, colIndex),
    startEdit: (originalIndex, colIndex, seedChar, selectText) =>
      this.editController.start(originalIndex, colIndex, seedChar, selectText),
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
    locale: this.locale,
    markedRowIndices: this.markedRowIndices,
    rowSelection: this.rowSelection,
    selectedCell: this.selectedCell,
    editingCell: this.editController.editingCell,
    insertRowAt: index => {
      this.reconcileMarkedRowsAfterInsertion(index);
      this.navigationController.insertRowAt(index);
    },
    startDragSelect: originalIndex => this.dragHandler.startDragSelect(originalIndex),
    onRowSelect: event => this.rowSelect.emit(event),
    onRowClick: event => this.rowClick.emit(event),
    onRowRemoved: event => {
      this.reconcileDirtyInlineRowsAfterRemoval(event.index);
      this.reconcileMarkedRowsAfterRemoval(event.index);
      this.rowRemoved.emit(this.createRecordEvent(event.index, event.data));
    },
    onEditRowRemoved: originalIndex => this.editController.onRowRemoved(originalIndex),
    closeFilterMenu: () => this.columnMenuController.close(),
    closeGroupActionsMenu: () => this.closeGroupActionsMenu(),
  });

  readonly selectedRowIndices = this.rowController.selectedRowIndices;
  readonly selectedRowIndex = this.rowController.selectedRowIndex;
  readonly contextMenu = this.rowController.contextMenu;
  readonly cellContextMenuState = this.rowController.cellContextMenu;

  /** Id of the menu-bar button whose dropdown is open, or `null`. */
  readonly openMenuBarItemId = signal<string | null>(null);

  /** Runtime state passed to menu-bar visibility, active, and disabled resolvers. */
  readonly menuBarContext = computed<AgridMenuBarContext<T>>(() => {
    const datasource = this.dataSource();
    const rows = datasource.rows() as T[];
    const selectedRows = [...this.selectedRowIndices()]
      .sort((a, b) => a - b)
      .map(originalIndex => ({ row: rows[originalIndex], originalIndex }))
      .filter((entry): entry is { row: T; originalIndex: number } => !!entry.row);
    return {
      rows,
      selectedRows,
      selectedCell: this.selectedCell(),
      provider: this.provider(),
      datasource,
    };
  });

  /** Menu-bar buttons currently allowed by their visibility resolvers. */
  readonly visibleMenuBarItems = computed(() =>
    this.menuBarItems().filter(item => this.isMenuBarItemVisible(item)),
  );

  private readonly sidebarController = new AgridSidebarController({
    control: this.control,
    dataSource: this.dataSource,
    colDefs: this.colDefs,
    visibleColDefs: this.visibleColDefs,
    selectedRowIndex: this.selectedRowIndex,
    autoOpenDetail: this.autoOpenDetail,
    useSidebarEditor: this.useSidebarEditor,
    isCellEditable: (col, originalIndex) => this.isCellEditable(col, originalIndex),
    onFieldChange: event => this.markCellChanged(event),
    onCellEdit: event => this.emitSidebarEditEvents(event),
    onValidationFailed: event => this.validationFailed.emit({ ...event, source: 'sidebar' }),
  });

  readonly sidebarOpen = this.sidebarController.open;
  /** @internal Per-field sidebar validation messages. */
  readonly sidebarValidationErrors = this.sidebarController.validationErrors;
  readonly sidebarTab = this.sidebarController.tab;
  readonly sidebarRow = this.sidebarController.row;
  readonly sidebarHiddenColumns = this.sidebarController.hiddenColumns;
  /** Original provider columns used as pivot field choices. */
  readonly sidebarPivotColumns = computed<ColDef[]>(
    () => this.provider().columns() as unknown as ColDef[],
  );

  private readonly clipboardHandler = new AgridClipboardHandler({
    control: this.control,
    dataSource: this.dataSource,
    filteredItems: this.filteredItems,
    visibleColDefs: this.visibleColDefs,
    locale: this.locale,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    markedRowIndices: this.markedRowIndices,
    isCellEditable: (col, originalIndex) => this.isCellEditable(col, originalIndex),
    onCellEdit: event => this.emitEditEvents(event),
    scrollToCell: (displayIndex, colIndex) => this.scrollToKeepVisible(displayIndex, colIndex),
  });

  readonly dragHandler = new AgridDragHandler({
    dataSource: this.dataSource,
    filteredItems: () => this.filteredItems(),
    locale: () => this.locale(),
    selectedIndices: this.rowController.selectedIndices,
    onReorder: e => {
      this.reconcileMarkedRowsAfterMove(e.oldIndex, e.newIndex);
      this.rowReorder.emit(e);
    },
    onSelectionChange: () => this.rowController.emitSelection(),
  }, this.destroyRef);

  private readonly columnReorder = new AgridColumnReorderController({
    control: this.control,
    visibleColDefs: this.visibleColDefs,
    getColDef: field => this.getColDef(field),
  }, this.destroyRef);

  readonly columnDragPreview = this.columnReorder.preview;

  /** @internal Start a column header drag. */
  onColHeaderPointerDown(event: PointerEvent, field: string): void {
    this.columnReorder.start(event, field);
  }

  /** @internal Start dragging all columns in one contiguous grouped-header segment. */
  onHeaderGroupPointerDown(event: PointerEvent, fields: string[], label: string): void {
    this.columnReorder.startGroup(event, fields, label);
  }

  /** @internal Whether any field in a grouped-header segment is being dragged. */
  isHeaderGroupDragging(fields: string[]): boolean {
    return fields.some(field => this.columnReorder.isDragging(field));
  }

  /** @internal Whether a grouped-header segment contains a locked column. */
  isHeaderGroupLocked(fields: string[]): boolean {
    return fields.some(field => this.getColDef(field)?.locked);
  }

  /** @internal Whether the given column header is being dragged. */
  isColDragging(field: string): boolean {
    return this.columnReorder.isDragging(field);
  }

  /** @internal Template helper for drop-indicator class. */
  getColDropSide(field: string): 'before' | 'after' | null {
    return this.columnReorder.getDropSide(field);
  }

  /** @internal Horizontal animation offset for a header during column reordering. */
  getColReorderOffset(field: string): number {
    return this.columnReorder.getHeaderOffset(field);
  }

  hasContextMenuEntries() {
    const hme = (!this.readonlyGrid() && !this.treeConfig())
    return hme;
  }

  // ── Setup ─────────────────────────────────────────────────────────────────────

  private readonly _seededControls = new WeakSet<AgridControl>();
  private readonly dirtyInlineRows = new Set<number>();
  private dirtyRowsDataSource: AgridDataSource | null = null;
  private readonly changedCells = signal<ReadonlySet<string>>(new Set());
  private changedCellsDataSource: AgridDataSource | null = null;

  private emitEditEvents(event: GridEditEvent): void {
    this.cellEdit.emit(event as GridEditEvent<T>);
    this.emitRecordEdit(event.position.rowIndex);
    this.markInlineRowDirty(event.position.rowIndex);
    this.markCellChanged(event);
  }

  private emitSidebarEditEvents(event: GridEditEvent): void {
    this.cellEdit.emit(event as GridEditEvent<T>);
    this.emitRecordEdit(event.position.rowIndex);
  }

  private emitRecordEdit(index: number): void {
    const datasource = this.dataSource();
    const event = this.createRecordEvent(index, datasource.getRow(index));
    queueMicrotask(() => this.recordEdit.emit(event));
  }

  private markInlineRowDirty(index: number): void {
    const datasource = this.dataSource();
    if (this.dirtyRowsDataSource !== datasource) {
      this.dirtyInlineRows.clear();
      this.dirtyRowsDataSource = datasource;
    }
    this.dirtyInlineRows.add(index);
  }

  private markCellChanged(event: GridEditEvent): void {
    if (!this.showChangedCellIndicator()) return;
    const datasource = this.dataSource();
    if (this.changedCellsDataSource !== datasource) {
      this.changedCells.set(new Set());
      this.changedCellsDataSource = datasource;
    }
    this.changedCells.update(current => {
      const next = new Set(current);
      next.add(this.changedCellKey(event.position.rowIndex, event.field));
      return next;
    });
  }

  private changedCellKey(rowIndex: number, field: string): string {
    return JSON.stringify([rowIndex, field]);
  }

  private parseChangedCellKey(key: string): { rowIndex: number; field: string } {
    const [rowIndex, field] = JSON.parse(key) as [number, string];
    return { rowIndex, field };
  }

  private flushDirtyInlineRows(activeRowIndex: number | null = null): void {
    const datasource = this.dataSource();
    if (this.dirtyRowsDataSource !== datasource) {
      this.dirtyInlineRows.clear();
      this.dirtyRowsDataSource = datasource;
      return;
    }

    for (const index of [...this.dirtyInlineRows].sort((a, b) => a - b)) {
      if (index === activeRowIndex) continue;
      this.dirtyInlineRows.delete(index);
      if (index >= 0 && index < datasource.length) this.emitRowChanged(index);
    }
  }

  private reconcileDirtyInlineRowsAfterRemoval(removedIndex: number): void {
    const shifted = new Set<number>();
    for (const index of this.dirtyInlineRows) {
      if (index < removedIndex) shifted.add(index);
      else if (index > removedIndex) shifted.add(index - 1);
    }
    this.dirtyInlineRows.clear();
    for (const index of shifted) this.dirtyInlineRows.add(index);
    this.reconcileChangedCellsAfterRemoval(removedIndex);
  }

  private reconcileChangedCellsAfterRemoval(removedIndex: number): void {
    const shifted = new Set<string>();
    for (const key of this.changedCells()) {
      const marker = this.parseChangedCellKey(key);
      if (marker.rowIndex < removedIndex) shifted.add(key);
      else if (marker.rowIndex > removedIndex) {
        shifted.add(this.changedCellKey(marker.rowIndex - 1, marker.field));
      }
    }
    this.changedCells.set(shifted);
  }

  private emitRowChanged(originalIndex: number): void {
    this.rowChanged.emit({
      row: this.dataSource().getRow(originalIndex),
      originalIndex,
    } as RowUpdateEvent<T>);
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
    // Keep one datasource identity so selection/controllers are not reset whenever source data
    // causes the computed pivot rows to be regenerated.
    this.pivotDataSource.linkSignal(this.pivotRows);
    effect(() => this.sidebarController.syncAutoOpen());

    effect(() => {
      const datasource = this.dataSource();
      if (this.changedCellsDataSource === datasource) return;
      this.changedCellsDataSource = datasource;
      this.changedCells.set(new Set());
    });

    effect(() => {
      const activeRowIndex = this.selectedCell()?.rowIndex ?? null;
      this.flushDirtyInlineRows(activeRowIndex);
    });

    afterNextRender(() => {
      this.viewReady = true;
      const wrapper = this.wrapperEl().nativeElement;
      const renderedRangeSubscription = this.viewport().renderedRangeStream.subscribe(() =>
        this.ensureServerRowsVisible()
      );
      const onKeyDown = (event: KeyboardEvent) => this.onKeyDown(event);
      wrapper.addEventListener('keydown', onKeyDown, { capture: true });
      this.destroyRef.onDestroy(() => {
        renderedRangeSubscription.unsubscribe();
        wrapper.removeEventListener('keydown', onKeyDown, { capture: true });
      });
      this.ensureServerRowsVisible();
    });

    // Query changes invalidate lazy blocks. The model owns request cancellation by generation,
    // so late responses from an old filter/sort state cannot overwrite current rows.
    effect(() => {
      const model = this.serverSideRowModel();
      const ctrl = this.control();
      if (!model) return;
      ctrl?.filters();
      ctrl?.sortOrder();
      ctrl?.quickFilter();
      const changed = model.setQuery(ctrl, this.projection.effectiveSortOrder());
      if (changed && this.viewReady) this.viewport().scrollToIndex(0);
      queueMicrotask(() => this.ensureServerRowsVisible());
    });

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (this.closeOpenMenus()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    this.browser.addDocumentListener('keydown', onDocumentKeyDown);

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
      const isInsideGrid = this._hostEl.nativeElement.contains(e.target as Node);
      if (!isInsideGrid) {
        this.closeOpenMenus();
        queueMicrotask(() => this.flushDirtyInlineRows());
      }
      if (this.rowSelection() === 'none') return;
      if (this.selectedRowIndices().size === 0) return;
      if (isInsideGrid) return;
      this.rowController.clearSelection();
    };
    this.browser.addDocumentListener('pointerdown', onOutsidePointerDown);
    this.destroyRef.onDestroy(() => {
      this.browser.removeDocumentListener('keydown', onDocumentKeyDown);
      this.browser.removeDocumentListener('pointerdown', onOutsidePointerDown);
      if (this.quickFilterTimer !== null) clearTimeout(this.quickFilterTimer);
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

  /** @internal Whether this virtual row is waiting for a server-side block. */
  isLoadingRow(item: GridItem): item is { loading: true; originalIndex: number } {
    return !!item && typeof item === 'object' && 'loading' in item;
  }

  /** @internal */
  isGroupHeaderItem(item: GridItem): item is { groupLabel: string; count: number; collapsed: boolean } {
    return isGroupHeaderItemFn(item);
  }

  /** @internal */
  isPathTreeNodeItem(item: GridItem): boolean {
    return isPathTreeNodeItemFn(item);
  }

  /** @internal */
  getItemOriginalIndex(item: GridItem): number | null {
    return isDataRowItemFn(item) ? item.originalIndex : null;
  }

  /** @internal True when the item is a master/detail panel row. */
  isDetailRowItem(item: GridItem): item is DetailRowItem {
    return isDetailRowItemFn(item);
  }

  /** @internal Rendered pixel height of a virtual-scroll item (detail panels are taller). */
  rowPx(item: GridItem): number {
    return isDetailRowItemFn(item) ? this.detailRowHeight() : this.rowHeight();
  }

  /** @internal Resolved HTML for an expanded detail panel (auto-sanitized by `[innerHTML]`). */
  detailHtml(item: GridItem): string {
    if (!isDetailRowItemFn(item)) return '';
    return this.provider().detailRenderer?.({ row: item.row as T }) ?? '';
  }

  /** @internal Resolved per-row CSS classes from the host `getRowClass` callback. */
  getRowClass(row: Record<string, unknown>, index: number): string {
    return this.presentation.getRowClass(row, index);
  }

  /** Whether the master/detail panel for `originalIndex` is currently expanded. */
  isDetailExpanded(originalIndex: number): boolean {
    return this._expandedDetailIds().has(originalIndex);
  }

  /** @internal Whether a data row may show a master/detail panel. */
  canToggleDetail(item: GridItem): boolean {
    if (!this.masterDetail() || !isDataRowItemFn(item)) return false;
    const config = this.treeConfig();
    return !config
      || isPathTreeConfig(config)
      || !this.treeParentIds().has(config.getId(item.row as T));
  }

  /** Toggle the master/detail panel for a row by its original (data-source) index. */
  toggleDetail(originalIndex: number): void {
    const row = this.dataSource().getRow(originalIndex);
    const config = this.treeConfig();
    if (
      !row
      || (
        config
        && !isPathTreeConfig(config)
        && this.treeParentIds().has(config.getId(row as T))
      )
    ) return;
    this._expandedDetailIds.update(ids => {
      const next = new Set(ids);
      if (next.has(originalIndex)) next.delete(originalIndex);
      else next.add(originalIndex);
      return next;
    });
  }

  /** @internal Template handler for the detail expander chevron. */
  onDetailToggle(originalIndex: number): void {
    this.toggleDetail(originalIndex);
  }

  /** Effective pin position of a row (`'top'`, `'bottom'`, or `undefined`). */
  rowPinState(originalIndex: number): 'top' | 'bottom' | undefined {
    const resolver = this.effectivePinRow();
    if (!resolver) return undefined;
    return resolver(this.dataSource().rows()[originalIndex], originalIndex);
  }

  /**
   * Pin a row to the top or bottom of the body, or unpin it with `null`.
   * Keyed by the row's original (data-source) index; the pinned row stays fully interactive.
   */
  pinRowTo(originalIndex: number, position: 'top' | 'bottom' | null): void {
    this._pinnedRows.update(map => {
      const next = new Map(map);
      // When no predicate could re-pin the row, an unpin can simply drop the override.
      if (position === null && !this.pinRowFn()) next.delete(originalIndex);
      else next.set(originalIndex, position);
      return next;
    });
  }

  /** @internal Template handler for the pin/unpin context-menu items; closes the open menus. */
  onPinRow(originalIndex: number, position: 'top' | 'bottom' | null): void {
    this.pinRowTo(originalIndex, position);
    this.rowController.closeContextMenu();
    this.rowController.closeCellContextMenu();
  }

  // ── Template helpers — tree ───────────────────────────────────────────────────

  /** @internal True when `col` is the configured tree column. */
  isTreeCell(col: ColDef): boolean {
    return this.treeConfig()?.treeField === col.field;
  }

  /** @internal Tree depth of a row item (0 when not a tree row). */
  treeRowLevel(item: GridItem): number {
    return isTreeRowItemFn(item) || isPathTreeNodeItemFn(item) ? item.level : 0;
  }

  /** @internal Whether a tree row has children and can be expanded. */
  treeRowExpandable(item: GridItem): boolean {
    return (isTreeRowItemFn(item) || isPathTreeNodeItemFn(item)) && item.expandable;
  }

  /** @internal Whether a tree row is currently expanded. */
  treeRowExpanded(item: GridItem): boolean {
    return (isTreeRowItemFn(item) || isPathTreeNodeItemFn(item)) && item.expanded;
  }

  /**
   * @internal Resolve the non-persistent value shown by a tree cell.
   *
   * A formatted path-leaf label wins in the tree column. In every other aggregate column, an
   * expandable parent shows its descendant rollup instead of its stored value. Returning `null`
   * delegates to the normal cell formatter. The source row is never mutated.
   */
  treeCellDisplayOverride(item: GridItem, col: ColDef): string | null {
    if (!isTreeRowItemFn(item)) return null;
    if (this.isTreeCell(col) && item.treeLabel != null) return item.treeLabel;
    if (item.aggregates && col.field in item.aggregates) {
      return this.getFooterDisplay(col, item.aggregates[col.field]);
    }
    return null;
  }

  /**
   * @internal True when a datasource-backed tree parent cell displays a computed rollup.
   * The template uses this to prevent editing a display-only value into the source parent row.
   * Generated path branches are not cell components and render their aggregates separately.
   */
  isTreeAggregateCell(item: GridItem, col: ColDef): boolean {
    return isTreeRowItemFn(item) && !!item.aggregates && col.field in item.aggregates;
  }

  /** @internal Whether the configured info action is visible for this cell. */
  showCellInfoIcon(col: ColDef, row: Record<string, unknown>): boolean {
    return typeof col.infoIcon === 'function'
      ? col.infoIcon({ value: row[col.field], row })
      : col.infoIcon === true;
  }

  /** @internal Emits the typed cell information action. */
  onCellInfo(originalIndex: number, col: ColDef, row: Record<string, unknown>): void {
    this.cellInfo.emit({
      row: row as T,
      field: col.field as AgridField<T>,
      value: row[col.field],
      originalIndex,
      column: col,
    } as unknown as CellInfoEvent<T>);
  }

  /** @internal Label of a generated path-tree branch. */
  pathTreeLabel(item: GridItem): string {
    return isPathTreeNodeItemFn(item) ? item.pathLabel : '';
  }

  /** @internal Toggle the expand/collapse state of a tree row from its twisty. */
  onTreeToggle(item: GridItem): void {
    const config = this.treeConfig();
    if (!config) return;
    if (isPathTreeNodeItemFn(item)) {
      this.treeController.toggle(item.pathNodeId);
    } else if (isTreeRowItemFn(item) && !isPathTreeConfig(config)) {
      this.treeController.toggle(config.getId(item.row as T));
    }
  }

  /** @internal Emits the generated path-tree branch click event. */
  onTreeNodeClick(item: GridItem): void {
    if (!isPathTreeNodeItemFn(item)) return;
    this.treeNodeClick.emit(this.toTreeNodeClickEvent(item));
  }

  /** @internal Emits the generated path-tree branch double-click event. */
  onTreeNodeDoubleClick(item: GridItem): void {
    if (!isPathTreeNodeItemFn(item)) return;
    this.treeNodeDoubleClicked.emit(this.toTreeNodeClickEvent(item));
  }

  private toTreeNodeClickEvent(item: PathTreeNodeItem): TreeNodeClickEvent {
    return {
      uuid: item.uuid,
      pathNodeId: item.pathNodeId,
      pathLabel: item.pathLabel,
      level: item.level,
      expanded: item.expanded,
      node: { ...item },
    };
  }

  private toggleTreeCell(originalIndex: number, colIndex: number): boolean {
    const config = this.treeConfig();
    const col = this.visibleColDefs()[colIndex];
    if (!config || !col || config.treeField !== col.field) return false;

    const item = this.displayItems().find(
      candidate => isDataRowItemFn(candidate) && candidate.originalIndex === originalIndex,
    );
    if (!item || !isTreeRowItemFn(item) || !item.expandable || isPathTreeConfig(config)) return false;

    this.treeController.toggle(config.getId(item.row as T));
    return true;
  }

  /** Expand every expandable node in the tree. No-op when not in tree mode. */
  expandAllNodes(): void {
    const config = this.treeConfig();
    if (!config) return;
    if (isPathTreeConfig(config)) {
      const ids = new Set<string>();
      for (const row of this.dataSource().rows() as T[]) {
        const path = config.getPath(row).map(String).filter(Boolean);
        for (let length = 1; length < path.length; length++) {
          ids.add(pathTreeNodeId(path.slice(0, length)));
        }
      }
      this.treeController.expandAll(ids);
      return;
    }
    const expandable = new Set<string | number>();
    for (const row of this.dataSource().rows()) {
      const parentId = config.getParentId(row as T);
      if (parentId != null) expandable.add(parentId);
    }
    this.treeController.expandAll(expandable);
  }

  /** Collapse every node in the tree. No-op when not in tree mode. */
  collapseAllNodes(): void {
    this.treeController.collapseAll();
  }

  /** @internal CDK trackBy — arrow to preserve `this`. */
  readonly trackByItem = (_di: number, item: GridItem): string | number => {
    if (item === 'ghost') return '__ghost__';
    if (item === null) return -1;
    if (this.isLoadingRow(item)) return `__loading__${item.originalIndex}`;
    if (isGroupHeaderItemFn(item)) return `__group__${item.groupLabel}`;
    if (isDetailRowItemFn(item)) return `__detail__${item.detailFor}`;
    if (isPathTreeNodeItemFn(item)) return item.pathNodeId;
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

  /** @internal Condition input type for a column, or `null` when unsupported. */
  getMenuFilterType(field: string): 'text' | 'number' | 'date' | null {
    return this.columnMenuController.getFilterType(field);
  }

  /** @internal Short label for an active header condition. */
  getConditionButtonLabel(field: string): string {
    switch (this.getMenuOperator(field)) {
      case 'eq': return '=';
      case 'neq': return '≠';
      case 'gt': return '>';
      case 'gte': return '≥';
      case 'lt': return '<';
      case 'lte': return '≤';
      case 'between': return '↔';
      case 'like': return '~';
      case 'startsWith': return 'A…';
      case 'endsWith': return '…Z';
      case 'includes': return '⊃';
      case 'notIncludes': return '⊅';
      default: return '⋯';
    }
  }

  /** @internal */
  getMenuOperator(field: string): FilterOperator | null {
    return this.columnMenuController.getFilterOperator(field);
  }

  /** @internal */
  getMenuOperand(field: string): string { return this.columnMenuController.getFilterOperand(field); }

  /** @internal */
  getMenuOperand2(field: string): string {
    return this.columnMenuController.getFilterOperand2(field);
  }

  /** @internal */
  onMenuOperatorChange(field: string, operator: FilterOperator | null): void {
    this.columnMenuController.setFilterOperator(field, operator);
  }

  /** @internal */
  onMenuOperandChange(field: string, value: string): void {
    this.columnMenuController.setFilterOperand(field, value);
  }

  /** @internal */
  onMenuOperand2Change(field: string, value: string): void {
    this.columnMenuController.setFilterOperand2(field, value);
  }

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
    if (this.rangeController.consumeSuppressedActivation()) return;
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

  private quickFilterTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @internal Quick-filter input handler. Stores the text on the control (drives the bound value
   * and client-side filtering) and, in server mode, emits a debounced `quickFilterChange` instead.
   */
  onQuickFilterInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.control()?.setQuickFilter(text);
    if (!this.serverSideFiltering()) return;
    if (this.quickFilterTimer !== null) clearTimeout(this.quickFilterTimer);
    const delay = this.filterDebounceMs();
    if (delay === 0) {
      this.quickFilterChange.emit(text);
      return;
    }
    this.quickFilterTimer = setTimeout(() => {
      this.quickFilterTimer = null;
      this.quickFilterChange.emit(text);
    }, delay);
  }

  /** @internal Whether a column is editable in the current grid state (drives boolean checkboxes). */
  isColEditable(col: ColDef, originalIndex?: number): boolean {
    return this.editController.isCellEditable(col, originalIndex);
  }

  /** @internal Inline validation message for a cell, or `null` when the cell has no active error. */
  cellValidationError(originalIndex: number, ci: number): string | null {
    const error = this.editController.validationError();
    return error && error.rowIndex === originalIndex && error.colIndex === ci ? error.message : null;
  }

  /** @internal Commit a boolean-column checkbox toggle directly to the data source. */
  onBooleanToggle(originalIndex: number, ci: number, value: boolean): void {
    this.editController.setCellValue(originalIndex, ci, value);
  }

  /** @internal Starts a fill-handle drag from the bottom-right corner of the selection. */
  onCellPointerDown(event: PointerEvent, originalIndex: number, colIndex: number): void {
    if (this.rangeController.startFill(event, originalIndex, colIndex)) return;
    this.rangeController.startSelection(event, originalIndex, colIndex);
  }

  /** @internal Main keyboard handler delegated from the wrapper div. */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.closeOpenMenus()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape' && this.pendingDeleteRow() !== null) {
      event.preventDefault();
      event.stopPropagation();
      this.cancelRowDelete();
      return;
    }
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

  private revealFindMatch(originalIndex: number, colIndex: number): void {
    const config = this.treeConfig();
    if (config) {
      const rows = this.dataSource().rows() as T[];
      const expanded = new Set(this.treeController.expandedIds());
      if (isPathTreeConfig(config)) {
        const path = config.getPath(rows[originalIndex]).map(String).filter(Boolean);
        for (let length = 1; length < path.length; length++) {
          expanded.add(pathTreeNodeId(path.slice(0, length)));
        }
      } else {
        const idToRow = new Map(rows.map(row => [config.getId(row), row]));
        const visited = new Set<string | number>();
        let parentId = config.getParentId(rows[originalIndex]);
        while (parentId !== null && parentId !== undefined && !visited.has(parentId)) {
          visited.add(parentId);
          expanded.add(parentId);
          const parent = idToRow.get(parentId);
          if (!parent) break;
          parentId = config.getParentId(parent);
        }
      }
      this.treeController.expandAll(expanded);
    } else {
      const control = this.control();
      const pageSize = control?.pageSize() ?? 0;
      const filteredIndex = this.projection.filteredSortedIndices().indexOf(originalIndex);
      if (control && pageSize > 0 && control.totalRows() === 0 && filteredIndex >= 0) {
        control.setPage(Math.floor(filteredIndex / pageSize) + 1);
      }
    }

    setTimeout(() => {
      const displayIndex = this.navigationController.findDisplayIndex(originalIndex);
      if (displayIndex >= 0) {
        this.navigationController.scrollToKeepVisible(displayIndex, colIndex);
      }
    });
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
    if (this.allowRowReorder() && event.pointerType === 'mouse' && event.button === 0) {
      this.onHandlePointerDown(event, originalIndex);
      return;
    }
    this.rowController.selectFromPointer(event, originalIndex, false);
  }

  /** @internal Toggle whether a row is included in subsequent copy operations. */
  toggleRowMarked(originalIndex: number): void {
    this.markedIndices.update(indices => {
      const next = new Set(indices);
      if (next.has(originalIndex)) next.delete(originalIndex);
      else next.add(originalIndex);
      return next;
    });
  }

  /** @internal Returns whether a row is marked for copying. */
  isRowMarked(originalIndex: number): boolean {
    return this.markedIndices().has(originalIndex);
  }

  /** Clear every row marked for clipboard inclusion. */
  clearMarkedRows(): void {
    this.markedIndices.set(new Set());
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

  /** @internal Closes any row, cell, menu-bar, group-action, or column menu owned by this grid. */
  closeOpenMenus(): boolean {
    const hadOpenMenu = this.contextMenu() !== null
      || this.cellContextMenuState() !== null
      || this.openMenuBarItemId() !== null
      || this.groupActionsMenu() !== null
      || this.filterMenu() !== null;
    if (!hadOpenMenu) return false;
    this.rowController.closeContextMenu();
    this.rowController.closeCellContextMenu();
    this.closeMenuBarMenu();
    this.groupController.closeActionsMenu();
    this.columnMenuController.close();
    return true;
  }

  /** @internal Resolves a menu-bar state callback against the current grid state. */
  resolveMenuBarState(state: AgridMenuBarState<T> | undefined, fallback: boolean): boolean {
    if (typeof state === 'function') return state(this.menuBarContext());
    return state ?? fallback;
  }

  /** @internal Whether a menu-bar button or dropdown item should be rendered. */
  isMenuBarItemVisible(item: AgridMenuBarMenuItem<T>): boolean {
    return this.resolveMenuBarState(item.visible, true);
  }

  /** @internal Whether a menu-bar button or dropdown item is active. */
  isMenuBarItemActive(item: AgridMenuBarMenuItem<T>): boolean {
    return this.resolveMenuBarState(item.active, false);
  }

  /** @internal Whether a menu-bar button or dropdown item is disabled. */
  isMenuBarItemDisabled(item: AgridMenuBarMenuItem<T>): boolean {
    return this.resolveMenuBarState(item.disabled, false);
  }

  /** @internal Visible dropdown entries for a menu-bar button. */
  visibleMenuBarChildren(item: AgridMenuBarItem<T>): AgridMenuBarMenuItem<T>[] {
    return (item.items ?? []).filter(child => this.isMenuBarItemVisible(child));
  }

  /** @internal Emits one menu-bar action and closes its dropdown. */
  runMenuBarAction(event: Event, item: AgridMenuBarMenuItem<T>): void {
    event.stopPropagation();
    if (!this.isMenuBarItemVisible(item) || this.isMenuBarItemDisabled(item)) return;
    this.menuBarAction.emit(item.id);
    this.closeMenuBarMenu();
  }

  /** @internal Opens or closes a split button's additional command menu. */
  toggleMenuBarMenu(event: Event, item: AgridMenuBarItem<T>): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.visibleMenuBarChildren(item).length === 0) return;
    this.rowController.closeContextMenu();
    this.rowController.closeCellContextMenu();
    this.groupController.closeActionsMenu();
    this.columnMenuController.close();
    this.openMenuBarItemId.update(id => id === item.id ? null : item.id);
  }

  /** @internal Opens a dropdown from the keyboard and focuses its first/last enabled item. */
  onMenuBarTriggerKeydown(event: KeyboardEvent, item: AgridMenuBarItem<T>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    event.stopPropagation();
    if (this.visibleMenuBarChildren(item).length === 0) return;
    this.openMenuBarItemId.set(item.id);
    const group = (event.currentTarget as HTMLElement).closest('.ag-menu-bar-group');
    setTimeout(() => {
      const enabled = group?.querySelectorAll<HTMLButtonElement>(
        '.ag-menu-bar-dropdown [role="menuitem"]:not(:disabled)',
      );
      const target = event.key === 'ArrowUp' ? enabled?.[enabled.length - 1] : enabled?.[0];
      target?.focus();
    });
  }

  /** @internal Provides standard keyboard navigation within an open menu-bar dropdown. */
  onMenuBarMenuKeydown(event: KeyboardEvent): void {
    const menu = event.currentTarget as HTMLElement;
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    ));
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeMenuBarMenu();
      menu.closest('.ag-menu-bar-group')
        ?.querySelector<HTMLButtonElement>('.ag-menu-bar-trigger')
        ?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || items.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const current = items.indexOf(event.target as HTMLButtonElement);
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length;
    items[next].focus();
  }

  /** @internal Closes the currently open menu-bar dropdown. */
  closeMenuBarMenu(): void {
    this.openMenuBarItemId.set(null);
  }

  /** @internal Synchronizes dropdown state and closes competing grid menus when one opens. */
  onMenuBarOpenItemChange(id: string | null): void {
    if (id !== null) {
      this.rowController.closeContextMenu();
      this.rowController.closeCellContextMenu();
      this.groupController.closeActionsMenu();
      this.columnMenuController.close();
    }
    this.openMenuBarItemId.set(id);
  }

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

  /** @internal Copy one field from the target and marked rows. */
  copyCellToClipboard(originalIndex: number, col: ColDef): void {
    this.rowController.copyCellToClipboard(originalIndex, col);
  }

  /** @internal Copy the target and marked rows using all visible fields. */
  copyRowToClipboard(originalIndex: number): void {
    this.rowController.copyRowToClipboard(originalIndex);
  }

  /** @internal Insert a blank row at a specific position and emit prepareAddRecord. */
  insertRowAt(atIndex: number): void {
    this.rowController.insertRowAt(atIndex);
  }

  /** Start confirmation or immediately delete the row at `originalIndex`. */
  deleteRow(originalIndex: number): void {
    if (this.confirmRowDelete()) {
      this.updateDeleteConfirmationPosition();
      this.pendingDeleteRow.set(originalIndex);
      this.rowController.closeContextMenu();
      this.rowController.closeCellContextMenu();
      this.browser.schedule(() => {
        (this._hostEl.nativeElement as HTMLElement)
          .querySelector<HTMLButtonElement>('[data-delete-confirm-no]')
          ?.focus();
      });
      return;
    }
    this.deleteRowImmediately(originalIndex);
  }

  /** @internal Returns whether this row is awaiting delete confirmation. */
  isRowPendingDelete(originalIndex: number): boolean {
    return this.pendingDeleteRow() === originalIndex;
  }

  /** @internal Delete the row currently awaiting confirmation. */
  confirmPendingRowDelete(): void {
    const originalIndex = this.pendingDeleteRow();
    if (originalIndex === null) return;
    this.pendingDeleteRow.set(null);
    this.deleteRowImmediately(originalIndex);
  }

  /** @internal Cancel the active row-delete confirmation. */
  cancelRowDelete(): void {
    this.pendingDeleteRow.set(null);
    this.wrapperEl().nativeElement.focus();
  }

  private deleteRowImmediately(originalIndex: number): void {
    this.rowController.deleteRow(originalIndex);
    this.rowController.closeCellContextMenu();
  }

  private updateDeleteConfirmationPosition(): void {
    const scroller = this.horizontalScrollerEl().nativeElement;
    this.deleteConfirmationLeft.set(scroller.scrollLeft);
    this.deleteConfirmationWidth.set(scroller.clientWidth);
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
    this.emitSettingsChange();
  }

  /** @internal Sets every column in a sidebar header group to the requested visibility. */
  onSidebarToggleColumnGroup(fields: string[], visible: boolean): void {
    this.columnMenuController.setColumnsVisibility(fields, visible);
    this.emitSettingsChange();
  }

  /** @internal Mirrors vertical scrolling from the main viewport into both pinned panes. */
  onBodyScroll(): void {
    const offset = this.viewport().measureScrollOffset();
    this.pinnedViewport()?.scrollToOffset(offset);
    this.rightPinnedViewport()?.scrollToOffset(offset);
  }

  private ensureServerRowsVisible(): void {
    const model = this.serverSideRowModel();
    if (!model || !this.viewReady) return;
    const viewport = this.viewport();
    const range = viewport.getRenderedRange();
    const start = Math.max(0, range.start - model.blockSize);
    const end = Math.max(range.end, range.start + model.blockSize) + model.blockSize;
    model.ensureRange(start, end);
  }

  /** @internal Keeps the row-delete prompt visible while columns scroll horizontally. */
  onHorizontalScroll(): void {
    this.updateDeleteConfirmationPosition();
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

  private reconcileMarkedRowsAfterInsertion(insertedIndex: number): void {
    if (this.markedIndices().size === 0) return;
    this.markedIndices.update(indices => new Set(
      [...indices].map(index => index >= insertedIndex ? index + 1 : index)
    ));
  }

  private reconcileMarkedRowsAfterRemoval(removedIndex: number): void {
    if (this.markedIndices().size === 0) return;
    this.markedIndices.update(indices => new Set(
      [...indices]
        .filter(index => index !== removedIndex)
        .map(index => index > removedIndex ? index - 1 : index)
    ));
  }

  private reconcileMarkedRowsAfterMove(oldIndex: number, newIndex: number): void {
    if (this.markedIndices().size === 0 || oldIndex === newIndex) return;
    const destination = newIndex > oldIndex ? newIndex - 1 : newIndex;
    this.markedIndices.update(indices => new Set([...indices].map(index => {
      if (index === oldIndex) return destination;
      if (oldIndex < destination && index > oldIndex && index <= destination) return index - 1;
      if (destination < oldIndex && index >= destination && index < oldIndex) return index + 1;
      return index;
    })));
  }

  private isCellEditable(col: ColDef, originalIndex?: number): boolean {
    return this.editController.isCellEditable(col, originalIndex);
  }

  private enterEdit(originalIndex: number, ci: number, seedChar: string, selectText = true): void {
    this.editController.start(originalIndex, ci, seedChar, selectText);
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
