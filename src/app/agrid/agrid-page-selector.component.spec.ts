import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AgridPageItem,
  AgridPageSelectorComponent,
} from './agrid-page-selector.component';

describe('AgridPageSelectorComponent', () => {
  let fixture: ComponentFixture<AgridPageSelectorComponent<number>>;
  let component: AgridPageSelectorComponent<number>;
  const items: AgridPageItem<number>[] = [
    { id: 1, label: 'Introduction' },
    { id: 2, label: 'Measurements' },
    { id: 100, label: 'Appendix' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AgridPageSelectorComponent] })
      .compileComponents();
    fixture = TestBed.createComponent(AgridPageSelectorComponent<number>);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('selectedId', 2);
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('shows the selected ID and enables navigation at an interior item', () => {
    const input = fixture.nativeElement.querySelector('.ag-page-input') as HTMLInputElement;
    const buttons = fixture.nativeElement.querySelectorAll('.ag-page-nav') as NodeListOf<HTMLButtonElement>;

    expect(input.value).toBe('2');
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(false);
  });

  it('emits complete items from previous and next navigation', () => {
    const selected: AgridPageItem<number>[] = [];
    component.selectPage.subscribe(item => selected.push(item));

    component.previous();
    component.next();

    expect(selected).toEqual([items[0], items[1]]);
  });

  it('emits a dropdown item and closes the menu', () => {
    const selected: AgridPageItem<number>[] = [];
    component.selectPage.subscribe(item => selected.push(item));
    component.openMenu();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('.ag-page-option') as NodeListOf<HTMLButtonElement>;
    options[2].click();

    expect(selected).toEqual([items[2]]);
    expect(component.menuOpen()).toBe(false);
  });

  it('selects an exact typed ID on Enter', () => {
    const selected: AgridPageItem<number>[] = [];
    component.selectPage.subscribe(item => selected.push(item));
    component.draft.set('100');

    component.onInputKeydown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));

    expect(selected).toEqual([items[2]]);
    expect(component.invalid()).toBe(false);
  });

  it('marks an unknown typed ID invalid without emitting', () => {
    const selected: AgridPageItem<number>[] = [];
    component.selectPage.subscribe(item => selected.push(item));
    component.draft.set('404');

    component.onInputKeydown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    fixture.detectChanges();

    expect(selected).toEqual([]);
    expect(component.invalid()).toBe(true);
    expect(fixture.nativeElement.querySelector('.ag-page-input').getAttribute('aria-invalid')).toBe('true');
  });

  it('closes the dropdown on an outside pointer event', () => {
    component.openMenu();
    component.onDocumentPointerDown(new PointerEvent('pointerdown'));

    expect(component.menuOpen()).toBe(false);
  });

  it('supports string IDs without coercing emitted values', async () => {
    const stringFixture = TestBed.createComponent(AgridPageSelectorComponent<string>);
    const stringItems = [{ id: 'A-01', label: 'Cover' }, { id: 'B-02', label: 'Details' }];
    stringFixture.componentRef.setInput('items', stringItems);
    stringFixture.componentRef.setInput('selectedId', 'A-01');
    stringFixture.detectChanges();
    const selected: AgridPageItem<string>[] = [];
    stringFixture.componentInstance.selectPage.subscribe(item => selected.push(item));
    stringFixture.componentInstance.draft.set('B-02');

    stringFixture.componentInstance.onInputKeydown(
      new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }),
    );

    expect(selected[0].id).toBe('B-02');
    stringFixture.destroy();
  });
});
