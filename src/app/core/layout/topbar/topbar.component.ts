import { Component, inject, Output, EventEmitter, computed } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

const ROUTE_TITLES: Record<string, string> = {
  '/app/dashboard':      'Dashboard',
  '/app/clientes':       'Clientes',
  '/app/clases':         'Clases',
  '/app/pagos':          'Pagos',
  '/app/conversaciones': 'Conversaciones WhatsApp',
  '/app/leads':          'Leads',
  '/app/configuracion':  'Configuración',
  '/app/workflows':      'Workflows n8n',
  '/app/mi-cuenta':      'Mi Cuenta',
  '/app/mi-pago':        'Mi Pago',
  '/app/roles':          'Gestión de Roles',
};

@Component({
  selector: 'app-topbar',
  standalone: true,
  template: `
    <header class="topbar">
      <div style="display:flex;align-items:center;gap:16px;">
        <button class="topbar__hamburger" (click)="menuClick.emit()" aria-label="Menú">
          <span></span><span></span><span></span>
        </button>
        <h1 class="topbar__title">{{ pageTitle() }}</h1>
      </div>

      <div class="topbar__actions">
        <div class="topbar__user">
          <div class="topbar__avatar">{{ initials() }}</div>
          <div class="topbar__user-info">
            <span class="name">{{ auth.profile()?.nombre_completo ?? 'Usuario' }}</span>
            <span class="role">{{ auth.rol() }}</span>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .topbar__hamburger {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      span {
        display: block;
        width: 20px;
        height: 2px;
        background: #ccc;
        border-radius: 2px;
        transition: 0.2s ease;
      }
      &:hover span { background: #fff; }
    }
    @media (max-width: 1024px) {
      .topbar__hamburger { display: flex; }
    }
  `],
})
export class TopbarComponent {
  @Output() menuClick = new EventEmitter<void>();
  auth = inject(AuthService);
  private router = inject(Router);

  pageTitle = computed(() => {
    const url = this.router.url.split('?')[0];
    return ROUTE_TITLES[url] ?? 'Panel Admin';
  });

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      // trigger computed re-evaluation
    });
  }

  initials() {
    const name = this.auth.profile()?.nombre_completo ?? '';
    return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || 'U';
  }
}
