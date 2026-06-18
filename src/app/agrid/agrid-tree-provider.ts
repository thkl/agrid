import { AgridDataSource } from './agrid-datasource';
import { AgridTreeConfig, AgridTreeSelectionMode } from './agrid.types';

/** Configuration accepted by {@link AgridTreeProvider}. */
export interface AgridTreeProviderConfig<T extends object> {
  datasource: AgridDataSource<T>;
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
  readonly datasource: AgridDataSource<T>;
  readonly treeConfig: AgridTreeConfig<T>;
  readonly getLabel?: (row: T) => string;
  readonly getDescription?: (row: T) => string | undefined;
  readonly selection: AgridTreeSelectionMode;
  readonly rowHeight: number;
  readonly ariaLabel: string;
  readonly emptyText: string;

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
