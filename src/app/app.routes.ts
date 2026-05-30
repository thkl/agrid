import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./agrid-demo/agrid-demo.component').then(m => m.AgridDemoComponent),
  },
];
