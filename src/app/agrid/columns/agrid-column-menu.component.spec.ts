import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AgridColumnMenuComponent,
  fitColumnMenuToViewport,
} from './agrid-column-menu.component';

describe('fitColumnMenuToViewport', () => {
  it('moves a menu up and left when it would exceed the viewport', () => {
    expect(fitColumnMenuToViewport(900, 700, 220, 400, 1024, 768))
      .toEqual({ x: 796, y: 360 });
  });

  it('keeps a menu at its requested position when it already fits', () => {
    expect(fitColumnMenuToViewport(100, 120, 220, 300, 1024, 768))
      .toEqual({ x: 100, y: 120 });
  });

  it('uses the viewport margin when the menu is larger than the viewport', () => {
    expect(fitColumnMenuToViewport(20, 20, 1200, 900, 1024, 768))
      .toEqual({ x: 8, y: 8 });
  });
});

describe('AgridColumnMenuComponent', () => {
  let fixture: ComponentFixture<AgridColumnMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgridColumnMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridColumnMenuComponent);
    fixture.componentRef.setInput('x', 0);
    fixture.componentRef.setInput('y', 0);
    fixture.componentRef.setInput('header', 'Name');
    fixture.componentRef.setInput('filterable', true);
    fixture.componentRef.setInput('filterType', 'text');
  });

  afterEach(() => fixture.destroy());

  it('offers string condition operators with a text operand', () => {
    fixture.detectChanges();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('.ag-filter-menu-operator-btn'),
      (button: Element) => button.textContent?.trim(),
    );
    const operand = fixture.nativeElement.querySelector(
      '.ag-filter-menu-operand',
    ) as HTMLInputElement | null;

    expect(options).toEqual([
      'No condition',
      'Equals',
      'Not equal',
      'Like (% and _ wildcards)',
      'Starts with',
      'Ends with',
      'Includes',
      'Does not include',
    ]);
    expect(operand).toBeNull();

    fixture.componentRef.setInput('operator', 'includes');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('.ag-filter-menu-operand') as HTMLInputElement).type,
    ).toBe('text');
  });
});
