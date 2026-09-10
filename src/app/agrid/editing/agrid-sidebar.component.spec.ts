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
      fixture.nativeElement.querySelectorAll('.ag-sidebar-group-child .ag-column-label'),
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

  it('filters the column chooser by header, field, or group label', () => {
    fixture.componentRef.setInput('columns', [
      { field: 'firstName', header: 'First name', group: 'employee' },
      { field: 'lastName', header: 'Last name', group: 'employee' },
      { field: 'department', header: 'Department' },
    ]);
    fixture.componentRef.setInput('headerGroups', [
      { id: 'employee', label: 'Employee' },
    ]);
    fixture.detectChanges();

    component.columnSearch.set('dep');
    fixture.detectChanges();

    expect(Array.from(
      fixture.nativeElement.querySelectorAll('.ag-column-label'),
      (element: Element) => element.textContent?.trim(),
    )).toEqual(['Department']);

    component.columnSearch.set('employee');
    fixture.detectChanges();

    expect(Array.from(
      fixture.nativeElement.querySelectorAll('.ag-column-label'),
      (element: Element) => element.textContent?.trim(),
    )).toEqual(['First name', 'Last name']);
  });

  it('emits bulk visibility and column move requests from chooser controls', () => {
    const bulk: boolean[] = [];
    const moves: object[] = [];
    component.setColumnsVisible.subscribe(visible => bulk.push(visible));
    component.moveColumn.subscribe(event => moves.push(event));
    fixture.detectChanges();

    const bulkButtons = fixture.nativeElement.querySelectorAll('.ag-column-bulk-btn') as NodeListOf<HTMLButtonElement>;
    bulkButtons[0].click();
    bulkButtons[1].click();

    const moveButtons = fixture.nativeElement.querySelectorAll('.ag-column-move-btn') as NodeListOf<HTMLButtonElement>;
    moveButtons[2].click();

    expect(bulk).toEqual([true, false]);
    expect(moves).toEqual([{ field: 'department', direction: 'up' }]);
  });

  it('disables chooser visibility and movement for locked columns', () => {
    fixture.componentRef.setInput('columns', [
      { field: 'id', header: 'ID', locked: true },
      { field: 'name', header: 'Name' },
      { field: 'department', header: 'Department' },
    ]);
    fixture.detectChanges();

    const lockedItem = fixture.nativeElement.querySelector('.ag-sidebar-item--locked') as HTMLElement;
    const lockedCheckbox = lockedItem.querySelector('input') as HTMLInputElement;
    const lockedButtons = lockedItem.querySelectorAll('.ag-column-move-btn') as NodeListOf<HTMLButtonElement>;
    const nameButtons = fixture.nativeElement.querySelectorAll('.ag-sidebar-item')[1]
      .querySelectorAll('.ag-column-move-btn') as NodeListOf<HTMLButtonElement>;

    expect(lockedCheckbox.disabled).toBe(true);
    expect(lockedItem.textContent).toContain('Locked');
    expect(lockedButtons[0].disabled).toBe(true);
    expect(lockedButtons[1].disabled).toBe(true);
    expect(nameButtons[0].disabled).toBe(true);
    expect(nameButtons[1].disabled).toBe(false);
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

  it('renders configured string sidebar controls as textareas', () => {
    const emitted: AgridSidebarEdit[] = [];
    component.detailEdit.subscribe(event => emitted.push(event));
    fixture.componentRef.setInput('activeTab', 'detail');
    fixture.componentRef.setInput('columns', [
      {
        field: 'notes',
        header: 'Notes',
        sidebarControl: { type: 'textarea', height: 5 },
      },
      {
        field: 'status',
        header: 'Status',
        values: ['Open', 'Closed'],
        sidebarControl: { type: 'textarea', height: 5 },
      },
    ]);
    fixture.componentRef.setInput('row', {
      notes: 'Long note',
      status: 'Open',
    });
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('.ag-detail-textarea') as HTMLTextAreaElement;
    const select = fixture.nativeElement.querySelector('select.ag-detail-input') as HTMLSelectElement;

    expect(textarea.value).toBe('Long note');
    expect(textarea.rows).toBe(5);
    expect(select).not.toBeNull();

    textarea.value = 'Changed note';
    textarea.dispatchEvent(new Event('change'));
    expect(emitted[0]).toMatchObject({ field: 'notes', value: 'Changed note' });
  });

  it('emits live and final sidebar widths while resizing', () => {
    const live: number[] = [];
    const final: number[] = [];
    component.sidebarWidthChange.subscribe(width => live.push(width));
    component.sidebarResizeEnd.subscribe(width => final.push(width));
    fixture.componentRef.setInput('resizable', true);
    fixture.componentRef.setInput('sidebarWidth', 240);
    fixture.detectChanges();

    const handle = fixture.nativeElement.querySelector('.ag-sidebar-resize-handle') as HTMLElement;
    handle.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 100, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 70 }));
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 60 }));

    expect(live).toEqual([270]);
    expect(final).toEqual([280]);
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

  it('renders pivot controls and emits complete replacement configurations', () => {
    fixture.componentRef.setInput('activeTab', 'pivot');
    fixture.componentRef.setInput('pivotColumns', [
      { field: 'region', header: 'Region' },
      { field: 'quarter', header: 'Quarter' },
      { field: 'revenue', header: 'Revenue', type: 'number' },
    ]);
    fixture.componentRef.setInput('pivotConfig', {
      rowField: 'region',
      columnField: 'quarter',
      valueField: 'revenue',
      aggregate: 'sum',
    });
    fixture.componentRef.setInput('columns', [
      { field: 'region', header: 'Region' },
      { field: '__agrid_pivot_0', header: 'Q1' },
      { field: '__agrid_pivot_1', header: 'Q2' },
    ]);
    const emitted: object[] = [];
    component.pivotChange.subscribe(config => emitted.push(config));
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('.ag-pivot-field select');
    expect(Array.from(selects, (select: HTMLSelectElement) => select.value))
      .toEqual(['region', 'quarter', 'revenue', 'sum']);
    expect(fixture.nativeElement.querySelectorAll('.ag-pivot-column-list .ag-sidebar-item'))
      .toHaveLength(3);

    selects[0].value = 'quarter';
    selects[0].dispatchEvent(new Event('change'));
    selects[3].value = 'avg';
    selects[3].dispatchEvent(new Event('change'));

    expect(emitted).toEqual([
      { rowField: 'quarter', columnField: 'quarter', valueField: 'revenue', aggregate: 'sum' },
      { rowField: 'region', columnField: 'quarter', valueField: 'revenue', aggregate: 'avg' },
    ]);
  });
});
