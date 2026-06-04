import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Signal,
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
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridDragHandler } from './agrid-drag.handler';
import { AgridResizeHandler } from './agrid-resize.handler';
import {
  applyTextAndValueFilters,
  applySortToIndices,
  buildGroupedItems,
  buildSelectionRange,
  getDisplayForField,
  isDataRowItem as isDataRowItemFn,
  isGroupHeaderItem as isGroupHeaderItemFn,
} from './agrid.utils';
import { HistoryEntry } from './agrid-control';
import {
  CellPosition, ColDef, GridEditEvent, GridItem, GroupAction,
  NewRecord, RowRemovedEvent, RowReorderEvent, RowSelectEvent, ValueOption,
} from './agrid.types';

// Re-export for backward compatibility with existing imports of GridItem from this file.
export type { GridItem };

/**
 * Excel-like data grid for Angular 21.
 *
 * ## Minimal setup
 * ```html
 * <agrid [colDefs]="columns" [dataSource]="ds" />
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
  imports: [ScrollingModule, AgridCellComponent],
  templateUrl: './agrid.component.html',
  styleUrl: './agrid.component.css',
})
export class AgridComponent {

  // ── Inputs ───────────────────────────────────────────────────────────────────

  /** Column definitions — order determines left-to-right display order. */
  colDefs = input<ColDef[]>([]);

  /** Row height in pixels. Must be fixed for CDK virtual scroll. @default 32 */
  rowHeight = input<number>(32);

  /** Minimum height of the grid host element (e.g. `'200px'`). */
  minHeight = input<string | undefined>(undefined);

  /** Maximum height of the grid host element (e.g. `'500px'`). */
  maxHeight = input<string | undefined>(undefined);

  /** Signal-based data container shared with the host. */
  dataSource = input<AgridDataSource>(new AgridDataSource());

  /**
   * Optional grid UI state container (column widths, filters, sort, grouping, visibility).
   * Required for filtering, sorting, grouping, column hide/show, and state persistence.
   */
  control = input<AgridControl | null>(null);

  /** Show a `+ Add row` placeholder at the bottom. */
  allowAddRows = input<boolean>(false);

  /** Automatically insert a blank row when navigating past the last real row. */
  autoAddRows = input<boolean>(false);

  /** Show a 24 px control column with a drag handle and right-click context menu. */
  showControlColumn = input<boolean>(false);

  /** Show a collapsible sidebar with a column visibility selector. Requires `[control]`. */
  showSidebar = input<boolean>(false);

  /**
   * Row selection mode.
   * - `'none'` — no selection (default)
   * - `'single'` — click to select/deselect
   * - `'multi'` — Ctrl+click toggles, Shift+click extends range, click+drag sweeps
   */
  rowSelection = input<'single' | 'multi' | 'none'>('none');

  /** Returns a short description string shown next to the group label. */
  groupDescription = input<((label: string) => string) | null>(null);

  /** Actions shown in the group header's `⋮` menu. */
  groupActions = input<GroupAction[]>([]);

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

  // ── Public state ─────────────────────────────────────────────────────────────

  /** Currently focused cell, or `null`. */
  readonly selectedCell = signal<CellPosition | null>(null);

  /** Position of the cell in edit mode, or `null`. */
  readonly editingCell = signal<CellPosition | null>(null);

  /** Draft value while editing — committed on Tab/Enter, discarded on Escape. */
  readonly currentDraft = signal<unknown>(null);

  /** Seed character typed to enter edit mode (e.g. pressing 'A'). */
  readonly editSeedChar = signal<string>('');

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

  /** Toggle the sidebar open/closed. */
  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }

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
    const body   = dataRows.map(row => cols.map(c => esc(getDisplayForField(c, row[c.field]))).join(',')).join('\n');

    const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** @internal Full display value for a cell — used as the `title` tooltip attribute. */
  getCellTitle(col: ColDef, value: unknown): string {
    return getDisplayForField(col, value);
  }

  // ── Internal signals ─────────────────────────────────────────────────────────

  private readonly _localWidths = signal<Record<string, number>>({});

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

  /** Map from field → sticky left offset (px) for each pinned column. */
  private readonly _pinnedLeftMap = computed(() => {
    const ctrl = this.control();
    const ctrlWidths = ctrl ? ctrl.columnWidths() : {};
    const localWidths = this._localWidths();
    const map = new Map<string, number>();
    let left = this.showControlColumn() ? 24 : 0;
    for (const col of this.pinnedColDefs()) {
      map.set(col.field, left);
      left += ctrlWidths[col.field] ?? localWidths[col.field] ?? col.width;
    }
    return map;
  });

  readonly hasFilterableColumns = computed(() => this.visibleColDefs().some(c => c.filterable));

  readonly filteredRowCount = computed(() => {
    let groupTotal = 0, dataTotal = 0;
    for (const item of this.filteredItems()) {
      if (isGroupHeaderItemFn(item)) groupTotal += item.count;
      else if (isDataRowItemFn(item)) dataTotal++;
    }
    return groupTotal > 0 ? groupTotal : dataTotal;
  });

  readonly gridTemplateColumns = computed(() => {
    const ctrl = this.control();
    const ctrlWidths = ctrl ? ctrl.columnWidths() : {};
    const localWidths = this._localWidths();
    const cols = this.visibleColDefs()
      .map(c => `${ctrlWidths[c.field] ?? localWidths[c.field] ?? c.width}px`).join(' ');
    return this.showControlColumn() ? `24px ${cols}` : cols;
  });

  readonly totalWidth = computed(() => {
    const ctrl = this.control();
    const ctrlWidths = ctrl ? ctrl.columnWidths() : {};
    const localWidths = this._localWidths();
    const w = this.visibleColDefs().reduce(
      (sum, c) => sum + (ctrlWidths[c.field] ?? localWidths[c.field] ?? c.width), 0
    );
    return this.showControlColumn() ? w + 24 : w;
  });

  /**
   * Filtered, sorted, and optionally grouped row list for `*cdkVirtualFor`.
   * Appends `null` when the explicit add-row placeholder is active.
   */
  readonly filteredItems = computed<GridItem[]>(() => {
    const rows = this.dataSource().rows();
    const ctrl = this.control();
    const colDefs = this.colDefs();
    const colMap = new Map(colDefs.map(c => [c.field, c]));
    let indices = rows.map((_, i) => i);

    if (ctrl) {
      const filters = ctrl.filters();
      indices = applyTextAndValueFilters(rows, indices, filters, colMap);

      const groupField = ctrl.groupByField();
      if (groupField) {
        const expandState = this._expandedGroups();
        const expandedLabels = expandState.field === groupField
          ? expandState.labels : new Set<string>();
        const sortEntry = (Object.entries(filters).find(([, f]) => f.sort) ?? null) as [string, import('./agrid-control').ColumnFilter] | null;
        const items = buildGroupedItems(rows, indices, groupField, colMap, sortEntry, expandedLabels);
        if (this.allowAddRows() && !this.autoAddRows()) items.push(null);
        return items;
      }

      const sortEntry = Object.entries(filters).find(([, f]) => f.sort);
      if (sortEntry) {
        indices = applySortToIndices(rows, indices, sortEntry[0], sortEntry[1], colMap);
      }
    }

    const items: GridItem[] = indices.map(i => ({ row: rows[i], originalIndex: i }));
    if (this.allowAddRows() && !this.autoAddRows()) items.push(null);
    return items;
  });

  /** Virtual scroll source — injects ghost row during a reorder drag. */
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

  // ── Infrastructure ────────────────────────────────────────────────────────────

  private readonly viewport    = viewChild.required(CdkVirtualScrollViewport);
  private readonly wrapperEl   = viewChild.required<ElementRef<HTMLDivElement>>('wrapper');
  private readonly destroyRef  = inject(DestroyRef);
  private readonly _hostEl     = inject(ElementRef<HTMLElement>);

  private readonly resizeHandler = new AgridResizeHandler(this.control, this._localWidths, this.destroyRef);

  readonly dragHandler = new AgridDragHandler({
    dataSource: this.dataSource,
    filteredItems: () => this.filteredItems(),
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

  /** @internal Start a column header drag. */
  onColHeaderPointerDown(event: PointerEvent, field: string): void {
    if (!this.control() || event.button !== 0) return;
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

  // ── Template helpers — filter menu ────────────────────────────────────────────

  /** @internal */
  getTextFilter(field: string): string { return this.control()?.getFilter(field).text ?? ''; }

  /** @internal */
  getSort(field: string): 'asc' | 'desc' | null { return this.control()?.getFilter(field).sort ?? null; }

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
  isColumnHidden(field: string): boolean { return this.control()?.isColumnHidden(field) ?? false; }

  /** @internal */
  isGroupedByField(field: string): boolean { return this.control()?.groupByField() === field; }

  /** @internal */
  isColumnPinned(field: string): boolean {
    return this.pinnedColDefs().some(c => c.field === field);
  }

  /** @internal Returns `true` for the rightmost pinned column (used to draw the separator shadow). */
  isLastPinnedColumn(field: string): boolean {
    const cols = this.pinnedColDefs();
    return cols.length > 0 && cols[cols.length - 1].field === field;
  }

  /** @internal Sticky left offset in px for a pinned column. */
  getPinnedStickyLeft(field: string): number {
    return this._pinnedLeftMap().get(field) ?? 0;
  }

  // ── Row selection ─────────────────────────────────────────────────────────────

  private _selectionPivot: number | null = null;

  /** @internal */
  onRowPointerDown(event: PointerEvent, originalIndex: number): void {
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
      event.preventDefault();
      this._selectedIndices.set(new Set([originalIndex]));
      this._selectionPivot = originalIndex;
      this.dragHandler.startDragSelect(originalIndex);
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
  onActivate(originalIndex: number, ci: number): void {
    if (this.isEditing(originalIndex, ci)) return;
    this.cancelCurrent();
    this.selectedCell.set({ rowIndex: originalIndex, colIndex: ci });
    const col = this.visibleColDefs()[ci];
    if (col.values?.length) this.enterEdit(originalIndex, ci, '');
    else this.wrapperEl().nativeElement.focus();
  }

  /** @internal */
  onActivateAddRow(): void {
    this.cancelCurrent();
    this.activateAddRow();
  }

  /** @internal */
  onStartEdit(originalIndex: number, ci: number): void {
    if (this.isEditing(originalIndex, ci)) return;
    this.enterEdit(originalIndex, ci, '');
  }

  /** @internal */
  onDraftChange(value: unknown): void { this.currentDraft.set(value); }

  /** @internal Main keyboard handler delegated from the wrapper div. */
  onKeyDown(event: KeyboardEvent): void {
    // Undo / redo — checked before everything else so they work in any state.
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      if (event.key === 'z') { event.preventDefault(); event.shiftKey ? this.applyRedo() : this.applyUndo(); return; }
      if (event.key === 'y') { event.preventDefault(); this.applyRedo(); return; }
    }

    if (this.editingCell()) {
      switch (event.key) {
        case 'Tab':    event.preventDefault(); this.commitCurrent(); this.moveSelection(0, event.shiftKey ? -1 : 1); break;
        case 'Enter':  event.preventDefault(); this.commitCurrent(); this.moveSelection(1, 0); break;
        case 'Escape': event.preventDefault(); this.cancelCurrent(); this.wrapperEl().nativeElement.focus(); break;
      }
      return;
    }
    const sel = this.selectedCell();
    const isOnAddRow = this.allowAddRows() && !this.autoAddRows() && sel?.rowIndex === this.dataSource().length;
    switch (event.key) {
      case 'ArrowUp':    event.preventDefault(); this.moveSelection(-1,  0); break;
      case 'ArrowDown':  event.preventDefault(); this.moveSelection( 1,  0); break;
      case 'ArrowLeft':  event.preventDefault(); this.moveSelection( 0, -1); break;
      case 'ArrowRight': event.preventDefault(); this.moveSelection( 0,  1); break;
      case 'Tab':        event.preventDefault(); this.moveSelection(0, event.shiftKey ? -1 : 1); break;
      case 'Enter':
      case 'F2':
        event.preventDefault();
        if (sel) { if (isOnAddRow) this.activateAddRow(); else this.enterEdit(sel.rowIndex, sel.colIndex, ''); }
        break;
      default:
        if (sel && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if (isOnAddRow) this.activateAddRow(); else this.enterEdit(sel.rowIndex, sel.colIndex, event.key);
        }
    }
  }

  // ── Row reorder ───────────────────────────────────────────────────────────────

  /** @internal Ghost cell display during a reorder drag. */
  getGhostCellDisplay(col: ColDef): string { return this.dragHandler.getGhostDisplay(col); }

  /** @internal Delegates to AgridDragHandler. */
  onHandlePointerDown(event: PointerEvent, originalIndex: number): void {
    if (!this.allowRowReorder()) return;
    this.dragHandler.startReorder(event, originalIndex);
  }

  // ── Column resize ─────────────────────────────────────────────────────────────

  /** @internal Delegates to AgridResizeHandler. */
  onResizeStart(event: MouseEvent, col: ColDef): void {
    this.resizeHandler.start(event, col);
  }

  // ── Row context menu ──────────────────────────────────────────────────────────

  /** @internal */
  onControlContextMenu(event: MouseEvent, originalIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, rowIndex: originalIndex });
  }

  /** @internal */
  closeContextMenu(): void { this.contextMenu.set(null); }

  /** Delete the row at `originalIndex`, adjusting stale cell/edit pointers. */
  deleteRow(originalIndex: number): void {
    this.dataSource().removeRow(originalIndex);

    const sel = this.selectedCell();
    if (sel?.rowIndex === originalIndex) this.selectedCell.set(null);
    else if (sel && sel.rowIndex > originalIndex)
      this.selectedCell.update(s => s ? { ...s, rowIndex: s.rowIndex - 1 } : null);

    const ed = this.editingCell();
    if (ed?.rowIndex === originalIndex) { this.editingCell.set(null); this.editSeedChar.set(''); }
    else if (ed && ed.rowIndex > originalIndex)
      this.editingCell.update(p => p ? { ...p, rowIndex: p.rowIndex - 1 } : null);

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
    this.control()?.setTextFilter(field, (event.target as HTMLInputElement).value);
  }

  /** @internal */
  openFilterMenu(event: MouseEvent, field: string): void {
    event.stopPropagation();
    this.filterMenuSearch.set('');
    this.filterMenu.set({ field, x: event.clientX, y: event.clientY });
  }

  /** @internal */
  closeFilterMenu(): void { this.filterMenu.set(null); }

  /** @internal */
  onFilterMenuSearch(event: Event): void {
    this.filterMenuSearch.set((event.target as HTMLInputElement).value);
  }

  /** @internal */
  onMenuSort(field: string, dir: 'asc' | 'desc'): void {
    const current = this.control()?.getFilter(field).sort;
    this.control()?.setSort(field, current === dir ? null : dir);
  }

  /** @internal */
  onMenuClearFilter(field: string): void {
    this.control()?.clearFilter(field);
    this.closeFilterMenu();
  }

  /** @internal */
  onMenuToggleGroupBy(field: string): void {
    const ctrl = this.control();
    if (!ctrl) return;
    ctrl.setGroupBy(ctrl.groupByField() === field ? null : field);
    this.closeFilterMenu();
  }

  /** @internal */
  onMenuClearAll(): void {
    this.control()?.clearAllFilters();
    this.closeFilterMenu();
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

  /** @internal Syncs pinned-column transform with horizontal scroll position. */
  onHorizontalScroll(event: Event): void {
    const scrollLeft = (event.target as HTMLElement).scrollLeft;
    this._hostEl.nativeElement.style.setProperty('--ag-hscroll-left', scrollLeft + 'px');
  }

  /** @internal */
  onMenuTogglePin(field: string): void {
    this.control()?.togglePinned(field);
    this.closeFilterMenu();
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private selectedDisplayIndex(): number {
    const sel = this.selectedCell();
    if (!sel) return -1;
    const items = this.filteredItems();
    if (sel.rowIndex >= this.dataSource().length) return items.length - 1;
    return items.findIndex(item => isDataRowItemFn(item) && item.originalIndex === sel.rowIndex);
  }

  private findDisplayIndex(originalIndex: number): number {
    return this.filteredItems().findIndex(
      item => isDataRowItemFn(item) && item.originalIndex === originalIndex
    );
  }

  private buildEmptyRow(): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const col of this.colDefs()) row[col.field] = col.type === 'number' ? 0 : '';
    return row;
  }

  private activateAddRow(): void {
    const emptyRow = this.buildEmptyRow();
    const insertedIndex = this.dataSource().addRow(emptyRow);
    this.selectedCell.set({ rowIndex: insertedIndex, colIndex: 0 });
    this.wrapperEl().nativeElement.focus();
    const displayIdx = this.findDisplayIndex(insertedIndex);
    if (displayIdx >= 0) this.scrollToKeepVisible(displayIdx);
    this.prepareAddRecord.emit({ index: insertedIndex, data: emptyRow });
  }

  private enterEdit(originalIndex: number, ci: number, seedChar: string): void {
    const col = this.visibleColDefs()[ci];
    if (col.editable === false) return;
    const currentValue = this.dataSource().getRow(originalIndex)[col.field];
    this.selectedCell.set({ rowIndex: originalIndex, colIndex: ci });
    this.currentDraft.set(seedChar !== '' ? seedChar : currentValue);
    this.editSeedChar.set(seedChar);
    this.editingCell.set({ rowIndex: originalIndex, colIndex: ci });
    const displayIdx = this.findDisplayIndex(originalIndex);
    if (displayIdx >= 0) this.scrollToKeepVisible(displayIdx);
  }

  private applyUndo(): void {
    const ctrl = this.control();
    if (!ctrl) return;
    const entry = ctrl.undo();
    if (!entry) return;
    this._applyHistoryEntry(entry, entry.oldValue);
  }

  private applyRedo(): void {
    const ctrl = this.control();
    if (!ctrl) return;
    const entry = ctrl.redo();
    if (!entry) return;
    this._applyHistoryEntry(entry, entry.newValue);
  }

  private _applyHistoryEntry(entry: HistoryEntry, value: unknown): void {
    const prevValue = this.dataSource().getRow(entry.rowIndex)[entry.field];
    this.dataSource().patchRow(entry.rowIndex, { [entry.field]: value });
    const ci = this.visibleColDefs().findIndex(c => c.field === entry.field);
    this.cellEdit.emit({
      position: { rowIndex: entry.rowIndex, colIndex: ci },
      field: entry.field,
      oldValue: prevValue,
      newValue: value,
    });
  }

  private commitCurrent(): void {
    const pos = this.editingCell();
    if (!pos) return;
    const col = this.visibleColDefs()[pos.colIndex];
    const oldValue = this.dataSource().getRow(pos.rowIndex)[col.field];
    const newValue = this.currentDraft();
    if (oldValue !== newValue) {
      this.dataSource().patchRow(pos.rowIndex, { [col.field]: newValue });
      this.control()?.pushEdit({ rowIndex: pos.rowIndex, field: col.field, oldValue, newValue });
      this.cellEdit.emit({ position: pos, field: col.field, oldValue, newValue });
    }
    this.editingCell.set(null);
    this.editSeedChar.set('');
    this.wrapperEl().nativeElement.focus();
  }

  private cancelCurrent(): void {
    this.editingCell.set(null);
    this.editSeedChar.set('');
  }

  private moveSelection(dRow: number, dCol: number): void {
    const items = this.filteredItems();
    if (items.length === 0) return;
    const cols = this.visibleColDefs().length;
    let di = this.selectedDisplayIndex();
    let ci = this.selectedCell()?.colIndex ?? 0;
    if (di === -1) { di = 0; ci = 0; }
    let newDi = di + dRow;
    let newCi = ci + dCol;
    const onAddRow = items[newDi] === null;
    if (!onAddRow) {
      if (newCi < 0)     { newDi--; newCi = cols - 1; }
      if (newCi >= cols) { newDi++; newCi = 0; }
    }
    // Skip group header rows.
    {
      const skipDir = dRow < 0 ? -1 : 1;
      let skipDi = newDi;
      while (skipDi >= 0 && skipDi < items.length && isGroupHeaderItemFn(items[skipDi])) skipDi += skipDir;
      if (skipDi >= 0 && skipDi < items.length) newDi = skipDi;
    }
    if (this.autoAddRows() && newDi >= items.length) {
      const emptyRow = this.buildEmptyRow();
      const insertedIndex = this.dataSource().addRow(emptyRow);
      const newDisplayIdx = this.filteredItems().findIndex(
        item => isDataRowItemFn(item) && item.originalIndex === insertedIndex
      );
      this.selectedCell.set({ rowIndex: insertedIndex, colIndex: Math.min(newCi, cols - 1) });
      if (newDisplayIdx >= 0) this.scrollToKeepVisible(newDisplayIdx);
      this.wrapperEl().nativeElement.focus();
      this.prepareAddRecord.emit({ index: insertedIndex, data: emptyRow });
      return;
    }
    newDi = Math.max(0, Math.min(items.length - 1, newDi));
    newCi = Math.max(0, Math.min(cols - 1, newCi));
    const newItem = items[newDi];
    if (newItem === null) {
      this.selectedCell.set({ rowIndex: this.dataSource().length, colIndex: 0 });
    } else if (isDataRowItemFn(newItem)) {
      this.selectedCell.set({ rowIndex: newItem.originalIndex, colIndex: newCi });
    }
    this.scrollToKeepVisible(newDi);
  }

  private scrollToKeepVisible(displayIndex: number): void {
    const viewport   = this.viewport();
    const itemSize   = this.rowHeight();
    const scrollOffset   = viewport.measureScrollOffset();
    const viewportSize   = viewport.getViewportSize();
    if (displayIndex * itemSize < scrollOffset)
      viewport.scrollToOffset(displayIndex * itemSize);
    else if ((displayIndex + 1) * itemSize > scrollOffset + viewportSize)
      viewport.scrollToOffset((displayIndex + 1) * itemSize - viewportSize);
  }
}
