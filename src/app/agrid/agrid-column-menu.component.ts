import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AgridLocaleText, AGRID_LOCALE_TEXT } from './agrid-localization';

/** Display model for one value-filter option in the column menu. */
export interface AgridColumnMenuValueItem {
  /** Human-readable value label shown in the menu. */
  label: string;
  /** Raw value string used by the filter state. */
  rawStr: string;
  /** Whether this value is present in the current cross-filtered row set. */
  active: boolean;
  /** Whether this value is currently selected in the value filter. */
  selected: boolean;
}

/** Floating column menu for sort, column actions, grouping, and value filters. */
@Component({
  selector: 'agrid-column-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agrid-column-menu.component.html',
  styleUrl: './agrid-column-menu.component.css',
})
export class AgridColumnMenuComponent {
  /** Localized labels used in the menu. */
  localeText = input<AgridLocaleText>(AGRID_LOCALE_TEXT.en);

  /** Fixed viewport x-position for the menu. */
  x = input.required<number>();

  /** Fixed viewport y-position for the menu. */
  y = input.required<number>();

  /** Header label for the active column. */
  header = input.required<string>();

  /** Current sort direction for the active column. */
  sortDir = input<'asc' | 'desc' | null>(null);

  /** Whether stateful column actions should be shown. */
  showColumnActions = input<boolean>(false);

  /** Whether the active column is currently pinned. */
  pinned = input<boolean>(false);

  /** Whether the active column supports grouping. */
  groupable = input<boolean>(false);

  /** Whether the grid is currently grouped by the active column. */
  grouped = input<boolean>(false);

  /** Whether the active column supports value-filter controls. */
  filterable = input<boolean>(false);

  /** Current search text for the value-filter option list. */
  search = input<string>('');

  /** Whether the value filter currently allows every value. */
  allSelected = input<boolean>(true);

  /** Visible value-filter option rows. */
  valueItems = input<AgridColumnMenuValueItem[]>([]);

  /** Emits a requested sort direction. Emitting the current direction clears sort upstream. */
  sort = output<'asc' | 'desc'>();

  /** Requests autosizing the active column. */
  autosize = output<void>();

  /** Requests toggling pin state for the active column. */
  togglePin = output<void>();

  /** Requests hiding the active column. */
  hide = output<void>();

  /** Requests toggling grouping for the active column. */
  toggleGroup = output<void>();

  /** Requests clearing filter and sort state for the active column. */
  clearFilter = output<void>();

  /** Requests clearing filter and sort state for every column. */
  clearAll = output<void>();

  /** Emits value-filter search text changes. */
  searchChange = output<string>();

  /** Requests selecting or deselecting all value-filter options. */
  toggleAll = output<void>();

  /** Requests toggling one value-filter option by raw string value. */
  toggleValue = output<string>();
}
