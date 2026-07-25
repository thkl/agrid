import { signal } from '@angular/core';
import { AgridDataSource } from './agrid-datasource';
import {
  AgridTreeConfig,
  AgridTreeContextMenuItem,
  AgridTreeNodeEvent,
  AgridTreeSelectionMode,
} from './agrid.types';

/** Root payload returned by a server-backed standalone tree. */
export interface AgridServerTreeRoot<T extends object> {
  /** Initial root-level rows. */
  rows: T[];
  /** Optional tree config resolved with the root payload. */
  treeConfig?: AgridTreeConfig<T>;
}

/** Child payload returned when a server-backed tree node expands. */
export interface AgridServerTreeChildren<T extends object> {
  /** Child rows to append to the provider datasource. */
  rows: T[];
}

/** Parameters passed to a server child loader. */
export interface AgridServerTreeChildrenRequest<T extends object> {
  /** Normalized event view of the node being expanded. */
  node: AgridTreeNodeEvent<T>;
  /** Stable node id resolved from `treeConfig.getId(row)`. */
  id: string | number;
  /** Original datasource row for the node being expanded. */
  row: T;
}

/** Async datasource hooks for the standalone tree control. */
export interface AgridServerTreeConfig<T extends object> {
  /**
   * Load the initial root rows. The response may replace the local `treeConfig` when the
   * server also determines hierarchy metadata.
   */
  loadRoot: () => Promise<T[] | AgridServerTreeRoot<T>>;
  /** Load children for a node the first time it expands. */
  loadChildren: (
    request: AgridServerTreeChildrenRequest<T>,
  ) => Promise<T[] | AgridServerTreeChildren<T>>;
  /** Return `true` for rows that can request children even before any child rows exist locally. */
  hasChildren?: (row: T) => boolean;
  /** Cache child responses after the first successful expansion. Defaults to `true`. */
  cacheChildren?: boolean;
  /** Text shown while root rows are loading. */
  rootLoadingText?: string;
  /** Text exposed to assistive tech while children are loading. */
  childLoadingText?: string;
  /** Optional host-level error hook. */
  onError?: (error: unknown, request: 'root' | AgridServerTreeChildrenRequest<T>) => void;
}

/** Configuration accepted by {@link AgridTreeProvider}. */
export interface AgridTreeProviderConfig<T extends object> {
  /** Flat datasource whose rows are linked by parent ids or path segments. */
  datasource: AgridDataSource<T>;
  /**
   * Hierarchy, identity, labeling, filtering, and initial-expansion configuration.
   * `aggregateTreeNodes` is ignored because the standalone tree has no grid columns.
   */
  treeConfig: AgridTreeConfig<T>;
  /** Label for parent-linked rows. Defaults to the configured `treeField` value. */
  getLabel?: (row: T) => string;
  /** Optional secondary text shown beneath a row label. */
  getDescription?: (row: T) => string | undefined;
  /** Optional CSS class names applied to data-row tree nodes. */
  getNodeClass?: (row: T) => string;
  /** Optional context menu items for data-row and generated-branch tree nodes. */
  contextMenuItems?: (node: AgridTreeNodeEvent<T>) => AgridTreeContextMenuItem[];
  /** Selection behavior. Defaults to `single`. */
  selection?: AgridTreeSelectionMode;
  /** Fixed node height in pixels. Defaults to `36`. */
  rowHeight?: number;
  /** Accessible name for the tree. Defaults to `Tree`. */
  ariaLabel?: string;
  /** Text shown when the datasource is empty. */
  emptyText?: string;
  /** Optional async loaders for server-backed root and child rows. */
  serverTree?: AgridServerTreeConfig<T>;
}

/** Provider-style configuration and datasource container for `<agrid-tree>`. */
export class AgridTreeProvider<T extends object = any> {
  /** Rows projected into the standalone tree. */
  readonly datasource: AgridDataSource<T>;
  /** Shared hierarchy configuration; column-specific aggregation is not used here. */
  treeConfig: AgridTreeConfig<T>;
  /** Optional host label resolver for parent-linked datasource rows. */
  readonly getLabel?: (row: T) => string;
  /** Optional host resolver for secondary node text. */
  readonly getDescription?: (row: T) => string | undefined;
  /** Optional host resolver for data-row node CSS class names. */
  readonly getNodeClass?: (row: T) => string;
  /** Optional host resolver for per-node context menu items. */
  readonly contextMenuItems?: (node: AgridTreeNodeEvent<T>) => AgridTreeContextMenuItem[];
  /** Effective node selection behavior. */
  readonly selection: AgridTreeSelectionMode;
  /** Effective fixed node height in pixels. */
  readonly rowHeight: number;
  /** Effective accessible name applied to the tree root. */
  readonly ariaLabel: string;
  /** Effective empty-state message. */
  readonly emptyText: string;
  /** Optional async server-tree hooks. */
  readonly serverTree?: AgridServerTreeConfig<T>;
  /** Whether the root payload is currently being requested. */
  readonly rootLoading = signal(false);
  /** Latest async load error, if any. */
  readonly loadError = signal<unknown>(null);
  /** Node ids whose children are currently being requested. */
  readonly loadingNodeIds = signal<Set<string | number>>(new Set());
  /** Node ids whose children have already loaded successfully. */
  readonly loadedNodeIds = signal<Set<string | number>>(new Set());

  private rootLoaded = false;

  /** Normalize optional standalone-tree settings and retain the reactive datasource. */
  constructor(config: AgridTreeProviderConfig<T>) {
    this.datasource = config.datasource;
    this.treeConfig = config.treeConfig;
    this.getLabel = config.getLabel;
    this.getDescription = config.getDescription;
    this.getNodeClass = config.getNodeClass;
    this.contextMenuItems = config.contextMenuItems;
    this.selection = config.selection ?? 'single';
    this.rowHeight = config.rowHeight ?? 36;
    this.ariaLabel = config.ariaLabel ?? 'Tree';
    this.emptyText = config.emptyText ?? 'No items';
    this.serverTree = config.serverTree;
  }

  /** True when this provider should lazily request rows from a server. */
  get serverBacked(): boolean {
    return !!this.serverTree;
  }

  /** Load the root payload once for server-backed trees. */
  async loadRoot(): Promise<void> {
    if (!this.serverTree || this.rootLoaded || this.rootLoading()) return;
    this.rootLoading.set(true);
    this.loadError.set(null);
    try {
      const result = await this.serverTree.loadRoot();
      const root = Array.isArray(result) ? { rows: result } : result;
      if (root.treeConfig) this.treeConfig = root.treeConfig;
      this.datasource.setData(root.rows);
      this.rootLoaded = true;
    } catch (error) {
      this.loadError.set(error);
      this.serverTree.onError?.(error, 'root');
    } finally {
      this.rootLoading.set(false);
    }
  }

  /** Return whether a row should present an expander before local children exist. */
  hasServerChildren(row: T): boolean {
    return !!this.serverTree?.hasChildren?.(row);
  }

  /** Return whether the node is currently loading children. */
  isNodeLoading(id: string | number): boolean {
    return this.loadingNodeIds().has(id);
  }

  /** Load a node's children unless a cached response already exists. */
  async loadChildren(request: AgridServerTreeChildrenRequest<T>): Promise<boolean> {
    const serverTree = this.serverTree;
    if (!serverTree) return true;
    const cacheChildren = serverTree.cacheChildren ?? true;
    if (cacheChildren && this.loadedNodeIds().has(request.id)) return true;
    if (this.loadingNodeIds().has(request.id)) return false;

    this.loadingNodeIds.update(ids => new Set(ids).add(request.id));
    this.loadError.set(null);
    try {
      const result = await serverTree.loadChildren(request);
      const children = Array.isArray(result) ? result : result.rows;
      if (children.length) {
        this.datasource.setData([...this.datasource.rows(), ...children]);
      }
      if (cacheChildren) {
        this.loadedNodeIds.update(ids => new Set(ids).add(request.id));
      }
      return true;
    } catch (error) {
      this.loadError.set(error);
      serverTree.onError?.(error, request);
      return false;
    } finally {
      this.loadingNodeIds.update(ids => {
        const next = new Set(ids);
        next.delete(request.id);
        return next;
      });
    }
  }
}
