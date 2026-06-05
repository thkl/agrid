import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

/** Floating find panel used by `AgridComponent` for in-grid search navigation. */
@Component({
  selector: 'agrid-find-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agrid-find-panel.component.html',
  styleUrl: './agrid-find-panel.component.css',
})
export class AgridFindPanelComponent implements AfterViewInit {
  /** Current find query shown in the input. */
  query = input<string>('');

  /** Number of cells matching the current query. */
  matchCount = input<number>(0);

  /** Zero-based active match index, or `-1` when no match is active. */
  activeIndex = input<number>(-1);

  /** Emits whenever the user changes the find query. */
  queryChange = output<string>();

  /** Requests navigation to the next match. */
  next = output<void>();

  /** Requests navigation to the previous match. */
  previous = output<void>();

  /** Requests closing the find panel. */
  close = output<void>();

  private readonly findInput = viewChild.required<ElementRef<HTMLInputElement>>('findInput');

  /** Focuses and selects the find input after Angular has rendered the panel. */
  ngAfterViewInit(): void {
    setTimeout(() => {
      const input = this.findInput().nativeElement;
      input.focus();
      input.select();
    });
  }

  /** Returns the compact `active / total` label displayed next to the input. */
  countLabel(): string {
    const count = this.matchCount();
    return count === 0 ? '0 / 0' : `${this.activeIndex() + 1} / ${count}`;
  }

  /** Handles Enter, Shift+Enter, and Escape while preventing grid-level key handling. */
  onKeyDown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      event.shiftKey ? this.previous.emit() : this.next.emit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close.emit();
    }
  }
}
