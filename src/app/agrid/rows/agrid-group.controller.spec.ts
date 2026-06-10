import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AgridControl } from '../agrid-control';
import { AgridGroupController } from './agrid-group.controller';

describe('AgridGroupController', () => {
  it('toggles, expands, and collapses group labels', () => {
    const control = new AgridControl({ groupByField: 'department' });
    const controller = new AgridGroupController({
      control: signal(control),
      groupDescription: signal(label => `Group ${label}`),
    });

    controller.toggle('Sales');
    expect(controller.expandedGroups().labels.has('Sales')).toBe(true);

    controller.expandAll([
      { groupLabel: 'Sales', count: 1, collapsed: false },
      { groupLabel: 'Engineering', count: 1, collapsed: false },
    ]);
    expect([...controller.expandedGroups().labels]).toEqual(['Sales', 'Engineering']);

    controller.collapseAll();
    expect(controller.expandedGroups().labels.size).toBe(0);
    expect(controller.getDescription('Sales')).toBe('Group Sales');
  });

  it('runs a group action and closes the menu', () => {
    const action = vi.fn();
    const controller = new AgridGroupController({
      control: signal(new AgridControl()),
      groupDescription: signal(null),
    });
    controller.actionsMenu.set({ x: 1, y: 2, label: 'Sales' });

    controller.runAction({ label: 'Archive', action }, 'Sales');

    expect(action).toHaveBeenCalledWith('Sales');
    expect(controller.actionsMenu()).toBeNull();
  });
});
