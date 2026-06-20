import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgridComponent } from './agrid.component';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';

describe('AgridComponent pivot integration', () => {
  let fixture: ComponentFixture<AgridComponent>;

  afterEach(() => fixture?.destroy());

  it('feeds generated pivot rows and columns through the normal grid pipeline', async () => {
    const provider = new AgridProvider({
      columns: [
        { field: 'region', header: 'Region' },
        { field: 'quarter', header: 'Quarter' },
        { field: 'revenue', header: 'Revenue', type: 'number' },
      ],
      datasource: new AgridDataSource([
        { region: 'East', quarter: 'Q1', revenue: 10 },
        { region: 'East', quarter: 'Q2', revenue: 20 },
        { region: 'West', quarter: 'Q1', revenue: 5 },
      ]),
      pivotConfig: {
        rowField: 'region',
        columnField: 'quarter',
        valueField: 'revenue',
        aggregate: 'sum',
      },
      allowAddRows: true,
    });

    await TestBed.configureTestingModule({ imports: [AgridComponent] }).compileComponents();
    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.colDefs().map(column => column.header)).toEqual(['Region', 'Q1', 'Q2']);
    expect(component.dataSource().rows()).toEqual([
      { region: 'East', __agrid_pivot_0: 10, __agrid_pivot_1: 20 },
      { region: 'West', __agrid_pivot_0: 5, __agrid_pivot_1: null },
    ]);
    expect(component.readonlyGrid()).toBe(true);
    expect(component.allowAddRows()).toBe(false);
    expect(component.allowRowReorder()).toBe(false);

    provider.pivotConfig = {
      rowField: 'quarter',
      columnField: 'region',
      valueField: 'revenue',
      aggregate: 'sum',
    };
    fixture.detectChanges();

    expect(component.colDefs().map(column => column.header)).toEqual(['Quarter', 'East', 'West']);
    expect(component.dataSource().rows()).toEqual([
      { quarter: 'Q1', __agrid_pivot_0: 10, __agrid_pivot_1: 5 },
      { quarter: 'Q2', __agrid_pivot_0: 20, __agrid_pivot_1: null },
    ]);

    const emitted: object[] = [];
    component.settingsChange.subscribe(settings => emitted.push(settings));
    component.onSidebarToggleColumn('__agrid_pivot_1');
    expect(emitted.at(-1)).toEqual(provider.saveSettings());

    const saved = component.saveSettings();
    provider.pivotConfig = {
      rowField: 'region', columnField: 'quarter', valueField: 'revenue', aggregate: 'avg',
    };
    component.loadSettings(saved);
    expect(provider.pivotConfig?.rowField).toBe('quarter');
    expect(provider.control.hiddenColumns().has('__agrid_pivot_1')).toBe(true);
  });
});
