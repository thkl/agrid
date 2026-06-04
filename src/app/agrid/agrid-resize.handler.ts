import { DestroyRef, Signal, WritableSignal } from '@angular/core';
import { AgridControl } from './agrid-control';
import { ColDef } from './agrid.types';

/** Encapsulates column-resize pointer state and document mouse listeners. */
export class AgridResizeHandler {
  private state: { field: string; startX: number; startWidth: number } | null = null;
  private readonly onMove = (e: MouseEvent) => this.handleMove(e);
  private readonly onUp   = () => this.handleUp();

  constructor(
    private readonly control: Signal<AgridControl | null>,
    private readonly localWidths: WritableSignal<Record<string, number>>,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => this.handleUp());
  }

  start(event: MouseEvent, col: ColDef): void {
    event.preventDefault();
    event.stopPropagation();
    const ctrl = this.control();
    const current = ctrl
      ? ctrl.columnWidths()[col.field] ?? col.width
      : this.localWidths()[col.field] ?? col.width;
    this.state = { field: col.field, startX: event.clientX, startWidth: current };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onUp);
  }

  private handleMove(event: MouseEvent): void {
    if (!this.state) return;
    const newWidth = Math.max(40, this.state.startWidth + (event.clientX - this.state.startX));
    const ctrl = this.control();
    if (ctrl) ctrl.setColumnWidth(this.state.field, newWidth);
    else this.localWidths.update(w => ({ ...w, [this.state!.field]: newWidth }));
  }

  private handleUp(): void {
    this.state = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onUp);
  }
}
