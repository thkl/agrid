import { InjectionToken, Signal } from '@angular/core';
import { ColDef } from '../agrid.types';

/**
 * Context handed to a custom cell renderer component through dependency injection.
 *
 * A custom renderer is any standalone component referenced by {@link ColDef.cellRendererComponent}.
 * The grid instantiates it for the cell's *display* (read) state and provides this context via the
 * {@link AGRID_RENDERER_CONTEXT} token. Unlike the HTML-string {@link ColDef.cellRenderer}, a
 * component renderer supports full Angular bindings, event handlers, and child components — and
 * needs no manual escaping or sanitization.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'status-badge',
 *   template: `<span class="badge" [class]="'badge--' + value()">{{ value() }}</span>`,
 * })
 * export class StatusBadge {
 *   private readonly ctx = inject(AGRID_RENDERER_CONTEXT);
 *   readonly value = computed(() => String(this.ctx.value() ?? ''));
 * }
 *
 * // ColDef: { field: 'status', cellRendererComponent: StatusBadge }
 * ```
 */
export interface AgridRendererContext<TValue = unknown> {
  /** The cell's current value. */
  readonly value: Signal<TValue>;
  /** The full row record the cell belongs to. */
  readonly row: Signal<Record<string, unknown>>;
  /** The column definition this cell is rendered from. */
  readonly column: Signal<ColDef>;
}

/** DI token a custom {@link ColDef.cellRendererComponent} component injects to read cell data. */
export const AGRID_RENDERER_CONTEXT = new InjectionToken<AgridRendererContext>('AGRID_RENDERER_CONTEXT');
