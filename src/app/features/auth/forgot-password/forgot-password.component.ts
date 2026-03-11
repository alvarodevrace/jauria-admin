import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">

        <div class="auth-card__header">
          <h1 class="auth-card__title">JAURÍA</h1>
          <p class="auth-card__subtitle">Recuperar Contraseña</p>
        </div>

        @if (!enviado()) {
          <p style="font-family:'Manrope',sans-serif;font-size:13px;color:#938C84;text-align:center;margin-bottom:24px;line-height:1.6;">
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input
                type="email"
                class="form-control"
                placeholder="tu@email.com"
                [(ngModel)]="email"
                name="email"
                required
                autocomplete="email"
              />
            </div>

            @if (error()) {
              <div class="alert alert--error">{{ error() }}</div>
            }

            <button type="submit" class="btn btn--primary auth-form__submit" [disabled]="loading()">
              {{ loading() ? 'Enviando...' : 'Enviar enlace de recuperación' }}
            </button>
          </form>
        } @else {
          <div class="alert alert--success" style="text-align:center;padding:24px;">
            <div style="font-size:32px;margin-bottom:12px;">📧</div>
            <strong>Email enviado</strong>
            <p style="margin-top:8px;font-size:13px;color:#d2cbc1;">
              Revisa tu bandeja de entrada en <strong>{{ email }}</strong>.
              El enlace expira en 1 hora.
            </p>
            <p style="margin-top:8px;font-size:12px;color:#938c84;">
              Si no llega, revisa la carpeta de spam.
            </p>
          </div>
        }

        <p class="auth-card__footer">
          <a routerLink="/auth/login">← Volver al inicio de sesión</a>
        </p>

      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0e0f10;
      padding: 24px;
    }
    .auth-card {
      background: #151718;
      border: 1px solid #2b3033;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      &__header { text-align: center; margin-bottom: 24px; }
      &__title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 0.1em; color: #A61F24; margin: 0; }
      &__subtitle { font-family: 'Manrope', sans-serif; font-size: 13px; color: #938C84; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 4px; }
      &__footer { text-align: center; font-family: 'Manrope', sans-serif; font-size: 13px; color: #938C84; margin-top: 20px;
        a { color: #A61F24; font-weight: 700; &:hover { text-decoration: underline; } }
      }
    }
    .auth-form__submit { width: 100%; margin-top: 8px; padding: 12px; font-size: 14px; }
  `],
})
export class ForgotPasswordComponent {
  private supabase = inject(SupabaseService);

  email = '';
  loading = signal(false);
  error = signal('');
  enviado = signal(false);

  async onSubmit() {
    if (!this.email) return;
    this.loading.set(true);
    this.error.set('');
    const normalizedEmail = this.email.trim().toLowerCase();

    const redirectTo = `${window.location.origin}/auth/reset-password`;

    const { error } = await this.supabase.client.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo }
    );

    this.loading.set(false);

    if (error) {
      this.error.set('No se pudo enviar el email. Verifica la dirección ingresada.');
      return;
    }

    this.email = normalizedEmail;
    this.enviado.set(true);
  }
}
