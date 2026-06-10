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
});
