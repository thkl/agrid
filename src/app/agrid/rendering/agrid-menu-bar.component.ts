import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AgridMenuBarContext,
  AgridMenuBarItem,
  AgridMenuBarMenuItem,
  AgridMenuBarState,
} from '../agrid.types';
import { AgridMenuBarIcon } from './agrid-menu-icon.component';

/** Internal renderer for provider-configured grid commands and dropdown items. */
@Component({
  selector: 'agrid-menu-bar',
  imports:[AgridMenuBarIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agrid-menu-bar.component.html',
  styleUrl: './agrid-menu-bar.component.css',
})
export class AgridMenuBarComponent<T extends object = any> {
  items = input<readonly AgridMenuBarItem<T>[]>([]);
  context = input.required<AgridMenuBarContext<T>>();
  label = input<string>('Actions');
  openItemId = input<string | null>(null);

  action = output<string>();
  openItemIdChange = output<string | null>();

  private readonly dropdownShifts = signal<Record<string, number>>({});

  constructor(private readonly host: ElementRef<HTMLElement>) {
    effect(() => {
      const openId = this.openItemId();
      if (openId === null) {
        this.dropdownShifts.set({});
        return;
      }
      setTimeout(() => this.clampOpenDropdown(openId));
    });
  }

  dropdownShift(id: string): number {
    return this.dropdownShifts()[id] ?? 0;
  }

  resolveState(state: AgridMenuBarState<T> | undefined, fallback: boolean): boolean {
    if (typeof state === 'function') return state(this.context());
    return state ?? fallback;
  }

  isActive(item: AgridMenuBarMenuItem<T>): boolean {
    return this.resolveState(item.active, false);
  }

  isDisabled(item: AgridMenuBarMenuItem<T>): boolean {
    return this.resolveState(item.disabled, false);
  }

  visibleChildren(item: AgridMenuBarItem<T>): AgridMenuBarMenuItem<T>[] {
    return (item.items ?? []).filter(child => this.resolveState(child.visible, true));
  }

  runAction(event: Event, item: AgridMenuBarMenuItem<T>): void {
    event.stopPropagation();
    if (!this.resolveState(item.visible, true) || this.isDisabled(item)) return;
    this.action.emit(item.id);
    this.openItemIdChange.emit(null);
  }

  toggleMenu(event: Event, item: AgridMenuBarItem<T>): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isDisabled(item) || this.visibleChildren(item).length === 0) return;
    this.openItemIdChange.emit(this.openItemId() === item.id ? null : item.id);
  }

  onTriggerKeydown(event: KeyboardEvent, item: AgridMenuBarItem<T>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    event.stopPropagation();
    if (this.isDisabled(item) || this.visibleChildren(item).length === 0) return;
    this.openItemIdChange.emit(item.id);
    const group = (event.currentTarget as HTMLElement).closest('.ag-menu-bar-group');
    setTimeout(() => {
      const enabled = group?.querySelectorAll<HTMLButtonElement>(
        '.ag-menu-bar-dropdown [role="menuitem"]:not(:disabled)',
      );
      const target = event.key === 'ArrowUp' ? enabled?.[enabled.length - 1] : enabled?.[0];
      target?.focus();
    });
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const menu = event.currentTarget as HTMLElement;
    const items = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.openItemIdChange.emit(null);
      menu.closest('.ag-menu-bar-group')
        ?.querySelector<HTMLButtonElement>('.ag-menu-bar-trigger')
        ?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || items.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const current = items.indexOf(event.target as HTMLButtonElement);
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length;
    items[next].focus();
  }

  private clampOpenDropdown(id: string): void {
    const root = this.host.nativeElement.querySelector<HTMLElement>('.ag-menu-bar');
    const group = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.ag-menu-bar-group'),
    ).find(candidate => candidate.dataset['menuId'] === id);
    const dropdown = group?.querySelector<HTMLElement>('.ag-menu-bar-dropdown');
    if (!root || !dropdown) return;

    const rootLeft = root.getBoundingClientRect().left;
    const dropdownLeft = dropdown.getBoundingClientRect().left;
    const shift = dropdownLeft < rootLeft ? rootLeft - dropdownLeft : 0;
    this.dropdownShifts.update(current => ({ ...current, [id]: shift }));
  }
}
