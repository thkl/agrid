import { ColumnFilter } from './agrid-control';
import { ColDef, GridItem, ValueOption } from './agrid.types';

// ── Display resolution ─────────────────────────────────────────────────────────

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
export function formatDateValue(raw: unknown, locale?: string): string {
  if (raw == null || raw === '') return '';
  const d = raw instanceof Date ? raw : new Date(raw as string);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
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
  if (col.type === 'date' || looksLikeDate(raw)) return formatDateValue(raw, locale);
  return String(raw ?? '');
}

// ── Type guards ────────────────────────────────────────────────────────────────

export function isDataRowItem(item: GridItem): item is { row: Record<string, unknown>; originalIndex: number } {
  return typeof item === 'object' && item !== null && 'row' in item;
}

export function isGroupHeaderItem(item: GridItem): item is { groupLabel: string; count: number; collapsed: boolean } {
  return typeof item === 'object' && item !== null && 'groupLabel' in item;
}

// ── Filtering ──────────────────────────────────────────────────────────────────

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

// ── Sorting ────────────────────────────────────────────────────────────────────

/** Sort indices by the display value of a single column, respecting the active sort direction. */
export function applySortToIndices(
  rows: Record<string, unknown>[],
  indices: number[],
  sortField: string,
  sortFilter: ColumnFilter,
  colMap: Map<string, ColDef>,
  locale?: string,
): number[] {
  const sortCol = colMap.get(sortField);
  return [...indices].sort((a, b) => {
    const rawA = rows[a][sortField];
    const rawB = rows[b][sortField];
    // Sort dates by timestamp so chronological order is preserved
    if (sortCol?.type === 'date' || looksLikeDate(rawA) || looksLikeDate(rawB)) {
      const ta = rawA instanceof Date ? rawA.getTime() : new Date(rawA as string).getTime();
      const tb = rawB instanceof Date ? rawB.getTime() : new Date(rawB as string).getTime();
      const cmp = (isNaN(ta) ? -1 : ta) - (isNaN(tb) ? -1 : tb);
      return sortFilter.sort === 'asc' ? cmp : -cmp;
    }
    const av = getDisplayForField(sortCol, rawA, locale);
    const bv = getDisplayForField(sortCol, rawB, locale);
    const cmp = av.localeCompare(bv, locale, { numeric: true, sensitivity: 'base' });
    return sortFilter.sort === 'asc' ? cmp : -cmp;
  });
}

// ── Grouping ───────────────────────────────────────────────────────────────────

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
  sortEntry: [string, ColumnFilter] | null,
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

  if (sortEntry && sortEntry[0] !== groupField) {
    const [sortFieldName, sortFilter] = sortEntry;
    const sortCol = colMap.get(sortFieldName);
    for (const groupRows of groups.values()) {
      groupRows.sort((a, b) => {
        const av = getDisplayForField(sortCol, rows[a][sortFieldName], locale);
        const bv = getDisplayForField(sortCol, rows[b][sortFieldName], locale);
        const cmp = av.localeCompare(bv, locale, { numeric: true, sensitivity: 'base' });
        return sortFilter.sort === 'asc' ? cmp : -cmp;
      });
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

// ── Selection range ────────────────────────────────────────────────────────────

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
