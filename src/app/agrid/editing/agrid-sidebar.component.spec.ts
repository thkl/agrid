import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgridSidebarComponent, AgridSidebarEdit } from './agrid-sidebar.component';

describe('AgridSidebarComponent', () => {
  let fixture: ComponentFixture<AgridSidebarComponent>;
  let component: AgridSidebarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgridSidebarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridSidebarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('columns', [
      { field: 'name', header: 'Name' },
      { field: 'department', header: 'Department' },
    ]);
    fixture.componentRef.setInput('row', {
      name: 'Alice',
      department: 'Engineering',
    });
    fixture.componentRef.setInput('rowIndex', 0);
  });

  afterEach(() => fixture.destroy());

  it('emits the field when a column visibility checkbox changes', () => {
    const emitted: string[] = [];
    component.toggleColumn.subscribe(field => emitted.push(field));
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector(
      '.ag-sidebar-item input',
    ) as HTMLInputElement;
    checkbox.dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['name']);
  });

  it('renders header groups as a tree and toggles all group columns', () => {
    fixture.componentRef.setInput('columns', [
      { field: 'firstName', header: 'First name', group: 'employee' },
      { field: 'lastName', header: 'Last name', group: 'employee' },
      { field: 'department', header: 'Department' },
    ]);
    fixture.componentRef.setInput('headerGroups', [
      { id: 'employee', label: 'Employee' },
    ]);
    fixture.componentRef.setInput('hiddenColumns', new Set(['lastName']));
    const emitted: { fields: string[]; visible: boolean }[] = [];
    component.toggleColumnGroup.subscribe(event => emitted.push(event));
    fixture.detectChanges();

    const groupCheckbox = fixture.nativeElement.querySelector(
      '.ag-sidebar-group-label input',
    ) as HTMLInputElement;
    const childLabels = Array.from(
      fixture.nativeElement.querySelectorAll('.ag-sidebar-group-child'),
      (element: Element) => element.textContent?.trim(),
    );

    expect(groupCheckbox.checked).toBe(false);
    expect(groupCheckbox.indeterminate).toBe(true);
    expect(childLabels).toEqual(['First name', 'Last name']);

    groupCheckbox.checked = true;
    groupCheckbox.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([{
      fields: ['firstName', 'lastName'],
      visible: true,
    }]);
  });

  it('keeps columns flat when no matching header groups are configured', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ag-sidebar-group')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.ag-sidebar-item')).toHaveLength(2);
  });

  it('renders detail fields and emits edits', () => {
    const emitted: AgridSidebarEdit[] = [];
    component.detailEdit.subscribe(event => emitted.push(event));
    fixture.componentRef.setInput('activeTab', 'detail');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-detail-input') as HTMLInputElement;
    input.value = 'Bob';
    input.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([{
      field: 'name',
      col: { field: 'name', header: 'Name' },
      value: 'Bob',
    }]);
  });

  it('applies a row-aware mask to detail editor input', () => {
    const emitted: AgridSidebarEdit[] = [];
    const row = { code: '123456', numeric: true };
    const column = {
      field: 'code',
      header: 'Code',
      inputMask: ({ row: currentRow }: { row: typeof row }) =>
        currentRow.numeric
          ? /\d{0,3}(?:-\d{0,5})?/
          : /[a-z0-9]{0,3}(?: [a-z0-9]{0,5})?/i,
    };
    component.detailEdit.subscribe(event => emitted.push(event));
    fixture.componentRef.setInput('columns', [column]);
    fixture.componentRef.setInput('row', row);
    fixture.componentRef.setInput('activeTab', 'detail');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-detail-input') as HTMLInputElement;
    expect(input.value).toBe('123456');

    input.value = '987-65432';
    input.dispatchEvent(new Event('input'));

    expect(input.value).toBe('987-65432');
    expect(emitted).toEqual([]);

    input.value = '987-65x';
    input.dispatchEvent(new Event('input'));
    expect(input.value).toBe('987-65432');

    input.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([{ field: 'code', col: column, value: '987-65432' }]);
  });
});
