import { ColumnFilter } from './agrid-control';
import {
  AgridPathTreeConfig,
  AgridTreeConfig,
  ColDef,
  DetailRowItem,
  GridItem,
  PathTreeNodeItem,
  TreeRowItem,
  ValueOption,
} from './agrid.types';

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

/**
 * Converts a numeric editor draft to its storage value.
 * Both dot and comma are accepted as decimal separators; invalid drafts are preserved so
 * column validation can report them instead of silently changing the user's input.
 */
export function coerceNumberInputValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const numeric = Number(trimmed.includes('.') ? trimmed : trimmed.replace(',', '.'));
  return Number.isNaN(numeric) ? value : numeric;
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
export function isDataRowItem<T extends object>(
  item: GridItem<T>,
): item is { row: T; originalIndex: number } {
  return typeof item === 'object' && item !== null && 'row' in item && !('detailFor' in item);
}

/** Returns whether a virtual-scroll item represents a master/detail panel row. */
export function isDetailRowItem<T extends object>(item: GridItem<T>): item is DetailRowItem<T> {
  return typeof item === 'object' && item !== null && 'detailFor' in item;
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
  return isDataRowItem(item) && 'level' in item;
}

/** Returns whether a virtual-scroll item is a generated path-tree branch node. */
export function isPathTreeNodeItem(item: GridItem): item is PathTreeNodeItem {
  return typeof item === 'object' && item !== null && 'pathNodeId' in item;
}

/** Returns whether a tree configuration derives its hierarchy from path segments. */
export function isPathTreeConfig<T extends object>(
  config: AgridTreeConfig<T>,
): config is AgridPathTreeConfig<T> {
  return typeof config.getPath === 'function';
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
      result = result.filter(i => passesConditionFilter(col, rows[i][field], filter, locale));
    }
  }
  return result;
}

/**
 * Evaluate a text, number, or date condition for one cell value.
 */
export function passesConditionFilter(
  col: ColDef | undefined,
  raw: unknown,
  filter: ColumnFilter,
  locale?: string,
): boolean {
  if (col?.type !== 'number' && col?.type !== 'date') {
    const value = getDisplayForField(col, raw, locale).toLocaleLowerCase(locale);
    const operand = String(filter.operand ?? '').toLocaleLowerCase(locale);
    switch (filter.operator) {
      case 'eq': return value === operand;
      case 'neq': return value !== operand;
      case 'startsWith': return value.startsWith(operand);
      case 'endsWith': return value.endsWith(operand);
      case 'includes': return value.includes(operand);
      case 'notIncludes': return !value.includes(operand);
      case 'like': {
        const escaped = operand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = escaped.replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'u').test(value);
      }
      default: return true;
    }
  }

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

  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const fields = sortEntries.map(([field, filter]) => {
    const col = colMap.get(field);
    const dateLike = new Uint8Array(indices.length);
    const dateValues = new Float64Array(indices.length);
    const numericValues = new Float64Array(indices.length);
    numericValues.fill(Number.NaN);
    const displayValues = new Array<string>(indices.length);

    for (let position = 0; position < indices.length; position++) {
      const index = indices[position];
      const raw = rows[index][field];
      const isDateLike = col?.type === 'date' || looksLikeDate(raw);
      const dateValue = isDateLike
        ? raw instanceof Date ? raw.getTime() : new Date(raw as string).getTime()
        : Number.NaN;
      const numericValue = col?.type === 'number'
        && !col.formatter
        && !col.values?.length
        && typeof raw === 'number'
        && Number.isFinite(raw)
        ? raw
        : Number.NaN;
      dateLike[position] = isDateLike ? 1 : 0;
      dateValues[position] = Number.isNaN(dateValue) ? -1 : dateValue;
      numericValues[position] = numericValue;
      displayValues[position] = isDateLike ? '' : getDisplayForField(col, raw, locale);
    }

    return {
      direction: filter.sort === 'desc' ? -1 : 1,
      dateLike,
      dateValues,
      numericValues,
      displayValues,
    };
  });
  const positions = Array.from({ length: indices.length }, (_, position) => position);

  positions.sort((a, b) => {
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      const field = fields[fieldIndex];
      let comparison: number;
      if (field.dateLike[a] || field.dateLike[b]) {
        comparison = field.dateValues[a] - field.dateValues[b];
      } else if (
        !Number.isNaN(field.numericValues[a])
        && !Number.isNaN(field.numericValues[b])
      ) {
        comparison = field.numericValues[a] - field.numericValues[b];
      } else {
        comparison = collator.compare(field.displayValues[a], field.displayValues[b]);
      }
      if (comparison !== 0) {
        return comparison * field.direction;
      }
    }
    return a - b;
  });

  return positions.map(position => indices[position]);
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
    if (typeof aggregate === 'function') {
      const values = indices.map(index => rows[index][col.field]);
      result[col.field] = (aggregate as (values: unknown[]) => unknown)(values);
      continue;
    }

    let count = 0;
    let numericCount = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const index of indices) {
      const raw = rows[index][col.field];
      if (raw != null && raw !== '') count++;

      const value = Number(raw);
      if (Number.isNaN(value)) continue;
      numericCount++;
      sum += value;
      if (value < min) min = value;
      if (value > max) max = value;
    }

    switch (aggregate) {
      case 'sum':
        result[col.field] = sum;
        break;
      case 'avg':
        result[col.field] = numericCount ? sum / numericCount : null;
        break;
      case 'min':
        result[col.field] = numericCount ? min : null;
        break;
      case 'max':
        result[col.field] = numericCount ? max : null;
        break;
      case 'count':
        result[col.field] = count;
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

/** Stable expansion id for a generated path prefix. */
export function pathTreeNodeId(path: readonly (string | number)[]): string {
  return `__agrid_path__${JSON.stringify(path.map(String))}`;
}

export function pathTreeNodeUuid(path: readonly (string | number)[]): string {
  const source = JSON.stringify(path.map(String));
  let a = 0x9e3779b9;
  let b = 0x85ebca6b;
  let c = 0xc2b2ae35;
  let d = 0x27d4eb2f;

  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    a = Math.imul(a ^ code, 0x85ebca6b);
    b = Math.imul(b ^ code, 0xc2b2ae35);
    c = Math.imul(c ^ code, 0x27d4eb2f);
    d = Math.imul(d ^ code, 0x165667b1);
  }

  const hex = [a, b, c, d]
    .map(value => (value >>> 0).toString(16).padStart(8, '0'))
    .join('')
    .split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

/** Builds display-only branch nodes and datasource-backed leaves from path segments. */
export function buildPathTreeItems<T extends object>(
  rows: T[],
  indices: number[],
  config: AgridPathTreeConfig<T>,
  expandedIds: Set<string | number>,
  forceExpanded = false,
): GridItem<T>[] {
  type Branch = {
    id: string;
    uuid: string;
    label: string;
    level: number;
    children: Map<string, Branch>;
    leaves: { originalIndex: number; label: string }[];
  };

  const roots = new Map<string, Branch>();
  for (const originalIndex of indices) {
    const rawPath = config.getPath(rows[originalIndex]).filter(
      segment => String(segment).length > 0,
    );
    if (rawPath.length === 0) continue;
    const path = rawPath.map(String);
    const formatSegment = (level: number, leaf: boolean): string =>
      config.formatPathSegment?.({
        row: rows[originalIndex],
        segment: rawPath[level],
        level,
        path: rawPath.slice(0, level + 1),
        leaf,
      }) ?? path[level];
    const resolveNodeUuid = (prefix: readonly string[]): string =>
      String(config.nodeUuid?.(rows[originalIndex])
        ?? config.nodeUUid?.(rows[originalIndex])
        ?? pathTreeNodeUuid(prefix));
    let branches = roots;
    for (let level = 0; level < path.length - 1; level++) {
      const prefix = path.slice(0, level + 1);
      const id = pathTreeNodeId(prefix);
      let branch = branches.get(id);
      if (!branch) {
        branch = {
          id,
          uuid: resolveNodeUuid(prefix),
          label: formatSegment(level, false),
          level,
          children: new Map(),
          leaves: [],
        };
        branches.set(id, branch);
      }
      if (level === path.length - 2) {
        branch.leaves.push({
          originalIndex,
          label: formatSegment(path.length - 1, true),
        });
      }
      branches = branch.children;
    }
    if (path.length === 1) {
      const id = pathTreeNodeId([]);
      let branch = roots.get(id);
      if (!branch) {
        branch = {
          id,
          uuid: resolveNodeUuid([]),
          label: '',
          level: -1,
          children: new Map(),
          leaves: [],
        };
        roots.set(id, branch);
      }
      branch.leaves.push({ originalIndex, label: formatSegment(0, true) });
    }
  }

  const items: GridItem<T>[] = [];
  const visit = (branch: Branch): void => {
    const isHiddenRoot = branch.level < 0;
    const expanded = forceExpanded || expandedIds.has(branch.id);
    if (!isHiddenRoot) {
      items.push({
        uuid: branch.uuid,
        pathNodeId: branch.id,
        pathLabel: branch.label,
        level: branch.level,
        expandable: true,
        expanded,
      });
    }
    if (!isHiddenRoot && !expanded) return;
    for (const child of branch.children.values()) visit(child);
    for (const leaf of branch.leaves) {
      items.push({
        row: rows[leaf.originalIndex],
        originalIndex: leaf.originalIndex,
        level: isHiddenRoot ? 0 : branch.level + 1,
        expandable: false,
        expanded: false,
        treeLabel: leaf.label,
      });
    }
  };
  for (const branch of roots.values()) visit(branch);
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

/** Test a complete proposed editor value against a regex input mask. */
export function matchesInputMask(value: unknown, mask: RegExp): boolean {
  const flags = mask.flags.replace(/[gy]/g, '');
  return new RegExp(`^(?:${mask.source})$`, flags).test(String(value ?? ''));
}
