import { describe, it, expect, beforeEach } from 'vitest';
import { AgridControl } from './agrid-control';

// AgridControl uses signal()/computed() which work outside injection context.

describe('AgridControl', () => {

  // ── Defaults ────────────────────────────────────────────────────────────────

  describe('defaults', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    it('starts with empty filters', () => expect(ctrl.filters()).toEqual({}));
    it('starts with pageSize 0', () => expect(ctrl.pageSize()).toBe(0));
    it('starts on page 1', () => expect(ctrl.currentPage()).toBe(1));
    it('starts with no groupByField', () => expect(ctrl.groupByField()).toBeNull());
    it('canUndo is false initially', () => expect(ctrl.canUndo()).toBe(false));
    it('canRedo is false initially', () => expect(ctrl.canRedo()).toBe(false));
  });

  // ── fromJSON / toJSON ────────────────────────────────────────────────────────

  describe('serialization', () => {
    it('round-trips via toJSON/fromJSON', () => {
      const ctrl = new AgridControl({
        columnWidths: { name: 200 },
        filters: { name: { text: 'alice', selectedValues: null, sort: 'asc' } },
        groupByField: 'dept',
        hiddenColumns: ['salary'],
        pinnedColumns: ['id'],
        pinnedRightColumns: ['actions'],
        pageSize: 25,
        currentPage: 2,
        sortOrder: ['name'],
        aggregates: { salary: 'sum' },
      });
      const restored = AgridControl.fromJSON(ctrl.toJSON());
      expect(restored.columnWidths()['name']).toBe(200);
      expect(restored.filters()['name'].text).toBe('alice');
      expect(restored.groupByField()).toBe('dept');
      expect(restored.hiddenColumns().has('salary')).toBe(true);
      expect(restored.pinnedColumns().has('id')).toBe(true);
      expect(restored.pinnedRightColumns().has('actions')).toBe(true);
      expect(restored.pageSize()).toBe(25);
      expect(restored.aggregates()['salary']).toBe('sum');
    });

    it('fromJSON with empty object uses defaults', () => {
      const ctrl = AgridControl.fromJSON({});
      expect(ctrl.pageSize()).toBe(0);
      expect(ctrl.groupByField()).toBeNull();
    });
  });

  // ── Column visibility ────────────────────────────────────────────────────────

  describe('column visibility', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    it('hides a column', () => {
      ctrl.setColumnVisibility('name', false);
      expect(ctrl.isColumnHidden('name')).toBe(true);
    });

    it('shows a column again', () => {
      ctrl.setColumnVisibility('name', false);
      ctrl.setColumnVisibility('name', true);
      expect(ctrl.isColumnHidden('name')).toBe(false);
    });

    it('toggleColumnVisibility hides a visible column', () => {
      ctrl.toggleColumnVisibility('name');
      expect(ctrl.isColumnHidden('name')).toBe(true);
    });

    it('toggleColumnVisibility shows a hidden column', () => {
      ctrl.setColumnVisibility('name', false);
      ctrl.toggleColumnVisibility('name');
      expect(ctrl.isColumnHidden('name')).toBe(false);
    });
  });

  // ── Column widths ────────────────────────────────────────────────────────────

  describe('column widths', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    it('returns defaultWidth when no override set', () => {
      expect(ctrl.getColumnWidth('name', 150)).toBe(150);
    });

    it('returns overridden width', () => {
      ctrl.setColumnWidth('name', 200);
      expect(ctrl.getColumnWidth('name', 150)).toBe(200);
    });

    it('enforces minimum width of 40px', () => {
      ctrl.setColumnWidth('name', 10);
      expect(ctrl.getColumnWidth('name', 150)).toBe(40);
    });
  });

  // ── Pinning ─────────────────────────────────────────────────────────────────

  describe('pinning', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    it('pins a column left', () => {
      ctrl.setPinned('name', true);
      expect(ctrl.isPinned('name')).toBe(true);
    });

    it('unpins a column left', () => {
      ctrl.setPinned('name', true);
      ctrl.setPinned('name', false);
      expect(ctrl.isPinned('name')).toBe(false);
    });

    it('pins a column right', () => {
      ctrl.setPinnedRight('name', true);
      expect(ctrl.isPinnedRight('name')).toBe(true);
    });

    it('pinning left removes right pin', () => {
      ctrl.setPinnedRight('name', true);
      ctrl.setPinned('name', true);
      expect(ctrl.isPinnedRight('name')).toBe(false);
      expect(ctrl.isPinned('name')).toBe(true);
    });

    it('pinning right removes left pin', () => {
      ctrl.setPinned('name', true);
      ctrl.setPinnedRight('name', true);
      expect(ctrl.isPinned('name')).toBe(false);
      expect(ctrl.isPinnedRight('name')).toBe(true);
    });

    it('togglePinnedRight toggles state', () => {
      ctrl.togglePinnedRight('name');
      expect(ctrl.isPinnedRight('name')).toBe(true);
      ctrl.togglePinnedRight('name');
      expect(ctrl.isPinnedRight('name')).toBe(false);
    });
  });

  // ── Column order ─────────────────────────────────────────────────────────────

  describe('moveColumn', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    it('moves a column before another', () => {
      ctrl.moveColumn(['a', 'b', 'c'], 'c', 'a', true);
      expect(ctrl.columnOrder()).toEqual(['c', 'a', 'b']);
    });

    it('moves a column after another', () => {
      ctrl.moveColumn(['a', 'b', 'c'], 'a', 'b', false);
      expect(ctrl.columnOrder()).toEqual(['b', 'a', 'c']);
    });

    it('moves a contiguous field block while preserving its internal order', () => {
      ctrl.moveColumns(['a', 'b', 'c', 'd'], ['a', 'b'], 'd', false);
      expect(ctrl.columnOrder()).toEqual(['c', 'd', 'a', 'b']);
    });
  });

  // ── Filters & sort ───────────────────────────────────────────────────────────

  describe('filters and sort', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    it('setTextFilter stores text', () => {
      ctrl.setTextFilter('name', 'alice');
      expect(ctrl.getFilter('name').text).toBe('alice');
    });

    it('setSelectedValues stores values', () => {
      ctrl.setSelectedValues('status', ['active']);
      expect(ctrl.getFilter('status').selectedValues).toEqual(['active']);
    });

    it('setSelectedValues null clears value filter', () => {
      ctrl.setSelectedValues('status', ['active']);
      ctrl.setSelectedValues('status', null);
      expect(ctrl.getFilter('status').selectedValues).toBeNull();
    });

    it('setRangeFilter stores operator and operands', () => {
      ctrl.setRangeFilter('score', 'between', '10', '20');
      expect(ctrl.getFilter('score')).toMatchObject({
        operator: 'between',
        operand: '10',
        operand2: '20',
      });
    });

    it('setRangeFilter with null operator clears the range condition', () => {
      ctrl.setRangeFilter('score', 'gt', '10');
      ctrl.setRangeFilter('score', null, null, null);
      expect(ctrl.getFilter('score').operator).toBeNull();
    });

    it('hasActiveFilter reflects an active range condition', () => {
      expect(ctrl.hasActiveFilter('score')).toBe(false);
      ctrl.setRangeFilter('score', 'gt', '10');
      expect(ctrl.hasActiveFilter('score')).toBe(true);
      ctrl.setRangeFilter('score', 'gt', '');
      expect(ctrl.hasActiveFilter('score')).toBe(false);
    });

    it('setSort sets direction and clears other sorts', () => {
      ctrl.setSort('a', 'asc');
      ctrl.setSort('b', 'desc');
      expect(ctrl.getFilter('a').sort).toBeNull();
      expect(ctrl.getFilter('b').sort).toBe('desc');
    });

    it('addSort adds column to multi-sort stack', () => {
      ctrl.addSort('name', 'asc');
      ctrl.addSort('score', 'desc');
      expect(ctrl.sortOrder()).toEqual(['name', 'score']);
    });

    it('addSort does not duplicate existing column in sort order', () => {
      ctrl.addSort('name', 'asc');
      ctrl.addSort('name', 'desc');
      expect(ctrl.sortOrder()).toEqual(['name']);
    });

    it('clearFilter removes filter for that field only', () => {
      ctrl.setTextFilter('name', 'alice');
      ctrl.setTextFilter('role', 'admin');
      ctrl.clearFilter('name');
      expect(ctrl.getFilter('name').text).toBe('');
      expect(ctrl.getFilter('role').text).toBe('admin');
    });

    it('clearAllFilters removes all filters', () => {
      ctrl.setTextFilter('name', 'alice');
      ctrl.addSort('name', 'asc');
      ctrl.clearAllFilters();
      expect(ctrl.filters()).toEqual({});
      expect(ctrl.sortOrder()).toEqual([]);
    });

    it('hasActiveFilter returns true when text filter active', () => {
      ctrl.setTextFilter('name', 'alice');
      expect(ctrl.hasActiveFilter('name')).toBe(true);
    });

    it('hasActiveFilter returns false when no filter', () => {
      expect(ctrl.hasActiveFilter('name')).toBe(false);
    });

    it('hasAnyActiveFilter returns true when any column has a filter', () => {
      ctrl.setTextFilter('name', 'alice');
      expect(ctrl.hasAnyActiveFilter()).toBe(true);
    });

    it('getSortPriority returns 0 when not sorted', () => {
      expect(ctrl.getSortPriority('name')).toBe(0);
    });

    it('getSortPriority returns 1-based index', () => {
      ctrl.addSort('name', 'asc');
      ctrl.addSort('score', 'desc');
      expect(ctrl.getSortPriority('name')).toBe(1);
      expect(ctrl.getSortPriority('score')).toBe(2);
    });
  });

  // ── Pagination ───────────────────────────────────────────────────────────────

  describe('pagination', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    it('setPageSize updates pageSize and resets to page 1', () => {
      ctrl.setPage(3);
      ctrl.setPageSize(20);
      expect(ctrl.pageSize()).toBe(20);
      expect(ctrl.currentPage()).toBe(1);
    });

    it('setPage updates current page', () => {
      ctrl.setPage(5);
      expect(ctrl.currentPage()).toBe(5);
    });

    it('setPage clamps to minimum 1', () => {
      ctrl.setPage(-1);
      expect(ctrl.currentPage()).toBe(1);
    });

    it('setPageSize 0 disables pagination', () => {
      ctrl.setPageSize(20);
      ctrl.setPageSize(0);
      expect(ctrl.pageSize()).toBe(0);
    });
  });

  // ── Aggregates ───────────────────────────────────────────────────────────────

  describe('aggregates', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    it('setAggregate stores the function', () => {
      ctrl.setAggregate('salary', 'sum');
      expect(ctrl.aggregates()['salary']).toBe('sum');
    });

    it('setAggregate null removes the entry', () => {
      ctrl.setAggregate('salary', 'sum');
      ctrl.setAggregate('salary', null);
      expect(ctrl.aggregates()['salary']).toBeUndefined();
    });
  });

  // ── Undo / Redo ──────────────────────────────────────────────────────────────

  describe('undo/redo', () => {
    let ctrl: AgridControl;
    beforeEach(() => { ctrl = new AgridControl(); });

    const entry = { rowIndex: 0, field: 'name', oldValue: 'Alice', newValue: 'Bob' };

    it('canUndo becomes true after pushEdit', () => {
      ctrl.pushEdit(entry);
      expect(ctrl.canUndo()).toBe(true);
    });

    it('undo returns the entry and moves pointer back', () => {
      ctrl.pushEdit(entry);
      const result = ctrl.undo();
      expect(result).toEqual(entry);
      expect(ctrl.canUndo()).toBe(false);
    });

    it('undo returns null when at beginning', () => {
      expect(ctrl.undo()).toBeNull();
    });

    it('canRedo becomes true after undo', () => {
      ctrl.pushEdit(entry);
      ctrl.undo();
      expect(ctrl.canRedo()).toBe(true);
    });

    it('redo returns the entry and advances pointer', () => {
      ctrl.pushEdit(entry);
      ctrl.undo();
      const result = ctrl.redo();
      expect(result).toEqual(entry);
      expect(ctrl.canRedo()).toBe(false);
    });

    it('redo returns null when at end', () => {
      ctrl.pushEdit(entry);
      expect(ctrl.redo()).toBeNull();
    });

    it('pushEdit discards redo entries after current position', () => {
      ctrl.pushEdit(entry);
      ctrl.undo();
      const entry2 = { ...entry, newValue: 'Carol' };
      ctrl.pushEdit(entry2);
      expect(ctrl.canRedo()).toBe(false);
    });

    it('clearHistory resets undo/redo state', () => {
      ctrl.pushEdit(entry);
      ctrl.clearHistory();
      expect(ctrl.canUndo()).toBe(false);
      expect(ctrl.canRedo()).toBe(false);
    });

    it('pushEditBatch stores multiple edits as one step', () => {
      const batch = [
        { rowIndex: 0, field: 'a', oldValue: 1, newValue: 2 },
        { rowIndex: 1, field: 'b', oldValue: 3, newValue: 4 },
      ];
      ctrl.pushEditBatch(batch);
      const result = ctrl.undo();
      expect(Array.isArray(result)).toBe(true);
      expect(ctrl.canUndo()).toBe(false);
    });

    it('ignores empty pushEditBatch', () => {
      ctrl.pushEditBatch([]);
      expect(ctrl.canUndo()).toBe(false);
    });
  });

  // ── Grouping ─────────────────────────────────────────────────────────────────

  describe('groupByField', () => {
    it('setGroupBy stores the field', () => {
      const ctrl = new AgridControl();
      ctrl.setGroupBy('dept');
      expect(ctrl.groupByField()).toBe('dept');
    });

    it('setGroupBy null clears grouping', () => {
      const ctrl = new AgridControl({ groupByField: 'dept' });
      ctrl.setGroupBy(null);
      expect(ctrl.groupByField()).toBeNull();
    });
  });
});
