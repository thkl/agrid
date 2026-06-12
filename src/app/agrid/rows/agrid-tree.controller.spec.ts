import { describe, it, expect, beforeEach } from 'vitest';
import { AgridTreeController } from './agrid-tree.controller';

describe('AgridTreeController', () => {
  let controller: AgridTreeController;

  beforeEach(() => {
    controller = new AgridTreeController();
  });

  it('starts with nothing expanded', () => {
    expect(controller.expandedIds().size).toBe(0);
    expect(controller.isExpanded(1)).toBe(false);
  });

  it('toggles a node on and off', () => {
    controller.toggle(1);
    expect(controller.isExpanded(1)).toBe(true);
    controller.toggle(1);
    expect(controller.isExpanded(1)).toBe(false);
  });

  it('toggles nodes independently', () => {
    controller.toggle(1);
    controller.toggle('a');
    expect(controller.isExpanded(1)).toBe(true);
    expect(controller.isExpanded('a')).toBe(true);
    controller.toggle(1);
    expect(controller.isExpanded(1)).toBe(false);
    expect(controller.isExpanded('a')).toBe(true);
  });

  it('sets explicit expanded state idempotently', () => {
    const before = controller.expandedIds();
    controller.setExpanded(1, false); // already collapsed → no change
    expect(controller.expandedIds()).toBe(before); // same reference, no churn

    controller.setExpanded(1, true);
    expect(controller.isExpanded(1)).toBe(true);
    const after = controller.expandedIds();
    controller.setExpanded(1, true); // already expanded → no change
    expect(controller.expandedIds()).toBe(after);
  });

  it('expands all supplied ids, replacing prior state', () => {
    controller.toggle('stale');
    controller.expandAll([1, 2, 3]);
    expect([...controller.expandedIds()].sort()).toEqual([1, 2, 3]);
    expect(controller.isExpanded('stale')).toBe(false);
  });

  it('collapses everything', () => {
    controller.expandAll([1, 2, 3]);
    controller.collapseAll();
    expect(controller.expandedIds().size).toBe(0);
  });

  it('emits a new set instance on mutation for change detection', () => {
    const first = controller.expandedIds();
    controller.toggle(1);
    expect(controller.expandedIds()).not.toBe(first);
  });
});
