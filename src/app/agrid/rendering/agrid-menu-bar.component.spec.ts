import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AgridMenuBarContext, AgridMenuBarItem } from '../agrid.types';
import { AgridMenuBarComponent } from './agrid-menu-bar.component';

const context = {
  rows: [],
  selectedRows: [],
  selectedCell: null,
  provider: {} as never,
  datasource: {} as never,
} as AgridMenuBarContext;

function stubEvent(): Event {
  return { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;
}

describe('AgridMenuBarComponent', () => {
  let fixture: ComponentFixture<AgridMenuBarComponent>;
  let cmp: AgridMenuBarComponent;

  function setup(items: AgridMenuBarItem[] = [], openItemId: string | null = null) {
    fixture = TestBed.createComponent(AgridMenuBarComponent);
    fixture.componentRef.setInput('context', context);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('openItemId', openItemId);
    cmp = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AgridMenuBarComponent] }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  it('resolves state from a function, a static boolean, or the fallback', () => {
    setup();
    const spy = vi.fn().mockReturnValue(true);
    expect(cmp.resolveState(spy, false)).toBe(true);
    expect(spy).toHaveBeenCalledWith(context);
    expect(cmp.resolveState(false, true)).toBe(false);
    expect(cmp.resolveState(undefined, true)).toBe(true);
    expect(cmp.resolveState(undefined, false)).toBe(false);
  });

  it('derives isActive/isDisabled with the correct defaults', () => {
    setup();
    expect(cmp.isActive({ id: 'a', label: 'A' })).toBe(false);
    expect(cmp.isActive({ id: 'a', label: 'A', active: true })).toBe(true);
    expect(cmp.isDisabled({ id: 'a', label: 'A' })).toBe(false);
    expect(cmp.isDisabled({ id: 'a', label: 'A', disabled: () => true })).toBe(true);
  });

  it('filters dropdown children by their visible state', () => {
    setup();
    const item: AgridMenuBarItem = {
      id: 'menu',
      label: 'Menu',
      items: [
        { id: 'shown', label: 'Shown' },
        { id: 'hidden', label: 'Hidden', visible: false },
        { id: 'fn', label: 'Fn', visible: () => true },
      ],
    };
    expect(cmp.visibleChildren(item).map(c => c.id)).toEqual(['shown', 'fn']);
    expect(cmp.visibleChildren({ id: 'x', label: 'X' })).toEqual([]);
  });

  it('runAction emits the id, closes the menu, and stops propagation', () => {
    setup();
    const actions: string[] = [];
    const openChanges: (string | null)[] = [];
    cmp.action.subscribe(id => actions.push(id));
    cmp.openItemIdChange.subscribe(v => openChanges.push(v));

    const event = stubEvent();
    cmp.runAction(event, { id: 'save', label: 'Save' });

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(actions).toEqual(['save']);
    expect(openChanges).toEqual([null]);
  });

  it('runAction is suppressed for disabled or hidden items', () => {
    setup();
    const actions: string[] = [];
    cmp.action.subscribe(id => actions.push(id));

    cmp.runAction(stubEvent(), { id: 'd', label: 'D', disabled: true });
    cmp.runAction(stubEvent(), { id: 'h', label: 'H', visible: false });
    expect(actions).toEqual([]);
  });

  it('toggleMenu opens, then closes the same item, and ignores items without visible children', () => {
    const item: AgridMenuBarItem = { id: 'm', label: 'M', items: [{ id: 'c', label: 'C' }] };
    setup([item], null);
    const openChanges: (string | null)[] = [];
    cmp.openItemIdChange.subscribe(v => openChanges.push(v));

    cmp.toggleMenu(stubEvent(), item); // closed -> open
    fixture.componentRef.setInput('openItemId', 'm');
    cmp.toggleMenu(stubEvent(), item); // open -> close
    expect(openChanges).toEqual(['m', null]);

    // No visible children → no emission.
    openChanges.length = 0;
    cmp.toggleMenu(stubEvent(), { id: 'empty', label: 'Empty' });
    cmp.toggleMenu(stubEvent(), { id: 'dis', label: 'Dis', disabled: true, items: [{ id: 'c', label: 'C' }] });
    expect(openChanges).toEqual([]);
  });

  it('onTriggerKeydown opens on arrow keys only', () => {
    const item: AgridMenuBarItem = { id: 'm', label: 'M', items: [{ id: 'c', label: 'C' }] };
    setup([item]);
    const openChanges: (string | null)[] = [];
    cmp.openItemIdChange.subscribe(v => openChanges.push(v));

    // Dispatch on the real trigger button so `event.currentTarget` is set (the handler reads it).
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('.ag-menu-bar-trigger')!;
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(openChanges).toEqual([]);

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(openChanges).toEqual(['m']);
  });

  it('renders a button per item plus a dropdown when open', () => {
    const item: AgridMenuBarItem = {
      id: 'view',
      label: 'View',
      items: [{ id: 'compact', label: 'Compact', active: true }],
    };
    setup([item], 'view');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.ag-menu-bar-button .ag-menu-bar-label')?.textContent).toBe('View');
    expect(root.querySelector('.ag-menu-bar-trigger')).not.toBeNull();
    const dropdownItems = root.querySelectorAll('.ag-menu-bar-dropdown-item');
    expect(dropdownItems).toHaveLength(1);
    expect(dropdownItems[0].classList.contains('ag-menu-bar-dropdown-item--active')).toBe(true);
  });

  it('onMenuKeydown closes on Escape and wraps focus with Arrow/Home/End', () => {
    const item: AgridMenuBarItem = {
      id: 'm',
      label: 'M',
      items: [
        { id: 'one', label: 'One' },
        { id: 'two', label: 'Two' },
        { id: 'three', label: 'Three' },
      ],
    };
    setup([item], 'm');
    const root = fixture.nativeElement as HTMLElement;
    const menu = root.querySelector('.ag-menu-bar-dropdown') as HTMLElement;
    const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(buttons).toHaveLength(3);

    const press = (key: string, target: HTMLElement) => {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true });
      Object.defineProperty(ev, 'currentTarget', { value: menu });
      Object.defineProperty(ev, 'target', { value: target });
      cmp.onMenuKeydown(ev);
    };

    buttons[0].focus();
    press('ArrowDown', buttons[0]);
    expect(document.activeElement).toBe(buttons[1]);

    press('End', buttons[1]);
    expect(document.activeElement).toBe(buttons[2]);

    press('ArrowDown', buttons[2]); // wraps to first
    expect(document.activeElement).toBe(buttons[0]);

    press('Home', buttons[0]);
    expect(document.activeElement).toBe(buttons[0]);

    press('ArrowUp', buttons[0]); // wraps to last
    expect(document.activeElement).toBe(buttons[2]);

    const openChanges: (string | null)[] = [];
    cmp.openItemIdChange.subscribe(v => openChanges.push(v));
    press('Escape', buttons[2]);
    expect(openChanges).toEqual([null]);
  });
});
