import { Signal, signal } from '@angular/core';

/**
 * Signal-based data container shared between the grid and the host component.
 *
 * Both the grid and the host component hold a reference to the same `AgridDataSource`
 * instance. Mutations made by either side (e.g. the grid calling `patchRow` when a cell
 * is committed, or the host calling `setData` to load fresh data) are immediately reflected
 * in the grid because {@link rows} is a readonly Angular signal.
 *
 * @example
 * ```ts
 * readonly ds = new AgridDataSource(generateRows(1000));
 *
 * // Later — update one row from outside the grid:
 * this.ds.patchRow(5, { salary: 99000 });
 * ```
 */
export class AgridDataSource<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly _rows = signal<T[]>([]);
  private readonly _rowAdded = signal<{ index: number; sequence: number } | null>(null);
  private _changeSequence = 0;

  /**
   * @param initialData Rows to seed the data source with.
   *   The array is shallow-copied so external mutations do not affect the source.
   */
  constructor(initialData: T[] = []) {
    this._rows.set([...initialData]);
  }

  /**
   * Readonly signal of the current row array.
   * Read it inside Angular templates or `computed()` to react to changes automatically.
   */
  readonly rows: Signal<T[]> = this._rows.asReadonly();

  /** Latest row insertion, used by attached grids to reveal the inserted row. */
  readonly rowAdded: Signal<{ index: number; sequence: number } | null> =
    this._rowAdded.asReadonly();

  /**
   * Replace the entire row array.
   * Triggers a full grid re-render via the signal.
   */
  setData(rows: T[]): void {
    this._rows.set([...rows]);
  }

  /**
   * Overwrite the row at `index` with a new row object.
   * Use {@link patchRow} when you only want to change specific fields.
   */
  updateRow(index: number, row: T): void {
    this._rows.update(rows => {
      const next = [...rows];
      next[index] = row;
      return next;
    });
  }

  /**
   * Merge `patch` into the existing row at `index`, leaving other fields untouched.
   * The grid calls this internally when a cell edit is committed.
   */
  patchRow(index: number, patch: Partial<T>): void {
    this._rows.update(rows => {
      const next = [...rows];
      next[index] = { ...next[index], ...patch } as T;
      return next;
    });
  }

  /**
   * Insert a row into the data source and return the index at which it was inserted.
   *
   * @param row The row object to insert.
   * @param atIndex Optional insertion index. Defaults to the end of the array.
   * @returns The index the row was inserted at.
   */
  addRow(row: T, atIndex?: number): number {
    let insertedAt!: number;
    this._rows.update(rows => {
      if (atIndex === undefined) {
        insertedAt = rows.length;
        return [...rows, row];
      }
      insertedAt = atIndex;
      const next = [...rows];
      next.splice(atIndex, 0, row);
      return next;
    });
    this._rowAdded.set({ index: insertedAt, sequence: ++this._changeSequence });
    return insertedAt;
  }

  /**
   * Remove the row at `index`.
   * The grid adjusts `selectedCell` and `editingCell` internally when a deletion occurs
   * via the control column context menu.
   */
  removeRow(index: number): void {
    this._rows.update(rows => rows.filter((_, i) => i !== index));
  }

  /**
   * Move the row at `from` to position `to` (insert-before semantics).
   * Designed to be called directly from a `(rowReorder)` handler:
   * ```ts
   * onReorder(e: RowReorderEvent) { this.ds.moveRow(e.oldIndex, e.newIndex); }
   * ```
   */
  moveRow(from: number, to: number): void {
    if (from === to) return;
    this._rows.update(rows => {
      const arr = [...rows];
      const [item] = arr.splice(from, 1);
      arr.splice(to > from ? to - 1 : to, 0, item);
      return arr;
    });
  }

  /** Return the current row at `index` (non-reactive snapshot). */
  getRow(index: number): T {
    return this._rows()[index];
  }

  /** Current number of rows (non-reactive snapshot). */
  get length(): number {
    return this._rows().length;
  }
}
