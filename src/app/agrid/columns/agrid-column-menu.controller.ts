import { DestroyRef, Signal, computed, signal } from '@angular/core';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { AgridColumnMenuValueItem } from './agrid-column-menu.component';
import { AgridControl, FilterOperator } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { ColDef, FilterChangeEvent, SortChangeEvent, ValueOption } from '../agrid.types';
import { passesConditionFilter } from '../agrid.utils';

/** Position and target field of the open column menu. @internal */
export type AgridColumnMenuState = {
  field: string;
  mode: 'column' | 'condition';
  x: number;
  y: number;
};

/** Dependencies and callbacks required by {@link AgridColumnMenuController}. @internal */
export interface AgridColumnMenuControllerOptions {
  control: Signal<AgridControl | null>;
  dataSource: Signal<AgridDataSource>;
  colDefs: Signal<ColDef[]>;
  serverSideFiltering: Signal<boolean>;
  filterDebounceMs: Signal<number>;
  sortOption: Signal<'single' | 'multi' | 'none'>;
  effectiveSortOrder: () => string[];
  autosizeColumn: (col: ColDef) => void;
  onFilterChange: (event: FilterChangeEvent) => void;
  onSortChange: (event: SortChangeEvent) => void;
}

/** Owns column-menu state, filters, sorting, and menu-triggered column mutations. @internal */
export class AgridColumnMenuController {
  readonly menu = signal<AgridColumnMenuState | null>(null);
  readonly search = signal('');

  readonly items = computed<{ label: string; rawStr: string }[]>(() => {
    const menu = this.menu();
    if (!menu) return [];
    const col = this.getColDef(menu.field);
    if (!col?.filterable) return [];
    const values = col?.values;
    if (values?.length) {
      return values
        .map(value => typeof value === 'string'
          ? { label: value, rawStr: value }
          : {
              label: (value as ValueOption).label,
              rawStr: String((value as ValueOption).value),
            })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }

    const rows = this.opts.dataSource().rows();
    const rawValues = [...new Set(rows.map(row => String(row[menu.field] ?? '')))];
    return rawValues
      .map(rawStr => ({
        label: col?.formatter ? col.formatter(rawStr) : rawStr,
        rawStr,
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
      );
  });

  readonly visibleItems = computed(() => {
    const search = this.search().toLowerCase();
    return this.items().filter(item => !search || item.label.toLowerCase().includes(search));
  });

  readonly activeValues = computed(() => {
    const menu = this.menu();
    if (!menu) return new Set<string>();
    const col = this.getColDef(menu.field);
    if (this.opts.serverSideFiltering() && col?.values?.length) {
      return new Set(this.items().map(item => item.rawStr));
    }
    const rows = this.opts.dataSource().rows();
    const control = this.opts.control();
    let indices = rows.map((_, index) => index);
    if (control) {
      for (const [field, filter] of Object.entries(control.filters())) {
        if (field === menu.field) continue;
        if (filter.text) {
          const search = filter.text.toLowerCase();
          indices = indices.filter(index =>
            String(rows[index][field] ?? '').toLowerCase().includes(search),
          );
        }
        if (filter.selectedValues !== null) {
          const allowed = new Set(filter.selectedValues);
          indices = indices.filter(index => allowed.has(String(rows[index][field] ?? '')));
        }
        if (filter.operator && filter.operand != null && filter.operand !== '') {
          const filterCol = this.getColDef(field);
          indices = indices.filter(index =>
            passesConditionFilter(filterCol, rows[index][field], filter),
          );
        }
      }
    }
    return new Set(indices.map(index => String(rows[index][menu.field] ?? '')));
  });

  readonly valueItems = computed<AgridColumnMenuValueItem[]>(() => {
    const menu = this.menu();
    if (!menu) return [];
    return this.visibleItems().map(item => ({
      ...item,
      active: this.activeValues().has(item.rawStr),
      selected: this.isValueSelected(menu.field, item.rawStr),
    }));
  });

  private readonly filterDebounces = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly opts: AgridColumnMenuControllerOptions,
    destroyRef: DestroyRef,
    private readonly browser = new AgridBrowserAdapter(),
  ) {
    destroyRef.onDestroy(() => {
      for (const timer of this.filterDebounces.values()) clearTimeout(timer);
      this.filterDebounces.clear();
    });
  }

  /** Returns the active text filter for a field. */
  getTextFilter(field: string): string {
    return this.opts.control()?.getFilter(field).text ?? '';
  }

  /** Returns the condition-filter input type for a filterable field. */
  getFilterType(field: string): 'text' | 'number' | 'date' | null {
    const col = this.getColDef(field);
    if (!col?.filterable || col.type === 'boolean') return null;
    return col.type === 'number' || col.type === 'date' ? col.type : 'text';
  }

  /** Returns the condition operator for a field, or `null`. */
  getFilterOperator(field: string): FilterOperator | null {
    return this.opts.control()?.getFilter(field).operator ?? null;
  }

  /** Returns the primary condition operand for a field. */
  getFilterOperand(field: string): string {
    return this.opts.control()?.getFilter(field).operand ?? '';
  }

  /** Returns the secondary condition operand (used by `between`). */
  getFilterOperand2(field: string): string {
    return this.opts.control()?.getFilter(field).operand2 ?? '';
  }

  /** Sets the condition operator; clearing it (`null`) also drops the operands. */
  setFilterOperator(field: string, operator: FilterOperator | null): void {
    const control = this.opts.control();
    if (!control) return;
    if (!operator) {
      control.setRangeFilter(field, null, null, null);
    } else {
      const current = control.getFilter(field);
      control.setRangeFilter(field, operator, current.operand ?? '', current.operand2 ?? '');
    }
    this.emitRangeServer(field, false);
  }

  /** Sets the primary condition operand. */
  setFilterOperand(field: string, value: string): void {
    const control = this.opts.control();
    if (!control) return;
    const current = control.getFilter(field);
    control.setRangeFilter(field, current.operator ?? 'eq', value, current.operand2 ?? '');
    this.emitRangeServer(field, true);
  }

  /** Sets the secondary condition operand (used by `between`). */
  setFilterOperand2(field: string, value: string): void {
    const control = this.opts.control();
    if (!control) return;
    const current = control.getFilter(field);
    control.setRangeFilter(field, current.operator ?? 'between', current.operand ?? '', value);
    this.emitRangeServer(field, true);
  }

  /**
   * In server-side filtering mode, emit a {@link FilterChangeEvent} carrying the current
   * condition so the host can refetch. Operand edits are debounced; operator changes are immediate.
   * No-op in client mode (the projection layer filters locally).
   */
  private emitRangeServer(field: string, debounce: boolean): void {
    if (!this.opts.serverSideFiltering()) return;
    const emit = () => {
      const f = this.opts.control()?.getFilter(field);
      this.opts.onFilterChange({
        field,
        value: '',
        operator: f?.operator ?? null,
        operand: f?.operand ?? null,
        operand2: f?.operand2 ?? null,
      });
    };
    this.cancelFilterDebounce(field);
    const delay = this.opts.filterDebounceMs();
    if (!debounce || delay === 0) {
      emit();
      return;
    }
    this.filterDebounces.set(field, setTimeout(() => {
      this.filterDebounces.delete(field);
      emit();
    }, delay));
  }

  /** Returns the active sort direction, respecting disabled sorting. */
  getSort(field: string): 'asc' | 'desc' | null {
    return this.opts.sortOption() === 'none'
      ? null
      : this.opts.control()?.getFilter(field).sort ?? null;
  }

  /** Returns a field's one-based position in the sort stack. */
  getSortPriority(field: string): number {
    return this.opts.control()?.getSortPriority(field) ?? 0;
  }

  /** Returns whether multiple sort fields are currently active. */
  hasMultiSort(): boolean {
    return this.opts.sortOption() === 'multi' && this.opts.effectiveSortOrder().length > 1;
  }

  /** Returns whether the value filter currently includes every value. */
  isAllSelected(field: string): boolean {
    return this.opts.control()?.getFilter(field).selectedValues === null;
  }

  /** Returns whether a raw value survives filters on other columns. */
  isValueActive(rawStr: string): boolean {
    return this.activeValues().has(rawStr);
  }

  /** Returns whether a raw value is selected by the field's value filter. */
  isValueSelected(field: string, value: string): boolean {
    const selected = this.opts.control()?.getFilter(field).selectedValues;
    return selected == null || selected.includes(value);
  }

  /** Returns whether a field has active filter or sort state. */
  hasActiveFilter(field: string): boolean {
    return this.opts.control()?.hasActiveFilter(field) ?? false;
  }

  /** Updates a text filter and emits its debounced server-side event. */
  onTextFilterChange(event: Event, field: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.opts.control()?.setTextFilter(field, value);
    if (!this.opts.serverSideFiltering()) return;

    this.cancelFilterDebounce(field);
    const delay = this.opts.filterDebounceMs();
    if (delay === 0) {
      this.opts.onFilterChange({ field, value });
      return;
    }
    this.filterDebounces.set(field, setTimeout(() => {
      this.filterDebounces.delete(field);
      this.opts.onFilterChange({ field, value });
    }, delay));
  }

  /** Opens the requested column menu, or closes it when that column is already open. */
  open(event: MouseEvent, field: string, mode: 'column' | 'condition' = 'column'): void {
    event.stopPropagation();
    if (this.menu()?.field === field && this.menu()?.mode === mode) {
      this.close();
      return;
    }
    this.search.set('');
    this.menu.set({
      field,
      mode,
      x: Math.min(event.clientX, this.browser.viewportWidth() - 220),
      y: event.clientY,
    });
  }

  /** Closes the column menu. */
  close(): void {
    this.menu.set(null);
  }

  /** Updates the distinct-value search text. */
  setSearch(value: string): void {
    this.search.set(value);
  }

  /** Applies or clears a sort according to the configured sorting mode. */
  sort(field: string, direction: 'asc' | 'desc'): void {
    const control = this.opts.control();
    if (!control || this.opts.sortOption() === 'none') return;
    if (control.getFilter(field).sort === direction) {
      const previous = control.getFilter(field);
      control.clearFilter(field);
      if (previous.text) control.setTextFilter(field, previous.text);
      if (previous.selectedValues !== null) {
        control.setSelectedValues(field, previous.selectedValues);
      }
      if (previous.operator) {
        control.setRangeFilter(
          field,
          previous.operator,
          previous.operand ?? null,
          previous.operand2 ?? null,
        );
      }
      if (this.opts.serverSideFiltering()) {
        this.opts.onSortChange({ field, direction: null });
      }
    } else if (this.opts.sortOption() === 'single') {
      const previousFields = control.sortOrder().filter(sortedField => sortedField !== field);
      control.setSort(field, direction);
      if (this.opts.serverSideFiltering()) {
        for (const previousField of previousFields) {
          this.opts.onSortChange({ field: previousField, direction: null });
        }
        this.opts.onSortChange({ field, direction });
      }
    } else {
      control.addSort(field, direction);
      if (this.opts.serverSideFiltering()) {
        this.opts.onSortChange({ field, direction });
      }
    }
    this.close();
  }

  /** Clears filter and sort state for one field. */
  clearFilter(field: string): void {
    const control = this.opts.control();
    if (!control) return;
    this.cancelFilterDebounce(field);
    const previous = control.getFilter(field);
    control.clearFilter(field);
    if (this.opts.serverSideFiltering()) {
      if (previous.text) this.opts.onFilterChange({ field, value: '' });
      if (previous.selectedValues !== null) {
        this.opts.onFilterChange({ field, value: '', selectedValues: null });
      }
      if (previous.operator) {
        this.opts.onFilterChange({ field, value: '', operator: null, operand: null, operand2: null });
      }
      if (previous.sort) this.opts.onSortChange({ field, direction: null });
    }
    this.close();
  }

  /** Replaces the multi-sort stack with one field and direction. */
  resetSort(field: string, direction: 'asc' | 'desc'): void {
    const control = this.opts.control();
    if (!control || this.opts.sortOption() !== 'multi') return;
    const previousFields = control.sortOrder().filter(sortedField => sortedField !== field);
    control.setSort(field, direction);
    if (this.opts.serverSideFiltering()) {
      for (const previousField of previousFields) {
        this.opts.onSortChange({ field: previousField, direction: null });
      }
      this.opts.onSortChange({ field, direction });
    }
    this.close();
  }

  /** Toggles grouping by a field. */
  toggleGroupBy(field: string): void {
    const control = this.opts.control();
    if (!control) return;
    control.setGroupBy(control.groupByField() === field ? null : field);
    this.close();
  }

  /** Clears filter and sort state for every field. */
  clearAll(): void {
    const control = this.opts.control();
    if (!control) return;
    for (const field of this.filterDebounces.keys()) this.cancelFilterDebounce(field);
    const previous = control.filters();
    control.clearAllFilters();
    if (this.opts.serverSideFiltering()) {
      for (const [field, filter] of Object.entries(previous)) {
        if (filter.text) this.opts.onFilterChange({ field, value: '' });
        if (filter.selectedValues !== null) {
          this.opts.onFilterChange({ field, value: '', selectedValues: null });
        }
        if (filter.operator) {
          this.opts.onFilterChange({ field, value: '', operator: null, operand: null, operand2: null });
        }
        if (filter.sort) this.opts.onSortChange({ field, direction: null });
      }
    }
    this.close();
  }

  /** Selects or deselects every distinct value for a field. */
  toggleAll(field: string): void {
    const control = this.opts.control();
    if (!control) return;
    const next = control.getFilter(field).selectedValues === null ? [] : null;
    control.setSelectedValues(field, next);
    this.emitValueServer(field, next);
  }

  /** Toggles one raw value in a field's value filter. */
  toggleValue(field: string, rawStr: string): void {
    const control = this.opts.control();
    if (!control) return;
    const allValues = this.items().map(item => item.rawStr);
    const current = control.getFilter(field).selectedValues ?? allValues;
    const next = current.includes(rawStr)
      ? current.filter(value => value !== rawStr)
      : [...current, rawStr];
    const selectedValues = next.length === allValues.length ? null : next;
    control.setSelectedValues(field, selectedValues);
    this.emitValueServer(field, selectedValues);
  }

  /** Toggles left pinning for a field. */
  togglePin(field: string): void {
    this.opts.control()?.togglePinned(field);
    this.close();
  }

  /** Toggles right pinning for a field. */
  togglePinRight(field: string): void {
    this.opts.control()?.togglePinnedRight(field);
    this.close();
  }

  /** Autosizes a field and closes the menu. */
  autosize(field: string): void {
    const col = this.getColDef(field);
    if (!col) return;
    this.opts.autosizeColumn(col);
    this.close();
  }

  /** Sets a built-in aggregate for a field. */
  setAggregate(
    field: string,
    aggregate: 'sum' | 'avg' | 'min' | 'max' | 'count' | null,
  ): void {
    this.opts.control()?.setAggregate(field, aggregate);
    this.close();
  }

  /** Hides a field and closes the menu. */
  hideColumn(field: string): void {
    this.opts.control()?.setColumnVisibility(field, false);
    this.close();
  }

  /** Toggles field visibility from the sidebar column list. */
  toggleColumnVisibility(field: string): void {
    this.opts.control()?.toggleColumnVisibility(field);
  }

  /** Sets visibility for several fields from a sidebar header-group toggle. */
  setColumnsVisibility(fields: string[], visible: boolean): void {
    const control = this.opts.control();
    if (!control) return;
    for (const field of fields) {
      control.setColumnVisibility(field, visible);
    }
  }

  private getColDef(field: string): ColDef | undefined {
    return this.opts.colDefs().find(col => col.field === field);
  }

  private cancelFilterDebounce(field: string): void {
    const timer = this.filterDebounces.get(field);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.filterDebounces.delete(field);
  }

  private emitValueServer(field: string, selectedValues: readonly string[] | null): void {
    if (!this.opts.serverSideFiltering()) return;
    this.opts.onFilterChange({ field, value: '', selectedValues });
  }
}
