import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">

        <div class="auth-card__header">
          <h1 class="auth-card__title">JAURÍA</h1>
          <p class="auth-card__subtitle">Nueva Contraseña</p>
        </div>

        @if (tokenValido()) {
          <p style="font-family:'Inter',sans-serif;font-size:13px;color:#666;text-align:center;margin-bottom:24px;">
            Ingresa tu nueva contraseña. Mínimo 8 caracteres.
          </p>

          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label class="form-label">Nueva contraseña</label>
              <input
                type="password"
                class="form-control"
                placeholder="Mínimo 8 caracteres"
                [(ngModel)]="password"
                name="password"
                required
                minlength="8"
                autocomplete="new-password"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Confirmar contraseña</label>
              <input
                type="password"
                class="form-control"
                placeholder="Repite la contraseña"
                [(ngModel)]="confirmPassword"
                name="confirm"
                required
                autocomplete="new-password"
              />
            </div>

            @if (error()) {
              <div class="alert alert--error">{{ error() }}</div>
            }
            @if (exito()) {
              <div class="alert alert--success">{{ exito() }}</div>
            }

            <button type="submit" class="btn btn--primary auth-form__submit"
              [disabled]="loading() || !!exito()">
              {{ loading() ? 'Actualizando...' : 'Cambiar Contraseña' }}
            </button>
          </form>
        } @else if (tokenInvalido()) {
          <div class="alert alert--error" style="text-align:center;padding:24px;">
            <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
            <strong>Enlace inválido o expirado</strong>
            <p style="margin-top:8px;font-size:13px;color:#aaa;">
              El enlace de recuperación expiró o ya fue usado. Solicita uno nuevo.
            </p>
          </div>
          <button class="btn btn--primary auth-form__submit" (click)="irAForgot()">
            Solicitar nuevo enlace
          </button>
        } @else {
          <div style="text-align:center;padding:40px;color:#666;">
            Verificando enlace...
          </div>
        }

        <p class="auth-card__footer" style="margin-top:16px;">
          <a (click)="irALogin()" style="cursor:pointer;">← Volver al inicio de sesión</a>
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
      &__header { text-align: center; margin-bottom: 24px; }
      &__title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 0.1em; color: #B71C1C; margin: 0; }
      &__subtitle { font-family: 'Inter', sans-serif; font-size: 13px; color: #666; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 4px; }
      &__footer { text-align: center; font-family: 'Inter', sans-serif; font-size: 13px; color: #555; margin-top: 20px;
        a { color: #B71C1C; font-weight: 600; &:hover { text-decoration: underline; } }
      }
    }
    .auth-form__submit { width: 100%; margin-top: 8px; padding: 12px; font-size: 14px; }
  `],
})
export class ResetPasswordComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal('');
  exito = signal('');
  tokenValido = signal(false);
  tokenInvalido = signal(false);

  ngOnInit() {
    // Supabase pone el access_token en el hash de la URL cuando el usuario
    // hace clic en el enlace de recuperación: #access_token=...&type=recovery
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      // Supabase SDK detecta automáticamente el token del hash y establece la sesión
      this.supabase.client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          this.tokenValido.set(true);
        }
      });
      // Dar 2 segundos para que el SDK procese el hash
      setTimeout(() => {
        if (!this.tokenValido()) {
          // Verificar si ya hay sesión activa (el SDK la procesó antes del listener)
          this.supabase.client.auth.getSession().then(({ data }) => {
            if (data.session) {
              this.tokenValido.set(true);
            } else {
              this.tokenInvalido.set(true);
            }
          });
        }
      }, 2000);
    } else {
      // Sin hash → enlace inválido
      this.tokenInvalido.set(true);
    }
  }

  async onSubmit() {
    this.error.set('');

    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);

    const { error } = await this.supabase.client.auth.updateUser({
      password: this.password,
    });

    this.loading.set(false);

    if (error) {
      this.error.set('Error al actualizar: ' + error.message);
      return;
    }

    this.exito.set('¡Contraseña actualizada! Redirigiendo...');
    setTimeout(() => this.router.navigate(['/auth/login']), 2500);
  }

  irAForgot() { this.router.navigate(['/auth/forgot-password']); }
  irALogin()  { this.router.navigate(['/auth/login']); }
}
