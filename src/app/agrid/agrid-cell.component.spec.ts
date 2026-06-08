import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgridCellComponent } from './agrid-cell.component';

describe('AgridCellComponent custom renderer', () => {
  let fixture: ComponentFixture<AgridCellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgridCellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridCellComponent);
    fixture.componentRef.setInput('rowIndex', 0);
    fixture.componentRef.setInput('colIndex', 0);
    fixture.componentRef.setInput('value', 'Active');
    fixture.componentRef.setInput('row', { status: 'Active' });
  });

  afterEach(() => fixture.destroy());

  it('sanitizes custom renderer HTML while preserving safe markup', () => {
    fixture.componentRef.setInput('col', {
      field: 'status',
      header: 'Status',
      cellRenderer: () =>
        '<span class="badge" onclick="window.compromised=true">Active</span>' +
        '<script>window.compromised=true</script>',
    });

    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.ag-cell-value') as HTMLElement;
    expect(value.querySelector('.badge')?.textContent).toBe('Active');
    expect(value.querySelector('.badge')?.hasAttribute('onclick')).toBe(false);
    expect(value.querySelector('script')).toBeNull();
  });
});
