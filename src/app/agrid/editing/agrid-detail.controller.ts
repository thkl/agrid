import { Signal, WritableSignal, signal } from '@angular/core';
import { CellRange } from '../selection/agrid-clipboard.handler';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import {
  CellPosition,
  ColDef,
  DetailAction,
  DetailRowItem,
  GridEditEvent,
  GridItem,
  RowDetailActionEvent,
  ValidationFailedEvent,
  ValueOption,
} from '../agrid.types';
import {
  coerceDateInputValue,
  coerceNumberInputValue,
  getCellValue,
  getDisplayForField,
  isDataRowItem,
  isDetailRowItem,
} from '../agrid.utils';

/** Dependencies and callbacks required by {@link AgridDetailController}. @internal */
export interface AgridDetailControllerOptions<T extends object = any> {
  dataSource: Signal<AgridDataSource>;
  control: Signal<AgridControl | null>;
  /** Column rendered as the expanded panel's multiline detail field, when configured. */
  detailColumn: Signal<ColDef | null>;
  locale: Signal<string>;
  displayItems: Signal<GridItem[]>;
  visibleColDefs: Signal<ColDef[]>;
  selectedCell: WritableSignal<CellPosition | null>;
  selectedRange: WritableSignal<CellRange | null>;
  /** Truthy while an inline cell edit is active (suppresses keyboard hand-off). */
  editingCell: Signal<CellPosition | null>;
  isCellEditable: (col: ColDef, rowIndex: number) => boolean;
  /** Renders the host-supplied detail panel HTML for a row. */
  renderDetailHtml: (row: Record<string, unknown>) => string;
  emitEditEvents: (event: GridEditEvent<T>) => void;
  emitValidationFailed: (event: ValidationFailedEvent) => void;
  emitDetailAction: (event: RowDetailActionEvent<T>) => void;
  /** Schedules a callback after the next render (browser adapter). */
  schedule: (fn: () => void) => void;
  /** Resolves the live textarea element for a detail row, if rendered. */
  queryTextarea: (rowIndex: number) => HTMLTextAreaElement | null;
}

/**
 * Owns the master/detail panel's multiline field editor: draft state, validation,
 * text-template actions, and keyboard hand-off from the grid into the detail textarea.
 *
 * Expansion of detail panels is intentionally *not* owned here — it lives with the
 * projection model in the host component, since it changes which rows are rendered.
 * @internal
 */
export class AgridDetailController<T extends object = any> {
  /** Datasource row currently editing its expanded detail field, or `null`. */
  readonly editingRow = signal<number | null>(null);
  /** In-flight text of the multiline detail editor. */
  readonly draft = signal('');
  /** Validation message for the active detail edit, or `null` when valid. */
  readonly validationError = signal<string | null>(null);

  /** Cell to restore selection to after a keyboard-initiated detail edit closes. */
  private returnCell: CellPosition | null = null;

  /**
   * Memoized detail-panel HTML keyed by the detail item. The projection recreates detail items
   * only when their data changes, so the cache hits across change-detection passes and invalidates
   * naturally when the row (and thus the item reference) changes — old items are GC'd via WeakMap.
   */
  private readonly htmlCache = new WeakMap<object, string>();

  constructor(private readonly opts: AgridDetailControllerOptions<T>) {}

  /** Resolved HTML for an expanded detail panel (auto-sanitized by `[innerHTML]`). */
  detailHtml(item: GridItem): string {
    if (!isDetailRowItem(item)) return '';
    const cached = this.htmlCache.get(item);
    if (cached !== undefined) return cached;
    const html = this.opts.renderDetailHtml(item.row);
    this.htmlCache.set(item, html);
    return html;
  }

  /** Formatted value shown while a configured detail field is not being edited. */
  detailFieldDisplay(item: DetailRowItem): string {
    const col = this.opts.detailColumn();
    return col ? getDisplayForField(col, getCellValue(col, item.row, item.detailFor), this.opts.locale(), item.row) : '';
  }

  /** Whether the configured detail field can be edited for this row. */
  isDetailFieldEditable(item: DetailRowItem): boolean {
    const col = this.opts.detailColumn();
    return !!col && this.opts.isCellEditable(col, item.detailFor);
  }

  /** Enter multiline editing for one expanded detail row. */
  startDetailFieldEdit(item: DetailRowItem, event?: Event): void {
    const col = this.opts.detailColumn();
    if (!col || !this.opts.isCellEditable(col, item.detailFor)) return;
    event?.preventDefault();
    event?.stopPropagation();
    this.returnCell = event instanceof KeyboardEvent ? this.opts.selectedCell() : null;
    this.opts.selectedCell.set(null);
    this.opts.selectedRange.set(null);
    this.editingRow.set(item.detailFor);
    this.draft.set(String(item.row[col.field] ?? ''));
    this.validationError.set(null);
    this.opts.schedule(() => {
      this.focusTextarea(item.detailFor);
    });
  }

  /** Keep the multiline draft synchronized with textarea input. */
  onDetailDraftInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  /** Commit on blur or Ctrl/Cmd+Enter, and cancel on Escape. */
  onDetailEditorKeydown(item: DetailRowItem, event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelDetailFieldEdit();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.commitDetailFieldEdit(item);
    }
  }

  private focusTextarea(rowIndex: number): void {
    this.opts.queryTextarea(rowIndex)?.focus();
  }

  /** Insert a configured text template into the active detail textarea. */
  applyDetailAction(item: DetailRowItem, action: DetailAction, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!action.text) {
      this.opts.emitDetailAction({
        id: action.id,
        row: item.row,
        originalIndex: item.detailFor,
      } as RowDetailActionEvent<T>);
      return;
    }
    if (!this.isDetailFieldEditable(item)) return;
    if (this.editingRow() !== item.detailFor) {
      this.startDetailFieldEdit(item, event);
    }
    const text = typeof action.text === 'function'
      ? action.text({ row: item.row, rowIndex: item.detailFor })
      : action.text ?? '';
    const textarea = this.opts.queryTextarea(item.detailFor);
    const current = this.draft();
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? start;
    const next = `${current.slice(0, start)}${text}${current.slice(end)}`;
    this.draft.set(next);
    this.validationError.set(null);
    this.opts.schedule(() => {
      const editor = this.opts.queryTextarea(item.detailFor);
      if (!editor) return;
      const caret = start + text.length;
      editor.focus();
      editor.setSelectionRange(caret, caret);
    });
  }

  private detailKeyboardTarget(direction: 1 | -1): DetailRowItem | null {
    const sel = this.opts.selectedCell();
    if (!sel) return null;
    const items = this.opts.displayItems();
    const selectedIndex = items.findIndex(item =>
      isDataRowItem(item) && item.originalIndex === sel.rowIndex,
    );
    if (selectedIndex < 0) return null;
    const candidate = items[selectedIndex + direction];
    return isDetailRowItem(candidate) && this.isDetailFieldEditable(candidate)
      ? candidate
      : null;
  }

  /**
   * Hand keyboard focus from the grid into an adjacent detail editor when the selection
   * leaves the row's first/last column toward an editable detail panel. Returns whether
   * the event was consumed.
   */
  focusDetailEditorFromKeyboard(event: KeyboardEvent): boolean {
    if (this.opts.editingCell() || this.editingRow() !== null) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const sel = this.opts.selectedCell();
    if (!sel) return false;
    const direction = event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)
      ? 1
      : event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)
        ? -1
        : null;
    if (direction === null) return false;
    const lastColIndex = this.opts.visibleColDefs().length - 1;
    if ((direction === 1 && sel.colIndex < lastColIndex) || (direction === -1 && sel.colIndex > 0)) {
      return false;
    }
    const target = this.detailKeyboardTarget(direction);
    if (!target) return false;
    event.preventDefault();
    event.stopPropagation();
    this.startDetailFieldEdit(target, event);
    return true;
  }

  /** Commit a multiline detail edit through normal grid edit semantics. */
  commitDetailFieldEdit(item: DetailRowItem): void {
    if (this.editingRow() !== item.detailFor) return;
    const col = this.opts.detailColumn();
    if (!col || !this.opts.isCellEditable(col, item.detailFor)) {
      this.cancelDetailFieldEdit();
      return;
    }
    const row = this.opts.dataSource().getRow(item.detailFor);
    const oldValue = row[col.field];
    let newValue: unknown = this.draft();
    if (col.type === 'number') {
      newValue = coerceNumberInputValue(newValue);
    } else if (col.type === 'date') {
      newValue = coerceDateInputValue(String(newValue), oldValue);
    } else if (col.values?.length) {
      const option = col.values.find(value =>
        typeof value === 'string'
          ? value === newValue
          : String((value as ValueOption).value) === newValue,
      );
      if (option !== undefined) {
        newValue = typeof option === 'string' ? option : (option as ValueOption).value;
      }
    }
    if (oldValue !== newValue) {
      const message = col.validate?.(newValue as never, row as never) ?? null;
      if (message) {
        this.validationError.set(message);
        this.opts.emitValidationFailed({
          rowIndex: item.detailFor,
          field: col.field,
          value: newValue,
          message,
          source: 'detail',
        });
        this.opts.schedule(() => this.focusTextarea(item.detailFor));
        return;
      }
      this.opts.dataSource().patchRow(item.detailFor, { [col.field]: newValue });
      this.opts.control()?.pushEdit({ rowIndex: item.detailFor, field: col.field, oldValue, newValue });
      this.opts.emitEditEvents({
        position: {
          rowIndex: item.detailFor,
          colIndex: this.opts.visibleColDefs().findIndex(column => column.field === col.field),
        },
        field: col.field,
        oldValue,
        newValue,
      } as GridEditEvent<T>);
    }
    this.cancelDetailFieldEdit();
  }

  /** Discard the active multiline detail draft, restoring keyboard selection if needed. */
  cancelDetailFieldEdit(): void {
    this.editingRow.set(null);
    this.draft.set('');
    this.validationError.set(null);
    if (this.returnCell) {
      this.opts.selectedCell.set(this.returnCell);
      this.returnCell = null;
    }
  }
}
