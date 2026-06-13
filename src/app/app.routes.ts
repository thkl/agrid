import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'demo',
    loadComponent: () => import('./demos/agrid-demo.component').then(m => m.AgridDemoComponent),
  },
  {
    path: 'documentation',
    loadComponent: () => import('./documentation/documentation.component').then(m => m.DocumentationComponent),
  },
  {
    path: 'custom-cells',
    loadComponent: () => import('./demos/custom-cells.component').then(m => m.CustomCellsDemoComponent),
  },
  {
    path: 'pagination',
    loadComponent: () => import('./demos/pagination.component').then(m => m.PaginationDemoComponent),
  },
  {
    path: 'server-pagination',
    loadComponent: () => import('./demos/server-pagination.component').then(m => m.ServerPaginationDemoComponent),
  },
  {
    path: 'aggregates',
    loadComponent: () => import('./demos/aggregates.component').then(m => m.AggregatesDemoComponent),
  },
  {
    path: 'readonly',
    loadComponent: () => import('./demos/readonly.component').then(m => m.ReadonlyDemoComponent),
  },
  {
    path: 'pinning',
    loadComponent: () => import('./demos/pinning.component').then(m => m.PinningDemoComponent),
  },
  {
    path: 'performance',
    loadComponent: () => import('./demos/performance.component').then(m => m.PerformanceDemoComponent),
  },
  {
    path: 'tree',
    loadComponent: () => import('./demos/tree.component').then(m => m.TreeDemoComponent),
  },
  {
    path: 'master-detail',
    loadComponent: () => import('./demos/master-detail.component').then(m => m.MasterDetailDemoComponent),
  },

];
