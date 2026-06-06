import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./agrid-demo/agrid-demo.component').then(m => m.AgridDemoComponent),
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
];
