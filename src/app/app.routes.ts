import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { ShellComponent } from './core/layout/shell/shell.component';

export const routes: Routes = [
  { path: '', redirectTo: 'app/novedades', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'novedades',
        loadComponent: () => import('./features/novedades/novedades.component').then(m => m.NovedadesComponent),
      },
      {
        path: 'dashboard',
        canActivate: [roleGuard], data: { roles: ['coach', 'admin'] },
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'clientes',
        canActivate: [roleGuard], data: { roles: ['coach', 'admin'] },
        loadComponent: () => import('./features/clientes/clientes.component').then(m => m.ClientesComponent),
      },
      {
        path: 'clases',
        loadComponent: () => import('./features/clases/clases.component').then(m => m.ClasesComponent),
      },
      {
        path: 'pagos',
        canActivate: [roleGuard], data: { roles: ['coach', 'admin'] },
        loadComponent: () => import('./features/pagos/pagos.component').then(m => m.PagosComponent),
      },
      {
        path: 'premios',
        loadComponent: () => import('./features/premios/premios.component').then(m => m.PremiosComponent),
      },
      {
        path: 'retos',
        loadComponent: () => import('./features/retos/retos.component').then(m => m.RetosComponent),
      },
      {
        path: 'conversaciones',
        canActivate: [roleGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./features/conversaciones/conversaciones.component').then(m => m.ConversacionesComponent),
      },
      {
        path: 'leads',
        canActivate: [roleGuard], data: { roles: ['coach', 'admin'] },
        loadComponent: () => import('./features/leads/leads.component').then(m => m.LeadsComponent),
      },
      {
        path: 'configuracion',
        canActivate: [roleGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./features/configuracion/configuracion.component').then(m => m.ConfiguracionComponent),
      },
      {
        path: 'eventos-noticias',
        canActivate: [roleGuard], data: { roles: ['coach', 'admin'] },
        loadComponent: () => import('./features/eventos-noticias/eventos-noticias.component').then(m => m.EventosNoticiasComponent),
      },
      {
        path: 'workflows',
        canActivate: [roleGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./features/workflows/workflows.component').then(m => m.WorkflowsComponent),
      },
      {
        path: 'mi-cuenta',
        loadComponent: () => import('./features/mi-cuenta/mi-cuenta.component').then(m => m.MiCuentaComponent),
      },
      {
        path: 'mi-pago',
        canActivate: [roleGuard], data: { roles: ['atleta'] },
        loadComponent: () => import('./features/mi-pago/mi-pago.component').then(m => m.MiPagoComponent),
      },
      {
        path: 'roles',
        canActivate: [roleGuard], data: { roles: ['coach', 'admin'] },
        loadComponent: () => import('./features/roles/roles.component').then(m => m.RolesComponent),
      },
      { path: '**', redirectTo: 'novedades' },
    ],
  },
  { path: '**', redirectTo: 'app/novedades' },
];
