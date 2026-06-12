import { signal } from '@angular/core';

/**
 * Owns the expand/collapse state of a hierarchical (tree) grid.
 *
 * Expansion is keyed by **node id** (from {@link AgridTreeConfig.getId}), independent of any
 * column or grouping field, so it works at arbitrary depth. Ids that no longer exist in the
 * data simply never match and are harmless, so the state does not need to be reset when the
 * underlying rows change.
 *
 * Mirrors {@link AgridGroupController} in spirit but is intentionally option-free — the grid
 * component supplies node ids to {@link expandAll} from the current data source.
 * @internal
 */
export class AgridTreeController {
  /** Ids of the nodes that are currently expanded (their children are visible). */
  readonly expandedIds = signal<Set<string | number>>(new Set());

  /** Returns `true` when the node with `id` is currently expanded. */
  isExpanded(id: string | number): boolean {
    return this.expandedIds().has(id);
  }

  /** Toggle the expanded state of a single node. */
  toggle(id: string | number): void {
    this.expandedIds.update(ids => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Explicitly expand or collapse a single node. */
  setExpanded(id: string | number, expanded: boolean): void {
    this.expandedIds.update(ids => {
      if (expanded === ids.has(id)) return ids;
      const next = new Set(ids);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Expand every node in `ids` (typically all expandable nodes in the data source). */
  expandAll(ids: Iterable<string | number>): void {
    this.expandedIds.set(new Set(ids));
  }

  /** Collapse every node. */
  collapseAll(): void {
    this.expandedIds.set(new Set());
  }
}
