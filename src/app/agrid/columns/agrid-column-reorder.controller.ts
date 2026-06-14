import { DestroyRef, Signal, signal } from '@angular/core';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { AgridControl } from '../agrid-control';
import { ColDef } from '../agrid.types';

/** View state for the floating column header shown during a reorder drag. @internal */
export interface AgridColumnDragPreview {
  field: string;
  fields: string[];
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type AgridColumnDropTarget = {
  field: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Dependencies required by {@link AgridColumnReorderController}. @internal */
export interface AgridColumnReorderControllerOptions {
  control: Signal<AgridControl | null>;
  visibleColDefs: Signal<ColDef[]>;
  getColDef: (field: string) => ColDef | undefined;
}

/** Owns column header drag/drop state and column reordering. @internal */
export class AgridColumnReorderController {
  private readonly dragFields = signal<string[]>([]);
  private readonly dragOverField = signal<string | null>(null);
  private readonly dragInsertBefore = signal(true);
  readonly preview = signal<AgridColumnDragPreview | null>(null);
  private dragStartFields: string[] = [];
  private dragLabel = '';
  private dragStartX = 0;
  private dragStartY = 0;
  private pointerOffsetX = 0;
  private pointerOffsetY = 0;
  private draggedWidth = 0;
  private draggedHeight = 0;
  private dropTargets: AgridColumnDropTarget[] = [];

  constructor(
    private readonly opts: AgridColumnReorderControllerOptions,
    destroyRef: DestroyRef,
    private readonly browser = new AgridBrowserAdapter(),
  ) {
    destroyRef.onDestroy(() => this.cancel());
  }

  /** Arms a column reorder gesture for an unlocked header. */
  start(event: PointerEvent, field: string): void {
    const col = this.opts.getColDef(field);
    this.startFields(event, [field], col?.header ?? field);
  }

  /** Arms a grouped-header reorder gesture for a contiguous field segment. */
  startGroup(event: PointerEvent, fields: readonly string[], label: string): void {
    this.startFields(event, fields, label);
  }

  private startFields(event: PointerEvent, fields: readonly string[], label: string): void {
    if (!this.opts.control() || event.button !== 0) return;
    if (fields.length === 0 || fields.some(field => this.opts.getColDef(field)?.locked)) return;
    const header = event.currentTarget as HTMLElement | null;
    const rect = header?.getBoundingClientRect();
    this.dragStartFields = [...fields];
    this.dragLabel = label;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.draggedWidth = rect?.width ?? 0;
    this.draggedHeight = rect?.height ?? 32;
    this.pointerOffsetX = rect ? event.clientX - rect.left : 0;
    this.pointerOffsetY = rect ? event.clientY - rect.top : 0;
    this.dropTargets = this.captureDropTargets(header);
    this.browser.addDocumentListener('pointermove', this.dragMove);
    this.browser.addDocumentListener('pointerup', this.dragUp);
    this.browser.addDocumentListener('pointercancel', this.dragCancel);
  }

  /** Returns whether the field is currently being dragged. */
  isDragging(field: string): boolean {
    return this.dragFields().includes(field);
  }

  /** Returns the active drop-indicator side for a field. */
  getDropSide(field: string): 'before' | 'after' | null {
    if (this.dragOverField() !== field || this.dragFields().includes(field)) return null;
    return this.dragInsertBefore() ? 'before' : 'after';
  }

  /** Horizontal translation used to animate headers away from the pending insertion gap. */
  getHeaderOffset(field: string): number {
    const movingFields = this.dragFields();
    const overField = this.dragOverField();
    if (movingFields.length === 0 || !overField || movingFields.includes(field)
      || this.draggedWidth <= 0) return 0;

    const fields = this.opts.visibleColDefs().map(col => col.field);
    const fromIndex = fields.findIndex(value => movingFields.includes(value));
    const remaining = fields.filter(value => !movingFields.includes(value));
    const overIndex = remaining.indexOf(overField);
    const fieldIndex = remaining.indexOf(field);
    if (fromIndex < 0 || overIndex < 0 || fieldIndex < 0) return 0;

    const insertionIndex = overIndex + (this.dragInsertBefore() ? 0 : 1);
    if (insertionIndex < fromIndex && fieldIndex >= insertionIndex && fieldIndex < fromIndex) {
      return this.draggedWidth;
    }
    if (insertionIndex > fromIndex && fieldIndex >= fromIndex && fieldIndex < insertionIndex) {
      return -this.draggedWidth;
    }
    return 0;
  }

  private readonly dragMove = (event: PointerEvent): void => {
    if (this.dragStartFields.length === 0) return;
    if (this.dragFields().length === 0) {
      if (Math.abs(event.clientX - this.dragStartX) < 5) return;
      this.dragFields.set([...this.dragStartFields]);
      this.preview.set({
        field: this.dragStartFields[0],
        fields: [...this.dragStartFields],
        label: this.dragLabel,
        x: event.clientX - this.pointerOffsetX,
        y: event.clientY - this.pointerOffsetY,
        width: this.draggedWidth,
        height: this.draggedHeight,
      });
    } else {
      this.preview.update(preview => preview ? {
        ...preview,
        x: event.clientX - this.pointerOffsetX,
        y: event.clientY - this.pointerOffsetY,
      } : null);
    }
    const hovered = this.getHoveredHeaderCell(event.clientX, event.clientY);
    if (hovered && !this.dragFields().includes(hovered.field)) {
      this.dragOverField.set(hovered.field);
      this.dragInsertBefore.set(hovered.insertBefore);
    } else {
      this.dragOverField.set(null);
    }
  };

  private readonly dragUp = (): void => {
    this.removeListeners();
    const from = this.dragFields();
    const to = this.dragOverField();
    if (from.length > 0 && to) {
      this.opts.control()?.moveColumns(
        this.opts.visibleColDefs().map(col => col.field),
        from,
        to,
        this.dragInsertBefore(),
      );
    }
    this.dragFields.set([]);
    this.dragOverField.set(null);
    this.dragInsertBefore.set(true);
    this.preview.set(null);
    this.dragStartFields = [];
    this.dragLabel = '';
    this.dropTargets = [];
  };

  private readonly dragCancel = (): void => this.cancel();

  private cancel(): void {
    this.removeListeners();
    this.dragFields.set([]);
    this.dragOverField.set(null);
    this.dragInsertBefore.set(true);
    this.preview.set(null);
    this.dragStartFields = [];
    this.dragLabel = '';
    this.dropTargets = [];
  }

  private removeListeners(): void {
    this.browser.removeDocumentListener('pointermove', this.dragMove);
    this.browser.removeDocumentListener('pointerup', this.dragUp);
    this.browser.removeDocumentListener('pointercancel', this.dragCancel);
  }

  private getHoveredHeaderCell(x: number, _y: number): { field: string; insertBefore: boolean } | null {
    const target = this.dropTargets.find(rect => x >= rect.left && x <= rect.right);
    return target
      ? { field: target.field, insertBefore: x < target.left + (target.right - target.left) / 2 }
      : null;
  }

  private captureDropTargets(header: HTMLElement | null): AgridColumnDropTarget[] {
    const root = header?.closest('.ag-wrapper') ?? header?.ownerDocument;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('.ag-header-cell[data-col-field]'))
      .map(element => {
        const field = element.dataset['colField'];
        const rect = element.getBoundingClientRect();
        return field ? {
          field,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        } : null;
      })
      .filter((target): target is AgridColumnDropTarget => target !== null);
  }

}
