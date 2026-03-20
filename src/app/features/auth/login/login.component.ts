import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { GoogleAnalyticsService } from '../../../core/services/google-analytics.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__header">
          <img class="auth-card__logo" src="assets/logo.png" alt="Jauría CrossFit" />
          <p class="auth-card__subtitle">Ingreso al panel</p>
        </div>

        <div class="auth-card__notice">
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
            <div class="auth-form__row">
              <label class="form-label auth-form__label" for="password">Contraseña</label>
              <a routerLink="/auth/forgot-password" class="auth-form__link">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <div class="auth-form__password-wrap">
              <input
                id="password"
                [type]="mostrarPassword() ? 'text' : 'password'"
                class="form-control auth-form__password-input"
                placeholder="••••••••"
                [(ngModel)]="password"
                name="password"
                required
                autocomplete="current-password"
              />
              <button
                type="button"
                class="auth-form__password-toggle"
                (click)="togglePasswordVisibility()"
                [attr.aria-label]="mostrarPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                [attr.aria-pressed]="mostrarPassword()"
              >
                <i-lucide [name]="mostrarPassword() ? 'eye-off' : 'eye'" />
              </button>
            </div>
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
      background:
        radial-gradient(circle at top, rgba(166, 31, 36, 0.2), transparent 38%),
        linear-gradient(160deg, #0b0c0d 0%, #111315 48%, #171a1c 100%);
      padding: 24px;
    }

    .auth-card {
      background: linear-gradient(180deg, rgba(21, 23, 24, 0.96), rgba(17, 19, 20, 0.98));
      border: 1px solid rgba(244, 241, 235, 0.08);
      border-radius: 24px;
      padding: 40px;
      width: 100%;
      max-width: 430px;
      box-shadow: 0 28px 64px rgba(0, 0, 0, 0.42);

      &__header {
        text-align: center;
        margin-bottom: 28px;
      }

      &__logo {
        width: 148px;
        height: auto;
        display: block;
        margin: 0 auto 18px;
      }

      &__subtitle {
        font-family: 'Manrope', sans-serif;
        font-size: 12px;
        color: #938c84;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin: 0;
      }

      &__footer {
        text-align: center;
        font-family: 'Manrope', sans-serif;
        font-size: 13px;
        color: #938c84;
        margin-top: 20px;

        a {
          color: #a61f24;
          font-weight: 600;
          &:hover { text-decoration: underline; }
        }
      }

      &__notice {
        margin-bottom: 20px;
        padding: 14px 16px;
        border-left: 3px solid #a61f24;
        background: rgba(29, 32, 34, 0.92);
        border-radius: 12px;
        font-family: 'Manrope', sans-serif;
        font-size: 12px;
        line-height: 1.6;
        color: #d2cbc1;

        strong {
          color: #f4f1eb;
        }
      }
    }

    .auth-form {
      &__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 6px;
      }

      &__label {
        margin-bottom: 0;
      }

      &__link {
        font-family: 'Manrope', sans-serif;
        font-size: 11px;
        color: #938c84;
        text-decoration: none;
        letter-spacing: 0.03em;
        transition: color 0.2s ease;

        &:hover {
          color: #a61f24;
        }
      }

      &__submit {
        width: 100%;
        margin-top: 8px;
        padding: 12px;
        font-size: 14px;
      }

      &__password-wrap {
        position: relative;
      }

      &__password-input {
        padding-right: 52px;
      }

      &__password-toggle {
        position: absolute;
        top: 50%;
        right: 10px;
        transform: translateY(-50%);
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 10px;
        background: transparent;
        color: #938c84;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: color 0.2s ease, background 0.2s ease;

        &:hover {
          color: #f4f1eb;
          background: rgba(255, 255, 255, 0.05);
        }

        &:focus-visible {
          outline: 2px solid rgba(166, 31, 36, 0.4);
          outline-offset: 1px;
        }
      }
    }

    .auth-card__footer--stack {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    @media (max-width: 480px) {
      .auth-page {
        padding: 16px;
      }

      .auth-card {
        padding: 28px 20px;

        &__logo {
          width: 126px;
        }
      }
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  mostrarPassword = signal(false);

  private auth = inject(AuthService);
  private router = inject(Router);
  private analytics = inject(GoogleAnalyticsService);

  async onSubmit() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    const { error } = await this.auth.login(this.email.trim().toLowerCase(), this.password);

    if (error) {
      this.error.set(error);
      this.loading.set(false);
      return;
    }

    this.analytics.trackLogin();
    await this.router.navigate(['/app/novedades']);
    this.loading.set(false);
  }

  togglePasswordVisibility() {
    this.mostrarPassword.update((visible) => !visible);
  }
}
