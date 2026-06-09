import { ColumnFilter } from './agrid-control';
import { ColDef, GridItem, ValueOption } from './agrid.types';

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
export function isGroupHeaderItem(item: GridItem): item is { groupLabel: string; count: number; collapsed: boolean } {
  return typeof item === 'object' && item !== null && 'groupLabel' in item;
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
  }
  return result;
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
export function buildGroupedItems(
  rows: Record<string, unknown>[],
  indices: number[],
  groupField: string,
  colMap: Map<string, ColDef>,
  sortEntries: [string, ColumnFilter][],
  expandedLabels: Set<string>,
  locale?: string,
): GridItem[] {
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
    items.push({ groupLabel: key, count: groupRows.length, collapsed: !isExpanded });
    if (isExpanded) {
      for (const i of groupRows) items.push({ row: rows[i], originalIndex: i });
    }
  }
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
