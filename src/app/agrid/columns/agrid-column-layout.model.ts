import { Signal, computed } from '@angular/core';
import { AgridControl } from '../agrid-control';
import { ColDef } from '../agrid.types';

/** Reactive inputs required by {@link AgridColumnLayoutModel}. @internal */
export interface AgridColumnLayoutOptions {
  control: Signal<AgridControl | null>;
  colDefs: Signal<ColDef[]>;
  showControlColumn: Signal<boolean>;
  getColumnWidth: (col: ColDef) => number;
  getColumnWidthToken: (col: ColDef) => string;
}

/**
 * Computes visible, ordered, pinned, and scrollable columns plus pane dimensions.
 * @internal
 */
export class AgridColumnLayoutModel {
  constructor(private readonly opts: AgridColumnLayoutOptions) {}

  /** Columns visible after hidden state, ordering, and left-pinning are applied. */
  readonly visibleColDefs = computed(() => {
    const control = this.opts.control();
    let columns = control
      ? this.opts.colDefs().filter(col => !control.hiddenColumns().has(col.field))
      : this.opts.colDefs().filter(col => !col.hidden);

    if (control) {
      const order = control.columnOrder();
      if (order.length > 0) {
        const orderMap = new Map(order.map((field, index) => [field, index]));
        columns = [...columns].sort((a, b) =>
          (orderMap.get(a.field) ?? Infinity) - (orderMap.get(b.field) ?? Infinity)
        );
      }
      const pinned = control.pinnedColumns();
      if (pinned.size > 0) {
        columns = [
          ...columns.filter(col => pinned.has(col.field)),
          ...columns.filter(col => !pinned.has(col.field)),
        ];
      }
    } else {
      const pinned = columns.filter(col => col.pinned === 'left');
      if (pinned.length > 0) {
        columns = [...pinned, ...columns.filter(col => col.pinned !== 'left')];
      }
    }
    return columns;
  });

  /** Visible columns pinned to the left edge. */
  readonly pinnedColDefs = computed(() => {
    const control = this.opts.control();
    if (control) {
      const pinned = control.pinnedColumns();
      return pinned.size > 0
        ? this.visibleColDefs().filter(col => pinned.has(col.field))
        : [];
    }
    return this.visibleColDefs().filter(col => col.pinned === 'left');
  });

  /** Visible columns pinned to the right edge. */
  readonly rightPinnedColDefs = computed(() => {
    const control = this.opts.control();
    if (control) {
      const pinned = control.pinnedRightColumns();
      return pinned.size > 0
        ? this.visibleColDefs().filter(col => pinned.has(col.field))
        : [];
    }
    return this.visibleColDefs().filter(col => col.pinned === 'right');
  });

  /** Visible columns rendered in the horizontally scrollable pane. */
  readonly scrollableColDefs = computed(() => {
    const left = new Set(this.pinnedColDefs().map(col => col.field));
    const right = new Set(this.rightPinnedColDefs().map(col => col.field));
    return this.visibleColDefs().filter(col => !left.has(col.field) && !right.has(col.field));
  });

  readonly hasPinnedPane = computed(() =>
    this.opts.showControlColumn() || this.pinnedColDefs().length > 0
  );
  readonly hasRightPinnedPane = computed(() => this.rightPinnedColDefs().length > 0);
  readonly hasFilterableColumns = computed(() =>
    this.visibleColDefs().some(col => col.filterable)
  );

  readonly gridTemplateColumns = computed(() => {
    const columns = this.widthTokens(this.visibleColDefs());
    return this.opts.showControlColumn() ? `24px ${columns}` : columns;
  });

  readonly pinnedGridTemplateColumns = computed(() => {
    const columns = this.widthTokens(this.pinnedColDefs());
    if (this.opts.showControlColumn()) return columns ? `24px ${columns}` : '24px';
    return columns;
  });

  readonly scrollableGridTemplateColumns = computed(() =>
    this.widthTokens(this.scrollableColDefs())
  );
  readonly rightGridTemplateColumns = computed(() =>
    this.widthTokens(this.rightPinnedColDefs())
  );

  readonly totalWidth = computed(() =>
    this.width(this.visibleColDefs()) + (this.opts.showControlColumn() ? 24 : 0)
  );
  readonly pinnedPaneWidth = computed(() =>
    this.width(this.pinnedColDefs()) + (this.opts.showControlColumn() ? 24 : 0)
  );
  readonly rightPinnedPaneWidth = computed(() => this.width(this.rightPinnedColDefs()));
  readonly scrollableTotalWidth = computed(() => this.width(this.scrollableColDefs()));

  private width(columns: ColDef[]): number {
    return columns.reduce((sum, col) => sum + this.opts.getColumnWidth(col), 0);
  }

  private widthTokens(columns: ColDef[]): string {
    return columns.map(col => this.opts.getColumnWidthToken(col)).join(' ');
  }
}
