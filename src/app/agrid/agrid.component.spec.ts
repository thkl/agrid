import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgridComponent } from './agrid.component';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';
import { GridItem, RowSelectEvent } from './agrid.types';

describe('AgridComponent grouped control column selection', () => {
  let fixture: ComponentFixture<AgridComponent>;
  let component: AgridComponent;
  let provider: AgridProvider;

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = () => undefined;
  });

  beforeEach(async () => {
    const control = new AgridControl({
      allowRowReorder: false,
      groupByField: 'department',
    });
    provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name', filterable: true },
        { field: 'department', header: 'Department', groupable: true },
      ],
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Sales' },
        { name: 'Carol', department: 'Engineering' },
        { name: 'David', department: 'Engineering' },
      ]),
      control,
      showControlColumn: true,
      rowSelection: 'single',
    });

    await TestBed.configureTestingModule({
      imports: [AgridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
    component.expandGroups();
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('selects and highlights the exact grouped row clicked in the control column', () => {
    const rows = visibleDataRows(component.filteredItems());
    const clicked = rows[2];
    const previous = rows[1];

    component.onControlPointerDown(primaryPointerEvent(), clicked.originalIndex);

    expect(component.selectedRowIndex()).toBe(clicked.originalIndex);
    expect(component.isPinnedPaneRowSelected(clicked)).toBe(true);
    expect(component.isPinnedPaneRowSelected(previous)).toBe(false);
  });

  it('emits the exact grouped row clicked in the control column', () => {
    const clicked = visibleDataRows(component.filteredItems())[2];
    const emitted: (RowSelectEvent | null)[] = [];
    component.rowSelect.subscribe(event => emitted.push(event));

    component.onControlPointerDown(primaryPointerEvent(), clicked.originalIndex);

    expect(emitted).toEqual([{
      rows: [{
        row: provider.datasource.getRow(clicked.originalIndex),
        originalIndex: clicked.originalIndex,
      }],
    }]);
  });
});

function visibleDataRows(
  items: GridItem[],
): { row: Record<string, unknown>; originalIndex: number }[] {
  return items.filter(
    (item): item is { row: Record<string, unknown>; originalIndex: number } =>
      typeof item === 'object' && item !== null && 'row' in item,
  );
}

function primaryPointerEvent(): PointerEvent {
  return {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as unknown as PointerEvent;
}
