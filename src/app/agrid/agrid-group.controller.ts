import { Signal, signal } from '@angular/core';
import { AgridControl } from './agrid-control';
import { GridItem, GroupAction } from './agrid.types';
import { isGroupHeaderItem } from './agrid.utils';

/** Expanded group labels associated with the active grouping field. @internal */
export type AgridExpandedGroups = {
  field: string | null;
  labels: Set<string>;
};

/** Dependencies required by {@link AgridGroupController}. @internal */
export interface AgridGroupControllerOptions {
  control: Signal<AgridControl | null>;
  groupDescription: Signal<((label: string) => string) | null>;
}

/** Owns group expansion state and the group-action context menu. @internal */
export class AgridGroupController {
  readonly expandedGroups = signal<AgridExpandedGroups>({
    field: null,
    labels: new Set(),
  });
  readonly actionsMenu = signal<{ x: number; y: number; label: string } | null>(null);

  constructor(private readonly opts: AgridGroupControllerOptions) {}

  /** Toggles one group label within the active grouping field. */
  toggle(label: string): void {
    const groupField = this.opts.control()?.groupByField() ?? null;
    this.expandedGroups.update(state => {
      const labels = state.field === groupField ? new Set(state.labels) : new Set<string>();
      if (labels.has(label)) labels.delete(label);
      else labels.add(label);
      return { field: groupField, labels };
    });
  }

  /** Expands every group header present in the supplied projection. */
  expandAll(items: GridItem[]): void {
    const groupField = this.opts.control()?.groupByField() ?? null;
    if (!groupField) return;
    const labels = new Set<string>();
    for (const item of items) {
      if (isGroupHeaderItem(item)) labels.add(item.groupLabel);
    }
    this.expandedGroups.set({ field: groupField, labels });
  }

  /** Collapses all groups for the active grouping field. */
  collapseAll(): void {
    const groupField = this.opts.control()?.groupByField() ?? null;
    this.expandedGroups.set({ field: groupField, labels: new Set() });
  }

  /** Returns the configured description for a group label. */
  getDescription(label: string): string {
    return this.opts.groupDescription()?.(label) ?? '';
  }

  /** Opens the action menu for a group label. */
  openActionsMenu(event: MouseEvent, label: string): void {
    event.stopPropagation();
    this.actionsMenu.set({ x: event.clientX, y: event.clientY, label });
  }

  /** Closes the group action menu. */
  closeActionsMenu(): void {
    this.actionsMenu.set(null);
  }

  /** Runs a group action and closes its menu. */
  runAction(action: GroupAction, label: string): void {
    action.action(label);
    this.closeActionsMenu();
  }
}
