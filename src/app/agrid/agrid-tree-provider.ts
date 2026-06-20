import { AgridDataSource } from './agrid-datasource';
import { AgridTreeConfig, AgridTreeSelectionMode } from './agrid.types';

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
  /** Selection behavior. Defaults to `single`. */
  selection?: AgridTreeSelectionMode;
  /** Fixed node height in pixels. Defaults to `36`. */
  rowHeight?: number;
  /** Accessible name for the tree. Defaults to `Tree`. */
  ariaLabel?: string;
  /** Text shown when the datasource is empty. */
  emptyText?: string;
}

/** Provider-style configuration and datasource container for `<agrid-tree>`. */
export class AgridTreeProvider<T extends object = any> {
  /** Rows projected into the standalone tree. */
  readonly datasource: AgridDataSource<T>;
  /** Shared hierarchy configuration; column-specific aggregation is not used here. */
  readonly treeConfig: AgridTreeConfig<T>;
  /** Optional host label resolver for parent-linked datasource rows. */
  readonly getLabel?: (row: T) => string;
  /** Optional host resolver for secondary node text. */
  readonly getDescription?: (row: T) => string | undefined;
  /** Effective node selection behavior. */
  readonly selection: AgridTreeSelectionMode;
  /** Effective fixed node height in pixels. */
  readonly rowHeight: number;
  /** Effective accessible name applied to the tree root. */
  readonly ariaLabel: string;
  /** Effective empty-state message. */
  readonly emptyText: string;

  /** Normalize optional standalone-tree settings and retain the reactive datasource. */
  constructor(config: AgridTreeProviderConfig<T>) {
    this.datasource = config.datasource;
    this.treeConfig = config.treeConfig;
    this.getLabel = config.getLabel;
    this.getDescription = config.getDescription;
    this.selection = config.selection ?? 'single';
    this.rowHeight = config.rowHeight ?? 36;
    this.ariaLabel = config.ariaLabel ?? 'Tree';
    this.emptyText = config.emptyText ?? 'No items';
  }
}
