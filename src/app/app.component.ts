import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { AppBusyService } from './core/services/app-busy.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />

    @if (auth.loading() || appBusy.busy()) {
      <div class="app-busy-overlay" aria-live="polite" aria-busy="true">
        <div class="app-busy-card">
          <div class="app-busy-spinner"></div>
          <p class="app-busy-message">
            {{ auth.loading() ? 'Cargando sesión...' : appBusy.message() }}
          </p>
        </div>
      </div>
    }
  `,
  styles: [`
    .app-busy-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(8, 9, 10, 0.58);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .app-busy-card {
      min-width: 220px;
      max-width: 320px;
      border: 1px solid #2b3033;
      border-radius: 18px;
      background: rgba(21, 23, 24, 0.96);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      text-align: center;
    }

    .app-busy-spinner {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 3px solid rgba(244, 241, 235, 0.12);
      border-top-color: #a61f24;
      animation: appBusySpin 0.9s linear infinite;
    }

    .app-busy-message {
      margin: 0;
      font-family: 'Manrope', sans-serif;
      font-size: 13px;
      color: #f4f1eb;
      line-height: 1.5;
    }

    @keyframes appBusySpin {
      to {
        transform: rotate(360deg);
      }
    }
  `],
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  protected readonly appBusy = inject(AppBusyService);
}
