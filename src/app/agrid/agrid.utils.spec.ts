import { describe, it, expect, beforeEach } from 'vitest';
import { ColDef } from './agrid.types';
import { ColumnFilter } from './agrid-control';
import {
  applyTextAndValueFilters,
  applySortToIndices,
  buildGroupedItems,
  buildSelectionRange,
  formatDateValue,
  getDisplayForField,
  isDataRowItem,
  isGroupHeaderItem,
  looksLikeDate,
} from './agrid.utils';

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
