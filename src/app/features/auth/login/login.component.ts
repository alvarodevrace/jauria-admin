import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__header">
          <h1 class="auth-card__title">JAURÍA</h1>
          <p class="auth-card__subtitle">Ingreso al panel</p>
        </div>

        <div class="auth-card__notice">
          <strong>Coach y admin:</strong> ingresa con tu cuenta del panel.
          Si eres atleta nuevo, activa tu cuenta solo después de que el coach registre tu membresía.
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input
              id="email"
              type="email"
              class="form-control"
              placeholder="coach@jauriagym.com"
              [(ngModel)]="email"
              name="email"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label class="form-label" for="password" style="margin-bottom:0;">Contraseña</label>
              <a routerLink="/auth/forgot-password"
                style="font-family:'Inter',sans-serif;font-size:11px;color:#666;text-decoration:none;letter-spacing:0.03em;"
                onmouseover="this.style.color='#B71C1C'"
                onmouseout="this.style.color='#666'">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <input
              id="password"
              type="password"
              class="form-control"
              placeholder="••••••••"
              [(ngModel)]="password"
              name="password"
              required
              autocomplete="current-password"
            />
          </div>

          @if (error()) {
            <div class="alert alert--error">{{ error() }}</div>
          }

          <button
            type="submit"
            class="btn btn--primary auth-form__submit"
            [disabled]="loading()"
          >
            {{ loading() ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>

        <div class="auth-card__footer auth-card__footer--stack">
          <span>¿Eres atleta y ya tienes membresía activa?</span>
          <a routerLink="/auth/registro">Activar cuenta de atleta</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      padding: 24px;
    }

    .auth-card {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;

      &__header {
        text-align: center;
        margin-bottom: 32px;
      }

      &__title {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 48px;
        letter-spacing: 0.1em;
        color: #B71C1C;
        margin: 0;
      }

      &__subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        color: #666;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        margin-top: 4px;
      }

      &__footer {
        text-align: center;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        color: #666;
        margin-top: 20px;

        a {
          color: #B71C1C;
          font-weight: 600;
          &:hover { text-decoration: underline; }
        }
      }

      &__notice {
        margin-bottom: 20px;
        padding: 14px 16px;
        border-left: 3px solid #B71C1C;
        background: #1e1e1e;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        line-height: 1.6;
        color: #aaa;

        strong {
          color: #fff;
        }
      }
    }

    .auth-form {
      &__submit {
        width: 100%;
        margin-top: 8px;
        padding: 12px;
        font-size: 14px;
      }
    }

    .auth-card__footer--stack {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  private auth = inject(AuthService);
  private router = inject(Router);

  async onSubmit() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    const { error } = await this.auth.login(this.email, this.password);

    if (error) {
      this.error.set(error);
      this.loading.set(false);
      return;
    }

    // Navigate based on role
    const rol = this.auth.rol();
    const dest = rol === 'admin' ? '/app/dashboard' : '/app/clases';
    this.router.navigate([dest]);
    this.loading.set(false);
  }
}
