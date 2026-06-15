import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AgridLocaleText, AGRID_LOCALE_TEXT } from '../agrid-localization';
import { FilterOperator } from '../agrid-control';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';

/** Clamp a floating menu so it remains inside the browser viewport. @internal */
export function fitColumnMenuToViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 8,
): { x: number; y: number } {
  return {
    x: Math.max(margin, Math.min(x, viewportWidth - width - margin)),
    y: Math.max(margin, Math.min(y, viewportHeight - height - margin)),
  };
}

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
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = new AgridBrowserAdapter();
  private resizeObserver: ResizeObserver | null = null;

  /** Localized labels used in the menu. */
  localeText = input<AgridLocaleText>(AGRID_LOCALE_TEXT.en);

  /** Fixed viewport x-position for the menu. */
  x = input.required<number>();

  /** Fixed viewport y-position for the menu. */
  y = input.required<number>();

  /** Viewport-fitted coordinates used by the rendered menu. */
  readonly position = signal({ x: 0, y: 0 });

  /** Header label for the active column. */
  header = input.required<string>();

  /** Current sort direction for the active column. */
  sortDir = input<'asc' | 'desc' | null>(null);

  /** Whether sort controls are available for this grid. */
  sortable = input<boolean>(true);

  /** Whether stateful column actions should be shown. */
  showColumnActions = input<boolean>(false);

  /** Current pin state of the active column. */
  pinned = input<'left' | 'right' | false>(false);

  /** Whether the active column supports grouping. */
  groupable = input<boolean>(false);

  /** Whether the grid is currently grouped by the active column. */
  grouped = input<boolean>(false);

  /** Whether the active column supports value-filter controls. */
  filterable = input<boolean>(false);

  /** Whether to show the Excel-style distinct-value picker. */
  showValueFilter = input<boolean>(true);

  /** Condition-filter input type for the active column, or `null` to hide the condition UI. */
  filterType = input<'text' | 'number' | 'date' | null>(null);

  /** Current condition operator, or `null` when none is selected. */
  operator = input<FilterOperator | null>(null);

  /** Current primary condition operand. */
  operand = input<string>('');

  /** Current secondary condition operand (used by `between`). */
  operand2 = input<string>('');

  /** Emits the selected condition operator, or `null` to clear it. */
  operatorChange = output<FilterOperator | null>();

  /** Emits the primary condition operand text. */
  operandChange = output<string>();

  /** Emits the secondary condition operand text (used by `between`). */
  operand2Change = output<string>();

  /** Current search text for the value-filter option list. */
  search = input<string>('');

  /** Whether the value filter currently allows every value. */
  allSelected = input<boolean>(true);

  /** Visible value-filter option rows. */
  valueItems = input<AgridColumnMenuValueItem[]>([]);

  /** 1-based priority of this column in the current multi-sort stack (0 = not sorted). */
  sortPriority = input<number>(0);

  /** Whether more than one column is currently sorted. */
  hasMultiSort = input<boolean>(false);

  /**
   * Emits a sort direction — toggles this column in the multi-sort stack
   * (adds if not sorted, clears if same direction clicked again).
   */
  sort = output<'asc' | 'desc'>();

  /** Emits to replace all sorts with only this column at the given direction. */
  resetSort = output<'asc' | 'desc'>();

  /** Requests autosizing the active column. */
  autosize = output<void>();

  /** Requests toggling left-pin for the active column. */
  togglePin = output<void>();

  /** Requests toggling right-pin for the active column. */
  togglePinRight = output<void>();

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

  /** Active aggregate function for this column set via the control, or `null` if none. */
  aggregate = input<'sum' | 'avg' | 'min' | 'max' | 'count' | null>(null);

  /** Emits the aggregate to set, or `null` to clear it. */
  setAggregate = output<'sum' | 'avg' | 'min' | 'max' | 'count' | null>();

  readonly aggregateOptions = computed(() => {
    const t = this.localeText();
    return [
      { value: 'sum'   as const, symbol: 'Σ', label: t.aggregateSum },
      { value: 'avg'   as const, symbol: 'Ø', label: t.aggregateAvg },
      { value: 'min'   as const, symbol: '↓', label: t.aggregateMin },
      { value: 'max'   as const, symbol: '↑', label: t.aggregateMax },
      { value: 'count' as const, symbol: '#', label: t.aggregateCount },
    ];
  });

  /** Condition operators offered for the active column, labeled per column type. */
  readonly operatorOptions = computed<{ value: FilterOperator; label: string }[]>(() => {
    const t = this.localeText();
    if (this.filterType() === 'date') {
      return [
        { value: 'eq',      label: t.filterOpOn },
        { value: 'lt',      label: t.filterOpBefore },
        { value: 'gt',      label: t.filterOpAfter },
        { value: 'between', label: t.filterOpBetween },
      ];
    }
    if (this.filterType() === 'text') {
      return [
        { value: 'eq',          label: t.filterOpEquals },
        { value: 'neq',         label: t.filterOpNotEquals },
        { value: 'like',        label: t.filterOpLike },
        { value: 'startsWith',  label: t.filterOpStartsWith },
        { value: 'endsWith',    label: t.filterOpEndsWith },
        { value: 'includes',    label: t.filterOpIncludes },
        { value: 'notIncludes', label: t.filterOpNotIncludes },
      ];
    }
    return [
      { value: 'eq',      label: t.filterOpEquals },
      { value: 'neq',     label: t.filterOpNotEquals },
      { value: 'gt',      label: t.filterOpGreater },
      { value: 'gte',     label: t.filterOpGreaterEqual },
      { value: 'lt',      label: t.filterOpLess },
      { value: 'lte',     label: t.filterOpLessEqual },
      { value: 'between', label: t.filterOpBetween },
    ];
  });

  /** Native input type for operand fields (date columns use a date picker). */
  readonly operandInputType = computed(() =>
    this.filterType() === 'date' ? 'date' : this.filterType() === 'number' ? 'number' : 'text',
  );

  constructor() {
    effect(() => {
      this.position.set({ x: this.x(), y: this.y() });
      this.scheduleViewportFit();
    });

    afterNextRender(() => {
      const menu = this.menuElement();
      this.fitToViewport();
      if (menu && typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.fitToViewport());
        this.resizeObserver.observe(menu);
      }
    });

    this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
  }

  private scheduleViewportFit(): void {
    setTimeout(() => this.fitToViewport());
  }

  private fitToViewport(): void {
    const menu = this.menuElement();
    if (!menu || !this.browser.available) return;
    const rect = menu.getBoundingClientRect();
    this.position.set(fitColumnMenuToViewport(
      this.x(),
      this.y(),
      rect.width,
      rect.height,
      this.browser.viewportWidth(),
      this.browser.viewportHeight(),
    ));
  }

  private menuElement(): HTMLElement | null {
    return this.elementRef.nativeElement.querySelector<HTMLElement>('.ag-filter-menu');
  }
}
