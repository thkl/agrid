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

  afterEach(() => {
    fixture?.destroy();
  });

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

  it('expands parent-linked rows from a defaultExpanded callback', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([
        { id: 1, parentId: null, name: 'Root' },
        { id: 2, parentId: 1, name: 'Child' },
        { id: 3, parentId: 2, name: 'Grandchild' },
      ]),
      treeConfig: {
        getId: row => row.id,
        getParentId: row => row.parentId,
        treeField: 'name',
        defaultExpanded: row => row.id === 1,
      },
    }));

    expect(component.items().map(item => component.label(item))).toEqual(['Root', 'Child']);
    expect(component.expandedIds()).toEqual(new Set([1]));
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

  it('applies provider node classes to data rows', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([
        { id: 1, parentId: null, name: 'Root' },
        { id: 2, parentId: null, name: 'Archived' },
      ]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
      getNodeClass: row => row.name === 'Archived' ? 'node-archived' : '',
    }));
    fixture.detectChanges();

    const nodes = fixture.nativeElement.querySelectorAll('.ag-tree-node') as NodeListOf<HTMLElement>;

    expect(nodes[0].classList.contains('node-archived')).toBe(false);
    expect(nodes[1].classList.contains('node-archived')).toBe(true);
  });

  it('emits node menu actions for context-menu items', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([{ id: 1, parentId: null, name: 'Root' }]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
      contextMenuItems: node => [
        { id: 'open', label: `Open ${node.label}` },
        { id: 'delete', label: 'Delete', danger: true },
      ],
    }));
    const actions: Array<{ id: string; node: AgridTreeNodeEvent<NodeRow> }> = [];
    component.nodeMenuAction.subscribe(action => actions.push(action));

    component.openContextMenu(
      new MouseEvent('contextmenu', { clientX: 12, clientY: 24, cancelable: true }),
      component.items()[0],
      0,
    );
    fixture.detectChanges();
    const menuItems = fixture.nativeElement.querySelectorAll(
      '.ag-tree-menu-item',
    ) as NodeListOf<HTMLButtonElement>;
    menuItems[0].click();

    expect(actions[0]).toMatchObject({ id: 'open', node: { kind: 'row', id: 1, label: 'Root' } });
    expect(component.menuState()).toBeNull();
  });

  it('reserves an activity slot and only shows the menu trigger when items exist', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([
        { id: 1, parentId: null, name: 'Root' },
        { id: 2, parentId: null, name: 'Plain' },
      ]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
      contextMenuItems: node => node.id === 1 ? [{ id: 'open', label: 'Open' }] : [],
    }));
    fixture.detectChanges();

    const slots = fixture.nativeElement.querySelectorAll(
      '.ag-tree-activity-slot',
    ) as NodeListOf<HTMLElement>;

    expect(slots).toHaveLength(2);
    expect(slots[0].querySelector('.ag-tree-menu-trigger')).not.toBeNull();
    expect(slots[0].getAttribute('aria-hidden')).toBeNull();
    expect(slots[1].querySelector('.ag-tree-menu-trigger')).toBeNull();
    expect(slots[1].getAttribute('aria-hidden')).toBe('true');
  });

  it('does not emit disabled node menu items', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([{ id: 1, parentId: null, name: 'Root' }]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
      contextMenuItems: () => [{ id: 'disabled', label: 'Disabled', disabled: true }],
    }));
    const actions: Array<{ id: string; node: AgridTreeNodeEvent<NodeRow> }> = [];
    component.nodeMenuAction.subscribe(action => actions.push(action));

    component.openContextMenu(new MouseEvent('contextmenu'), component.items()[0], 0);
    component.selectMenuItem(component.menuState()!.items[0]);

    expect(actions).toEqual([]);
    expect(component.menuState()).not.toBeNull();
  });

  it('requires confirmation before emitting confirmed node menu items', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([{ id: 1, parentId: null, name: 'Root' }]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
      contextMenuItems: () => [{
        id: 'delete',
        label: 'Delete',
        danger: true,
        confirm: { title: 'Confirm delete', message: 'Delete Root?', confirmLabel: 'Delete' },
      }],
    }));
    const actions: Array<{ id: string; node: AgridTreeNodeEvent<NodeRow> }> = [];
    component.nodeMenuAction.subscribe(action => actions.push(action));

    component.openContextMenu(
      new MouseEvent('contextmenu', { clientX: 12, clientY: 24 }),
      component.items()[0],
      0,
    );
    component.selectMenuItem(component.menuState()!.items[0]);
    fixture.detectChanges();

    expect(actions).toEqual([]);
    expect(component.menuState()).toBeNull();
    expect(component.confirmState()).toMatchObject({
      x: 12,
      y: 24,
      item: { id: 'delete' },
      node: { id: 1, label: 'Root' },
    });
    expect(fixture.nativeElement.querySelector('.ag-tree-confirm-title').textContent.trim())
      .toBe('Confirm delete');
    expect(fixture.nativeElement.querySelector('.ag-tree-confirm-message').textContent.trim())
      .toBe('Delete Root?');

    component.closeConfirmation();
    expect(component.confirmState()).toBeNull();
    expect(actions).toEqual([]);

    component.openContextMenu(new MouseEvent('contextmenu'), component.items()[0], 0);
    component.selectMenuItem(component.menuState()!.items[0]);
    component.confirmMenuAction();

    expect(actions.map(action => action.id)).toEqual(['delete']);
    expect(component.confirmState()).toBeNull();
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

  it('expands path branches from rows matched by a defaultExpanded callback', async () => {
    await create(new AgridTreeProvider({
      datasource: new AgridDataSource<NodeRow>([
        { id: 1, parentId: null, name: '01.01.0001' },
        { id: 2, parentId: null, name: '01.02.0001' },
      ]),
      treeConfig: {
        getPath: row => row.name.split('.'),
        treeField: 'name',
        defaultExpanded: row => row.name === '01.01.0001',
      },
    }));

    expect(component.items().map(item => component.label(item))).toEqual(['01', '01', '0001', '02']);
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

  it('loads root rows from a server-backed provider', async () => {
    let resolveRoot!: (rows: NodeRow[]) => void;
    const rootRows = new Promise<NodeRow[]>(resolve => {
      resolveRoot = resolve;
    });
    const provider = new AgridTreeProvider<NodeRow>({
      datasource: new AgridDataSource<NodeRow>(),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
      serverTree: {
        loadRoot: () => rootRows,
        loadChildren: async () => [],
      },
    });

    await create(provider);
    expect(provider.rootLoading()).toBe(true);
    resolveRoot([{ id: 1, parentId: null, name: 'Server root' }]);
    await rootRows;
    await Promise.resolve();
    fixture.detectChanges();

    expect(provider.rootLoading()).toBe(false);
    expect(component.items().map(item => component.label(item))).toEqual(['Server root']);
  });

  it('loads child rows on first expansion and exposes node loading state', async () => {
    let resolveChildren!: (rows: NodeRow[]) => void;
    const childRows = new Promise<NodeRow[]>(resolve => {
      resolveChildren = resolve;
    });
    const provider = new AgridTreeProvider<NodeRow>({
      datasource: new AgridDataSource<NodeRow>([
        { id: 1, parentId: null, name: 'Root' },
      ]),
      treeConfig: { getId: row => row.id, getParentId: row => row.parentId, treeField: 'name' },
      serverTree: {
        loadRoot: async () => [{ id: 1, parentId: null, name: 'Root' }],
        loadChildren: () => childRows,
        hasChildren: row => row.id === 1,
      },
    });

    await create(provider);
    await Promise.resolve();
    fixture.detectChanges();
    const root = component.items()[0];

    component.toggleNode(root);
    expect(component.isLoading(root)).toBe(true);
    expect(component.items().map(item => component.label(item))).toEqual(['Root']);

    resolveChildren([{ id: 2, parentId: 1, name: 'Child' }]);
    await childRows;
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.isLoading(root)).toBe(false);
    expect(component.items().map(item => component.label(item))).toEqual(['Root', 'Child']);
    expect(provider.loadedNodeIds()).toEqual(new Set([1]));
  });
});
