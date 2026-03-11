import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, NavigationEnd, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, TablerIconComponent],
  template: `
    <!-- Mobile overlay -->
    @if (mobileOpen()) {
      <div class="sidebar-overlay" (click)="close()"></div>
    }

    <aside class="sidebar" [class.open]="mobileOpen()">
      <div class="sidebar__logo">
        <div class="sidebar__logo-icon">J</div>
        <div>
          <span class="sidebar__logo-name">Jauría</span>
          <span class="sidebar__logo-sub">Admin Panel</span>
        </div>
      </div>

      <nav class="sidebar__nav">

        <!-- General — todos los roles -->
        <span class="sidebar__section-label">General</span>

        <a class="sidebar__item" routerLink="/app/clases" routerLinkActive="active" (click)="close()">
          <i-tabler class="sidebar__item-icon" name="barbell" />
          <span>Clases</span>
        </a>

        <a class="sidebar__item" routerLink="/app/mi-cuenta" routerLinkActive="active" (click)="close()">
          <i-tabler class="sidebar__item-icon" name="user" />
          <span>Mi Cuenta</span>
        </a>

        @if (auth.rol() === 'atleta') {
          <a class="sidebar__item" routerLink="/app/mi-pago" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="credit-card" />
            <span>Mi Pago</span>
          </a>
        }

        <!-- Coach + Admin -->
        @if (auth.isCoach()) {
          <span class="sidebar__section-label">Gestión</span>

          <a class="sidebar__item" routerLink="/app/clientes" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="users" />
            <span>Clientes</span>
          </a>

          <a class="sidebar__item" routerLink="/app/pagos" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="wallet" />
            <span>Pagos</span>
          </a>

          <a class="sidebar__item" routerLink="/app/conversaciones" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="message" />
            <span>Conversaciones WA</span>
          </a>

          <a class="sidebar__item" routerLink="/app/configuracion" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="settings-2" />
            <span>Configuración</span>
          </a>
        }

        <!-- Admin only -->
        @if (auth.isAdmin()) {
          <span class="sidebar__section-label">Sistema</span>

          <a class="sidebar__item" routerLink="/app/dashboard" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="chart-bar" />
            <span>Dashboard</span>
          </a>

          <a class="sidebar__item" routerLink="/app/leads" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="clipboard" />
            <span>Leads</span>
          </a>

          <a class="sidebar__item" routerLink="/app/workflows" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="bolt" />
            <span>Workflows n8n</span>
          </a>

          <a class="sidebar__item" routerLink="/app/roles" routerLinkActive="active" (click)="close()">
            <i-tabler class="sidebar__item-icon" name="key" />
            <span>Gestión de Roles</span>
          </a>
        }
      </nav>

      <div class="sidebar__footer">
        <div class="sidebar__user-mini">
          <div class="sidebar__user-avatar">{{ initials() }}</div>
          <div class="sidebar__user-text">
            <span class="sidebar__user-name">{{ firstName() }}</span>
            <span class="sidebar__user-role">{{ auth.rol() }}</span>
          </div>
        </div>
        <button class="sidebar__logout" (click)="auth.logout()" title="Cerrar sesión">
          <i-tabler name="logout-2" />
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar-overlay {
      position: fixed;
      inset: 0;
      background: rgba(8, 9, 10, 0.7);
      z-index: 999;
    }
    .sidebar__logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sidebar__logo-icon {
      width: 36px;
      height: 36px;
      background: #A61F24;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 20px;
      color: #f4f1eb;
      flex-shrink: 0;
    }
    .sidebar__logo-name {
      display: block;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18px;
      letter-spacing: 0.05em;
      color: #f4f1eb;
      text-transform: uppercase;
      line-height: 1;
    }
    .sidebar__logo-sub {
      display: block;
      font-family: 'Manrope', sans-serif;
      font-size: 10px;
      color: #938c84;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 2px;
    }
    .sidebar__item-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      color: currentColor;
    }
    .sidebar__user-mini {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }
    .sidebar__user-avatar {
      width: 30px;
      height: 30px;
      background: #A61F24;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 13px;
      color: #f4f1eb;
      flex-shrink: 0;
    }
    .sidebar__user-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .sidebar__user-name {
      font-family: 'Manrope', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #f4f1eb;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sidebar__user-role {
      font-family: 'Manrope', sans-serif;
      font-size: 10px;
      color: #938c84;
      text-transform: capitalize;
    }
    .sidebar__footer {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sidebar__logout {
      background: none;
      border: 1px solid #2b3033;
      color: #938c84;
      width: 30px;
      height: 30px;
      border-radius: 6px;
      cursor: pointer;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      &:hover { border-color: #A61F24; color: #A61F24; background: #1d2022; }
    }
  `],
})
export class SidebarComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  mobileOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.mobileOpen.set(false);
      });
  }

  open()  { this.mobileOpen.set(true); }
  close() { this.mobileOpen.set(false); }
  toggle() { this.mobileOpen.update(v => !v); }

  initials() {
    const name = this.auth.profile()?.nombre_completo ?? '';
    return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || 'U';
  }

  firstName() {
    const name = this.auth.profile()?.nombre_completo ?? 'Usuario';
    return name.split(' ')[0] ?? 'Usuario';
  }
}
