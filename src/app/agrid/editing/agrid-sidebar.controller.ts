import { Signal, computed, signal } from '@angular/core';
import { AgridControl } from '../agrid-control';
import { AgridDataSource } from '../agrid-datasource';
import { AgridSidebarEdit } from './agrid-sidebar.component';
import { ColDef, GridEditEvent, ValueOption } from '../agrid.types';
import { coerceDateInputValue } from '../agrid.utils';

/** Dependencies and callbacks required by {@link AgridSidebarController}. @internal */
export interface AgridSidebarControllerOptions {
  control: Signal<AgridControl | null>;
  dataSource: Signal<AgridDataSource>;
  colDefs: Signal<ColDef[]>;
  visibleColDefs: Signal<ColDef[]>;
  selectedRowIndex: Signal<number | null>;
  autoOpenDetail: Signal<boolean>;
  useSidebarEditor: Signal<boolean>;
  isCellEditable: (col: ColDef, originalIndex: number) => boolean;
  onFieldChange: (event: GridEditEvent) => void;
  onCellEdit: (event: GridEditEvent) => void;
  /** Called when a `ColDef.validate` hook rejects a sidebar value. */
  onValidationFailed: (event: { rowIndex: number; field: string; value: unknown; message: string }) => void;
}

/** Owns sidebar visibility, selected-row projection, and detail-panel edits. @internal */
export class AgridSidebarController {
  readonly open = signal(false);
  readonly tab = signal<'columns' | 'detail'>('columns');
  readonly row = computed<Record<string, unknown> | null>(() => {
    const index = this.opts.selectedRowIndex();
    return index === null ? null : this.opts.dataSource().rows()[index] ?? null;
  });
  readonly hiddenColumns = computed<ReadonlySet<string>>(
    () => this.opts.control()?.hiddenColumns() ?? new Set<string>(),
  );
  /** Per-field validation messages for rejected sidebar edits (`field → message`). */
  readonly validationErrors = signal<Record<string, string>>({});

  constructor(private readonly opts: AgridSidebarControllerOptions) {}

  /** Remove the stored validation message for one field, if any. */
  private clearFieldError(field: string): void {
    if (!(field in this.validationErrors())) return;
    this.validationErrors.update(errors => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }

  /** Opens the detail tab when automatic detail display is enabled. */
  syncAutoOpen(): void {
    if (this.opts.autoOpenDetail() && this.opts.selectedRowIndex() !== null) {
      this.open.set(true);
      this.tab.set('detail');
    }
  }

  /** Toggles sidebar visibility without changing the active tab. */
  toggle(): void {
    this.open.update(value => !value);
  }

  /** Opens the sidebar. */
  openSidebar(): void {
    this.open.set(true);
  }

  /** Closes the sidebar. */
  closeSidebar(): void {
    this.open.set(false);
  }

  /** Selects a tab, or closes the sidebar when selecting its active tab. */
  selectTab(tab: 'columns' | 'detail'): void {
    if (this.open() && this.tab() === tab) {
      this.open.set(false);
    } else {
      this.tab.set(tab);
      this.open.set(true);
    }
  }

  /** Commits an edit emitted by the sidebar component. */
  edit(event: AgridSidebarEdit): void {
    this.commitEdit(event.field, event.col, event.value);
  }

  /** Returns the currently selected data-source row index. */
  selectedRowIndex(): number | null {
    return this.opts.selectedRowIndex();
  }

  /** Coerces and commits a sidebar field value to the selected row. */
  commitEdit(field: string, col: ColDef, stringValue: string): void {
    const index = this.opts.selectedRowIndex();
    if (index === null) return;
    if (!this.opts.isCellEditable(col, index)) return;
    let newValue: unknown = stringValue;
    if (col.type === 'number') {
      newValue = stringValue === '' ? null : Number(stringValue);
    } else if (col.type === 'date') {
      newValue = coerceDateInputValue(
        stringValue,
        this.opts.dataSource().getRow(index)[field],
      );
    } else if (col.values?.length) {
      const option = col.values.find(value =>
        typeof value === 'string'
          ? value === stringValue
          : String((value as ValueOption).value) === stringValue,
      );
      newValue = option === undefined
        ? stringValue
        : typeof option === 'string' ? option : (option as ValueOption).value;
    }

    const row = this.opts.dataSource().getRow(index);
    const oldValue = row[field];
    if (oldValue === newValue) return;
    const message = col.validate?.(newValue as never, row as never) ?? null;
    if (message) {
      this.validationErrors.update(errors => ({ ...errors, [field]: message }));
      this.opts.onValidationFailed({ rowIndex: index, field, value: newValue, message });
      return;
    }
    this.clearFieldError(field);
    this.opts.dataSource().patchRow(index, { [field]: newValue });
    const colIndex = this.opts.visibleColDefs().findIndex(column => column.field === field);
    this.opts.control()?.pushEdit({ rowIndex: index, field, oldValue, newValue });
    const event = {
      position: { rowIndex: index, colIndex },
      field,
      oldValue,
      newValue,
    };
    this.opts.onFieldChange(event);
    if (!this.opts.useSidebarEditor()) {
      this.opts.onCellEdit(event);
    }
  }
}
