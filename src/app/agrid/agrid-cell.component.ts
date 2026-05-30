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
      <input
        #editInput
        class="ag-cell-input"
        [value]="draft()"
        (input)="onInput($event)"
      />
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

  constructor() {
    effect(() => {
      if (this.editing()) {
        const seed = this.seedChar();
        this.draft.set(seed !== '' ? seed : String(this.value() ?? ''));
        setTimeout(() => {
          const el = this.inputEl()?.nativeElement;
          if (!el) return;
          el.focus();
          if (!seed) el.select();
          else {
            const len = el.value.length;
            el.setSelectionRange(len, len);
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
}
