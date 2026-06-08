import { DestroyRef, Signal, computed, signal } from '@angular/core';
import { AgridColumnMenuValueItem } from './agrid-column-menu.component';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { ColDef, FilterChangeEvent, SortChangeEvent, ValueOption } from './agrid.types';

export type AgridColumnMenuState = {
  field: string;
  x: number;
  y: number;
};

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

/** Owns column-menu state, filters, sorting, and menu-triggered column mutations. */
export class AgridColumnMenuController {
  readonly menu = signal<AgridColumnMenuState | null>(null);
  readonly search = signal('');

  readonly items = computed<{ label: string; rawStr: string }[]>(() => {
    const menu = this.menu();
    if (!menu) return [];
    const col = this.getColDef(menu.field);
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
  ) {
    destroyRef.onDestroy(() => {
      for (const timer of this.filterDebounces.values()) clearTimeout(timer);
      this.filterDebounces.clear();
    });
  }

  getTextFilter(field: string): string {
    return this.opts.control()?.getFilter(field).text ?? '';
  }

  getSort(field: string): 'asc' | 'desc' | null {
    return this.opts.sortOption() === 'none'
      ? null
      : this.opts.control()?.getFilter(field).sort ?? null;
  }

  getSortPriority(field: string): number {
    return this.opts.control()?.getSortPriority(field) ?? 0;
  }

  hasMultiSort(): boolean {
    return this.opts.sortOption() === 'multi' && this.opts.effectiveSortOrder().length > 1;
  }

  isAllSelected(field: string): boolean {
    return this.opts.control()?.getFilter(field).selectedValues === null;
  }

  isValueActive(rawStr: string): boolean {
    return this.activeValues().has(rawStr);
  }

  isValueSelected(field: string, value: string): boolean {
    const selected = this.opts.control()?.getFilter(field).selectedValues;
    return selected == null || selected.includes(value);
  }

  hasActiveFilter(field: string): boolean {
    return this.opts.control()?.hasActiveFilter(field) ?? false;
  }

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

  open(event: MouseEvent, field: string): void {
    event.stopPropagation();
    this.search.set('');
    this.menu.set({
      field,
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: event.clientY,
    });
  }

  close(): void {
    this.menu.set(null);
  }

  setSearch(value: string): void {
    this.search.set(value);
  }

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

  clearFilter(field: string): void {
    const control = this.opts.control();
    if (!control) return;
    this.cancelFilterDebounce(field);
    const previous = control.getFilter(field);
    control.clearFilter(field);
    if (this.opts.serverSideFiltering()) {
      if (previous.text) this.opts.onFilterChange({ field, value: '' });
      if (previous.sort) this.opts.onSortChange({ field, direction: null });
    }
    this.close();
  }

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

  toggleGroupBy(field: string): void {
    const control = this.opts.control();
    if (!control) return;
    control.setGroupBy(control.groupByField() === field ? null : field);
    this.close();
  }

  clearAll(): void {
    const control = this.opts.control();
    if (!control) return;
    for (const field of this.filterDebounces.keys()) this.cancelFilterDebounce(field);
    const previous = control.filters();
    control.clearAllFilters();
    if (this.opts.serverSideFiltering()) {
      for (const [field, filter] of Object.entries(previous)) {
        if (filter.text) this.opts.onFilterChange({ field, value: '' });
        if (filter.sort) this.opts.onSortChange({ field, direction: null });
      }
    }
    this.close();
  }

  toggleAll(field: string): void {
    const control = this.opts.control();
    if (!control) return;
    control.setSelectedValues(
      field,
      control.getFilter(field).selectedValues === null ? [] : null,
    );
  }

  toggleValue(field: string, rawStr: string): void {
    const control = this.opts.control();
    if (!control) return;
    const allValues = this.items().map(item => item.rawStr);
    const current = control.getFilter(field).selectedValues ?? allValues;
    const next = current.includes(rawStr)
      ? current.filter(value => value !== rawStr)
      : [...current, rawStr];
    control.setSelectedValues(field, next.length === allValues.length ? null : next);
  }

  togglePin(field: string): void {
    this.opts.control()?.togglePinned(field);
    this.close();
  }

  togglePinRight(field: string): void {
    this.opts.control()?.togglePinnedRight(field);
    this.close();
  }

  autosize(field: string): void {
    const col = this.getColDef(field);
    if (!col) return;
    this.opts.autosizeColumn(col);
    this.close();
  }

  setAggregate(
    field: string,
    aggregate: 'sum' | 'avg' | 'min' | 'max' | 'count' | null,
  ): void {
    this.opts.control()?.setAggregate(field, aggregate);
    this.close();
  }

  hideColumn(field: string): void {
    this.opts.control()?.setColumnVisibility(field, false);
    this.close();
  }

  toggleColumnVisibility(field: string): void {
    this.opts.control()?.toggleColumnVisibility(field);
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
}
