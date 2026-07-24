import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnChanges,
  Signal,
  afterNextRender,
  afterRenderEffect,
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
import { AgridPaneHeaderComponent } from './rendering/agrid-pane-header.component';
import { AgridBrowserAdapter } from './infrastructure/agrid-browser.adapter';
import { AgridClipboardHandler, CellRange } from './selection/agrid-clipboard.handler';
import {
  AgridColumnLayoutModel,
  AgridHeaderGroup,
  AgridHeaderGroupRun,
} from './columns/agrid-column-layout.model';
import { AgridColumnVirtualizationController } from './columns/agrid-column-virtualization.controller';
import { AgridColumnMenuComponent } from './columns/agrid-column-menu.component';
import { AgridColumnMenuController } from './columns/agrid-column-menu.controller';
import { AgridColumnReorderController } from './columns/agrid-column-reorder.controller';
import { AgridColumnSizingController } from './columns/agrid-column-sizing.controller';
import { AgridColumnStateService } from './columns/agrid-column-state.service';
import { AgridControl, ColumnFilter, FilterOperator } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridDragHandler } from './rows/agrid-drag.handler';
import { AgridDetailController } from './editing/agrid-detail.controller';
import { AgridEditController } from './editing/agrid-edit.controller';
import { AgridFindController } from './selection/agrid-find.controller';
import { AgridFindPanelComponent } from './selection/agrid-find-panel.component';
import { computeSelectionSummary } from './selection/agrid-selection-summary';
import { AgridGroupController } from './rows/agrid-group.controller';
import { AgridTreeController } from './rows/agrid-tree.controller';
import { AgridLocaleText, resolveAgridLocaleText, resolveLocale } from './agrid-localization';
import { AgridNavigationController } from './selection/agrid-navigation.controller';
import { AgridPresentationService } from './rendering/agrid-presentation.service';
import { resolveCellSpanAnchor } from './rendering/agrid-cell-span';
import { AgridMenuBarComponent } from './rendering/agrid-menu-bar.component';
import { AgridMenuBarController } from './rendering/agrid-menu-bar.controller';
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
  buildExportGroups,
  defaultExpandedTreeIds,
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
  AgridAggregate, AgridSelectionSummary,
  AgridBodyColumn, AgridCurrentCell, AgridCurrentRow, AgridField, AgridHeaderColumn, AgridPivotConfig,
  AgridServerQuery, CellContextMenuItem, CellInfoEvent, CellPosition, CellSelectEvent, ColDef, ColumnHeaderActionEvent, ColumnMarkEvent, DetailAction, DetailRowItem, FilterChangeEvent, FirstDataRenderedEvent, GridEditEvent,
  GridItem, GroupAction, NewRecord, PageChangeEvent, PathTreeNodeItem, RecordEditEvent, RowClickEvent,
  RowMarkEvent, RowReorderEvent, RowSelectEvent, RowUpdateEvent, SortChangeEvent, TreeNodeClickEvent, ValidationFailedEvent, ValueOption,
  RowDetailActionEvent, AgridTreeConfig,
} from './agrid.types';

// Re-export for backward compatibility with existing imports of GridItem from this file.
export type { GridItem };

/**
 * Excel-like data grid for Angular 21 and 22.
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
    AgridPaneHeaderComponent,
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
export class AgridComponent<T extends object = any> implements OnChanges {

  // ── Inputs ───────────────────────────────────────────────────────────────────

  /** Grid provider containing columns, data source, control, and options. */
  provider = input<AgridProvider<T>>(new AgridProvider<T>());
  private restoredProvider?: AgridProvider<T>;
  private initializedTreeExpansionFor: {
    provider: AgridProvider<T>;
    datasource: AgridDataSource;
    treeConfig: AgridTreeConfig<T>;
  } | null = null;

  // All display / behaviour options are read from the provider.
  readonly rowHeight = computed(() => this.provider().rowHeight);
  readonly minHeight = computed(() => this.provider().minHeight);
  readonly maxHeight = computed(() => this.provider().maxHeight);
  readonly allowAddRows = computed(() => this.provider().allowAddRows && !this.provider().pivotConfig);
  readonly autoAddRows = computed(() =>
    !this.provider().pivotConfig && (this.control()?.autoAddRows() ?? false)
  );
  readonly enableRowMarking = computed(() => this.provider().enableRowMarking);
  readonly enableColumnMarking = computed(() => this.provider().enableColumnMarking);
  readonly showRowNumbers = computed(() => this.provider().showRowNumbers);
  readonly showControlColumn = computed(() =>
    this.provider().showControlColumn
    || this.showRowNumbers()
    || this.enableRowMarking()
    || this.masterDetail()
  );
  readonly controlColumnWidth = computed(() => {
    if (!this.showRowNumbers()) return this.enableRowMarking() ? 48 : 24;
    const numberWidth = this.rowNumberColumnWidth();
    return this.enableRowMarking() ? numberWidth + 20 : numberWidth;
  });
  readonly showSidebar = computed(() => this.provider().showSidebar);
  readonly autoOpenDetail = computed(() => this.provider().autoOpenDetail);
  readonly serverSideFiltering = computed(() => this.provider().serverSideFiltering);
  readonly filterDebounceMs = computed(() => this.provider().filterDebounceMs);
  readonly enableQuickFilter = computed(() => this.provider().enableQuickFilter);
  readonly showFormulaBar = computed(() => this.provider().showFormulaBar);
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
  readonly hideGridStatusBar = computed(() => this.provider().hideGridStatusBar);

  /** Host callback for per-row CSS classes, or `undefined`. */
  readonly rowClassFn = computed(() => this.provider().getRowClass as
    | ((params: { row: Record<string, unknown>; index: number }) => string)
    | undefined);
  readonly externalFilterFn = computed(() => this.provider().externalFilter as
    | ((params: { row: Record<string, unknown>; index: number }) => boolean)
    | undefined);
  /** Host callback designating pinned rows, or `undefined`. */
  readonly pinRowFn = computed(() => this.provider().pinRow as
    | ((row: Record<string, unknown>, index: number) => 'top' | 'bottom' | undefined)
    | undefined);

  readonly pivotRowColumnField = computed(() => {
    return this.provider().pivotConfig?.rowField;
  })

  readonly pivotHeaderLabel = computed(() => {
    const aggr: AgridAggregate | undefined = this.provider().pivotConfig?.aggregate;
    const vcfield = this.provider().pivotConfig?.valueField;
    const valueColumn = this.provider().columns().find(c => c.field === vcfield);
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
  /** Column configured as the expanded panel's multiline detail field. */
  readonly detailColumn = computed<ColDef | null>(() => {
    const field = this.provider().detailColumnField;
    return field ? this.colDefs().find(col => col.field === field) ?? null : null;
  });
  /** Text-template buttons configured for the expanded panel's multiline detail field. */
  readonly detailActions = computed(() => this.provider().detailActions);
  // Detail-field editor state lives on `detailController`; re-exported below for the template.

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

  readonly gridId = computed<string | undefined>(() => this.provider().gridId)

  readonly enableExportButtons = computed<boolean | undefined>(() => this.provider().enableExportButtons)

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

  /** Emitted when a row is marked or unmarked from its row header. */
  rowMark = output<RowMarkEvent<T>>();

  /** Emitted when a complete column is marked or unmarked from its header. */
  columnMark = output<ColumnMarkEvent<T>>();

  /** Emitted when a custom column-header menu command is selected. */
  columnHeaderAction = output<ColumnHeaderActionEvent<T>>();

  /** Emitted once after the first non-empty datasource render has completed. */
  firstDataRendered = output<FirstDataRenderedEvent<T>>();

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

  /** Emitted with the complete server-side filter/sort/page query snapshot. */
  serverQueryChange = output<AgridServerQuery>();

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

  /** Emitted when the selected cell changes. `null` = cell selection cleared. */
  cellSelect = output<CellSelectEvent<T> | null>();

  /** Emitted for every enabled menu-bar button or dropdown item, carrying its configured id. */
  menuBarAction = output<string>();

  /** Emitted if there is a Detail pane Action without text property */
  detailAction = output<RowDetailActionEvent<T>>();

  // ── Public state ─────────────────────────────────────────────────────────────

  /** Currently focused cell, or `null`. */
  readonly selectedCell = signal<CellPosition | null>(null);
  private lastEmittedCell: CellPosition | null | undefined = undefined;

  /** Original indices of rows whose master/detail panel is currently expanded. */
  private readonly _expandedDetailIds = signal<Set<number>>(new Set());

  /**
   * Runtime per-row pin overrides set through the UI (keyed by original index). A `null` value
   * explicitly unpins a row that the `pinRow` predicate would otherwise pin. Merged with the
   * provider predicate by {@link effectivePinRow}.
   */
  private readonly _pinnedRows = signal<Map<number, 'top' | 'bottom' | null>>(new Map());
  readonly formulaBarDraft = signal('');
  private readonly formulaBarFocused = signal(false);
  private formulaBarEditCell: CellPosition | null = null;

  private readonly markedIndices = signal<Set<number>>(new Set());
  private readonly markedFields = signal<Set<string>>(new Set());
  private firstDataRenderedEmitted = false;
  private serverQueryProvider: AgridProvider<T> | null = null;

  /** Original datasource indices marked for inclusion in copy operations. */
  readonly markedRowIndices: Signal<ReadonlySet<number>> =
    this.markedIndices.asReadonly() as Signal<ReadonlySet<number>>;
  /** Fields currently marked as complete columns. */
  readonly markedColumnFields: Signal<ReadonlySet<string>> =
    this.markedFields.asReadonly() as Signal<ReadonlySet<string>>;

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

  /** Return the first currently selected row, or `null` when no row is selected. */
  getCurrentRow(): AgridCurrentRow<T> | null {
    const originalIndex = this.selectedRowIndex();
    if (originalIndex === null) return null;
    const row = this.dataSource().rows()[originalIndex] as T | undefined;
    return row ? { row, originalIndex } : null;
  }

  /** Return the currently selected cell with row, field, value, and column metadata. */
  getCurrentCell(): AgridCurrentCell<T> | null {
    return this.resolveCurrentCell(this.selectedCell());
  }

  readonly formulaBarLabel = computed(() => {
    const cell = this.selectedCell();
    const col = cell ? this.visibleColDefs()[cell.colIndex] : null;
    if (!cell || !col) return '';
    return `${col.field}${cell.rowIndex + 1}`;
  });

  private resolveCurrentCell(position: CellPosition | null): AgridCurrentCell<T> | null {
    if (!position) return null;
    const row = this.dataSource().rows()[position.rowIndex] as T | undefined;
    const column = this.visibleColDefs()[position.colIndex] as unknown as ColDef<T> | undefined;
    if (!row || !column) return null;
    return {
      position: { ...position },
      row,
      originalIndex: position.rowIndex,
      field: column.field as AgridField<T>,
      value: row[column.field as keyof T],
      column,
    } as AgridCurrentCell<T>;
  }

  private sameCell(a: CellPosition | null, b: CellPosition | null): boolean {
    return a?.rowIndex === b?.rowIndex && a?.colIndex === b?.colIndex;
  }

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


  ngOnChanges(): void {
    const provider = this.provider();

    if (
      provider === this.restoredProvider ||
      !provider.gridId
    ) {
      return;
    }

    this.restoredProvider = provider;
    const key = `agrid_settings_${provider.gridId}`;
    const saved = localStorage.getItem(key);

    if (!saved) return;

    try {
      provider.loadSettings(JSON.parse(saved));
    } catch {
      localStorage.removeItem(key);
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

  /** @internal */ goToFirstPage(): void { this.control()?.setPage(1); }
  /** @internal */ goToLastPage(): void { this.control()?.setPage(this.totalPages()); }
  /** @internal */ goToNextPage(): void { const c = this.control(); if (c) c.setPage(Math.min(c.currentPage() + 1, this.totalPages())); }
  /** @internal */ goToPrevPage(): void { const c = this.control(); if (c) c.setPage(Math.max(c.currentPage() - 1, 1)); }

  /** Resize every visible column to fit its header and current row values. */
  autosizeAllColumns(): void {
    this.columnSizing.autosizeAllColumns();
  }

  /** return yes if we have saved config so a autosize from the client can be surpressed */
  hasSavedSizeConfig(): boolean {
    const provider = this.provider();
    const key = `agrid_settings_${provider.gridId}`;
    const saved = localStorage.getItem(key);
    try {
      if (saved !== null) {
        const config = JSON.parse(saved);
        return config && config.control && config.control.columnWidths;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
  /**
   * Clears changed-cell markers after persistence succeeds.
   * Omit `originalIndex` to clear every marker; omit `fields` to clear the whole row.
   */
  clearChangedCells(originalIndex?: number, fields?: readonly string[]): void {
    this.control()?.clearChangedCells(originalIndex, fields);
  }

  /** @internal Whether a cell has an unsaved-change marker. */
  isCellChanged(originalIndex: number, field: string): boolean {
    return this.control()?.isCellChanged(originalIndex, field) ?? false;
  }

  /** @internal Whether a row is currently in the colored phase of a control indication. */
  rowIndicationActive(originalIndex: number): boolean {
    return this.control()?.rowIndications().has(originalIndex) ?? false;
  }

  /** @internal CSS color for a transient row indication. */
  rowIndicationColor(originalIndex: number): string | null {
    return this.control()?.rowIndications().get(originalIndex)?.color ?? null;
  }

  /** @internal Fade duration for a transient row indication. */
  rowIndicationDuration(originalIndex: number): number | null {
    return this.control()?.rowIndications().get(originalIndex)?.durationMs ?? null;
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

  /** @internal Header view-model for the left-pinned, scrollable, and right-pinned panes. */
  readonly pinnedHeaderColumns = computed(() => this.buildHeaderColumns(this.pinnedColDefs()));
  readonly scrollableHeaderColumns = computed(() => this.buildHeaderColumns(this.scrollableColDefs()));
  readonly rightHeaderColumns = computed(() => this.buildHeaderColumns(this.rightPinnedColDefs()));

  /** @internal Grouped-header view-model per pane (run + reactive lock/drag state). */
  readonly pinnedHeaderGroups = computed(() => this.buildHeaderGroups(this.pinnedHeaderGroupRuns()));
  readonly scrollableHeaderGroups = computed(() =>
    this.buildHeaderGroups(this.scrollableHeaderGroupRuns())
  );
  readonly rightHeaderGroups = computed(() => this.buildHeaderGroups(this.rightHeaderGroupRuns()));

  /**
   * Resolves every per-column header/filter binding into a flat view-model. Called from the
   * pane header computeds; reads the same signal-backed helpers the template used directly, so
   * the result is memoized and recomputed only when sort/filter/drag/sizing state changes.
   */
  private buildHeaderColumns(cols: ColDef[]): AgridHeaderColumn[] {
    return cols.map(col => {
      const field = col.field;
      return {
        col,
        field,
        ariaColIndex: this.getAriaColIndex(this.getVisibleColIndex(field)),
        sort: this.getSort(field),
        sortPriority: this.getSortPriority(field),
        hasFilter: this.hasActiveFilter(field),
        dragging: this.isColDragging(field),
        dropSide: this.getColDropSide(field),
        reorderOffset: this.getColReorderOffset(field),
        grouped: this.isGroupedByField(field),
        lastPinned: this.isLastPinnedColumn(field),
        firstRightPinned: this.isFirstRightPinnedColumn(field),
        columnWidth: this.getColumnWidth(col),
        textFilter: this.getTextFilter(field),
        menuFilterType: this.getMenuFilterType(field),
        hasCondition: this.getMenuOperator(field) !== null,
        conditionLabel: this.getConditionButtonLabel(field),
      };
    });
  }

  private buildHeaderGroups(runs: AgridHeaderGroupRun[]): AgridHeaderGroup[] {
    return runs.map(run => ({
      ...run,
      locked: this.isHeaderGroupLocked(run.fields),
      dragging: this.isHeaderGroupDragging(run.fields),
    }));
  }

  /** @internal Body view-model for the left-pinned, scrollable, and right-pinned panes. */
  readonly pinnedBodyColumns = computed(() => this.buildBodyColumns(this.pinnedColDefs()));
  readonly scrollableBodyColumns = computed(() => this.buildBodyColumns(this.scrollableColDefs()));
  readonly rightBodyColumns = computed(() => this.buildBodyColumns(this.rightPinnedColDefs()));

  /** @internal Whether a pane needs per-cell span resolution. */
  readonly pinnedPaneHasSpans = computed(() => this.pinnedColDefs().some(col => col.colSpan));
  readonly scrollablePaneHasSpans = computed(() => this.scrollableColDefs().some(col => col.colSpan));
  readonly rightPaneHasSpans = computed(() => this.rightPinnedColDefs().some(col => col.colSpan));

  /**
   * Resolves the per-column bindings shared by every data, footer, and ghost cell. Reads only
   * layout/drag/pinning signals, so the result is reused across all rows and recomputes only
   * when columns move, resize, drag, or change pinning.
   */
  private buildBodyColumns(cols: ColDef[]): AgridBodyColumn[] {
    return cols.map(col => {
      const field = col.field;
      const visibleColIndex = this.getVisibleColIndex(field);
      return {
        col,
        field,
        visibleColIndex,
        ariaColIndex: this.getAriaColIndex(visibleColIndex),
        dragging: this.isColDragging(field),
        reorderOffset: this.getColReorderOffset(field),
        lastPinned: this.isLastPinnedColumn(field),
        firstRightPinned: this.isFirstRightPinnedColumn(field),
      };
    });
  }


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
    externalFilter: this.externalFilterFn,
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

  /** Live horizontal scroll metrics of the scrollable pane, fed to column virtualization. */
  private readonly colScrollLeft = signal(0);
  private readonly colViewportWidth = signal(0);

  /** Scrollable-column count above which column virtualization activates. */
  readonly columnVirtualizationThreshold = computed(
    () => this.provider().columnVirtualizationThreshold,
  );

  /** Windows the scrollable-pane columns to those near the horizontal viewport. */
  private readonly columnVirtualization = new AgridColumnVirtualizationController({
    columnWidths: computed(() => this.scrollableColDefs().map(col => this.getColumnWidth(col))),
    scrollLeft: this.colScrollLeft,
    viewportWidth: this.colViewportWidth,
    minColumns: this.columnVirtualizationThreshold,
  });

  /** @internal Current rendered column window (full set + zero spacers when inactive). */
  readonly columnWindow = this.columnVirtualization.window;

  /** @internal Scrollable body columns sliced to the active window. */
  readonly virtualScrollableBodyColumns = computed(() => {
    const window = this.columnWindow();
    return this.scrollableBodyColumns().slice(window.start, window.end);
  });

  /** @internal Number of hidden scrollable columns after the window (trailing spacer span). */
  readonly columnWindowRightSpan = computed(() =>
    this.scrollableBodyColumns().length - this.columnWindow().end,
  );

  /**
   * Filtered, sorted, and optionally grouped row list for `*cdkVirtualFor`.
   * Appends `null` when the explicit add-row placeholder is active.
   */
  readonly filteredItems: Signal<GridItem[]> = this.projection.filteredItems;

  /**
   * @internal The full filtered + sorted row set (grouping/pagination ignored). Reused for export
   * and published to the provider as `visibleRows` so charts and consumers can react to filters.
   */
  readonly ɵvisibleRows = computed(() => {
    const rows = this.dataSource().rows();
    return this.projection.filteredSortedIndices()
      .map(index => rows[index])
      .filter((row): row is Record<string, unknown> => !!row);
  });

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

  /** Maps originalIndex → 1-based filtered/sorted row number for the control column. */
  readonly rowNumbers = computed<Map<number, number>>(() => {
    const map = new Map<number, number>();
    this.projection.filteredSortedIndices().forEach((originalIndex, index) => {
      map.set(originalIndex, index + 1);
    });
    return map;
  });

  /** Width needed for the largest currently rendered row number. */
  readonly rowNumberColumnWidth = computed(() => {
    const maxNumber = Math.max(
      1,
      ...[
        ...this.pinnedTopItems(),
        ...this.filteredItems(),
        ...this.pinnedBottomItems(),
      ].map(item => this.visibleRowNumber(item)).filter(number => number !== null),
    );
    const digits = String(maxNumber).length;
    return Math.max(36, 20 + digits * 8);
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

  /** Live numeric statistics for the active cell or rectangular range. */
  readonly selectionSummary = computed<AgridSelectionSummary | null>(() =>
    computeSelectionSummary(
      this.filteredItems(),
      this.visibleColDefs(),
      this.rangeController.getActiveSelectionBounds(),
    )
  );

  /** Locale-formatted status-bar values derived from {@link selectionSummary}. */
  readonly selectionSummaryDisplay = computed(() => {
    const summary = this.selectionSummary();
    if (!summary) return null;
    const locale = this.locale();
    const format = (value: number): string => value.toLocaleString(locale, {
      maximumFractionDigits: 2,
    });
    return {
      count: summary.count.toLocaleString(locale),
      sum: format(summary.sum),
      average: format(summary.average),
      min: format(summary.min),
      max: format(summary.max),
    };
  });

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
    // Export the full filtered + sorted set, not the rendered projection: grouping,
    // pagination, and collapsed groups must not drop rows from the file.
    exportRows: this.ɵvisibleRows,
    // When grouped, export a fully-expanded grouped structure with subtotals (xlsx outline).
    exportGroups: computed(() => {
      const control = this.control();
      const groupField = control?.groupByField();
      if (!control || !groupField || this.pivotMode()) return null;
      const cols = this.visibleColDefs();
      const groupCol = cols.find(col => col.field === groupField)
        ?? this.colDefs().find(col => col.field === groupField);
      return buildExportGroups(
        this.dataSource().rows(),
        this.projection.filteredSortedIndices(),
        groupField,
        groupCol,
        cols,
        control.aggregates(),
        this.locale(),
      );
    }),
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

  private readonly detailController = new AgridDetailController<T>({
    dataSource: this.dataSource,
    control: this.control,
    detailColumn: this.detailColumn,
    locale: this.locale,
    displayItems: this.displayItems,
    visibleColDefs: this.visibleColDefs,
    selectedCell: this.selectedCell,
    selectedRange: this.selectedRange,
    editingCell: this.editController.editingCell,
    isCellEditable: (col, originalIndex) => this.isCellEditable(col, originalIndex),
    renderDetailHtml: row => this.provider().detailRenderer?.({ row: row as T }) ?? '',
    emitEditEvents: event => this.emitEditEvents(event),
    emitValidationFailed: event => this.validationFailed.emit(event),
    emitDetailAction: event => this.detailAction.emit(event),
    schedule: fn => this.browser.schedule(fn),
    queryTextarea: rowIndex =>
      (this._hostEl.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
        `textarea[data-detail-row="${rowIndex}"]`,
      ),
  });

  /** @internal Detail-field editor state, re-exported for the template. */
  readonly detailEditingRow = this.detailController.editingRow;
  readonly detailDraft = this.detailController.draft;
  readonly detailValidationError = this.detailController.validationError;

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
    resolveCellColumn: (originalIndex, colIndex, direction) =>
      this.resolveSpannedColumn(originalIndex, colIndex, direction),
    onPrepareAddRecord: event => this.prepareAddRecord.emit({
      ...event,
      provider: this.provider(),
      datasource: this.dataSource(),
    }),
  });

  /** Maps logical covered columns to a rendered span anchor (or past it when moving right). */
  private resolveSpannedColumn(originalIndex: number, colIndex: number, direction: -1 | 0 | 1): number {
    const row = this.dataSource().getRow(originalIndex);
    const visible = this.visibleColDefs();
    const col = visible[colIndex];
    if (!row || !col) return colIndex;

    const panes = [this.pinnedColDefs(), this.scrollableColDefs(), this.rightPinnedColDefs()];
    const pane = panes.find(columns => columns.includes(col));
    if (!pane) return colIndex;
    const paneIndex = pane.indexOf(col);
    const anchor = resolveCellSpanAnchor(pane, paneIndex, row, originalIndex);
    if (anchor.anchorIndex === paneIndex) return colIndex;

    const targetPaneIndex = direction > 0 ? anchor.anchorIndex + anchor.span : anchor.anchorIndex;
    const target = pane[targetPaneIndex];
    if (target) return visible.indexOf(target);
    return direction > 0 ? colIndex + 1 : visible.indexOf(pane[anchor.anchorIndex]);
  }

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
    confirmRowDelete: this.confirmRowDelete,
    focusDeleteConfirmButton: () => {
      (this._hostEl.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('[data-delete-confirm-no]')
        ?.focus();
    },
    focusGrid: () => this.wrapperEl().nativeElement.focus(),
    measureScroller: () => {
      const scroller = this.horizontalScrollerEl().nativeElement;
      return { left: scroller.scrollLeft, width: scroller.clientWidth };
    },
  });

  readonly selectedRowIndices = this.rowController.selectedRowIndices;
  readonly selectedRowIndex = this.rowController.selectedRowIndex;
  readonly contextMenu = this.rowController.contextMenu;
  readonly cellContextMenuState = this.rowController.cellContextMenu;
  readonly pendingDeleteRow = this.rowController.pendingDeleteRow;
  readonly deleteConfirmationLeft = this.rowController.deleteConfirmationLeft;
  readonly deleteConfirmationWidth = this.rowController.deleteConfirmationWidth;

  private readonly menuBarController = new AgridMenuBarController<T>({
    dataSource: this.dataSource,
    provider: this.provider,
    selectedRowIndices: this.selectedRowIndices,
    selectedCell: this.selectedCell,
    menuBarItems: this.menuBarItems,
    gridId: this.gridId,
    enableExportButtons: this.enableExportButtons,
    saveConfigLabel: computed(() => this.localeText().saveConfig),
    exportLabel: computed(() => this.localeText().export),
    exportCsvLabel: computed(() => this.localeText().exportCsv),
    exportXlsxLabel: computed(() => this.localeText().exportXlsx),
    emitAction: id => this.menuBarAction.emit(id),
    closeOtherMenus: () => {
      this.rowController.closeContextMenu();
      this.rowController.closeCellContextMenu();
      this.groupController.closeActionsMenu();
      this.columnMenuController.close();
    },
    persistSettings: () => {
      const gridConfig = this.provider().saveSettings();
      localStorage.setItem(`agrid_settings_${this.gridId()}`, JSON.stringify(gridConfig));
    },
    exportData: (format) => {
      switch (format) {
        case 'csv':   
          this.provider().exportCsv();
          break;
        case 'xlsx':
          this.provider().exportXlsx();
          break;
      }
    },
  });

  /** Id of the menu-bar button whose dropdown is open, or `null`. */
  readonly openMenuBarItemId = this.menuBarController.openItemId;
  /** Runtime state passed to menu-bar visibility, active, and disabled resolvers. */
  readonly menuBarContext = this.menuBarController.context;
  /** Menu-bar buttons currently allowed by their visibility resolvers. */
  readonly visibleMenuBarItems = this.menuBarController.visibleItems;

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

  /** @internal Toggles a complete column when its non-interactive header surface is clicked. */
  onColHeaderClick(event: MouseEvent, field: string): void {
    const target = event.target as Element | null;
    if (!this.enableColumnMarking() || target?.closest('button, input, .ag-resize-handle')) return;
    this.toggleColumnMarked(field);
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
  private changedCellsDataSource: AgridDataSource | null = null;
  private dirtyInlineRowsIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly dirtyInlineRowsIdleFlushMs = 2000;

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
    this.scheduleDirtyInlineRowsIdleFlush();
  }

  private markCellChanged(event: GridEditEvent): void {
    if (!this.showChangedCellIndicator()) return;
    const datasource = this.dataSource();
    if (this.changedCellsDataSource !== datasource) {
      this.control()?.clearChangedCells();
      this.changedCellsDataSource = datasource;
    }
    this.control()?.markChangedCell(event.position.rowIndex, event.field);
  }

  private flushDirtyInlineRows(activeRowIndex: number | null = null): void {
    const datasource = this.dataSource();
    if (this.dirtyRowsDataSource !== datasource) {
      this.dirtyInlineRows.clear();
      this.dirtyRowsDataSource = datasource;
      this.clearDirtyInlineRowsIdleFlush();
      return;
    }

    for (const index of [...this.dirtyInlineRows].sort((a, b) => a - b)) {
      if (index === activeRowIndex) continue;
      this.dirtyInlineRows.delete(index);
      if (index >= 0 && index < datasource.length) this.emitRowChanged(index);
    }
    if (this.dirtyInlineRows.size === 0) this.clearDirtyInlineRowsIdleFlush();
    else this.scheduleDirtyInlineRowsIdleFlush();
  }

  private scheduleDirtyInlineRowsIdleFlush(): void {
    this.clearDirtyInlineRowsIdleFlush();
    if (this.dirtyInlineRows.size === 0) return;
    this.dirtyInlineRowsIdleTimer = setTimeout(() => {
      this.dirtyInlineRowsIdleTimer = null;
      if (this.editingCell()) {
        this.scheduleDirtyInlineRowsIdleFlush();
        return;
      }
      this.flushDirtyInlineRows();
    }, this.dirtyInlineRowsIdleFlushMs);
  }

  private clearDirtyInlineRowsIdleFlush(): void {
    if (this.dirtyInlineRowsIdleTimer === null) return;
    clearTimeout(this.dirtyInlineRowsIdleTimer);
    this.dirtyInlineRowsIdleTimer = null;
  }

  private reconcileDirtyInlineRowsAfterRemoval(removedIndex: number): void {
    const shifted = new Set<number>();
    for (const index of this.dirtyInlineRows) {
      if (index < removedIndex) shifted.add(index);
      else if (index > removedIndex) shifted.add(index - 1);
    }
    this.dirtyInlineRows.clear();
    for (const index of shifted) this.dirtyInlineRows.add(index);
    this.control()?.reconcileChangedCellsAfterRemoval(removedIndex);
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

  private buildServerQuery(): AgridServerQuery | null {
    const control = this.control();
    if (!control) return null;
    const pageSize = control.pageSize();
    const serverFiltering = this.serverSideFiltering();
    const serverPagination = !serverFiltering && control.totalRows() > 0 && pageSize > 0;
    if (!serverFiltering && !serverPagination) return null;

    const page = Math.max(1, control.currentPage());
    const startRow = pageSize > 0 ? (page - 1) * pageSize : 0;
    const endRow = pageSize > 0 ? startRow + pageSize - 1 : -1;
    const filters = Object.fromEntries(
      Object.entries(control.filters()).map(([field, filter]) => [field, {
        ...filter,
        selectedValues: filter.selectedValues ? [...filter.selectedValues] : null,
      }]),
    );
    const sort = this.projection.effectiveSortOrder()
      .flatMap(field => {
        const direction = filters[field]?.sort;
        return direction ? [{ field, direction }] : [];
      });

    return {
      filters,
      sort,
      quickFilter: control.quickFilter(),
      page,
      pageSize,
      startRow,
      endRow,
    };
  }

  constructor() {
    // Keep one datasource identity so selection/controllers are not reset whenever source data
    // causes the computed pivot rows to be regenerated.
    this.pivotDataSource.linkSignal(this.pivotRows);
    effect(() => this.sidebarController.syncAutoOpen());

    // Expose CSV/XLSX export through the provider so callers don't need a ViewChild on the grid.
    effect(onCleanup => {
      const provider = this.provider();
      provider.ɵattachExport({
        csv: filename => this.presentation.exportCsv(filename),
        xlsx: filename => this.presentation.exportXlsx(filename),
      });
      onCleanup(() => provider.ɵattachExport(null));
    });

    // Publish the live filtered/sorted rows so charts (and other consumers) can react to filters.
    effect(() => this.provider().ɵsetVisibleRows(this.ɵvisibleRows()));
    this.destroyRef.onDestroy(() => this.provider().ɵsetVisibleRows(null));

    // Seed tree expansion once per provider/datasource/config identity. After that, user toggles
    // own the expansion set until one of those identities changes.
    effect(() => {
      const provider = this.provider();
      const datasource = this.dataSource();
      const treeConfig = this.treeConfig();
      if (!treeConfig) {
        if (this.initializedTreeExpansionFor) {
          this.treeController.collapseAll();
          this.initializedTreeExpansionFor = null;
        }
        return;
      }
      const initialized = this.initializedTreeExpansionFor;
      if (
        initialized?.provider === provider
        && initialized.datasource === datasource
        && initialized.treeConfig === treeConfig
      ) {
        return;
      }
      this.treeController.collapseAll();
      const rows = datasource.rows() as T[];
      if (rows.length === 0) return;
      this.treeController.expandAll(defaultExpandedTreeIds(rows, treeConfig));
      this.initializedTreeExpansionFor = { provider, datasource, treeConfig };
    });

    // Publish one complete query object for signal-backed server data stores.
    effect(() => {
      const provider = this.provider();
      if (this.serverQueryProvider && this.serverQueryProvider !== provider) {
        this.serverQueryProvider.ɵsetServerQuery(null);
      }
      this.serverQueryProvider = provider;
      const query = this.buildServerQuery();
      provider.ɵsetServerQuery(query);
      if (query) this.serverQueryChange.emit(query);
    });
    this.destroyRef.onDestroy(() => this.serverQueryProvider?.ɵsetServerQuery(null));

    afterRenderEffect(() => {
      if (this.firstDataRenderedEmitted) return;
      const datasource = this.dataSource();
      const rows = datasource.rows() as T[];
      const hasRenderedData = [
        ...this.pinnedTopItems(),
        ...this.displayItems(),
        ...this.pinnedBottomItems(),
      ].some(isDataRowItemFn);
      if (rows.length === 0 || !hasRenderedData) return;

      this.firstDataRenderedEmitted = true;
      const event: FirstDataRenderedEvent<T> = {
        rows,
        rowCount: rows.length,
        provider: this.provider(),
        datasource,
      };
      queueMicrotask(() => this.firstDataRendered.emit(event));
    });

    effect(() => {
      const datasource = this.dataSource();
      if (this.changedCellsDataSource === datasource) return;
      this.changedCellsDataSource = datasource;
      this.control()?.clearChangedCells();
    });

    effect(() => {
      const activeRowIndex = this.selectedCell()?.rowIndex ?? null;
      this.flushDirtyInlineRows(activeRowIndex);
    });

    effect(() => {
      const cell = this.selectedCell();
      if (this.lastEmittedCell === undefined && cell === null) {
        this.lastEmittedCell = null;
        return;
      }
      if (this.sameCell(this.lastEmittedCell ?? null, cell)) return;
      this.lastEmittedCell = cell ? { ...cell } : null;
      this.cellSelect.emit(this.resolveCurrentCell(cell));
    });

    effect(() => {
      if (this.formulaBarFocused()) return;
      const cell = this.selectedCell();
      const editing = this.editingCell();
      if (!cell) {
        this.formulaBarDraft.set('');
        return;
      }
      if (editing?.rowIndex === cell.rowIndex && editing.colIndex === cell.colIndex) {
        this.formulaBarDraft.set(String(this.currentDraft() ?? ''));
        return;
      }
      const row = this.dataSource().rows()[cell.rowIndex];
      const col = this.visibleColDefs()[cell.colIndex];
      this.formulaBarDraft.set(row && col ? String(row[col.field] ?? '') : '');
    });

    afterNextRender(() => {
      this.viewReady = true;
      this.syncColumnViewportMetrics();
      const wrapper = this.wrapperEl().nativeElement;
      const renderedRangeSubscription = this.viewport().renderedRangeStream.subscribe(() =>
        this.ensureServerRowsVisible()
      );
      const onKeyDown = (event: KeyboardEvent) => this.onKeyDown(event);
      wrapper.addEventListener('keydown', onKeyDown, { capture: true });
      // Keep the column-virtualization viewport width current when the grid is resized without
      // a horizontal scroll (e.g. a layout/container change or sidebar toggle).
      const ResizeObserverCtor = globalThis.ResizeObserver;
      const resizeObserver = ResizeObserverCtor
        ? new ResizeObserverCtor(() => this.syncColumnViewportMetrics())
        : null;
      resizeObserver?.observe(this.horizontalScrollerEl().nativeElement);
      this.destroyRef.onDestroy(() => {
        renderedRangeSubscription.unsubscribe();
        wrapper.removeEventListener('keydown', onKeyDown, { capture: true });
        resizeObserver?.disconnect();
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

    effect(() => {
      const control = this.control();
      if (!control) return;
      control.ɵfilterReapplyRevision();
      this.dataSource().ɵreapplyFiltersToAddedRows();
    });

    effect(() => {
      const control = this.control();
      if (!control) return;
      const hasDeferredRows = this.dataSource().ɵunfilteredAddedRows().size > 0;
      control.ɵsetFilterReapplyNeeded(hasDeferredRows && control.hasAnyActiveFilter());
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
      this.clearDirtyInlineRowsIdleFlush();
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

  /** @internal 1-based row number for visible data rows. */
  visibleRowNumber(item: GridItem): number | null {
    return isDataRowItemFn(item) ? this.rowNumbers().get(item.originalIndex) ?? null : null;
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
    return this.detailController.detailHtml(item);
  }

  /** @internal Formatted value shown while a configured detail field is not being edited. */
  detailFieldDisplay(item: DetailRowItem): string {
    return this.detailController.detailFieldDisplay(item);
  }

  /** @internal Whether the configured detail field can be edited for this row. */
  isDetailFieldEditable(item: DetailRowItem): boolean {
    return this.detailController.isDetailFieldEditable(item);
  }

  /** @internal Enter multiline editing for one expanded detail row. */
  startDetailFieldEdit(item: DetailRowItem, event?: Event): void {
    this.detailController.startDetailFieldEdit(item, event);
  }

  /** @internal Keep the multiline draft synchronized with textarea input. */
  onDetailDraftInput(event: Event): void {
    this.detailController.onDetailDraftInput(event);
  }

  /** @internal Commit on blur or Ctrl/Cmd+Enter, and cancel on Escape. */
  onDetailEditorKeydown(item: DetailRowItem, event: KeyboardEvent): void {
    this.detailController.onDetailEditorKeydown(item, event);
  }

  /** @internal Insert a configured text template into the active detail textarea. */
  applyDetailAction(item: DetailRowItem, action: DetailAction, event: Event): void {
    this.detailController.applyDetailAction(item, action, event);
  }

  private focusDetailEditorFromKeyboard(event: KeyboardEvent): boolean {
    return this.detailController.focusDetailEditorFromKeyboard(event);
  }

  /** @internal Commit a multiline detail edit through normal grid edit semantics. */
  commitDetailFieldEdit(item: DetailRowItem): void {
    this.detailController.commitDetailFieldEdit(item);
  }

  /** @internal Discard the active multiline detail draft. */
  cancelDetailFieldEdit(): void {
    this.detailController.cancelDetailFieldEdit();
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
    this.treeController.expandAll(defaultExpandedTreeIds(
      this.dataSource().rows() as T[],
      { ...config, defaultExpanded: true },
    ));
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

  /** @internal Complete filter snapshot for custom filter components. */
  getColumnFilter(field: string): ColumnFilter {
    return this.control()?.getFilter(field) ?? { text: '', selectedValues: null, sort: null };
  }

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

  /** @internal */
  onFormulaBarFocus(): void {
    this.formulaBarFocused.set(true);
    this.formulaBarEditCell = this.selectedCell();
  }

  /** @internal */
  onFormulaBarInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.formulaBarEditCell ??= this.selectedCell();
    this.formulaBarDraft.set(value);
    const cell = this.selectedCell();
    const editing = this.editingCell();
    if (cell && editing?.rowIndex === cell.rowIndex && editing.colIndex === cell.colIndex) {
      this.editController.setDraft(value);
    }
  }

  /** @internal */
  onFormulaBarBlur(): void {
    if (!this.formulaBarFocused()) return;
    this.commitFormulaBar(this.formulaBarEditCell);
    this.finishFormulaBarInteraction();
  }

  /** @internal */
  onFormulaBarKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.commitFormulaBar()) {
        this.finishFormulaBarInteraction();
        this.wrapperEl().nativeElement.focus();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.resetFormulaBarDraft();
    }
  }

  /** @internal */
  commitFormulaBar(targetCell: CellPosition | null = this.formulaBarEditCell ?? this.selectedCell()): boolean {
    const cell = targetCell;
    if (!cell) return true;
    const editing = this.editingCell();
    if (editing?.rowIndex === cell.rowIndex && editing.colIndex === cell.colIndex) {
      return this.editController.commit();
    }
    return this.editController.setCellValue(cell.rowIndex, cell.colIndex, this.formulaBarDraft());
  }

  private finishFormulaBarInteraction(): void {
    this.formulaBarFocused.set(false);
    this.formulaBarEditCell = null;
    this.resetFormulaBarDraft();
  }

  private resetFormulaBarDraft(): void {
    const cell = this.selectedCell();
    if (!cell) {
      this.formulaBarDraft.set('');
      return;
    }
    const row = this.dataSource().rows()[cell.rowIndex];
    const col = this.visibleColDefs()[cell.colIndex];
    this.formulaBarDraft.set(row && col ? String(row[col.field] ?? '') : '');
  }

  /** @internal A custom cell editor requested a commit (e.g. picking a value). */
  onEditorCommit(): void { this.editController.commit(); }

  /** @internal A custom cell editor requested cancellation. */
  onEditorCancel(): void { this.editController.cancel(); }

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
    if (this.isToolbarInputEvent(event)) return;
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
    if (this.focusDetailEditorFromKeyboard(event)) return;
    this.navigationController.handleKeyDown(event);
  }

  private isToolbarInputEvent(event: Event): boolean {
    const target = event.target as Element | null;
    if (!target?.closest('.ag-toolbar')) return false;
    return target.matches('input, textarea, select, [contenteditable="true"]');
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

  /** @internal Marks a row when its control-column header surface is clicked. */
  onControlCellClick(event: MouseEvent, originalIndex: number): void {
    event.stopPropagation();
    if (this.enableRowMarking()) this.toggleRowMarked(originalIndex);
  }

  /** Toggle whether a row is included in subsequent copy operations and emit its new state. */
  toggleRowMarked(originalIndex: number): void {
    this.setRowMarked(originalIndex, !this.markedIndices().has(originalIndex));
  }

  /** Set one row's mark state and emit `rowMark` when that state changes. */
  setRowMarked(originalIndex: number, marked: boolean): void {
    const row = this.dataSource().getRow(originalIndex) as T | undefined;
    if (!row || this.markedIndices().has(originalIndex) === marked) return;
    this.markedIndices.update(indices => {
      const next = new Set(indices);
      if (marked) next.add(originalIndex);
      else next.delete(originalIndex);
      return next;
    });
    this.rowMark.emit({ row, originalIndex, marked });
  }

  /** @internal Returns whether a row is marked for copying. */
  isRowMarked(originalIndex: number): boolean {
    return this.markedIndices().has(originalIndex);
  }

  /** Clear every row marked for clipboard inclusion. */
  clearMarkedRows(): void {
    this.markedIndices.set(new Set());
  }

  /** Set one complete column's mark state and emit `columnMark` when it changes. */
  setColumnMarked(field: string, marked: boolean): void {
    const column = this.getColDef(field) as ColDef<T> | undefined;
    if (!column || this.markedFields().has(field) === marked) return;
    this.markedFields.update(fields => {
      const next = new Set(fields);
      if (marked) next.add(field);
      else next.delete(field);
      return next;
    });
    this.columnMark.emit({ column, field: column.field, marked });
  }

  /** Toggle one complete column's mark state. */
  toggleColumnMarked(field: string): void {
    this.setColumnMarked(field, !this.markedFields().has(field));
  }

  /** Clear all marked columns. */
  clearMarkedColumns(): void {
    this.markedFields.set(new Set());
  }

  /** @internal Emits a custom header command for its typed column and closes the menu. */
  onColumnHeaderAction(field: string, key: string): void {
    const column = this.getColDef(field) as ColDef<T> | undefined;
    if (!column) return;
    this.columnHeaderAction.emit({ column, key });
    this.columnMenuController.close();
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

  /** @internal Closes the currently open menu-bar dropdown. */
  closeMenuBarMenu(): void {
    this.menuBarController.close();
  }

  /** @internal Synchronizes dropdown state and closes competing grid menus when one opens. */
  onMenuBarOpenItemChange(id: string | null): void {
    this.menuBarController.onOpenItemChange(id);
  }

  /** @internal Dispatches a menu-bar action (or persists config for the built-in save entry). */
  onMenuBarAction(id: string): void {
    this.menuBarController.runAction(id);
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
    this.rowController.requestDeleteRow(originalIndex);
  }

  /** @internal Returns whether this row is awaiting delete confirmation. */
  isRowPendingDelete(originalIndex: number): boolean {
    return this.rowController.isRowPendingDelete(originalIndex);
  }

  /** @internal Delete the row currently awaiting confirmation. */
  confirmPendingRowDelete(): void {
    this.rowController.confirmPendingRowDelete();
  }

  /** @internal Cancel the active row-delete confirmation. */
  cancelRowDelete(): void {
    this.rowController.cancelRowDelete();
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
  openFilterMenu(event: MouseEvent, field: string, mode: 'column' | 'condition' = 'column'): void {
    this.columnMenuController.open(event, field, mode);
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
  onMenuReplaceFilter(field: string, filter: ColumnFilter): void {
    this.columnMenuController.replaceFilter(field, filter);
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

  /** Refresh the attached server-side row model and optionally reset vertical scroll to row zero. */
  refreshServerSideRows(options: { purge?: boolean; resetScroll?: boolean } = {}): void {
    const model = this.serverSideRowModel();
    if (!model) return;
    model.refresh({ purge: options.purge });
    if (options.resetScroll && this.viewReady) this.viewport().scrollToIndex(0);
    queueMicrotask(() => this.ensureServerRowsVisible());
  }

  /** @internal Keeps the row-delete prompt visible while columns scroll horizontally. */
  onHorizontalScroll(): void {
    this.syncColumnViewportMetrics();
    this.rowController.repositionDeleteConfirmation();
  }

  /** @internal Refreshes the scroll offset / viewport width driving column virtualization. */
  private syncColumnViewportMetrics(): void {
    const scroller = this.horizontalScrollerEl().nativeElement;
    this.colScrollLeft.set(scroller.scrollLeft);
    this.colViewportWidth.set(scroller.clientWidth);
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
