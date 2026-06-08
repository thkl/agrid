import { DestroyRef, Signal, signal } from '@angular/core';
import { AgridControl } from './agrid-control';
import { ColDef } from './agrid.types';

export interface AgridColumnReorderControllerOptions {
  control: Signal<AgridControl | null>;
  visibleColDefs: Signal<ColDef[]>;
  getColDef: (field: string) => ColDef | undefined;
}

/** Owns column header drag/drop state and column reordering. */
export class AgridColumnReorderController {
  private readonly dragField = signal<string | null>(null);
  private readonly dragOverField = signal<string | null>(null);
  private readonly dragInsertBefore = signal(true);
  private dragStartField: string | null = null;
  private dragStartX = 0;

  constructor(
    private readonly opts: AgridColumnReorderControllerOptions,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => this.removeListeners());
  }

  start(event: PointerEvent, field: string): void {
    if (!this.opts.control() || event.button !== 0) return;
    if (this.opts.getColDef(field)?.locked) return;
    this.dragStartField = field;
    this.dragStartX = event.clientX;
    document.addEventListener('pointermove', this.dragMove);
    document.addEventListener('pointerup', this.dragUp);
  }

  isDragging(field: string): boolean {
    return this.dragField() === field;
  }

  getDropSide(field: string): 'before' | 'after' | null {
    if (this.dragOverField() !== field || this.dragField() === field) return null;
    return this.dragInsertBefore() ? 'before' : 'after';
  }

  private readonly dragMove = (event: PointerEvent): void => {
    if (!this.dragStartField) return;
    if (this.dragField() === null) {
      if (Math.abs(event.clientX - this.dragStartX) < 5) return;
      this.dragField.set(this.dragStartField);
    }
    const hovered = this.getHoveredHeaderCell(event.clientX, event.clientY);
    if (hovered && hovered.field !== this.dragField()) {
      this.dragOverField.set(hovered.field);
      this.dragInsertBefore.set(hovered.insertBefore);
    } else {
      this.dragOverField.set(null);
    }
  };

  private readonly dragUp = (): void => {
    this.removeListeners();
    const from = this.dragField();
    const to = this.dragOverField();
    if (from && to) {
      this.opts.control()?.moveColumn(
        this.opts.visibleColDefs().map(col => col.field),
        from,
        to,
        this.dragInsertBefore(),
      );
    }
    this.dragField.set(null);
    this.dragOverField.set(null);
    this.dragStartField = null;
  };

  private removeListeners(): void {
    document.removeEventListener('pointermove', this.dragMove);
    document.removeEventListener('pointerup', this.dragUp);
  }

  private getHoveredHeaderCell(x: number, y: number): { field: string; insertBefore: boolean } | null {
    for (const el of document.elementsFromPoint(x, y)) {
      const headerEl = (el as HTMLElement).closest<HTMLElement>('.ag-header-cell[data-col-field]');
      if (!headerEl?.dataset['colField']) continue;
      const rect = headerEl.getBoundingClientRect();
      return { field: headerEl.dataset['colField'], insertBefore: x < rect.left + rect.width / 2 };
    }
    return null;
  }
}
