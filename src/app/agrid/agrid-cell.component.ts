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
import { ColDef, ValueOption } from './agrid.types';

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
    '[class.selected]': 'selected()',
    '[class.editing]': 'editing()',
    '(click)': 'activate.emit()',
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
          [value]="draft()"
          (input)="onInput($event)"
        />
      }
    } @else {
      <span class="ag-cell-value">{{ displayValue() }}</span>
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

  /** Whether this cell has the active selection outline. */
  selected = input<boolean>(false);

  /** Whether this cell is currently in edit mode. */
  editing = input<boolean>(false);

  /**
   * Optional character to pre-fill the edit input when the user presses a printable key
   * while the cell is selected (type-to-start-editing behavior).
   */
  seedChar = input<string>('');

  /**
   * Emitted on single click — the grid selects this cell.
   * For `values` columns the grid also enters edit mode immediately.
   */
  activate = output<void>();

  /** Emitted on double-click — the grid enters edit mode. */
  startEdit = output<void>();

  /**
   * Emitted on every keystroke inside the edit input or on every select change.
   * The grid stores the latest value in `currentDraft` so it can commit on Tab / Enter.
   */
  draftChange = output<unknown>();

  /** Live draft value managed by the cell during an active edit. */
  readonly draft = signal<unknown>('');

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
        this.draft.set(seed !== '' ? seed : this.value());

        setTimeout(() => {
          const input = this.inputEl()?.nativeElement;
          if (input) {
            // For text inputs, show the string representation as the editable text
            const displaySeed = seed !== '' ? seed : String(this.value() ?? '');
            input.value = displaySeed;
            input.focus();
            if (!seed) input.select();
            else {
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

  /** Forward `<input>` changes to the grid. */
  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.draft.set(val);
    this.draftChange.emit(val);
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
