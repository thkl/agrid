import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AgridHeaderColumn, ColDef } from '../agrid.types';
import { AgridHeaderGroup } from '../columns/agrid-column-layout.model';
import { AgridLocaleText } from '../agrid-localization';

/** Which of the three grid panes this header belongs to. @internal */
export type AgridPaneVariant = 'left' | 'center' | 'right';

/** Payload for header interactions that need the original DOM event plus the target column. @internal */
export interface AgridPaneHeaderColumnEvent<E extends Event = Event> {
  event: E;
  field: string;
}

/** Payload for resize interactions, which operate on the full {@link ColDef}. @internal */
export interface AgridPaneHeaderResizeEvent<E extends Event = Event> {
  event: E;
  col: ColDef;
}

/** Payload for grabbing a grouped-header segment. @internal */
export interface AgridPaneHeaderGroupEvent {
  event: PointerEvent;
  fields: string[];
  label: string;
}

/**
 * Renders the grouped-header row, header-cell row, and inline filter row for a single grid pane.
 *
 * Presentational only: every binding is fed from the parent's header view-model
 * ({@link AgridHeaderColumn} / {@link AgridHeaderGroup}) and every interaction is re-emitted with
 * its original DOM event so {@link AgridComponent} keeps ownership of the behavior. The three panes
 * (`left` / `center` / `right`) differ only in a handful of variant-driven classes, the control
 * column (left), and the grouped badge (center/right) — all handled by {@link variant}.
 *
 * Host uses `display: contents` so it adds no layout box: the two header rows stay direct children
 * of the pane, preserving the existing flex/grid layout and CSS (no stylesheet rule targets the
 * header via a child combinator).
 *
 * Not intended for direct use — `AgridComponent` owns all inputs and outputs.
 */
@Component({
  selector: 'agrid-pane-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  templateUrl: './agrid-pane-header.component.html',
  styleUrl: './agrid-pane-header.component.css',
})
export class AgridPaneHeaderComponent {
  /** Which pane this header renders. Drives the small structural differences between panes. */
  readonly variant = input.required<AgridPaneVariant>();

  /** Grouped-header segments for this pane (empty when no header groups are configured). */
  readonly headerGroups = input.required<AgridHeaderGroup[]>();
  /** Per-column header view-model for this pane. */
  readonly columns = input.required<AgridHeaderColumn[]>();

  /** CSS `grid-template-columns` value for this pane. */
  readonly gridTemplateColumns = input.required<string>();
  /** Fixed pane width in px — applied for the `left` and `right` (pinned) variants. */
  readonly paneWidth = input.required<number>();
  /** Total content width in px — applied as `min-width` for the scrollable `center` variant. */
  readonly totalWidth = input.required<number>();

  readonly hasHeaderGroups = input.required<boolean>();
  readonly hasFilterableColumns = input.required<boolean>();
  readonly headerRowCount = input.required<number>();
  readonly showControlColumn = input.required<boolean>();
  readonly localeText = input.required<AgridLocaleText>();
  readonly pivotHeaderLabel = input<string | null | undefined>(null);
  readonly pivotRowColumnField = input<string | null | undefined>(null);
  readonly hasMultiSort = input.required<boolean>();
  /** Field of the column whose filter menu is currently open, for `aria-expanded`. */
  readonly filterMenuField = input<string | null>(null);
  /** Fields currently marked as complete columns. */
  readonly markedColumnFields = input<ReadonlySet<string>>(new Set());

  readonly headerGroupPointerDown = output<AgridPaneHeaderGroupEvent>();
  readonly colHeaderPointerDown = output<AgridPaneHeaderColumnEvent<PointerEvent>>();
  readonly colHeaderClick = output<AgridPaneHeaderColumnEvent<MouseEvent>>();
  readonly filterMenuOpen = output<AgridPaneHeaderColumnEvent<MouseEvent>>();
  readonly filterConditionMenuOpen = output<AgridPaneHeaderColumnEvent<MouseEvent>>();
  readonly textFilterChange = output<AgridPaneHeaderColumnEvent>();
  readonly resizeKeyDown = output<AgridPaneHeaderResizeEvent<KeyboardEvent>>();
  readonly resizeStart = output<AgridPaneHeaderResizeEvent<MouseEvent>>();
  readonly autosizeColumn = output<AgridPaneHeaderResizeEvent<MouseEvent>>();
}
