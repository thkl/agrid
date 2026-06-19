import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** Identifier supported by the standalone page selector. */
export type AgridPageId = string | number;

/** One selectable page. IDs must be unique within the item list. */
export interface AgridPageItem<TId extends AgridPageId = AgridPageId> {
  id: TId;
  label: string;
}

let nextPageSelectorId = 0;

/** Compact previous/input/dropdown/next control for navigating a labeled page list. */
@Component({
  selector: 'agrid-page-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agrid-page-selector.component.html',
  styleUrl: './agrid-page-selector.component.css',
})
export class AgridPageSelectorComponent<TId extends AgridPageId = AgridPageId> {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly listboxId = `agrid-page-options-${nextPageSelectorId++}`;

  items = input<readonly AgridPageItem<TId>[]>([]);
  selectedId = input<TId | null>(null);
  disabled = input<boolean>(false);
  previousLabel = input<string>('Previous page');
  nextLabel = input<string>('Next page');
  inputLabel = input<string>('Page ID');
  menuLabel = input<string>('Choose a page');
  emptyText = input<string>('No pages');

  selectPage = output<AgridPageItem<TId>>();

  readonly menuOpen = signal(false);
  readonly draft = signal('');
  readonly invalid = signal(false);
  readonly activeId = signal<TId | null>(null);
  readonly focusedOptionIndex = signal(-1);

  readonly activeIndex = computed(() =>
    this.items().findIndex(item => this.idsEqual(item.id, this.activeId())),
  );
  readonly hasPrevious = computed(() => !this.disabled() && this.activeIndex() > 0);
  readonly hasNext = computed(() => {
    const index = this.activeIndex();
    return !this.disabled() && index >= 0 && index < this.items().length - 1;
  });

  constructor() {
    effect(() => {
      const id = this.selectedId();
      this.activeId.set(id);
      this.draft.set(id == null ? '' : String(id));
      this.invalid.set(false);
    });
  }

  previous(): void {
    if (!this.hasPrevious()) return;
    this.choose(this.items()[this.activeIndex() - 1]);
  }

  next(): void {
    if (!this.hasNext()) return;
    this.choose(this.items()[this.activeIndex() + 1]);
  }

  toggleMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled() || this.items().length === 0) return;
    this.menuOpen() ? this.closeMenu() : this.openMenu();
  }

  openMenu(): void {
    if (this.disabled() || this.items().length === 0) return;
    const current = this.activeIndex();
    this.focusedOptionIndex.set(current >= 0 ? current : 0);
    this.menuOpen.set(true);
    this.scrollFocusedOptionIntoView();
  }

  closeMenu(): void {
    this.menuOpen.set(false);
    this.focusedOptionIndex.set(-1);
  }

  onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    this.invalid.set(false);
    this.closeMenu();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
      this.resetDraft();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.menuOpen()) this.openMenu();
      else this.moveOption(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' && this.menuOpen()) {
      event.preventDefault();
      this.focusedOptionIndex.set(0);
      this.scrollFocusedOptionIntoView();
      return;
    }
    if (event.key === 'End' && this.menuOpen()) {
      event.preventDefault();
      this.focusedOptionIndex.set(this.items().length - 1);
      this.scrollFocusedOptionIntoView();
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const focused = this.menuOpen() ? this.items()[this.focusedOptionIndex()] : undefined;
    if (focused) this.choose(focused);
    else this.selectDraft();
  }

  choose(item: AgridPageItem<TId>): void {
    if (this.disabled()) return;
    this.activeId.set(item.id);
    this.draft.set(String(item.id));
    this.invalid.set(false);
    this.closeMenu();
    this.selectPage.emit(item);
  }

  optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  isSelected(item: AgridPageItem<TId>): boolean {
    return this.idsEqual(item.id, this.activeId());
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.menuOpen()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) this.closeMenu();
  }

  private selectDraft(): void {
    const value = this.draft().trim();
    const item = this.items().find(candidate => String(candidate.id) === value);
    if (item) this.choose(item);
    else this.invalid.set(true);
  }

  private resetDraft(): void {
    const id = this.activeId();
    this.draft.set(id == null ? '' : String(id));
    this.invalid.set(false);
  }

  private moveOption(direction: 1 | -1): void {
    const count = this.items().length;
    if (count === 0) return;
    const current = this.focusedOptionIndex();
    this.focusedOptionIndex.set((current + direction + count) % count);
    this.scrollFocusedOptionIntoView();
  }

  private scrollFocusedOptionIntoView(): void {
    queueMicrotask(() => this.elementRef.nativeElement
      .querySelector<HTMLElement>(`#${this.optionId(this.focusedOptionIndex())}`)
      ?.scrollIntoView?.({ block: 'nearest' }));
  }

  private idsEqual(left: TId, right: TId | null): boolean {
    return right !== null && left === right;
  }
}
