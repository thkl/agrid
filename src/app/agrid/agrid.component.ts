import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
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
import { CellPosition, ColDef, GridEditEvent, NewRecord, RowReorderEvent, ValueOption } from './agrid.types';

/**
 * Internal row item used in the virtual scroll list.
 * - `{ row, originalIndex }` — a real data row
 * - `null` — the add-row placeholder
 * - `'ghost'` — the drop-target ghost inserted while dragging
 */
export type GridItem = { row: Record<string, unknown>; originalIndex: number } | null | 'ghost';

/**
 * Excel-like data grid for Angular 21.
 *
 * ## Minimal setup
 * ```html
 * <agrid [colDefs]="columns" [dataSource]="ds" />
 * ```
 *
 * ## Full example
 * ```html
 * <agrid
 *   [colDefs]="columns"
 *   [dataSource]="ds"
 *   [control]="ctrl"
 *   [allowAddRows]="true"
 *   [autoAddRows]="true"
 *   [showControlColumn]="true"
 *   (cellEdit)="onEdit($event)"
 *   (prepareAddRecord)="onAdd($event)"
 * />
 * ```
 *
 * ### Keyboard shortcuts
 * | Key | Action |
 * |-----|--------|
 * | Arrow keys | Move selection |
 * | Tab / Shift+Tab | Move right / left (wraps rows) |
 * | Enter / F2 | Enter edit mode |
 * | Printable key | Enter edit mode and seed input with typed character |
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
  /**
   * Column definitions — order determines left-to-right display order.
   * Uses an empty default so computed signals that depend on it are safe
   * to read before Angular has finished setting inputs (e.g. via viewChild queries).
   */
  colDefs = input<ColDef[]>([]);

  /**
   * Row height in pixels.
   * Must be a fixed value because CDK virtual scroll requires a constant item size.
   * @default 32
   */
  rowHeight = input<number>(32);

  /**
   * Signal-based data container. Shared with the host so both sides can read and write rows.
   * Semantically required — always provide a value.
   * Uses an empty default internally so computed signals that depend on it are safe
   * to read before Angular has finished setting inputs (e.g. via viewChild queries).
   */
  dataSource = input<AgridDataSource>(new AgridDataSource());

  /**
   * Optional grid UI state container (column widths, filters, sort).
   * When provided, column width changes and filter/sort state are stored here
   * and can be persisted via `control.toJSON()` / `AgridControl.fromJSON()`.
   * Without it, resize state is ephemeral and filtering/sorting is unavailable.
   */
  control = input<AgridControl | null>(null);

  /**
   * Show a `+ Add row` placeholder at the bottom of the grid.
   * Clicking or navigating to it triggers {@link prepareAddRecord}.
   */
  allowAddRows = input<boolean>(false);

  /**
   * Automatically add a blank row when the user navigates past the last real row.
   * The row is inserted before {@link prepareAddRecord} fires, so the grid can
   * scroll to it immediately. When `true`, the explicit placeholder is hidden.
   */
  autoAddRows = input<boolean>(false);

  /**
   * Show a 24 px control column as the first column.
   * Right-clicking a control cell opens a context menu with row-level actions (Delete row, etc.).
   */
  showControlColumn = input<boolean>(false);

  /**
   * Emitted after the user commits a cell edit.
   * The data source is already updated at this point.
   */
  cellEdit = output<GridEditEvent>();

  /**
   * Emitted when the grid has inserted a blank row into the data source.
   * Use the `index` in the event to call `dataSource.patchRow(index, realData)`.
   */
  prepareAddRecord = output<NewRecord>();

  /**
   * Emitted when the user finishes dragging a row to a new position.
   * The grid does **not** reorder data automatically — call
   * `dataSource.moveRow(event.oldIndex, event.newIndex)` inside the handler.
   * Requires `AgridControl.allowRowReorder = true` and `showControlColumn = true`.
   */
  rowReorder = output<RowReorderEvent>();

  /** Currently selected cell (original index), or `null` when nothing is selected. */
  readonly selectedCell = signal<CellPosition | null>(null);

  /** Position of the cell currently in edit mode (original index), or `null`. */
  readonly editingCell = signal<CellPosition | null>(null);

  /** Draft value of the editing cell — committed on Tab/Enter, discarded on Escape. */
  readonly currentDraft = signal<unknown>(null);

  /** Seed character typed by the user to enter edit mode instantly (e.g. pressing 'A'). */
  readonly editSeedChar = signal<string>('');

  // Ephemeral widths used when no AgridControl is provided.
  private readonly _localWidths = signal<Record<string, number>>({});

  /** `true` when row reordering is enabled via the attached `AgridControl`. */
  readonly allowRowReorder = computed(() => this.control()?.allowRowReorder() ?? false);

  /** `true` when at least one column has `filterable: true`. Controls filter-row visibility. */
  readonly hasFilterableColumns = computed(() => this.colDefs().some(c => c.filterable));

  /**
   * Number of data rows currently visible after all active filters are applied.
   * Read this via a template reference (`<agrid #grid>`→`grid.filteredRowCount()`) to
   * show a "3 of 10 rows" indicator in the host component.
   * Always equals `dataSource.length` when no filters are active.
   */
  readonly filteredRowCount = computed(() =>
    this.filteredItems().filter(item => item !== null).length
  );

  /** CSS `grid-template-columns` string derived from effective column widths. */
  readonly gridTemplateColumns = computed(() => {
    const ctrl = this.control();
    const ctrlWidths = ctrl ? ctrl.columnWidths() : {};
    const localWidths = this._localWidths();
    const cols = this.colDefs()
      .map(c => `${ctrlWidths[c.field] ?? localWidths[c.field] ?? c.width}px`)
      .join(' ');
    return this.showControlColumn() ? `24px ${cols}` : cols;
  });

  /** Sum of all effective column widths (plus the control column when enabled). */
  readonly totalWidth = computed(() => {
    const ctrl = this.control();
    const ctrlWidths = ctrl ? ctrl.columnWidths() : {};
    const localWidths = this._localWidths();
    const w = this.colDefs().reduce(
      (sum, c) => sum + (ctrlWidths[c.field] ?? localWidths[c.field] ?? c.width),
      0
    );
    return this.showControlColumn() ? w + 24 : w;
  });

  /**
   * Filtered and sorted row list passed to `*cdkVirtualFor`.
   * Each item carries the original data-source index so all cell operations target
   * the correct row even when filters change the display order.
   * Appends a `null` sentinel when the explicit add-row placeholder is active.
   *
   * Text filter matches against the DISPLAY value (label / formatted string),
   * not the raw stored value, so typing "Engineering" works even when the field stores an ID.
   */
  readonly filteredItems = computed<GridItem[]>(() => {
    const rows = this.dataSource().rows();
    const ctrl = this.control();
    const colDefs = this.colDefs();
    const colMap = new Map(colDefs.map(c => [c.field, c]));

    // Build index array: start with all rows, then filter, then sort.
    let indices = rows.map((_, i) => i);

    if (ctrl) {
      const filters = ctrl.filters();

      for (const [field, filter] of Object.entries(filters)) {
        const col = colMap.get(field);
        if (filter.text) {
          const lc = filter.text.toLowerCase();
          // Match against the display label/formatted string, not the raw value
          indices = indices.filter(i =>
            this.getDisplayForField(col, rows[i][field]).toLowerCase().includes(lc)
          );
        }
        if (filter.selectedValues !== null) {
          // selectedValues stores stringified raw values for type-safe comparison
          const allowed = new Set(filter.selectedValues);
          indices = indices.filter(i => allowed.has(String(rows[i][field] ?? '')));
        }
      }

      // Apply sort — sort by display label so "Engineering" sorts correctly even if stored as 2
      const sortEntry = Object.entries(filters).find(([, f]) => f.sort);
      if (sortEntry) {
        const [sortField, sortFilter] = sortEntry;
        const sortCol = colMap.get(sortField);
        indices = [...indices].sort((a, b) => {
          const av = this.getDisplayForField(sortCol, rows[a][sortField]);
          const bv = this.getDisplayForField(sortCol, rows[b][sortField]);
          const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
          return sortFilter.sort === 'asc' ? cmp : -cmp;
        });
      }
    }

    const items: GridItem[] = indices.map(i => ({ row: rows[i], originalIndex: i }));

    if (this.allowAddRows() && !this.autoAddRows()) {
      items.push(null);
    }

    return items;
  });

  /**
   * Virtual scroll source during a drag.
   * - Removes the dragged row so its space immediately collapses.
   * - Inserts a `'ghost'` placeholder at the cursor position so CDK makes room.
   * - When no drag is active, returns `filteredItems()` unchanged.
   */
  readonly displayItems = computed<GridItem[]>(() => {
    const items = this.filteredItems();
    const dragIdx = this._dragOriginalIndex();
    if (dragIdx === null) return items;

    // Drop source row from the list so its space closes up immediately.
    const sourcePos = items.findIndex(
      item => item !== null && item !== 'ghost' && (item as { originalIndex: number }).originalIndex === dragIdx
    );
    const withoutSource: GridItem[] = sourcePos === -1
      ? [...items]
      : [...items.slice(0, sourcePos), ...items.slice(sourcePos + 1)];

    const overIdx = this._dragOverIndex();
    if (overIdx === null) return withoutSource;

    const targetPos = withoutSource.findIndex(
      item => item !== null && item !== 'ghost' && (item as { originalIndex: number }).originalIndex === overIdx
    );
    if (targetPos === -1) return withoutSource;

    const insertAt = this._dragInsertBefore() ? targetPos : targetPos + 1;
    const result = [...withoutSource];
    result.splice(insertAt, 0, 'ghost');
    return result;
  });

  /** Active context menu state, or `null` when no menu is open. */
  readonly contextMenu = signal<{ x: number; y: number; rowIndex: number } | null>(null);

  /** Active filter dropdown state, or `null` when closed. */
  readonly filterMenu = signal<{ field: string; x: number; y: number } | null>(null);

  /** Search text typed inside the filter dropdown's value list. */
  readonly filterMenuSearch = signal<string>('');

  /**
   * All items for the open filter menu's value list, sorted by label.
   * - For `ValueOption` columns: derived from `ColDef.values` (label + stringified raw value).
   * - For plain string or untyped columns: unique values extracted from the full dataset.
   * `rawStr` is what gets stored in `ColumnFilter.selectedValues`.
   */
  readonly filterMenuItems = computed<{ label: string; rawStr: string }[]>(() => {
    const menu = this.filterMenu();
    if (!menu) return [];
    const col = this.colDefs().find(c => c.field === menu.field);
    const vals = col?.values;

    if (vals?.length) {
      return vals
        .map(v =>
          typeof v === 'string'
            ? { label: v, rawStr: v }
            : { label: (v as ValueOption).label, rawStr: String((v as ValueOption).value) }
        )
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }

    // Extract from dataset; apply formatter if present
    const rows = this.dataSource().rows();
    const rawStrs = [...new Set(rows.map(r => String(r[menu.field] ?? '')))];
    return rawStrs
      .map(rawStr => ({
        label: col?.formatter ? col.formatter(rawStr) : rawStr,
        rawStr,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
  });

  /**
   * Subset of {@link filterMenuItems} matching the current search string (by label).
   */
  readonly filterMenuVisibleItems = computed(() => {
    const search = this.filterMenuSearch().toLowerCase();
    return this.filterMenuItems().filter(item =>
      !search || item.label.toLowerCase().includes(search)
    );
  });

  /**
   * Set of values that still exist in the dataset when ALL OTHER column filters are applied
   * (excluding the currently open menu's own filter).
   * Values absent from this set are grayed and disabled in the dropdown — they exist in the
   * full dataset but are already excluded by other active filters.
   */
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
        if (field === openField) continue; // exclude this column's own filter
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

  // Row reorder drag state
  private readonly _dragOriginalIndex = signal<number | null>(null);
  private readonly _dragOverIndex = signal<number | null>(null);
  private readonly _dragInsertBefore = signal<boolean>(true);

  // Column resize drag state — captured on mousedown, cleared on mouseup.
  private resizeState: { field: string; startX: number; startWidth: number } | null = null;
  private readonly resizeMouseMove = (e: MouseEvent) => this.onResizeMove(e);
  private readonly resizeMouseUp = () => this.onResizeEnd();

  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);
  private readonly wrapperEl = viewChild.required<ElementRef<HTMLDivElement>>('wrapper');
  private readonly destroyRef = inject(DestroyRef);

  // ── Template helpers ───────────────────────────────────────────────────────

  /** @internal Is the cell at (originalIndex, ci) currently selected? */
  isSelected(originalIndex: number, ci: number): boolean {
    const sel = this.selectedCell();
    return sel?.rowIndex === originalIndex && sel?.colIndex === ci;
  }

  /** @internal Is the cell at (originalIndex, ci) currently in edit mode? */
  isEditing(originalIndex: number, ci: number): boolean {
    const ed = this.editingCell();
    return ed?.rowIndex === originalIndex && ed?.colIndex === ci;
  }

  /** @internal Seed char for the currently editing cell; empty for all others. */
  getSeedChar(originalIndex: number, ci: number): string {
    return this.isEditing(originalIndex, ci) ? this.editSeedChar() : '';
  }

  /** @internal Is the add-row placeholder currently selected? */
  isAddRowSelected(): boolean {
    const sel = this.selectedCell();
    return this.allowAddRows() && sel?.rowIndex === this.dataSource().length;
  }

  /** @internal Current text filter value for a column (for binding to the filter input). */
  getTextFilter(field: string): string {
    return this.control()?.getFilter(field).text ?? '';
  }

  /** @internal Current sort direction for a column (for visual indicator in the dropdown). */
  getSort(field: string): 'asc' | 'desc' | null {
    return this.control()?.getFilter(field).sort ?? null;
  }

  /** @internal Whether all values are selected (or no value filter is active) for the open menu's field. */
  isMenuAllSelected(field: string): boolean {
    return this.control()?.getFilter(field).selectedValues === null;
  }

  /** @internal Whether a rawStr value is present in the dataset after all OTHER filters are applied. */
  isMenuValueActive(rawStr: string): boolean {
    return this.filterMenuActiveValues().has(rawStr);
  }

  /** @internal Whether a specific value is checked in the open filter menu. */
  isMenuValueSelected(field: string, value: string): boolean {
    const selected = this.control()?.getFilter(field).selectedValues;
    if (selected == null) return true;  // null or undefined → all values shown
    return selected.includes(value);
  }

  /** @internal Whether the given field has any active filter or sort. */
  hasActiveFilter(field: string): boolean {
    return this.control()?.hasActiveFilter(field) ?? false;
  }

  // ── Cell interaction ───────────────────────────────────────────────────────

  /** @internal Called when a data cell is clicked. */
  onActivate(originalIndex: number, ci: number): void {
    if (this.isEditing(originalIndex, ci)) return;
    this.cancelCurrent();
    this.selectedCell.set({ rowIndex: originalIndex, colIndex: ci });
    const col = this.colDefs()[ci];
    if (col.values?.length) {
      this.enterEdit(originalIndex, ci, '');
    } else {
      this.wrapperEl().nativeElement.focus();
    }
  }

  /** @internal Called when the add-row placeholder is clicked. */
  onActivateAddRow(): void {
    this.cancelCurrent();
    this.activateAddRow();
  }

  /** @internal Called on double-click of a data cell. */
  onStartEdit(originalIndex: number, ci: number): void {
    if (this.isEditing(originalIndex, ci)) return;
    this.enterEdit(originalIndex, ci, '');
  }

  /** @internal Called by AgridCellComponent on every draft change. */
  onDraftChange(value: unknown): void {
    this.currentDraft.set(value);
  }

  /** @internal Main keyboard handler — delegated from the wrapper div. */
  onKeyDown(event: KeyboardEvent): void {
    if (this.editingCell()) {
      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          this.commitCurrent();
          this.moveSelection(0, event.shiftKey ? -1 : 1);
          break;
        case 'Enter':
          event.preventDefault();
          this.commitCurrent();
          this.moveSelection(1, 0);
          break;
        case 'Escape':
          event.preventDefault();
          this.cancelCurrent();
          this.wrapperEl().nativeElement.focus();
          break;
      }
      return;
    }

    const sel = this.selectedCell();
    const isOnAddRow = this.allowAddRows() && !this.autoAddRows()
      && sel?.rowIndex === this.dataSource().length;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.moveSelection(-1, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveSelection(1, 0);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.moveSelection(0, -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.moveSelection(0, 1);
        break;
      case 'Tab':
        event.preventDefault();
        this.moveSelection(0, event.shiftKey ? -1 : 1);
        break;
      case 'Enter':
      case 'F2':
        event.preventDefault();
        if (sel) {
          if (isOnAddRow) this.activateAddRow();
          else this.enterEdit(sel.rowIndex, sel.colIndex, '');
        }
        break;
      default:
        if (sel && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if (isOnAddRow) this.activateAddRow();
          else this.enterEdit(sel.rowIndex, sel.colIndex, event.key);
        }
    }
  }

  /** @internal CDK virtual scroll `trackBy` function. */
  trackByItem(_di: number, item: GridItem): string | number {
    if (item === 'ghost') return '__ghost__';
    return item?.originalIndex ?? -1;
  }

  // ── Row reorder drag (pointer-events based — no HTML5 drag snap-back) ──────

  /** @internal Display value for a ghost cell — reads from the dragged row. */
  getGhostCellDisplay(col: ColDef): string {
    const idx = this._dragOriginalIndex();
    if (idx === null) return '';
    return this.getDisplayForField(col, this.dataSource().rows()[idx]?.[col.field]);
  }

  /** @internal Pointerdown on the drag handle starts the drag. */
  onHandlePointerDown(event: PointerEvent, originalIndex: number): void {
    if (!this.allowRowReorder()) return;
    event.preventDefault();

    const handle = event.currentTarget as HTMLElement;
    const rowEl = handle.closest<HTMLElement>('.ag-row');
    if (!rowEl) return;

    const rect = rowEl.getBoundingClientRect();
    this._dragOriginalIndex.set(originalIndex);
    this._dragOffsetX = event.clientX - rect.left;
    this._dragOffsetY = event.clientY - rect.top;

    // Build a floating full-row overlay that follows the cursor.
    const overlay = rowEl.cloneNode(true) as HTMLElement;
    overlay.removeAttribute('data-original-index'); // don't confuse _getHoveredRow
    Object.assign(overlay.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      pointerEvents: 'none',
      zIndex: '9999',
      background: '#fff',
      border: '1px solid #1a73e8',
      borderRadius: '4px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      overflow: 'hidden',
      opacity: '0.95',
      cursor: 'grabbing',
    });
    document.body.appendChild(overlay);
    this._dragOverlayEl = overlay;

    document.addEventListener('pointermove', this._ptrMoveHandler);
    document.addEventListener('pointerup', this._ptrUpHandler);
    this.destroyRef.onDestroy(() => this._cleanupPointerDrag());
  }

  private readonly _ptrMoveHandler = (e: PointerEvent): void => {
    // Move overlay: direct DOM, no Angular involved.
    if (this._dragOverlayEl) {
      this._dragOverlayEl.style.top = `${e.clientY - this._dragOffsetY}px`;
      this._dragOverlayEl.style.left = `${e.clientX - this._dragOffsetX}px`;
    }
    // Update hover target only when it changes (avoids unnecessary CD cycles).
    const hovered = this._getHoveredRow(e.clientX, e.clientY);
    if (hovered) {
      if (this._dragOverIndex() !== hovered.originalIndex) this._dragOverIndex.set(hovered.originalIndex);
      if (this._dragInsertBefore() !== hovered.insertBefore) this._dragInsertBefore.set(hovered.insertBefore);
    }
  };

  private readonly _ptrUpHandler = (_e: PointerEvent): void => {
    document.removeEventListener('pointermove', this._ptrMoveHandler);
    document.removeEventListener('pointerup', this._ptrUpHandler);

    // Fade out the overlay before committing so the user never sees it snap anywhere.
    const overlay = this._dragOverlayEl;
    this._dragOverlayEl = null;
    if (overlay) {
      overlay.style.transition = 'opacity 80ms ease';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 90);
    }

    const oldIndex = this._dragOriginalIndex();
    const overIdx = this._dragOverIndex();
    if (oldIndex !== null && overIdx !== null) {
      const newIndex = this._dragInsertBefore() ? overIdx : overIdx + 1;
      const shouldEmit = oldIndex !== newIndex;
      this._clearDrag();
      if (shouldEmit) {
        this.rowReorder.emit({ row: { ...this.dataSource().rows()[oldIndex] }, oldIndex, newIndex });
      }
    } else {
      this._clearDrag();
    }
  };

  private _getHoveredRow(x: number, y: number): { originalIndex: number; insertBefore: boolean } | null {
    for (const el of document.elementsFromPoint(x, y)) {
      const rowEl = (el as HTMLElement).closest<HTMLElement>('.ag-row[data-original-index]');
      if (!rowEl) continue;
      const rect = rowEl.getBoundingClientRect();
      return { originalIndex: Number(rowEl.dataset['originalIndex']), insertBefore: y < rect.top + rect.height / 2 };
    }
    return null;
  }

  private _cleanupPointerDrag(): void {
    document.removeEventListener('pointermove', this._ptrMoveHandler);
    document.removeEventListener('pointerup', this._ptrUpHandler);
    this._dragOverlayEl?.remove();
    this._dragOverlayEl = null;
    this._clearDrag();
  }

  private _dragOverlayEl: HTMLElement | null = null;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;

  private _clearDrag(): void {
    this._dragOriginalIndex.set(null);
    this._dragOverIndex.set(null);
  }

  // ── Column resize ──────────────────────────────────────────────────────────

  /** @internal Start a column resize drag. */
  onResizeStart(event: MouseEvent, col: ColDef): void {
    event.preventDefault();
    event.stopPropagation();
    const ctrl = this.control();
    const localWidths = this._localWidths();
    const currentWidth = ctrl
      ? ctrl.columnWidths()[col.field] ?? col.width
      : localWidths[col.field] ?? col.width;
    this.resizeState = { field: col.field, startX: event.clientX, startWidth: currentWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.resizeMouseMove);
    document.addEventListener('mouseup', this.resizeMouseUp);
    this.destroyRef.onDestroy(() => this.onResizeEnd());
  }

  private onResizeMove(event: MouseEvent): void {
    if (!this.resizeState) return;
    const newWidth = Math.max(40, this.resizeState.startWidth + (event.clientX - this.resizeState.startX));
    const ctrl = this.control();
    if (ctrl) {
      ctrl.setColumnWidth(this.resizeState.field, newWidth);
    } else {
      this._localWidths.update(w => ({ ...w, [this.resizeState!.field]: newWidth }));
    }
  }

  private onResizeEnd(): void {
    this.resizeState = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.resizeMouseMove);
    document.removeEventListener('mouseup', this.resizeMouseUp);
  }

  // ── Row context menu ───────────────────────────────────────────────────────

  /** @internal Right-click on the control column cell. */
  onControlContextMenu(event: MouseEvent, originalIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, rowIndex: originalIndex });
  }

  /** @internal Close the row context menu. */
  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  /**
   * Delete the row at `originalIndex`.
   * Adjusts `selectedCell` and `editingCell` to avoid stale indices.
   */
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

    this.contextMenu.set(null);
  }

  // ── Filter row & menu ──────────────────────────────────────────────────────

  /** @internal Text filter input changed. */
  onTextFilterChange(event: Event, field: string): void {
    const text = (event.target as HTMLInputElement).value;
    this.control()?.setTextFilter(field, text);
  }

  /** @internal Open the value-picker dropdown for a column. */
  openFilterMenu(event: MouseEvent, field: string): void {
    event.stopPropagation();
    this.filterMenuSearch.set('');
    this.filterMenu.set({ field, x: event.clientX, y: event.clientY });
  }

  /** @internal Close the filter dropdown. */
  closeFilterMenu(): void {
    this.filterMenu.set(null);
  }

  /** @internal Search input inside the filter dropdown changed. */
  onFilterMenuSearch(event: Event): void {
    this.filterMenuSearch.set((event.target as HTMLInputElement).value);
  }

  /** @internal Sort button clicked inside the filter dropdown. */
  onMenuSort(field: string, dir: 'asc' | 'desc'): void {
    const current = this.control()?.getFilter(field).sort;
    this.control()?.setSort(field, current === dir ? null : dir);
  }

  /** @internal Clear filter for the open dropdown's column. */
  onMenuClearFilter(field: string): void {
    this.control()?.clearFilter(field);
    this.closeFilterMenu();
  }

  /** @internal Clear all filters and sorts. */
  onMenuClearAll(): void {
    this.control()?.clearAllFilters();
    this.closeFilterMenu();
  }

  /** @internal Toggle "Select All" in the value-picker. */
  onMenuToggleAll(field: string): void {
    const ctrl = this.control();
    if (!ctrl) return;
    const current = ctrl.getFilter(field).selectedValues;
    ctrl.setSelectedValues(field, current === null ? [] : null);
  }

  /** @internal Toggle a single value (by rawStr) in the value-picker. */
  onMenuToggleValue(field: string, rawStr: string): void {
    const ctrl = this.control();
    if (!ctrl) return;
    const allRawStrs = this.filterMenuItems().map(i => i.rawStr);
    const current = ctrl.getFilter(field).selectedValues ?? allRawStrs;
    const next = current.includes(rawStr)
      ? current.filter(v => v !== rawStr)
      : [...current, rawStr];
    ctrl.setSelectedValues(field, next.length === allRawStrs.length ? null : next);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Find the display index of the currently selected cell in `filteredItems`.
   * Returns -1 when nothing is selected or the selected row is filtered out.
   */
  private selectedDisplayIndex(): number {
    const sel = this.selectedCell();
    if (!sel) return -1;
    const items = this.filteredItems();
    // Add-row placeholder is always last
    if (sel.rowIndex >= this.dataSource().length) return items.length - 1;
    return items.findIndex(item => item !== null && item !== 'ghost' && item.originalIndex === sel.rowIndex);
  }

  /**
   * Find the display index of `originalIndex` in `filteredItems`.
   * Returns -1 if the row is currently filtered out.
   */
  private findDisplayIndex(originalIndex: number): number {
    return this.filteredItems().findIndex(
      item => item !== null && item !== 'ghost' && item.originalIndex === originalIndex
    );
  }

  /**
   * Return the display string for a raw field value.
   * Priority: ValueOption label → `ColDef.formatter` → raw string coercion.
   */
  private getDisplayForField(col: ColDef | undefined, raw: unknown): string {
    if (!col) return String(raw ?? '');
    if (col.values?.length) {
      const opt = col.values.find(v =>
        typeof v === 'string' ? v === raw : (v as ValueOption).value === raw
      );
      if (opt !== undefined) return typeof opt === 'string' ? opt : (opt as ValueOption).label;
    }
    if (col.formatter) return col.formatter(raw);
    return String(raw ?? '');
  }

  private buildEmptyRow(): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const col of this.colDefs()) {
      row[col.field] = col.type === 'number' ? 0 : '';
    }
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
    const col = this.colDefs()[ci];
    if (col.editable === false) return;
    const currentValue = this.dataSource().getRow(originalIndex)[col.field];
    this.selectedCell.set({ rowIndex: originalIndex, colIndex: ci });
    this.currentDraft.set(seedChar !== '' ? seedChar : currentValue);
    this.editSeedChar.set(seedChar);
    this.editingCell.set({ rowIndex: originalIndex, colIndex: ci });
    const displayIdx = this.findDisplayIndex(originalIndex);
    if (displayIdx >= 0) this.scrollToKeepVisible(displayIdx);
  }

  private commitCurrent(): void {
    const pos = this.editingCell();
    if (!pos) return;
    const col = this.colDefs()[pos.colIndex];
    const oldValue = this.dataSource().getRow(pos.rowIndex)[col.field];
    const newValue = this.currentDraft();
    if (oldValue !== newValue) {
      this.dataSource().patchRow(pos.rowIndex, { [col.field]: newValue });
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

  /**
   * Move selection by `(dRow, dCol)` in display space.
   * Translates display indices back to original indices for `selectedCell`.
   */
  private moveSelection(dRow: number, dCol: number): void {
    const items = this.filteredItems();
    if (items.length === 0) return;

    const cols = this.colDefs().length;
    let di = this.selectedDisplayIndex();
    let ci = this.selectedCell()?.colIndex ?? 0;

    // Default to first item when nothing is selected
    if (di === -1) { di = 0; ci = 0; }

    let newDi = di + dRow;
    let newCi = ci + dCol;

    const onAddRow = items[newDi] === null;

    // Column wrap (skip for add-row placeholder which spans full width)
    if (!onAddRow) {
      if (newCi < 0) { newDi--; newCi = cols - 1; }
      if (newCi >= cols) { newDi++; newCi = 0; }
    }

    // autoAddRows: going past the last displayed row inserts a blank row
    if (this.autoAddRows() && newDi >= items.length) {
      const emptyRow = this.buildEmptyRow();
      const insertedIndex = this.dataSource().addRow(emptyRow);
      // filteredItems will update; find the new row's display position
      const newDisplayIdx = this.filteredItems().findIndex(
        item => item !== null && item !== 'ghost' && item.originalIndex === insertedIndex
      );
      const clampedCi = Math.min(newCi, cols - 1);
      this.selectedCell.set({ rowIndex: insertedIndex, colIndex: clampedCi });
      if (newDisplayIdx >= 0) this.scrollToKeepVisible(newDisplayIdx);
      this.wrapperEl().nativeElement.focus();
      this.prepareAddRecord.emit({ index: insertedIndex, data: emptyRow });
      return;
    }

    newDi = Math.max(0, Math.min(items.length - 1, newDi));
    newCi = Math.max(0, Math.min(cols - 1, newCi));

    const newItem = items[newDi];

    if (newItem === null) {
      // Add-row placeholder: track via dataSource.length (out-of-range sentinel)
      this.selectedCell.set({ rowIndex: this.dataSource().length, colIndex: 0 });
    } else if (newItem !== 'ghost') {
      this.selectedCell.set({ rowIndex: newItem.originalIndex, colIndex: newCi });
    }

    this.scrollToKeepVisible(newDi);
  }

  /**
   * Scroll the CDK viewport the minimum distance needed to keep `displayIndex` visible.
   * Takes a display index (position in the filtered list), not an original index.
   */
  private scrollToKeepVisible(displayIndex: number): void {
    const viewport = this.viewport();
    const itemSize = this.rowHeight();
    const scrollOffset = viewport.measureScrollOffset();
    const viewportSize = viewport.getViewportSize();

    if (displayIndex * itemSize < scrollOffset) {
      viewport.scrollToOffset(displayIndex * itemSize);
    } else if ((displayIndex + 1) * itemSize > scrollOffset + viewportSize) {
      viewport.scrollToOffset((displayIndex + 1) * itemSize - viewportSize);
    }
  }
}
