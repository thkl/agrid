import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgridDataSource } from './agrid-datasource';
import { AgridTreeComponent } from './agrid-tree.component';
import { AgridTreeProvider } from './agrid-tree-provider';
import { AgridTreeNodeEvent, AgridTreeSelectionEvent } from './agrid.types';

interface NodeRow {
  id: number;
  parentId: number | null;
  name: string;
}

describe('AgridTreeComponent', () => {
  let fixture: ComponentFixture<AgridTreeComponent<NodeRow>>;
  let component: AgridTreeComponent<NodeRow>;

  async function create(provider: AgridTreeProvider<NodeRow>): Promise<void> {
    await TestBed.configureTestingModule({ imports: [AgridTreeComponent] }).compileComponents();
    fixture = TestBed.createComponent(AgridTreeComponent<NodeRow>);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
  }

  afterEach(() => fixture?.destroy());

  it('projects parent-linked rows and expands and collapses branches', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([
        { id: 1, parentId: null, name: 'Root' },
        { id: 2, parentId: 1, name: 'Child' },
      ]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
    }));

    expect(component.items().map(item => component.label(item))).toEqual(['Root']);
    component.expandAllNodes();
    expect(component.items().map(item => component.label(item))).toEqual(['Root', 'Child']);
    component.collapseAllNodes();
    expect(component.items()).toHaveLength(1);
  });

  it('emits typed click and selection events for data rows', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([{ id: 1, parentId: null, name: 'Root' }]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
    }));
    const clicks: AgridTreeNodeEvent<NodeRow>[] = [];
    const selections: AgridTreeSelectionEvent<NodeRow>[] = [];
    component.nodeClick.subscribe(event => clicks.push(event));
    component.selectionChange.subscribe(event => selections.push(event));

    component.onNodeClick(new MouseEvent('click'), component.items()[0], 0);

    expect(clicks[0]).toMatchObject({ kind: 'row', id: 1, label: 'Root', originalIndex: 0 });
    expect(clicks[0].row?.name).toBe('Root');
    expect(selections[0].nodes.map(node => node.id)).toEqual([1]);
  });

  it('reuses generated path branches and includes their configured UUID in events', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([
        { id: 7, parentId: null, name: '01.001' },
      ]),
      treeConfig: {
        getPath: row => row.name.split('.'),
        nodeUuid: row => `uuid-${row.id}`,
        treeField: 'name',
        defaultExpanded: true,
      },
    }));
    const events: AgridTreeNodeEvent<NodeRow>[] = [];
    component.nodeClick.subscribe(event => events.push(event));
    const branch = component.items()[0];

    component.onNodeClick(new MouseEvent('click'), branch, 0);

    expect(events[0]).toMatchObject({
      kind: 'branch', label: '01', uuid: 'uuid-7', expandable: true,
    });
    expect(component.items().map(item => component.label(item))).toEqual(['01', '001']);
  });

  it('supports multi-selection toggling with the modifier key', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([
        { id: 1, parentId: null, name: 'One' },
        { id: 2, parentId: null, name: 'Two' },
      ]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
      selection: 'multi',
    }));

    component.onNodeClick(new MouseEvent('click'), component.items()[0], 0);
    component.onNodeClick(new MouseEvent('click', { ctrlKey: true }), component.items()[1], 1);

    expect(component.selectedKeys().size).toBe(2);
  });

  it('moves keyboard focus and expands with ArrowRight', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([
        { id: 1, parentId: null, name: 'Root' },
        { id: 2, parentId: 1, name: 'Child' },
      ]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
    }));
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });

    component.onKeydown(event, component.items()[0], 0);

    expect(component.items()).toHaveLength(2);
    expect(event.defaultPrevented).toBe(true);
  });
});
