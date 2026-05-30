import { Signal, signal } from '@angular/core';

export class AgridDataSource<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly _rows = signal<T[]>([]);

  constructor(initialData: T[] = []) {
    this._rows.set([...initialData]);
  }

  /** Signal of the current rows — reactive in templates and computed() */
  readonly rows: Signal<T[]> = this._rows.asReadonly();

  /** Replace all rows */
  setData(rows: T[]): void {
    this._rows.set([...rows]);
  }

  /** Overwrite a single row at index */
  updateRow(index: number, row: T): void {
    this._rows.update(rows => {
      const next = [...rows];
      next[index] = row;
      return next;
    });
  }

  /** Merge partial fields into a row (non-destructive update) */
  patchRow(index: number, patch: Partial<T>): void {
    this._rows.update(rows => {
      const next = [...rows];
      next[index] = { ...next[index], ...patch } as T;
      return next;
    });
  }

  /** Add a row at the end (or at a specific index). Returns the inserted index. */
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
    return insertedAt;
  }

  /** Remove a row by index */
  removeRow(index: number): void {
    this._rows.update(rows => rows.filter((_, i) => i !== index));
  }

  /** Read the current row at index */
  getRow(index: number): T {
    return this._rows()[index];
  }

  get length(): number {
    return this._rows().length;
  }
}
