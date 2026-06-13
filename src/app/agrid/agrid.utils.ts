import { ColumnFilter } from './agrid-control';
import { ColDef, GridItem, TreeRowItem, ValueOption } from './agrid.types';

// Display resolution

// Matches YYYY-MM-DD with optional time component — strict enough to avoid false positives.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Returns true if the value is a Date object or an ISO date string. */
export function looksLikeDate(raw: unknown): boolean {
  if (raw instanceof Date) return true;
  if (typeof raw === 'string') return ISO_DATE_RE.test(raw.trim());
  return false;
}

/**
 * Formats a raw value as a human-readable date string.
 * Accepts Date objects and ISO strings.
 * Returns empty string for null/undefined, raw string if unparseable.
 */
export function formatDateValue(raw: unknown, locale?: string, calendarDate = false): string {
  if (raw == null || raw === '') return '';
  const dateInputValue = calendarDate ? getDateInputValue(raw) : '';
  const d = dateInputValue
    ? new Date(`${dateInputValue}T00:00:00.000Z`)
    : raw instanceof Date ? raw : new Date(raw as string);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(calendarDate ? { timeZone: 'UTC' } : {}),
  });
}

/** Converts a supported date value to the `YYYY-MM-DD` format required by date inputs. */
export function getDateInputValue(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const date = raw instanceof Date ? raw : new Date(raw as string);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/**
 * Converts a date input value back to the storage form used by the original value.
 *
 * `Date` objects remain `Date` objects. ISO timestamps retain their original time and zone
 * suffix, while date-only strings and previously empty values remain date-only strings.
 */
export function coerceDateInputValue(value: string, originalValue: unknown): unknown {
  if (value === '') return '';
  if (originalValue instanceof Date) return new Date(`${value}T00:00:00.000Z`);
  if (
    typeof originalValue === 'string'
    && /^\d{4}-\d{2}-\d{2}T/.test(originalValue)
  ) {
    return `${value}${originalValue.slice(10)}`;
  }
  return value;
}

/** Resolve the display string for a raw cell value via ValueOption label, formatter, or coercion. */
export function getDisplayForField(col: ColDef | undefined, raw: unknown, locale?: string): string {
  if (!col) return String(raw ?? '');
  if (col.values?.length) {
    const opt = col.values.find(v =>
      typeof v === 'string' ? v === raw : (v as ValueOption).value === raw
    );
    if (opt !== undefined) return typeof opt === 'string' ? opt : (opt as ValueOption).label;
  }
  if (col.formatter) return col.formatter(raw);
  if (col.type === 'date' || looksLikeDate(raw)) {
    return formatDateValue(raw, locale, col.type === 'date');
  }
  return String(raw ?? '');
}

/** Returns whether a virtual-scroll item represents a data row. */
export function isDataRowItem(item: GridItem): item is { row: Record<string, unknown>; originalIndex: number } {
  return typeof item === 'object' && item !== null && 'row' in item;
}

/** Returns whether a virtual-scroll item represents a group header. */
export function isGroupHeaderItem(
  item: GridItem,
): item is { groupLabel: string; count: number; collapsed: boolean; aggregates?: Record<string, unknown> } {
  return typeof item === 'object' && item !== null && 'groupLabel' in item;
}

/**
 * Returns whether a virtual-scroll item represents a tree row.
 *
 * Tree rows also pass {@link isDataRowItem} (they carry `row` + `originalIndex`); this guard
 * additionally narrows to the indentation/expansion fields via the `level` discriminator.
 */
export function isTreeRowItem<T extends object>(item: GridItem<T>): item is TreeRowItem<T> {
  return typeof item === 'object' && item !== null && 'level' in item;
}

// Filtering

/** Apply text substring and value-set filters, returning the surviving row indices. */
export function applyTextAndValueFilters(
  rows: Record<string, unknown>[],
  indices: number[],
  filters: Record<string, ColumnFilter>,
  colMap: Map<string, ColDef>,
  locale?: string,
): number[] {
  let result = indices;
  for (const [field, filter] of Object.entries(filters)) {
    const col = colMap.get(field);
    if (filter.text) {
      const lc = filter.text.toLowerCase();
      result = result.filter(i => getDisplayForField(col, rows[i][field], locale).toLowerCase().includes(lc));
    }
    if (filter.selectedValues !== null) {
      const allowed = new Set(filter.selectedValues);
      result = result.filter(i => allowed.has(String(rows[i][field] ?? '')));
    }
    if (filter.operator && filter.operand != null && filter.operand !== '') {
      result = result.filter(i => passesRangeFilter(col, rows[i][field], filter));
    }
  }
  return result;
}

/**
 * Evaluate a typed range filter (`number` / `date`) for one cell value.
 * Date columns compare epoch-millis; everything else compares as numbers.
 * Rows whose value can't be parsed to the comparison type are excluded.
 */
export function passesRangeFilter(
  col: ColDef | undefined,
  raw: unknown,
  filter: ColumnFilter,
): boolean {
  const isDate = col?.type === 'date' || looksLikeDate(raw);
  const toNum = (v: unknown): number =>
    isDate
      ? (v instanceof Date ? v.getTime() : new Date(v as string).getTime())
      : Number(v);
  const value = toNum(raw);
  if (Number.isNaN(value)) return false;
  const a = toNum(filter.operand);
  if (Number.isNaN(a)) return true;
  switch (filter.operator) {
    case 'eq':  return value === a;
    case 'neq': return value !== a;
    case 'gt':  return value > a;
    case 'gte': return value >= a;
    case 'lt':  return value < a;
    case 'lte': return value <= a;
    case 'between': {
      const b = toNum(filter.operand2);
      if (Number.isNaN(b)) return value >= a;
      return value >= Math.min(a, b) && value <= Math.max(a, b);
    }
    default: return true;
  }
}

/**
 * Keep only the rows where at least one of the given columns' display value contains
 * `text` (case-insensitive). An empty/whitespace `text` returns the indices unchanged.
 */
export function applyQuickFilter(
  rows: Record<string, unknown>[],
  indices: number[],
  text: string,
  cols: ColDef[],
  locale?: string,
): number[] {
  const q = text.trim().toLowerCase();
  if (!q) return indices;
  return indices.filter(i =>
    cols.some(col => getDisplayForField(col, rows[i][col.field], locale).toLowerCase().includes(q)),
  );
}

// Sorting

/**
 * Sort indices by one or more columns in priority order.
 * Each entry is `[field, ColumnFilter]`; the first entry has the highest priority.
 * Ties are broken by subsequent entries.
 */
export function applySortToIndices(
  rows: Record<string, unknown>[],
  indices: number[],
  sortEntries: [string, ColumnFilter][],
  colMap: Map<string, ColDef>,
  locale?: string,
): number[] {
  if (sortEntries.length === 0) return indices;

  interface SortKey {
    display: string;
    dateLike: boolean;
    dateValue: number;
    numericValue: number | null;
  }

  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const fields = sortEntries.map(([field, filter]) => ({
    field,
    direction: filter.sort === 'desc' ? -1 : 1,
    col: colMap.get(field),
  }));
  const decorated = indices.map((index, position) => ({
    index,
    position,
    keys: fields.map(({ field, col }): SortKey => {
      const raw = rows[index][field];
      const dateLike = col?.type === 'date' || looksLikeDate(raw);
      const dateValue = dateLike
        ? raw instanceof Date ? raw.getTime() : new Date(raw as string).getTime()
        : Number.NaN;
      const numericValue = col?.type === 'number'
        && !col.formatter
        && !col.values?.length
        && typeof raw === 'number'
        && Number.isFinite(raw)
        ? raw
        : null;
      return {
        display: dateLike ? '' : getDisplayForField(col, raw, locale),
        dateLike,
        dateValue: Number.isNaN(dateValue) ? -1 : dateValue,
        numericValue,
      };
    }),
  }));

  decorated.sort((a, b) => {
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      const keyA = a.keys[fieldIndex];
      const keyB = b.keys[fieldIndex];
      let comparison: number;
      if (keyA.dateLike || keyB.dateLike) {
        comparison = keyA.dateValue - keyB.dateValue;
      } else if (keyA.numericValue !== null && keyB.numericValue !== null) {
        comparison = keyA.numericValue - keyB.numericValue;
      } else {
        comparison = collator.compare(keyA.display, keyB.display);
      }
      if (comparison !== 0) {
        return comparison * fields[fieldIndex].direction;
      }
    }
    return a.position - b.position;
  });

  return decorated.map(item => item.index);
}

// Grouping

/**
 * Bucket rows by the display value of `groupField`, sort group keys alphabetically,
 * optionally sort within groups by a secondary sort, and interleave group-header items.
 * Does NOT append the add-row null sentinel — the caller does that.
 */
/** Built-in aggregate function names supported by the footer and group subtotals. */
type BuiltinAggregate = 'sum' | 'avg' | 'min' | 'max' | 'count';

/**
 * Compute aggregate values for the given rows across every column that has a static
 * (`ColDef.aggregate`) or control-configured aggregate. Returns a `field → value` map containing
 * only aggregated columns. Shared by the grid footer and per-group subtotals.
 */
export function computeAggregates(
  rows: Record<string, unknown>[],
  indices: number[],
  cols: ColDef[],
  controlAggregates: Record<string, BuiltinAggregate>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const col of cols) {
    const aggregate: ColDef['aggregate'] = controlAggregates[col.field] ?? col.aggregate;
    if (!aggregate) continue;
    const values = indices.map(index => rows[index][col.field]);
    if (typeof aggregate === 'function') {
      result[col.field] = (aggregate as (values: unknown[]) => unknown)(values);
      continue;
    }
    const numbers = values.map(Number).filter(value => !Number.isNaN(value));
    switch (aggregate) {
      case 'sum':
        result[col.field] = numbers.reduce((sum, value) => sum + value, 0);
        break;
      case 'avg':
        result[col.field] = numbers.length
          ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
          : null;
        break;
      case 'min':
        result[col.field] = numbers.length ? Math.min(...numbers) : null;
        break;
      case 'max':
        result[col.field] = numbers.length ? Math.max(...numbers) : null;
        break;
      case 'count':
        result[col.field] = values.filter(value => value != null && value !== '').length;
        break;
    }
  }
  return result;
}

export function buildGroupedItems(
  rows: Record<string, unknown>[],
  indices: number[],
  groupField: string,
  colMap: Map<string, ColDef>,
  sortEntries: [string, ColumnFilter][],
  expandedLabels: Set<string>,
  locale?: string,
  aggregateCols: ColDef[] = [],
  controlAggregates: Record<string, BuiltinAggregate> = {},
): GridItem[] {
  const hasAggregates = aggregateCols.some(
    col => controlAggregates[col.field] ?? col.aggregate,
  );
  const groupCol = colMap.get(groupField);

  const groups = new Map<string, number[]>();
  for (const i of indices) {
    const key = getDisplayForField(groupCol, rows[i][groupField], locale);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) =>
    a.localeCompare(b, locale, { sensitivity: 'base' })
  );

  const nonGroupSorts = sortEntries.filter(([f]) => f !== groupField);
  if (nonGroupSorts.length > 0) {
    for (const [, groupRows] of groups) {
      const sorted = applySortToIndices(rows, groupRows, nonGroupSorts, colMap, locale);
      groupRows.splice(0, groupRows.length, ...sorted);
    }
  }

  const items: GridItem[] = [];
  for (const key of sortedKeys) {
    const groupRows = groups.get(key)!;
    const isExpanded = expandedLabels.has(key);
    const aggregates = hasAggregates
      ? computeAggregates(rows, groupRows, aggregateCols, controlAggregates)
      : undefined;
    items.push({ groupLabel: key, count: groupRows.length, collapsed: !isExpanded, aggregates });
    if (isExpanded) {
      for (const i of groupRows) items.push({ row: rows[i], originalIndex: i });
    }
  }
  return items;
}

/** Row accessors required to flatten a hierarchy. @internal */
export interface TreeAccessors<T extends object> {
  getId: (row: T) => string | number;
  getParentId: (row: T) => string | number | null | undefined;
}

/**
 * Flatten a parent/child hierarchy into a depth-first list of {@link TreeRowItem}s for the
 * virtual scroll list, honoring the expanded-id set.
 *
 * `indices` is the already filtered and sorted set of source-array positions; sibling order
 * follows that order. A row is treated as a **root** when its parent id is `null`/`undefined`
 * or when that parent is not present in `indices` (orphan). Children of a collapsed row are
 * omitted. Cycles and rows visited more than once are guarded so the walk always terminates.
 *
 * @param rows            The full data-source array.
 * @param indices         Filtered/sorted source positions to include, in display order.
 * @param accessors       `getId` / `getParentId` for the rows.
 * @param expandedIds     Ids whose children should be rendered.
 * @param forceExpandedIds Ids forced open regardless of `expandedIds` — used to reveal the
 *   ancestor path of filter matches. Optional.
 */
export function buildTreeItems<T extends object>(
  rows: T[],
  indices: number[],
  accessors: TreeAccessors<T>,
  expandedIds: Set<string | number>,
  forceExpandedIds?: Set<string | number>,
): GridItem<T>[] {
  const { getId, getParentId } = accessors;

  const includedIds = new Set<string | number>();
  for (const i of indices) includedIds.add(getId(rows[i]));

  // Bucket each included row under its parent, preserving the incoming (sorted) order.
  const childrenByParent = new Map<string | number, number[]>();
  const roots: number[] = [];
  for (const i of indices) {
    const parentId = getParentId(rows[i]);
    if (parentId == null || !includedIds.has(parentId)) {
      roots.push(i);
      continue;
    }
    const siblings = childrenByParent.get(parentId);
    if (siblings) siblings.push(i);
    else childrenByParent.set(parentId, [i]);
  }

  const items: GridItem<T>[] = [];
  const visited = new Set<string | number>();

  const visit = (index: number, level: number): void => {
    const row = rows[index];
    const id = getId(row);
    if (visited.has(id)) return; // cycle / duplicate-parent guard
    visited.add(id);

    const children = childrenByParent.get(id);
    const expandable = !!children?.length;
    const expanded = expandable && (expandedIds.has(id) || !!forceExpandedIds?.has(id));
    items.push({ row, originalIndex: index, level, expandable, expanded });

    if (expanded && children) {
      for (const childIndex of children) visit(childIndex, level + 1);
    }
  };

  for (const rootIndex of roots) visit(rootIndex, 0);
  return items;
}

// Selection range

/** Build the set of original indices spanning from `fromOrig` to `toOrig` in display order. */
export function buildSelectionRange(fromOrig: number, toOrig: number, items: GridItem[]): Set<number> {
  const fromDisp = items.findIndex(item => isDataRowItem(item) && item.originalIndex === fromOrig);
  const toDisp   = items.findIndex(item => isDataRowItem(item) && item.originalIndex === toOrig);
  if (fromDisp === -1 || toDisp === -1) return new Set();
  const [lo, hi] = [Math.min(fromDisp, toDisp), Math.max(fromDisp, toDisp)];
  const next = new Set<number>();
  for (let i = lo; i <= hi; i++) {
    const item = items[i];
    if (isDataRowItem(item)) next.add(item.originalIndex);
  }
  return next;
}
