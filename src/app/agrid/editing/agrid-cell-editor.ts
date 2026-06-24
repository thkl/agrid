import { InjectionToken, Signal } from '@angular/core';
import { ColDef } from '../agrid.types';

/**
 * Context handed to a custom cell editor component through dependency injection.
 *
 * A custom editor is any standalone component referenced by {@link ColDef.cellEditor}.
 * The grid instantiates it while a cell is in edit mode and provides this context via the
 * {@link AGRID_EDITOR_CONTEXT} token. The editor is purely an *input surface*: it reads the
 * current value and pushes drafts back through {@link setDraft}. The grid keeps full ownership
 * of validation, history (undo/redo), and the commit/cancel lifecycle — so Tab, Enter, and
 * Escape continue to work without the editor doing anything.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'rating-editor',
 *   template: `
 *     <select #s [value]="ctx.value()" (change)="ctx.setDraft(+s.value); ctx.commit()">
 *       @for (n of [1,2,3,4,5]; track n) { <option [value]="n">{{ n }} ★</option> }
 *     </select>`,
 * })
 * export class RatingEditor {
 *   readonly ctx = inject(AGRID_EDITOR_CONTEXT);
 * }
 *
 * // ColDef: { field: 'rating', cellEditor: RatingEditor }
 * ```
 */
export interface AgridEditorContext<TValue = unknown> {
  /** The cell's current value at the moment editing started. */
  readonly value: Signal<TValue>;
  /** The full row record the cell belongs to. */
  readonly row: Signal<Record<string, unknown>>;
  /** The column definition this cell is rendered from. */
  readonly column: Signal<ColDef>;
  /**
   * The printable character that triggered type-to-edit, or `''` when editing started another
   * way (double-click, Enter, F2). Useful for seeding a free-text editor.
   */
  readonly seedChar: Signal<string>;
  /** Stage a new value. The grid commits whatever was last staged on Tab/Enter. */
  setDraft(value: unknown): void;
  /** Programmatically commit the staged value (same as the user pressing Enter). */
  commit(): void;
  /** Programmatically discard the edit (same as the user pressing Escape). */
  cancel(): void;
}

/** DI token a custom {@link ColDef.cellEditor} component injects to talk to the grid. */
export const AGRID_EDITOR_CONTEXT = new InjectionToken<AgridEditorContext>('AGRID_EDITOR_CONTEXT');
