import { Signal, signal } from '@angular/core';
import { AgridControl, ColumnFilter } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';

const SERVER_ROW_PLACEHOLDER = Symbol('agrid-server-row-placeholder');

type ServerRowPlaceholder = { readonly [SERVER_ROW_PLACEHOLDER]: true };
const PLACEHOLDER: ServerRowPlaceholder = { [SERVER_ROW_PLACEHOLDER]: true };

/** Sort entry sent to a server-side row datasource. */
export interface AgridServerSideSort {
  field: string;
  direction: 'asc' | 'desc';
}

/** Immutable request for one half-open row block (`startRow <= row < endRow`). */
export interface AgridServerSideRequest {
  startRow: number;
  endRow: number;
  filters: Readonly<Record<string, ColumnFilter>>;
  sort: readonly AgridServerSideSort[];
  quickFilter: string;
}

/** Rows returned by a server-side datasource. Supply `rowCount` when the total is known. */
export interface AgridServerSideResult<T extends object> {
  rows: T[];
  rowCount?: number;
}

/** Fetches blocks for {@link AgridServerSideRowModel}. */
export interface AgridServerSideDatasource<T extends object> {
  getRows(request: AgridServerSideRequest): Promise<AgridServerSideResult<T>>;
}

/** Configuration for the lazy, block-cached server-side row model. */
export interface AgridServerSideRowModelConfig<T extends object> {
  datasource: AgridServerSideDatasource<T>;
  /** Number of rows requested per block. @default 100 */
  blockSize?: number;
  /** Maximum loaded blocks retained in memory. @default 10 */
  maxBlocksInCache?: number;
  /** Known initial total. Omit when the server determines it from the first request. */
  initialRowCount?: number;
}

interface ServerQuery {
  filters: Record<string, ColumnFilter>;
  sort: AgridServerSideSort[];
  quickFilter: string;
}

/** Refresh behavior for server-side block cache invalidation. */
export interface AgridServerSideRefreshOptions {
  /** When `true`, clear all cached rows and replace them with placeholders. @default true */
  purge?: boolean;
}

/**
 * Sparse datasource that lazy-loads row blocks while retaining global datasource indices.
 * Attach it to an `AgridProvider` through `serverSideRowModel`.
 */
export class AgridServerSideRowModel<T extends object = any> extends AgridDataSource<T> {
  readonly blockSize: number;
  readonly maxBlocksInCache: number;

  private readonly remote: AgridServerSideDatasource<T>;
  private slots: (T | ServerRowPlaceholder)[] = [];
  private readonly loadedBlocks = new Map<number, number>();
  private readonly loadingBlocks = new Set<number>();
  private readonly failedBlocks = new Set<number>();
  private query: ServerQuery = { filters: {}, sort: [], quickFilter: '' };
  private queryKey = '';
  private generation = 0;
  private accessSequence = 0;
  private knownRowCount = false;
  private readonly _loading = signal(false);
  private readonly _error = signal<unknown | null>(null);
  private readonly _rowCount = signal(0);

  /** Whether at least one block request is in flight. */
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  /** Most recent load error, cleared by the next successful request or refresh. */
  readonly error: Signal<unknown | null> = this._error.asReadonly();
  /** Current logical row count represented by the virtual scrollbar. */
  readonly rowCount: Signal<number> = this._rowCount.asReadonly();

  constructor(config: AgridServerSideRowModelConfig<T>) {
    super();
    this.remote = config.datasource;
    this.blockSize = Math.max(1, Math.floor(config.blockSize ?? 100));
    this.maxBlocksInCache = Math.max(1, Math.floor(config.maxBlocksInCache ?? 10));
    const initial = config.initialRowCount;
    this.knownRowCount = initial !== undefined;
    this.replaceSlots(this.createPlaceholders(Math.max(0, initial ?? this.blockSize)));
  }

  /** Update server query state. A changed query invalidates cached blocks and starts at row zero. */
  setQuery(control: AgridControl | null, sortFields: readonly string[]): boolean {
    const filters = cloneFilters(control?.filters() ?? {});
    const sort = sortFields.flatMap(field => {
      const direction = filters[field]?.sort;
      return direction ? [{ field, direction }] : [];
    });
    const quickFilter = control?.quickFilter() ?? '';
    const key = JSON.stringify({ filters, sort, quickFilter });
    if (key === this.queryKey) return false;
    this.queryKey = key;
    this.query = { filters, sort, quickFilter };
    this.reset();
    return true;
  }

  /** Invalidate cached blocks while preserving the current query and known total row count. */
  refresh(options: AgridServerSideRefreshOptions = {}): void {
    const purge = options.purge ?? true;
    this.generation++;
    this.loadingBlocks.clear();
    this.failedBlocks.clear();
    this._loading.set(false);
    this._error.set(null);
    if (purge) {
      this.loadedBlocks.clear();
      const length = this.knownRowCount ? this._rowCount() : this.blockSize;
      this.replaceSlots(this.createPlaceholders(length));
    } else {
      this.loadedBlocks.clear();
    }
  }

  /** Clear the block cache and show placeholders until requested blocks are reloaded. */
  purgeCache(): void {
    this.refresh({ purge: true });
  }

  /** Retry the most recently failed block, or a specific block index when supplied. */
  retryFailedBlock(block?: number): void {
    const target = block ?? [...this.failedBlocks].at(-1);
    if (target === undefined) return;
    this.failedBlocks.delete(target);
    this.loadedBlocks.delete(target);
    void this.loadBlock(target);
  }

  /** Failed block indices that can be passed to {@link retryFailedBlock}. */
  failedBlockIndices(): number[] {
    return [...this.failedBlocks].sort((left, right) => left - right);
  }

  /** Ensure every block intersecting the requested half-open range is loaded. */
  ensureRange(startRow: number, endRow: number): void {
    const count = this.slots.length;
    if (!count) return;
    const start = Math.max(0, Math.min(Math.floor(startRow), count - 1));
    const end = Math.max(start + 1, Math.min(Math.ceil(endRow), count));
    const firstBlock = Math.floor(start / this.blockSize);
    const lastBlock = Math.floor((end - 1) / this.blockSize);
    for (let block = firstBlock; block <= lastBlock; block++) void this.loadBlock(block);
  }

  /** Whether a logical datasource row has not been loaded yet. */
  isPlaceholder(index: number): boolean {
    return isServerRowPlaceholder(this.slots[index]);
  }

  private reset(): void {
    this.generation++;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.failedBlocks.clear();
    this._loading.set(false);
    this._error.set(null);
    const length = this.knownRowCount ? this._rowCount() : this.blockSize;
    this.replaceSlots(this.createPlaceholders(length));
  }

  private async loadBlock(block: number): Promise<void> {
    if (this.loadedBlocks.has(block) || this.loadingBlocks.has(block)) {
      if (this.loadedBlocks.has(block)) this.loadedBlocks.set(block, ++this.accessSequence);
      return;
    }
    const startRow = block * this.blockSize;
    if (startRow >= this.slots.length) return;
    const endRow = Math.min(startRow + this.blockSize, this.slots.length);
    const generation = this.generation;
    this.loadingBlocks.add(block);
    this._loading.set(true);
    try {
      const result = await this.remote.getRows({
        startRow,
        endRow,
        filters: this.query.filters,
        sort: this.query.sort,
        quickFilter: this.query.quickFilter,
      });
      if (generation !== this.generation) return;
      this.applyBlock(block, startRow, result);
      this.failedBlocks.delete(block);
      this._error.set(null);
    } catch (error) {
      if (generation === this.generation) {
        this.failedBlocks.add(block);
        this._error.set(error);
      }
    } finally {
      if (generation === this.generation) {
        this.loadingBlocks.delete(block);
        this._loading.set(this.loadingBlocks.size > 0);
      }
    }
  }

  private applyBlock(block: number, startRow: number, result: AgridServerSideResult<T>): void {
    if (result.rowCount !== undefined) {
      this.knownRowCount = true;
      this.resize(Math.max(0, Math.floor(result.rowCount)));
    } else if (result.rows.length < this.blockSize) {
      this.knownRowCount = true;
      this.resize(startRow + result.rows.length);
    } else if (!this.knownRowCount && startRow + result.rows.length >= this.slots.length) {
      this.resize(this.slots.length + this.blockSize);
    }

    const next = [...this.slots];
    for (let index = 0; index < result.rows.length; index++) {
      const target = startRow + index;
      if (target >= next.length) break;
      next[target] = result.rows[index];
    }
    this.loadedBlocks.set(block, ++this.accessSequence);
    this.evictBlocks(block, next);
    this.replaceSlots(next);
  }

  private evictBlocks(activeBlock: number, slots: (T | ServerRowPlaceholder)[]): void {
    while (this.loadedBlocks.size > this.maxBlocksInCache) {
      const candidate = [...this.loadedBlocks]
        .filter(([block]) => block !== activeBlock)
        .sort((left, right) => left[1] - right[1])[0];
      if (!candidate) return;
      const [block] = candidate;
      this.loadedBlocks.delete(block);
      const start = block * this.blockSize;
      const end = Math.min(start + this.blockSize, slots.length);
      for (let index = start; index < end; index++) slots[index] = placeholder();
    }
  }

  private resize(length: number): void {
    if (length === this.slots.length) return;
    if (length < this.slots.length) this.slots = this.slots.slice(0, length);
    else this.slots = [...this.slots, ...this.createPlaceholders(length - this.slots.length)];
    this._rowCount.set(length);
  }

  private replaceSlots(slots: (T | ServerRowPlaceholder)[]): void {
    this.slots = slots;
    this._rowCount.set(slots.length);
    this.setRows(slots as T[]);
  }

  private createPlaceholders(length: number): ServerRowPlaceholder[] {
    return Array.from({ length }, () => placeholder());
  }
}

/** @internal */
export function isServerRowPlaceholder(value: unknown): value is ServerRowPlaceholder {
  return !!value && typeof value === 'object' && SERVER_ROW_PLACEHOLDER in value;
}

function placeholder(): ServerRowPlaceholder {
  return PLACEHOLDER;
}

function cloneFilters(filters: Record<string, ColumnFilter>): Record<string, ColumnFilter> {
  return Object.fromEntries(Object.entries(filters).map(([field, filter]) => [field, {
    ...filter,
    selectedValues: filter.selectedValues ? [...filter.selectedValues] : null,
  }]));
}
