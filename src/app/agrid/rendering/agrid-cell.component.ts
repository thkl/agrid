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
import { ColDef, ValueOption } from '../agrid.types';
import {
  coerceDateInputValue,
  formatDateValue,
  getDateInputValue,
  looksLikeDate,
} from '../agrid.utils';

/**
 * Individual cell component used inside `AgridComponent`.
 *
 * Renders a read-only span when not editing, and an `<input>` or `<select>`
 * (for columns with `ColDef.values`) when in edit mode.
 *
 * Not intended for direct use — `AgridComponent` manages all inputs and outputs.
 */
@Component({
  selector: 'agrid-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'gridcell',
    '[class.selected]': 'selected()',
    '[class.editing]': 'editing()',
    '[class.ag-cell--tree]': 'treeCell()',
    '[attr.aria-readonly]': 'col().editable === false ? "true" : null',
    '(click)': 'activate.emit($event)',
    '(dblclick)': 'startEdit.emit()',
    tabindex: '-1',
  },
  template: `
    @if (editing()) {
      @if (col().values?.length) {
        <select
          #editSelect
          class="ag-cell-select"
          (change)="onSelectChange($event)"
        >
          @for (opt of valueOptions(); track opt.label; let idx = $index) {
            <option [value]="idx" [selected]="idx === selectedOptionIndex()">{{ opt.label }}</option>
          }
        </select>
      } @else {
        <input
          #editInput
          class="ag-cell-input"
          [type]="col().type === 'date' ? 'date' : col().type === 'number' ? 'number' : 'text'"
          [value]="editorValue()"
          (input)="onInput($event)"
        />
      }
    } @else {
      @if (treeCell()) {
        <span class="ag-tree-prefix" [style.padding-left.px]="treeLevel() * treeIndent">
          @if (treeExpandable()) {
            <button
              type="button"
              class="ag-tree-twisty"
              [class.ag-tree-twisty--expanded]="treeExpanded()"
              [attr.aria-label]="treeExpanded() ? 'Collapse' : 'Expand'"
              (click)="onTreeToggle($event)"
            >▶</button>
          } @else {
            <span class="ag-tree-twisty-spacer"></span>
          }
        </span>
      }
      @if (col().cellRenderer) {
        <span class="ag-cell-value" [innerHTML]="renderedHtml()"></span>
      } @else {
        <span class="ag-cell-value">{{ displayValue() }}</span>
      }
    }
  `,
  styleUrl: './agrid-cell.component.css',
})
export class AgridCellComponent {
  /** Column definition for this cell. */
  col = input.required<ColDef>();

  /** Absolute row index within the data source. */
  rowIndex = input.required<number>();

  /** Column index within `colDefs`. */
  colIndex = input.required<number>();

  /** Current field value from the data source (displayed when not editing). */
  value = input.required<unknown>();

  /** Full row data — passed to `cellRenderer` when set. */
  row = input<Record<string, unknown>>({});

  /** Locale used for built-in date formatting. */
  locale = input<string | undefined>(undefined);

  /** Whether this cell has the active selection outline. */
  selected = input<boolean>(false);

  /** Whether this cell is currently in edit mode. */
  editing = input<boolean>(false);

  /** Whether this cell is the tree column and should render indentation + a twisty. */
  treeCell = input<boolean>(false);

  /** Depth of the row in the tree (drives indentation). Root rows are `0`. */
  treeLevel = input<number>(0);

  /** Whether the row has children and can be expanded/collapsed. */
  treeExpandable = input<boolean>(false);

  /** Whether the row is currently expanded. */
  treeExpanded = input<boolean>(false);

  /** Emitted when the user clicks the expand/collapse twisty. */
  treeToggle = output<void>();

  /** Indentation in pixels applied per tree level. */
  readonly treeIndent = 16;

  /**
   * Optional character to pre-fill the edit input when the user presses a printable key
   * while the cell is selected (type-to-start-editing behavior).
   */
  seedChar = input<string>('');

  /**
   * Emitted on single click — the grid selects this cell.
   * For `values` columns the grid also enters edit mode immediately.
   */
  activate = output<MouseEvent>();

  /** Emitted on double-click — the grid enters edit mode. */
  startEdit = output<void>();

  /**
   * Emitted on every keystroke inside the edit input or on every select change.
   * The grid stores the latest value in `currentDraft` so it can commit on Tab / Enter.
   */
  draftChange = output<unknown>();

  /** Live draft value managed by the cell during an active edit. */
  readonly draft = signal<unknown>('');

  /** String value accepted by the active native input element. */
  readonly editorValue = computed((): string => {
    const draft = this.draft();
    return this.col().type === 'date'
      ? getDateInputValue(draft)
      : String(draft ?? '');
  });

  readonly renderedHtml = computed((): string => {
    const renderer = this.col().cellRenderer;
    if (!renderer) return '';
    return renderer({ value: this.value(), row: this.row() });
  });

  /**
   * Normalized list of value options (always `{ label, rawValue }` regardless of whether
   * `ColDef.values` is `string[]` or `ValueOption[]`).
   */
  readonly valueOptions = computed(() => {
    const vals = this.col().values ?? [];
    return vals.map(v =>
      typeof v === 'string'
        ? { label: v, rawValue: v as unknown }
        : { label: (v as ValueOption).label, rawValue: (v as ValueOption).value }
    );
  });

  /**
   * The string shown in the cell when not editing.
   * Priority: ValueOption label → `ColDef.formatter` → raw string.
   */
  readonly displayValue = computed((): string => {
    const raw = this.value();
    const col = this.col();

    if (col.values?.length) {
      const opt = col.values.find(v =>
        typeof v === 'string' ? v === raw : (v as ValueOption).value === raw
      );
      if (opt !== undefined) return typeof opt === 'string' ? opt : (opt as ValueOption).label;
    }

    if (col.formatter) return col.formatter(raw);
    if (col.type === 'date' || looksLikeDate(raw)) {
      return formatDateValue(raw, this.locale(), col.type === 'date');
    }
    return String(raw ?? '');
  });

  /**
   * Index of the currently selected option in `valueOptions`.
   * Used to drive `<option [value]="idx" [selected]="idx === selectedOptionIndex()">`.
   * Index-based approach avoids string/type coercion for non-string raw values.
   */
  readonly selectedOptionIndex = computed((): number => {
    const raw = this.draft();
    return this.valueOptions().findIndex(o => o.rawValue === raw);
  });

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('editInput');
  private readonly selectEl = viewChild<ElementRef<HTMLSelectElement>>('editSelect');

  constructor() {
    effect(() => {
      if (this.editing()) {
        const seed = this.seedChar();
        const isDate = this.col().type === 'date';
        const existingDate = isDate ? getDateInputValue(this.value()) : '';
        const dateInitial = existingDate || (isDate && seed === '' ? new Date().toISOString().slice(0, 10) : '');
        const initialValue = isDate
          ? dateInitial
          : seed !== '' ? seed : this.value();
        this.draft.set(initialValue);

        setTimeout(() => {
          const input = this.inputEl()?.nativeElement;
          if (input) {
            const displaySeed = isDate
              ? dateInitial
              : seed !== '' ? seed : String(this.value() ?? '');
            input.value = displaySeed;
            input.focus();
            if (input.type === 'text' && !seed) input.select();
            else if (input.type === 'text') {
              const len = displaySeed.length;
              input.setSelectionRange(len, len);
            }
            return;
          }

          const sel = this.selectEl()?.nativeElement;
          if (sel) {
            const idx = this.selectedOptionIndex();
            if (idx >= 0) sel.value = String(idx);
            sel.focus();
            try {
              (sel as HTMLSelectElement & { showPicker?: () => void }).showPicker?.();
            } catch {
              sel.click();
            }
          }
        });
      }
    });
  }

  /** Emit a tree expand/collapse request without selecting or editing the cell. */
  onTreeToggle(event: MouseEvent): void {
    event.stopPropagation();
    this.treeToggle.emit();
  }

  /** Forward `<input>` changes to the grid. */
  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const draft = this.col().type === 'date'
      ? coerceDateInputValue(val, this.value())
      : val;
    this.draft.set(draft);
    this.draftChange.emit(draft);
  }

  /**
   * Forward `<select>` changes to the grid.
   * Maps the option index back to the raw value (preserves original type — number, object, etc.).
   */
  onSelectChange(event: Event): void {
    const idx = Number((event.target as HTMLSelectElement).value);
    const opts = this.valueOptions();
    const rawValue = opts[idx]?.rawValue ?? '';
    this.draft.set(rawValue);
    this.draftChange.emit(rawValue);
  }
}
