import { describe, it, expect, beforeEach } from 'vitest';
import { ColDef } from './agrid.types';
import { ColumnFilter } from './agrid-control';
import {
  applyQuickFilter,
  applyTextAndValueFilters,
  applySortToIndices,
  buildGroupedItems,
  buildSelectionRange,
  buildTreeItems,
  coerceDateInputValue,
  formatDateValue,
  getDateInputValue,
  getDisplayForField,
  isDataRowItem,
  isGroupHeaderItem,
  isTreeRowItem,
  looksLikeDate,
} from './agrid.utils';

describe('date input conversion', () => {
  it('formats supported date values for native date inputs', () => {
    expect(getDateInputValue('2024-03-15')).toBe('2024-03-15');
    expect(getDateInputValue('2024-03-15T14:30:00.000Z')).toBe('2024-03-15');
    expect(getDateInputValue(new Date('2024-03-15T14:30:00.000Z'))).toBe('2024-03-15');
    expect(getDateInputValue('not-a-date')).toBe('');
  });

  it('preserves the original date storage form', () => {
    expect(coerceDateInputValue('2025-04-20', '2024-03-15')).toBe('2025-04-20');
    expect(
      coerceDateInputValue('2025-04-20', '2024-03-15T14:30:00.000Z'),
    ).toBe('2025-04-20T14:30:00.000Z');

    const result = coerceDateInputValue(
      '2025-04-20',
      new Date('2024-03-15T14:30:00.000Z'),
    );
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2025-04-20T00:00:00.000Z');
  });
});

// ── looksLikeDate ──────────────────────────────────────────────────────────────

describe('looksLikeDate', () => {
  it('returns true for Date objects', () => {
    expect(looksLikeDate(new Date())).toBe(true);
  });

  it('returns true for ISO date strings', () => {
    expect(looksLikeDate('2024-01-15')).toBe(true);
  });

  it('returns true for ISO datetime strings', () => {
    expect(looksLikeDate('2024-01-15T10:30:00Z')).toBe(true);
    expect(looksLikeDate('2024-01-15T10:30:00+02:00')).toBe(true);
  });

  it('returns false for plain strings', () => {
    expect(looksLikeDate('hello')).toBe(false);
    expect(looksLikeDate('15-01-2024')).toBe(false);
  });

  it('returns false for numbers', () => {
    expect(looksLikeDate(20240115)).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(looksLikeDate(null)).toBe(false);
    expect(looksLikeDate(undefined)).toBe(false);
  });
});

// ── formatDateValue ────────────────────────────────────────────────────────────

describe('formatDateValue', () => {
  it('returns empty string for null', () => expect(formatDateValue(null)).toBe(''));
  it('returns empty string for undefined', () => expect(formatDateValue(undefined)).toBe(''));
  it('returns empty string for empty string', () => expect(formatDateValue('')).toBe(''));

  it('formats a Date object', () => {
    const result = formatDateValue(new Date('2024-06-01'));
    expect(result).toContain('2024');
  });

  it('formats an ISO date string', () => {
    const result = formatDateValue('2024-06-01');
    expect(result).toContain('2024');
  });

  it('returns the raw string for an unparseable value', () => {
    expect(formatDateValue('not-a-date')).toBe('not-a-date');
  });
});

// ── getDisplayForField ─────────────────────────────────────────────────────────

describe('getDisplayForField', () => {
  it('falls back to String(raw) when col is undefined', () => {
    expect(getDisplayForField(undefined, 42)).toBe('42');
  });

  it('resolves string values to their label', () => {
    const col: ColDef = { field: 'status', header: 'Status', values: ['Active', 'Inactive'] };
    expect(getDisplayForField(col, 'Active')).toBe('Active');
  });

  it('resolves ValueOption to label', () => {
    const col: ColDef = {
      field: 'type', header: 'Type',
      values: [{ label: 'Full-time', value: 1 }, { label: 'Part-time', value: 2 }],
    };
    expect(getDisplayForField(col, 1)).toBe('Full-time');
  });

  it('uses formatter when no values list', () => {
    const col: ColDef = { field: 'salary', header: 'Salary', formatter: v => `$${v}` };
    expect(getDisplayForField(col, 1000)).toBe('$1000');
  });

  it('formats date fields', () => {
    const col: ColDef = { field: 'dob', header: 'DOB', type: 'date' };
    const result = getDisplayForField(col, '2000-01-01');
    expect(result).toContain('2000');
  });

  it('returns String(raw) as final fallback', () => {
    const col: ColDef = { field: 'count', header: 'Count' };
    expect(getDisplayForField(col, 99)).toBe('99');
  });
});

// ── isDataRowItem / isGroupHeaderItem ──────────────────────────────────────────

describe('type guards', () => {
  it('identifies data row items', () => {
    expect(isDataRowItem({ row: {}, originalIndex: 0 })).toBe(true);
    expect(isDataRowItem({ groupLabel: 'A', count: 1, collapsed: false })).toBe(false);
    expect(isDataRowItem(null)).toBe(false);
    expect(isDataRowItem('ghost')).toBe(false);
  });

  it('identifies group header items', () => {
    expect(isGroupHeaderItem({ groupLabel: 'A', count: 1, collapsed: false })).toBe(true);
    expect(isGroupHeaderItem({ row: {}, originalIndex: 0 })).toBe(false);
    expect(isGroupHeaderItem(null)).toBe(false);
  });

  it('identifies tree row items', () => {
    const treeItem = { row: {}, originalIndex: 0, level: 0, expandable: false, expanded: false };
    expect(isTreeRowItem(treeItem)).toBe(true);
    expect(isTreeRowItem({ row: {}, originalIndex: 0 })).toBe(false);
    expect(isTreeRowItem({ groupLabel: 'A', count: 1, collapsed: false })).toBe(false);
    expect(isTreeRowItem(null)).toBe(false);
    expect(isTreeRowItem('ghost')).toBe(false);
  });

  it('treats tree row items as data row items', () => {
    const treeItem = { row: {}, originalIndex: 0, level: 1, expandable: true, expanded: true };
    expect(isDataRowItem(treeItem)).toBe(true);
  });
});

// ── applyTextAndValueFilters ───────────────────────────────────────────────────

describe('applyTextAndValueFilters', () => {
  const rows = [
    { name: 'Alice', role: 'admin' },
    { name: 'Bob',   role: 'user' },
    { name: 'Carol', role: 'admin' },
  ];
  const indices = [0, 1, 2];
  const colMap = new Map<string, ColDef>([
    ['name', { field: 'name', header: 'Name' }],
    ['role', { field: 'role', header: 'Role' }],
  ]);

  it('returns all indices when no filters are set', () => {
    expect(applyTextAndValueFilters(rows, indices, {}, colMap)).toEqual([0, 1, 2]);
  });

  it('applies text filter (case-insensitive)', () => {
    const filters: Record<string, ColumnFilter> = { name: { text: 'ali', selectedValues: null, sort: null } };
    expect(applyTextAndValueFilters(rows, indices, filters, colMap)).toEqual([0]);
  });

  it('returns empty when text filter matches nothing', () => {
    const filters: Record<string, ColumnFilter> = { name: { text: 'xyz', selectedValues: null, sort: null } };
    expect(applyTextAndValueFilters(rows, indices, filters, colMap)).toEqual([]);
  });

  it('applies value filter', () => {
    const filters: Record<string, ColumnFilter> = { role: { text: '', selectedValues: ['admin'], sort: null } };
    const result = applyTextAndValueFilters(rows, indices, filters, colMap);
    expect(result).toEqual([0, 2]);
  });

  it('combines text and value filters (AND logic)', () => {
    const filters: Record<string, ColumnFilter> = {
      name: { text: 'alice', selectedValues: null, sort: null },
      role: { text: '', selectedValues: ['user'], sort: null },
    };
    const result = applyTextAndValueFilters(rows, indices, filters, colMap);
    expect(result).toEqual([]);
  });

  it('null selectedValues passes all values through', () => {
    const filters: Record<string, ColumnFilter> = { role: { text: '', selectedValues: null, sort: null } };
    expect(applyTextAndValueFilters(rows, indices, filters, colMap)).toEqual([0, 1, 2]);
  });
});

// ── typed range filters ─────────────────────────────────────────────────────────

describe('applyTextAndValueFilters — typed range operators', () => {
  const rows = [
    { score: 10, due: '2024-01-10' },
    { score: 20, due: '2024-02-15' },
    { score: 30, due: '2024-03-20' },
  ];
  const indices = [0, 1, 2];
  const colMap = new Map<string, ColDef>([
    ['score', { field: 'score', header: 'Score', type: 'number' }],
    ['due',   { field: 'due',   header: 'Due',   type: 'date' }],
  ]);
  const numFilter = (operator: ColumnFilter['operator'], operand: string, operand2?: string): Record<string, ColumnFilter> =>
    ({ score: { text: '', selectedValues: null, sort: null, operator, operand, operand2 } });

  it('filters numbers with gt / gte / lt / lte', () => {
    expect(applyTextAndValueFilters(rows, indices, numFilter('gt', '20'), colMap)).toEqual([2]);
    expect(applyTextAndValueFilters(rows, indices, numFilter('gte', '20'), colMap)).toEqual([1, 2]);
    expect(applyTextAndValueFilters(rows, indices, numFilter('lt', '20'), colMap)).toEqual([0]);
    expect(applyTextAndValueFilters(rows, indices, numFilter('lte', '20'), colMap)).toEqual([0, 1]);
  });

  it('filters numbers with eq / neq / between', () => {
    expect(applyTextAndValueFilters(rows, indices, numFilter('eq', '20'), colMap)).toEqual([1]);
    expect(applyTextAndValueFilters(rows, indices, numFilter('neq', '20'), colMap)).toEqual([0, 2]);
    expect(applyTextAndValueFilters(rows, indices, numFilter('between', '15', '35'), colMap)).toEqual([1, 2]);
  });

  it('ignores the operand-less / empty range filter', () => {
    expect(applyTextAndValueFilters(rows, indices, numFilter('gt', ''), colMap)).toEqual([0, 1, 2]);
  });

  it('filters dates with before (lt) / after (gt) / between', () => {
    const dateFilter = (operator: ColumnFilter['operator'], operand: string, operand2?: string): Record<string, ColumnFilter> =>
      ({ due: { text: '', selectedValues: null, sort: null, operator, operand, operand2 } });
    expect(applyTextAndValueFilters(rows, indices, dateFilter('lt', '2024-02-01'), colMap)).toEqual([0]);
    expect(applyTextAndValueFilters(rows, indices, dateFilter('gt', '2024-02-01'), colMap)).toEqual([1, 2]);
    expect(applyTextAndValueFilters(rows, indices, dateFilter('between', '2024-02-01', '2024-03-01'), colMap)).toEqual([1]);
  });
});

// ── applyQuickFilter ─────────────────────────────────────────────────────────

describe('applyQuickFilter', () => {
  const rows = [
    { name: 'Alice', dept: 1 },
    { name: 'Bob', dept: 2 },
    { name: 'Carol', dept: 1 },
  ];
  const indices = [0, 1, 2];
  const cols: ColDef[] = [
    { field: 'name', header: 'Name' },
    { field: 'dept', header: 'Dept', values: [{ value: 1, label: 'Engineering' }, { value: 2, label: 'Sales' }] },
  ];

  it('returns all indices for empty / whitespace text', () => {
    expect(applyQuickFilter(rows, indices, '', cols)).toEqual([0, 1, 2]);
    expect(applyQuickFilter(rows, indices, '   ', cols)).toEqual([0, 1, 2]);
  });

  it('matches across any visible column, case-insensitively', () => {
    expect(applyQuickFilter(rows, indices, 'car', cols)).toEqual([2]);
  });

  it('matches the resolved display label, not the raw value', () => {
    // dept 1 → 'Engineering'; searching the label keeps rows 0 and 2
    expect(applyQuickFilter(rows, indices, 'engineering', cols)).toEqual([0, 2]);
  });

  it('returns empty when nothing matches', () => {
    expect(applyQuickFilter(rows, indices, 'zzz', cols)).toEqual([]);
  });
});

// ── applySortToIndices ─────────────────────────────────────────────────────────

describe('applySortToIndices', () => {
  const rows = [
    { name: 'Carol', score: 30 },
    { name: 'Alice', score: 10 },
    { name: 'Bob',   score: 20 },
  ];
  const indices = [0, 1, 2];
  const colMap = new Map<string, ColDef>([
    ['name',  { field: 'name',  header: 'Name' }],
    ['score', { field: 'score', header: 'Score' }],
  ]);

  const asc  = (f: string): [string, ColumnFilter] => [f, { text: '', selectedValues: null, sort: 'asc'  }];
  const desc = (f: string): [string, ColumnFilter] => [f, { text: '', selectedValues: null, sort: 'desc' }];

  it('returns same order when no sort entries', () => {
    expect(applySortToIndices(rows, indices, [], colMap)).toEqual([0, 1, 2]);
  });

  it('sorts ascending by string column', () => {
    const result = applySortToIndices(rows, indices, [asc('name')], colMap);
    expect(result.map(i => rows[i].name)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('sorts descending by string column', () => {
    const result = applySortToIndices(rows, indices, [desc('name')], colMap);
    expect(result.map(i => rows[i].name)).toEqual(['Carol', 'Bob', 'Alice']);
  });

  it('does not mutate the original indices array', () => {
    const original = [...indices];
    applySortToIndices(rows, indices, [asc('name')], colMap);
    expect(indices).toEqual(original);
  });

  it('sorts dates correctly', () => {
    const dateRows = [
      { d: '2024-03-01' },
      { d: '2024-01-01' },
      { d: '2024-06-01' },
    ];
    const dateColMap = new Map<string, ColDef>([['d', { field: 'd', header: 'D', type: 'date' }]]);
    const result = applySortToIndices(dateRows, [0, 1, 2], [asc('d')], dateColMap);
    expect(result.map(i => dateRows[i].d)).toEqual(['2024-01-01', '2024-03-01', '2024-06-01']);
  });

  it('sorts typed numeric columns numerically', () => {
    const numericRows = [{ score: 100 }, { score: 9 }, { score: 20 }];
    const numericColMap = new Map<string, ColDef>([
      ['score', { field: 'score', header: 'Score', type: 'number' }],
    ]);
    const result = applySortToIndices(numericRows, [0, 1, 2], [asc('score')], numericColMap);
    expect(result.map(i => numericRows[i].score)).toEqual([9, 20, 100]);
  });

  it('resolves formatter values once per row and sort field', () => {
    let formatterCalls = 0;
    const formattedRows = [{ status: 2 }, { status: 1 }, { status: 3 }];
    const formattedColMap = new Map<string, ColDef>([
      ['status', {
        field: 'status',
        header: 'Status',
        formatter: value => {
          formatterCalls++;
          return ({ 1: 'Beta', 2: 'Alpha', 3: 'Gamma' })[Number(value)] ?? '';
        },
      }],
    ]);

    const result = applySortToIndices(
      formattedRows,
      [0, 1, 2],
      [asc('status')],
      formattedColMap,
    );

    expect(result.map(i => formattedRows[i].status)).toEqual([2, 1, 3]);
    expect(formatterCalls).toBe(formattedRows.length);
  });

  it('uses subsequent fields for ties and preserves input order for complete ties', () => {
    const tiedRows = [
      { department: 'Engineering', score: 20 },
      { department: 'Engineering', score: 10 },
      { department: 'Sales', score: 10 },
      { department: 'Engineering', score: 10 },
    ];
    const tiedColMap = new Map<string, ColDef>([
      ['department', { field: 'department', header: 'Department' }],
      ['score', { field: 'score', header: 'Score', type: 'number' }],
    ]);

    expect(
      applySortToIndices(
        tiedRows,
        [0, 1, 2, 3],
        [asc('department'), asc('score')],
        tiedColMap,
      ),
    ).toEqual([1, 3, 0, 2]);
  });
});

// ── buildGroupedItems ──────────────────────────────────────────────────────────

describe('buildGroupedItems', () => {
  const rows = [
    { dept: 'Eng',  name: 'Alice' },
    { dept: 'HR',   name: 'Bob' },
    { dept: 'Eng',  name: 'Carol' },
    { dept: 'HR',   name: 'Dave' },
  ];
  const indices = [0, 1, 2, 3];
  const colMap = new Map<string, ColDef>([
    ['dept', { field: 'dept', header: 'Dept' }],
    ['name', { field: 'name', header: 'Name' }],
  ]);

  it('produces one group header per unique value', () => {
    const items = buildGroupedItems(rows, indices, 'dept', colMap, [], new Set());
    const headers = items.filter(isGroupHeaderItem);
    expect(headers.length).toBe(2);
  });

  it('sorts group keys alphabetically', () => {
    const items = buildGroupedItems(rows, indices, 'dept', colMap, [], new Set());
    const headers = items.filter(isGroupHeaderItem).map(h => isGroupHeaderItem(h) ? h.groupLabel : '');
    expect(headers).toEqual(['Eng', 'HR']);
  });

  it('marks all groups collapsed when expandedLabels is empty', () => {
    const items = buildGroupedItems(rows, indices, 'dept', colMap, [], new Set());
    const headers = items.filter(isGroupHeaderItem);
    expect(headers.every(h => isGroupHeaderItem(h) && h.collapsed)).toBe(true);
  });

  it('does not include data rows for collapsed groups', () => {
    const items = buildGroupedItems(rows, indices, 'dept', colMap, [], new Set());
    expect(items.filter(isDataRowItem).length).toBe(0);
  });

  it('includes data rows for expanded groups', () => {
    const items = buildGroupedItems(rows, indices, 'dept', colMap, [], new Set(['Eng']));
    const engRows = items.filter(isDataRowItem);
    expect(engRows.length).toBe(2);
  });

  it('stores correct row count on group header', () => {
    const items = buildGroupedItems(rows, indices, 'dept', colMap, [], new Set());
    const eng = items.find(i => isGroupHeaderItem(i) && i.groupLabel === 'Eng');
    expect(isGroupHeaderItem(eng!) && eng!.count).toBe(2);
  });
});

// ── buildSelectionRange ────────────────────────────────────────────────────────

describe('buildSelectionRange', () => {
  const items = [
    { row: { id: 0 }, originalIndex: 0 },
    { row: { id: 1 }, originalIndex: 1 },
    { row: { id: 2 }, originalIndex: 2 },
    { row: { id: 3 }, originalIndex: 3 },
  ];

  it('builds range from lower to higher', () => {
    const result = buildSelectionRange(1, 3, items);
    expect([...result].sort()).toEqual([1, 2, 3]);
  });

  it('builds range from higher to lower (reversed)', () => {
    const result = buildSelectionRange(3, 1, items);
    expect([...result].sort()).toEqual([1, 2, 3]);
  });

  it('returns empty set when fromOrig not found', () => {
    const result = buildSelectionRange(99, 1, items);
    expect(result.size).toBe(0);
  });

  it('skips group header items within range', () => {
    const mixed = [
      { row: { id: 0 }, originalIndex: 0 },
      { groupLabel: 'G', count: 1, collapsed: false },
      { row: { id: 1 }, originalIndex: 1 },
    ];
    const result = buildSelectionRange(0, 1, mixed);
    expect([...result]).toEqual([0, 1]);
  });
});

// ── buildTreeItems ─────────────────────────────────────────────────────────────

describe('buildTreeItems', () => {
  interface Node { id: number; parentId: number | null; name: string; }

  const accessors = {
    getId: (r: Node) => r.id,
    getParentId: (r: Node) => r.parentId,
  };

  // 1 ─ 2 ─ 4
  //   └ 3
  // 5 (root)
  const rows: Node[] = [
    { id: 1, parentId: null, name: 'root-a' },
    { id: 2, parentId: 1, name: 'child-a1' },
    { id: 3, parentId: 1, name: 'child-a2' },
    { id: 4, parentId: 2, name: 'grandchild' },
    { id: 5, parentId: null, name: 'root-b' },
  ];
  const allIndices = rows.map((_, i) => i);

  const idsOf = (items: ReturnType<typeof buildTreeItems<Node>>) =>
    items.filter(isTreeRowItem).map(i => (i.row as Node).id);

  it('shows only roots when nothing is expanded', () => {
    const items = buildTreeItems(rows, allIndices, accessors, new Set());
    expect(idsOf(items)).toEqual([1, 5]);
    const root = items.filter(isTreeRowItem);
    expect(root.every(i => i.level === 0)).toBe(true);
  });

  it('marks rows with children as expandable', () => {
    const items = buildTreeItems(rows, allIndices, accessors, new Set());
    const byId = new Map(items.filter(isTreeRowItem).map(i => [(i.row as Node).id, i]));
    expect(byId.get(1)!.expandable).toBe(true);
    expect(byId.get(5)!.expandable).toBe(false);
  });

  it('reveals direct children of an expanded node with incremented level', () => {
    const items = buildTreeItems(rows, allIndices, accessors, new Set([1]));
    expect(idsOf(items)).toEqual([1, 2, 3, 5]);
    const child = items.filter(isTreeRowItem).find(i => (i.row as Node).id === 2)!;
    expect(child.level).toBe(1);
    // Grandchild stays hidden because node 2 is collapsed.
    expect(child.expanded).toBe(false);
  });

  it('reveals descendants depth-first across multiple expanded levels', () => {
    const items = buildTreeItems(rows, allIndices, accessors, new Set([1, 2]));
    expect(idsOf(items)).toEqual([1, 2, 4, 3, 5]);
    const grandchild = items.filter(isTreeRowItem).find(i => (i.row as Node).id === 4)!;
    expect(grandchild.level).toBe(2);
  });

  it('preserves the incoming (sorted) order among siblings', () => {
    // Feed children in reversed order; output should follow indices order, not id order.
    const reversed = [0, 2, 1, 3, 4]; // root, child3, child2, grandchild, root5
    const items = buildTreeItems(rows, reversed, accessors, new Set([1]));
    expect(idsOf(items)).toEqual([1, 3, 2, 5]);
  });

  it('treats a row whose parent is filtered out as a root', () => {
    // Exclude node 1 (the parent) and root 5; children 2 and 3 become roots at level 0.
    const indices = [1, 2, 3]; // array positions → ids 2, 3, 4 (4's parent 2 is present)
    const items = buildTreeItems(rows, indices, accessors, new Set([2]));
    const roots = items.filter(isTreeRowItem).filter(i => i.level === 0).map(i => (i.row as Node).id);
    expect(roots).toEqual([2, 3]);
    // 2 is expanded so its grandchild 4 shows at level 1.
    expect(idsOf(items)).toEqual([2, 4, 3]);
  });

  it('terminates without rendering an unreachable cycle', () => {
    const cyclic: Node[] = [
      { id: 1, parentId: 2, name: 'a' },
      { id: 2, parentId: 1, name: 'b' },
    ];
    // Each is the other's child, so neither is a root and the cycle is unreachable.
    // The call must terminate (no stack overflow) and emit nothing.
    const items = buildTreeItems(cyclic, [0, 1], accessors, new Set([1, 2]));
    expect(items.filter(isTreeRowItem)).toEqual([]);
  });

  it('renders each row once and terminates when a node is its own parent', () => {
    // Self-parent within an otherwise normal tree: node 2 points at itself.
    const selfRef: Node[] = [
      { id: 1, parentId: null, name: 'root' },
      { id: 2, parentId: 2, name: 'self' },
    ];
    const items = buildTreeItems(selfRef, [0, 1], { ...accessors }, new Set([1, 2]));
    const ids = items.filter(isTreeRowItem).map(i => (i.row as Node).id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  it('returns an empty list for empty input', () => {
    expect(buildTreeItems(rows, [], accessors, new Set())).toEqual([]);
  });

  it('force-expands ids regardless of the expanded set', () => {
    // Node 1 is not in expandedIds, but forcing it open reveals its children.
    const items = buildTreeItems(rows, allIndices, accessors, new Set(), new Set([1]));
    expect(idsOf(items)).toEqual([1, 2, 3, 5]);
    const root = items.filter(isTreeRowItem).find(i => (i.row as Node).id === 1)!;
    expect(root.expanded).toBe(true);
  });

  it('combines forced and explicit expansion', () => {
    // Node 1 forced, node 2 explicitly expanded → grandchild 4 shows too.
    const items = buildTreeItems(rows, allIndices, accessors, new Set([2]), new Set([1]));
    expect(idsOf(items)).toEqual([1, 2, 4, 3, 5]);
  });
});
