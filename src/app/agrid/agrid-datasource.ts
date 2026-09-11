import { Signal, WritableSignal, isWritableSignal, linkedSignal, signal } from '@angular/core';

export type AgridRowId = string | number;
export type AgridRowIdGetter<T extends object> = (row: T, index: number) => AgridRowId;

export type AgridTransactionUpdate<T extends object> =
  | T
  | Partial<T>
  | { id: AgridRowId; changes: Partial<T> }
  | { index: number; changes: Partial<T> };

export type AgridTransactionRemove<T extends object> =
  | T
  | AgridRowId
  | { id: AgridRowId }
  | { index: number };

export interface AgridTransaction<T extends object> {
  /** Rows inserted into the datasource. Defaults to appending at the end. */
  add?: readonly T[];
  /** Optional insertion index for all added rows. Values outside the row range are clamped. */
  addIndex?: number;
  /** Existing rows to patch or replace, matched by index, id, or `getRowId`. */
  update?: readonly AgridTransactionUpdate<T>[];
  /** Existing rows to remove, matched by index, id, `getRowId`, or object reference. */
  remove?: readonly AgridTransactionRemove<T>[];
}

export interface AgridTransactionOptions<T extends object> {
  /** Per-call id resolver. Falls back to the datasource/provider resolver when omitted. */
  getRowId?: AgridRowIdGetter<T>;
}

export interface AgridTransactionResult<T extends object> {
  /** Complete row records inserted by this transaction. */
  added: T[];
  /** Complete row records after their update patches were applied. */
  updated: T[];
  /** Complete row records removed by this transaction. */
  removed: T[];
  /** Final indexes where added rows were inserted. */
  addIndexes: number[];
  /** Datasource indexes updated before removals/additions were applied. */
  updateIndexes: number[];
  /** Datasource indexes removed before row shifting. */
  removeIndexes: number[];
}

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
export class AgridDataSource<T extends object = any> {
  private readonly _linkedRows = signal<Signal<T[]> | null>(null);
  private readonly _rows = linkedSignal<T[]>(() => this._linkedRows()?.() ?? []);
  private _writableLinkedRows: WritableSignal<T[]> | null = null;
  private readonly _rowAdded = signal<{ index: number; sequence: number } | null>(null);
  private readonly _unfilteredAddedRows = signal<ReadonlySet<number>>(new Set());
  private _changeSequence = 0;
  private _getRowId: AgridRowIdGetter<T> | null = null;

  /**
   * @param initialData Rows to seed the data source with.
   *   The array is shallow-copied so external mutations do not affect the source.
   */
  constructor(initialData: T[] = [], getRowId?: AgridRowIdGetter<T>) {
    this._rows.set([...initialData]);
    this._getRowId = getRowId ?? null;
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
   * Rows inserted since filters were last explicitly reapplied.
   * Attached grids include these rows even when they do not match active filters.
   * @internal
   */
  readonly ɵunfilteredAddedRows: Signal<ReadonlySet<number>> =
    this._unfilteredAddedRows.asReadonly();

  /** Install or clear the row id resolver used by transaction updates and removals. */
  setRowIdGetter(getRowId?: AgridRowIdGetter<T>): void {
    this._getRowId = getRowId ?? null;
  }

  /**
   * Link an external row signal to this data source.
   *
   * Whenever `source` changes, its array becomes the current datasource value without an
   * intermediate effect or array copy. If `source` is writable, datasource mutations are written
   * back to it automatically. Mutations remain local when linking a readonly signal.
  */
  linkSignal(source: Signal<T[]>): void {
    this._writableLinkedRows = isWritableSignal(source)
      ? source as WritableSignal<T[]>
      : null;
    this._linkedRows.set(source);
  }

  /**
   * Replace the entire row array.
   * Triggers a full grid re-render via the signal.
   */
  setData(rows: T[]): void {
    this.setRows([...rows]);
    this.ɵreapplyFiltersToAddedRows();
  }

  /**
   * Overwrite the row at `index` with a new row object.
   * Use {@link patchRow} when you only want to change specific fields.
   */
  updateRow(index: number, row: T): void {
    this.updateRows(rows => {
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
    this.updateRows(rows => {
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
    this.updateRows(rows => {
      if (atIndex === undefined) {
        insertedAt = rows.length;
        return [...rows, row];
      }
      insertedAt = atIndex;
      const next = [...rows];
      next.splice(atIndex, 0, row);
      return next;
    });
    this._unfilteredAddedRows.update(current => {
      const next = new Set<number>();
      for (const index of current) next.add(index >= insertedAt ? index + 1 : index);
      next.add(insertedAt);
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
    this.updateRows(rows => rows.filter((_, i) => i !== index));
    this._unfilteredAddedRows.update(current => {
      const next = new Set<number>();
      for (const addedIndex of current) {
        if (addedIndex < index) next.add(addedIndex);
        else if (addedIndex > index) next.add(addedIndex - 1);
      }
      return next;
    });
  }

  /**
   * Apply add/update/remove operations in one datasource write.
   *
   * Updates are resolved before removals, then additions are inserted last. The returned
   * `updated` rows are the complete post-update records, so callers can send them directly to
   * APIs that support PATCHing arrays of full records.
   */
  applyTransaction(
    transaction: AgridTransaction<T>,
    options: AgridTransactionOptions<T> = {},
  ): AgridTransactionResult<T> {
    const currentRows = this._rows();
    const nextRows = [...currentRows];
    const getRowId = options.getRowId ?? this._getRowId ?? undefined;
    const idToIndex = getRowId ? this.buildRowIdIndex(currentRows, getRowId) : null;
    const updated: T[] = [];
    const updateIndexes: number[] = [];

    for (const update of transaction.update ?? []) {
      const resolved = this.resolveUpdate(update, currentRows, idToIndex, getRowId);
      if (!resolved || resolved.index < 0 || resolved.index >= nextRows.length) continue;
      const merged = { ...nextRows[resolved.index], ...resolved.changes } as T;
      nextRows[resolved.index] = merged;
      updated.push(merged);
      updateIndexes.push(resolved.index);
    }

    const removeIndexes = this.resolveRemoveIndexes(
      transaction.remove ?? [],
      currentRows,
      idToIndex,
      getRowId,
    );
    const removed = removeIndexes
      .map(index => nextRows[index])
      .filter((row): row is T => row !== undefined);
    for (const index of [...removeIndexes].sort((a, b) => b - a)) {
      nextRows.splice(index, 1);
    }

    const addRows = [...(transaction.add ?? [])];
    const insertAt = this.clampInsertIndex(transaction.addIndex, nextRows.length);
    nextRows.splice(insertAt, 0, ...addRows);
    const addIndexes = addRows.map((_, offset) => insertAt + offset);

    if (updated.length || removed.length || addRows.length) {
      this.setRows(nextRows);
      this.reconcileUnfilteredAddedRows(removeIndexes, insertAt, addRows.length, addIndexes);
      if (addIndexes.length) {
        this._rowAdded.set({
          index: addIndexes[addIndexes.length - 1],
          sequence: ++this._changeSequence,
        });
      }
    }

    return {
      added: addRows,
      updated,
      removed,
      addIndexes,
      updateIndexes,
      removeIndexes,
    };
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
    let insertedAt = from;
    this.updateRows(rows => {
      const arr = [...rows];
      const [item] = arr.splice(from, 1);
      insertedAt = to > from ? to - 1 : to;
      arr.splice(insertedAt, 0, item);
      return arr;
    });
    this._unfilteredAddedRows.update(current => {
      const next = new Set<number>();
      for (const index of current) {
        if (index === from) {
          next.add(insertedAt);
          continue;
        }
        let moved = index;
        if (moved > from) moved -= 1;
        if (moved >= insertedAt) moved += 1;
        next.add(moved);
      }
      return next;
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

  private updateRows(update: (rows: T[]) => T[]): void {
    this.setRows(update(this._rows()));
  }

  private buildRowIdIndex(rows: readonly T[], getRowId: AgridRowIdGetter<T>): Map<AgridRowId, number> {
    const idToIndex = new Map<AgridRowId, number>();
    rows.forEach((row, index) => idToIndex.set(getRowId(row, index), index));
    return idToIndex;
  }

  private resolveUpdate(
    update: AgridTransactionUpdate<T>,
    rows: readonly T[],
    idToIndex: Map<AgridRowId, number> | null,
    getRowId?: AgridRowIdGetter<T>,
  ): { index: number; changes: Partial<T> } | null {
    if (this.isObject(update) && 'changes' in update) {
      const changes = (update as { changes: Partial<T> }).changes;
      if (typeof (update as { index?: unknown }).index === 'number') {
        return { index: (update as { index: number }).index, changes };
      }
      if ('id' in update && idToIndex) {
        const index = idToIndex.get((update as { id: AgridRowId }).id);
        return index === undefined ? null : { index, changes };
      }
    }

    if (!this.isObject(update) || !getRowId || !idToIndex) return null;
    const id = getRowId(update as T, -1);
    const index = idToIndex.get(id);
    return index === undefined ? null : { index, changes: update as Partial<T> };
  }

  private resolveRemoveIndexes(
    removals: readonly AgridTransactionRemove<T>[],
    rows: readonly T[],
    idToIndex: Map<AgridRowId, number> | null,
    getRowId?: AgridRowIdGetter<T>,
  ): number[] {
    const indexes = new Set<number>();
    for (const removal of removals) {
      const index = this.resolveRemoveIndex(removal, rows, idToIndex, getRowId);
      if (index !== null && index >= 0 && index < rows.length) indexes.add(index);
    }
    return [...indexes].sort((a, b) => a - b);
  }

  private resolveRemoveIndex(
    removal: AgridTransactionRemove<T>,
    rows: readonly T[],
    idToIndex: Map<AgridRowId, number> | null,
    getRowId?: AgridRowIdGetter<T>,
  ): number | null {
    if (this.isObject(removal) && typeof (removal as { index?: unknown }).index === 'number') {
      return (removal as { index: number }).index;
    }
    if (this.isObject(removal) && 'id' in removal && idToIndex) {
      return idToIndex.get((removal as { id: AgridRowId }).id) ?? null;
    }
    if ((typeof removal === 'string' || typeof removal === 'number') && idToIndex) {
      return idToIndex.get(removal) ?? null;
    }
    if (this.isObject(removal)) {
      if (getRowId && idToIndex) {
        return idToIndex.get(getRowId(removal as T, -1)) ?? null;
      }
      const index = rows.indexOf(removal as T);
      return index === -1 ? null : index;
    }
    return null;
  }

  private clampInsertIndex(index: number | undefined, length: number): number {
    if (index === undefined || Number.isNaN(index)) return length;
    return Math.max(0, Math.min(Math.trunc(index), length));
  }

  private reconcileUnfilteredAddedRows(
    removeIndexes: readonly number[],
    insertAt: number,
    addCount: number,
    addIndexes: readonly number[],
  ): void {
    if (!removeIndexes.length && !addCount) return;
    this._unfilteredAddedRows.update(current => {
      const next = new Set<number>();
      for (const originalIndex of current) {
        if (removeIndexes.includes(originalIndex)) continue;
        const removedBefore = removeIndexes.filter(index => index < originalIndex).length;
        let moved = originalIndex - removedBefore;
        if (addCount && moved >= insertAt) moved += addCount;
        next.add(moved);
      }
      for (const index of addIndexes) next.add(index);
      return next;
    });
  }

  private isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
  }

  /** Replace the backing row array without copying. Intended for specialized datasource models. */
  protected setRows(rows: T[]): void {
    this._writableLinkedRows?.set(rows);
    this._rows.set(rows);
  }

  /** @internal Clears the transient filter bypass applied to newly inserted rows. */
  ɵreapplyFiltersToAddedRows(): void {
    this._unfilteredAddedRows.set(new Set());
  }
}
