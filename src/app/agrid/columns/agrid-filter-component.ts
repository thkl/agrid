import { InjectionToken, Signal } from '@angular/core';
import { AgridControl, ColumnFilter } from '../agrid-control';
import { ColDef } from '../agrid.types';

/**
 * Runtime context handed to a custom column-filter component through dependency injection.
 *
 * Custom filters should write normal {@link ColumnFilter} state through {@link setFilter}. That
 * keeps filter persistence, server query generation, and the active-filter header state aligned
 * with built-in filters.
 *
 * @example
 * ```ts
 * const ctx = inject(AGRID_FILTER_CONTEXT);
 * ctx.setFilter({ ...ctx.filter(), text: 'active' });
 * ```
 */
export interface AgridFilterContext {
  /** Field currently being filtered. */
  readonly field: string;
  /** Column definition for the active filter menu. */
  readonly column: ColDef;
  /** Shared grid control that owns filter state. */
  readonly control: AgridControl | null;
  /** Current filter snapshot for this field. */
  readonly filter: Signal<ColumnFilter>;
  /** Replace this field's filter state, preserving any fields the component copies forward. */
  setFilter(filter: ColumnFilter): void;
  /** Clear this field's filter state. */
  clear(): void;
  /** Close the column menu. */
  close(): void;
}

/**
 * DI token a custom {@link ColDef.filterComponent} injects to control column filtering.
 *
 * The token is only available while the component is rendered inside an aGrid column menu.
 */
export const AGRID_FILTER_CONTEXT = new InjectionToken<AgridFilterContext>('AGRID_FILTER_CONTEXT');
