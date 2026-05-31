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
  col = input.required<ColDef>();
  rowIndex = input.required<number>();
  colIndex = input.required<number>();
  value = input.required<unknown>();
  selected = input<boolean>(false);
  editing = input<boolean>(false);
  seedChar = input<string>('');

  activate = output<void>();
  startEdit = output<void>();
  draftChange = output<unknown>();

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
            sel.value = this.draft();  // set after options are in the DOM
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

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.draft.set(val);
    this.draftChange.emit(val);
  }

  onSelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.draft.set(val);
    this.draftChange.emit(val);
  }
}
