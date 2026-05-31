import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ColDef } from './agrid.types';

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
          @for (val of col().values!; track val) {
            <option [value]="val" [selected]="val === draft()">{{ val }}</option>
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
      <span class="ag-cell-value">{{ value() }}</span>
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
  readonly draft = signal('');

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('editInput');
  private readonly selectEl = viewChild<ElementRef<HTMLSelectElement>>('editSelect');

  constructor() {
    effect(() => {
      if (this.editing()) {
        const seed = this.seedChar();
        this.draft.set(seed !== '' ? seed : String(this.value() ?? ''));

        setTimeout(() => {
          const input = this.inputEl()?.nativeElement;
          if (input) {
            input.focus();
            if (!seed) input.select();
            else {
              const len = input.value.length;
              input.setSelectionRange(len, len);
            }
            return;
          }

          const sel = this.selectEl()?.nativeElement;
          if (sel) {
            // Set value after options are in the DOM — [value] binding on <select> runs before
            // @for renders the options, so the browser would fall back to the first item.
            sel.value = this.draft();
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

  /** Forward `<select>` changes to the grid. */
  onSelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.draft.set(val);
    this.draftChange.emit(val);
  }
}
