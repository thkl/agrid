import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
  AgridDataSource,
  AgridTreeComponent,
  AgridTreeNodeEvent,
  AgridTreeProvider,
} from '../agrid';

interface OrgRow {
  id: number;
  parentId: number | null;
  name: string;
  role: string;
  team: string;
  headcount: number;
}

/**
 * Flat rows linked by `parentId` — the grid builds the hierarchy from the accessors below.
 * No nested `children` arrays; selection and editing keep working on the flat indices.
 */
const ROWS: OrgRow[] = [
  { id: 1,  parentId: null, name: 'Dana Whitfield',  role: 'CEO',              team: 'Exec',        headcount: 24 },
  { id: 2,  parentId: 1,    name: 'Priya Raman',     role: 'VP Engineering',   team: 'Engineering', headcount: 12 },
  { id: 3,  parentId: 2,    name: 'Marco Bianchi',   role: 'Eng Manager',      team: 'Platform',    headcount: 5 },
  { id: 4,  parentId: 3,    name: 'Lena Fischer',    role: 'Senior Engineer',  team: 'Platform',    headcount: 0 },
  { id: 5,  parentId: 3,    name: 'Tomás Herrera',   role: 'Engineer',         team: 'Platform',    headcount: 0 },
  { id: 6,  parentId: 2,    name: 'Aisha Bello',     role: 'Eng Manager',      team: 'Product Eng', headcount: 4 },
  { id: 7,  parentId: 6,    name: 'Sven Larsson',    role: 'Engineer',         team: 'Product Eng', headcount: 0 },
  { id: 8,  parentId: 6,    name: 'Mei Lin',         role: 'Engineer',         team: 'Product Eng', headcount: 0 },
  { id: 9,  parentId: 1,    name: 'Carlos Mendes',   role: 'VP Sales',         team: 'Sales',       headcount: 6 },
  { id: 10, parentId: 9,    name: 'Hannah Kim',      role: 'Sales Manager',    team: 'EMEA',        headcount: 3 },
  { id: 11, parentId: 10,   name: 'Olivier Dubois',  role: 'Account Exec',     team: 'EMEA',        headcount: 0 },
  { id: 12, parentId: 10,   name: 'Sofia Rossi',     role: 'Account Exec',     team: 'EMEA',        headcount: 0 },
  { id: 13, parentId: 9,    name: 'James Carter',    role: 'Sales Manager',    team: 'Americas',    headcount: 1 },
  { id: 14, parentId: 13,   name: 'Grace Nwosu',     role: 'Account Exec',     team: 'Americas',    headcount: 0 },
  { id: 15, parentId: 1,    name: 'Ingrid Solberg',  role: 'VP Design',        team: 'Design',      headcount: 2 },
  { id: 16, parentId: 15,   name: 'Yuki Tanaka',     role: 'Product Designer', team: 'Design',      headcount: 0 },
  { id: 17, parentId: 15,   name: 'Pablo Gómez',     role: 'Brand Designer',   team: 'Design',      headcount: 0 },
];

@Component({
  selector: 'demo-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridTreeComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Tree</h2>
        <span class="demo-meta">Standalone control using the same parent/child tree projection as the grid</span>
      </div>
      <div class="demo-toolbar">
        <button type="button" (click)="tree()?.expandAllNodes()">Expand all</button>
        <button type="button" (click)="tree()?.collapseAllNodes()">Collapse all</button>
      </div>
      <agrid-tree class="demo-tree" [provider]="provider"
        (nodeClick)="onNodeClick($event)" />
      <div class="demo-event">{{ lastEvent() }}</div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-toolbar { display: flex; gap: 8px; }
    .demo-toolbar button { font: inherit; font-size: 12px; padding: 4px 12px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; cursor: pointer; }
    .demo-toolbar button:hover { background: #eef1f4; }
    .demo-tree { flex: 1; min-height: 0; border: 1px solid var(--agrid-color-border); border-radius: 6px; }
    .demo-event { min-height: 18px; color: #57606a; font-size: 12px; }
  `],
})
export class TreeDemoComponent {
  readonly provider = new AgridTreeProvider<OrgRow>({
    datasource: new AgridDataSource(ROWS),
    treeConfig: {
      getId: row => row.id,
      getParentId: row => row.parentId,
      treeField: 'name',
      defaultExpanded: true,
    },
    getDescription: row => `${row.role} · ${row.team}`,
    selection: 'single',
    ariaLabel: 'Organization',
  });
  readonly lastEvent = signal('Select a node to inspect its event.');
  readonly tree = viewChild(AgridTreeComponent);

  onNodeClick(event: AgridTreeNodeEvent<OrgRow>): void {
    this.lastEvent.set(`${event.kind} ${event.id}: ${event.label}`);
  }
}
