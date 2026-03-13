import { Component, DestroyRef, inject, Output, EventEmitter, computed, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

const ROUTE_TITLES: Record<string, string> = {
  '/app/novedades':      'Novedades',
  '/app/dashboard':      'Dashboard',
  '/app/clientes':       'Clientes',
  '/app/clases':         'Clases',
  '/app/pagos':          'Pagos',
  '/app/conversaciones': 'Conversaciones WhatsApp',
  '/app/leads':          'Leads',
  '/app/configuracion':  'Configuración',
  '/app/eventos-noticias': 'Eventos y Noticias',
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
      <div class="topbar__context">
        <button class="topbar__hamburger" (click)="menuClick.emit()" aria-label="Menú">
          <span></span><span></span><span></span>
        </button>
        <h1 class="topbar__title">{{ pageTitle() }}</h1>
      </div>
    </header>
  `,
  styles: [`
    .topbar__context {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
    }
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
        background: #938c84;
        border-radius: 2px;
        transition: 0.2s ease;
      }
      &:hover span { background: #f4f1eb; }
    }
    .topbar__title {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media (max-width: 1024px) {
      .topbar__hamburger { display: flex; }
    }
  `],
})
export class TopbarComponent {
  @Output() menuClick = new EventEmitter<void>();
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private currentUrl = signal(this.getCurrentUrl());

  pageTitle = computed(() => {
    return ROUTE_TITLES[this.currentUrl()] ?? 'Panel Admin';
  });

  constructor() {
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.currentUrl.set(this.getCurrentUrl());
      });
  }

  private getCurrentUrl(): string {
    return this.router.url.split('?')[0];
  }
}
