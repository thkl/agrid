import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AgridDataSource } from './agrid-datasource';
import { AgridLocaleText, AGRID_LOCALE_TEXT } from './agrid-localization';
import { AgridTreeProvider } from './agrid-tree-provider';
import { AgridTreeController } from './rows/agrid-tree.controller';
import {
  AgridTreeNodeEvent,
  AgridTreeSelectionEvent,
  GridItem,
  PathTreeNodeItem,
  TreeRowItem,
} from './agrid.types';
import {
  buildPathTreeItems,
  buildTreeItems,
  defaultExpandedTreeIds,
  isPathTreeConfig,
} from './agrid.utils';

type StandaloneTreeItem<T extends object> = TreeRowItem<T> | PathTreeNodeItem;

function isPathNode<T extends object>(item: StandaloneTreeItem<T>): item is PathTreeNodeItem {
  return 'pathNodeId' in item;
}

/** Standalone accessible tree control backed by the same projection logic as `AgridComponent`. */
@Component({
  selector: 'agrid-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agrid-tree.component.html',
  styleUrl: './agrid-tree.component.css',
  host: { '[style.--agrid-tree-row-height.px]': 'provider().rowHeight' },
})
export class AgridTreeComponent<T extends object = any> {
  provider = input.required<AgridTreeProvider<T>>();
  localeText = input<AgridLocaleText>(AGRID_LOCALE_TEXT.en);

  nodeClick = output<AgridTreeNodeEvent<T>>();
  nodeDoubleClicked = output<AgridTreeNodeEvent<T>>();
  selectionChange = output<AgridTreeSelectionEvent<T>>();

  private readonly treeController = new AgridTreeController();
  private readonly treeElement = viewChild<ElementRef<HTMLElement>>('tree');
  private initializedProvider: AgridTreeProvider<T> | null = null;

  readonly focusedIndex = signal(0);
  readonly selectedKeys = signal<Set<string>>(new Set());
  readonly expandedIds = this.treeController.expandedIds;

  readonly items = computed<StandaloneTreeItem<T>[]>(() => {
    const provider = this.provider();
    const rows = provider.datasource.rows();
    const indices = rows.map((_, index) => index);
    const config = provider.treeConfig;
    const projected: GridItem<T>[] = isPathTreeConfig(config)
      ? buildPathTreeItems(rows, indices, config, this.expandedIds())
      : buildTreeItems(rows, indices, config, this.expandedIds());
    return projected.filter((item): item is StandaloneTreeItem<T> =>
      item !== null && typeof item === 'object' && 'level' in item
      && ('pathNodeId' in item || 'row' in item),
    ).map(item => this.withServerExpansionState(provider, item));
  });

  constructor() {
    effect(() => {
      const provider = this.provider();
      if (provider === this.initializedProvider) return;
      this.initializedProvider = provider;
      this.selectedKeys.set(new Set());
      this.focusedIndex.set(0);
      this.collapseAllNodes();
      if (!provider.serverBacked) {
        this.applyDefaultExpansion(provider);
        return;
      }
      void provider.loadRoot().then(() => {
        if (this.provider() !== provider) return;
        this.applyDefaultExpansion(provider);
      });
    });
  }

  /** Expands every branch currently represented by the datasource. */
  expandAllNodes(): void {
    const provider = this.provider();
    this.treeController.expandAll(defaultExpandedTreeIds(
      provider.datasource.rows(),
      { ...provider.treeConfig, defaultExpanded: true },
      row => provider.hasServerChildren(row),
    ));
  }

  /** Applies the provider's configured initial expansion state. */
  private applyDefaultExpansion(provider: AgridTreeProvider<T>): void {
    this.treeController.expandAll(defaultExpandedTreeIds(
      provider.datasource.rows(),
      provider.treeConfig,
      row => provider.hasServerChildren(row),
    ));
  }

  /** Collapses every branch. */
  collapseAllNodes(): void {
    this.treeController.collapseAll();
  }

  /** Toggles one expandable node. */
  toggleNode(item: StandaloneTreeItem<T>): void {
    if (!item.expandable) return;
    if (item.expanded) {
      this.treeController.setExpanded(this.expansionId(item), false);
      return;
    }
    void this.expandNode(item);
  }

  /** @internal */
  label(item: StandaloneTreeItem<T>): string {
    if (isPathNode(item)) return item.pathLabel;
    if (item.treeLabel !== undefined) return item.treeLabel;
    const provider = this.provider();
    return provider.getLabel?.(item.row) ?? String(item.row[provider.treeConfig.treeField] ?? '');
  }

  /** @internal */
  description(item: StandaloneTreeItem<T>): string | undefined {
    return isPathNode(item) ? undefined : this.provider().getDescription?.(item.row);
  }

  /** @internal */
  isLoading(item: StandaloneTreeItem<T>): boolean {
    return !isPathNode(item) && this.provider().isNodeLoading(this.expansionId(item));
  }

  /** @internal */
  isSelected(item: StandaloneTreeItem<T>): boolean {
    return this.selectedKeys().has(this.selectionKey(item));
  }

  /** @internal */
  onNodeClick(event: MouseEvent, item: StandaloneTreeItem<T>, index: number): void {
    event.stopPropagation();
    this.focusedIndex.set(index);
    this.select(item, event.metaKey || event.ctrlKey);
    this.nodeClick.emit(this.toEvent(item));
  }

  /** @internal */
  onNodeDoubleClick(event: MouseEvent, item: StandaloneTreeItem<T>): void {
    event.stopPropagation();
    this.nodeDoubleClicked.emit(this.toEvent(item));
  }

  /** @internal */
  onKeydown(event: KeyboardEvent, item: StandaloneTreeItem<T>, index: number): void {
    const items = this.items();
    if (event.key === 'ArrowDown') return this.moveFocus(event, Math.min(index + 1, items.length - 1));
    if (event.key === 'ArrowUp') return this.moveFocus(event, Math.max(index - 1, 0));
    if (event.key === 'Home') return this.moveFocus(event, 0);
    if (event.key === 'End') return this.moveFocus(event, items.length - 1);
    if (event.key === 'ArrowRight' && item.expandable) {
      event.preventDefault();
      if (!item.expanded) this.toggleNode(item);
      else this.moveFocus(event, Math.min(index + 1, items.length - 1));
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (item.expandable && item.expanded) this.toggleNode(item);
      else {
        const parent = this.findParentIndex(index, item.level);
        if (parent >= 0) this.focusNode(parent);
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(item, event.metaKey || event.ctrlKey);
      this.nodeClick.emit(this.toEvent(item));
    }
  }

  /** @internal */
  trackItem(_index: number, item: StandaloneTreeItem<T>): string {
    return this.selectionKey(item);
  }

  private select(item: StandaloneTreeItem<T>, additive: boolean): void {
    const mode = this.provider().selection;
    if (mode === 'none') return;
    const key = this.selectionKey(item);
    this.selectedKeys.update(current => {
      const next = mode === 'multi' && additive ? new Set(current) : new Set<string>();
      if (mode === 'multi' && additive && next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    const selected = this.items().filter(candidate => this.selectedKeys().has(this.selectionKey(candidate)));
    this.selectionChange.emit({ nodes: selected.map(candidate => this.toEvent(candidate)) });
  }

  private toEvent(item: StandaloneTreeItem<T>): AgridTreeNodeEvent<T> {
    if (isPathNode(item)) {
      return {
        kind: 'branch', id: item.pathNodeId, uuid: item.uuid, label: item.pathLabel,
        level: item.level, expandable: true, expanded: item.expanded,
      };
    }
    const config = this.provider().treeConfig;
    const id = isPathTreeConfig(config) ? item.originalIndex : config.getId(item.row);
    return {
      kind: 'row', id, label: this.label(item), level: item.level,
      expandable: item.expandable, expanded: item.expanded,
      row: item.row, originalIndex: item.originalIndex,
    };
  }

  private expansionId(item: StandaloneTreeItem<T>): string | number {
    if (isPathNode(item)) return item.pathNodeId;
    const config = this.provider().treeConfig;
    return isPathTreeConfig(config) ? item.originalIndex : config.getId(item.row);
  }

  private selectionKey(item: StandaloneTreeItem<T>): string {
    return isPathNode(item)
      ? `branch:${item.pathNodeId}`
      : `row:${this.expansionId(item)}`;
  }

  private moveFocus(event: KeyboardEvent, index: number): void {
    event.preventDefault();
    this.focusNode(index);
  }

  private focusNode(index: number): void {
    this.focusedIndex.set(index);
    queueMicrotask(() => this.treeElement()?.nativeElement
      .querySelector<HTMLElement>(`[data-tree-index="${index}"]`)?.focus());
  }

  private findParentIndex(index: number, level: number): number {
    for (let candidate = index - 1; candidate >= 0; candidate--) {
      if (this.items()[candidate].level < level) return candidate;
    }
    return -1;
  }

  private withServerExpansionState(
    provider: AgridTreeProvider<T>,
    item: StandaloneTreeItem<T>,
  ): StandaloneTreeItem<T> {
    if (isPathNode(item) || !provider.hasServerChildren(item.row)) return item;
    const id = this.expansionId(item);
    return {
      ...item,
      expandable: true,
      expanded: this.expandedIds().has(id),
    };
  }

  private async expandNode(item: StandaloneTreeItem<T>): Promise<void> {
    const id = this.expansionId(item);
    if (isPathNode(item)) {
      this.treeController.setExpanded(id, true);
      return;
    }
    const provider = this.provider();
    if (!provider.serverBacked) {
      this.treeController.setExpanded(id, true);
      return;
    }
    const loaded = await provider.loadChildren({
      node: this.toEvent(item),
      id,
      row: item.row,
    });
    if (loaded) this.treeController.setExpanded(id, true);
  }
}
