import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
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
          <p style="font-family:'Manrope',sans-serif;font-size:13px;color:#938C84;text-align:center;margin-bottom:24px;">
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
            <p style="margin-top:8px;font-size:13px;color:#d2cbc1;">
              El enlace de recuperación expiró o ya fue usado. Solicita uno nuevo.
            </p>
          </div>
          <button class="btn btn--primary auth-form__submit" (click)="irAForgot()">
            Solicitar nuevo enlace
          </button>
        } @else {
          <div style="text-align:center;padding:40px;color:#938c84;">
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
export class ResetPasswordComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal('');
  exito = signal('');
  tokenValido = signal(false);
  tokenInvalido = signal(false);
  private redirectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private tokenCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    const hash = window.location.hash;
    if (!hash.includes('type=recovery') && !hash.includes('access_token')) {
      this.tokenInvalido.set(true);
      return;
    }

    const { data: { subscription } } = this.supabase.client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        this.tokenValido.set(true);
        this.tokenInvalido.set(false);
      }
    });

    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      if (this.redirectTimeoutId) clearTimeout(this.redirectTimeoutId);
      if (this.tokenCheckTimeoutId) clearTimeout(this.tokenCheckTimeoutId);
    });

    this.tokenCheckTimeoutId = setTimeout(() => {
      void this.validarSesionRecuperacion();
    }, 1500);
  }

  private async validarSesionRecuperacion() {
    if (this.tokenValido()) return;

    const { data } = await this.supabase.client.auth.getSession();
    if (data.session) {
      this.tokenValido.set(true);
      this.tokenInvalido.set(false);
      return;
    }

    this.tokenInvalido.set(true);
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
    this.redirectTimeoutId = setTimeout(() => {
      void this.router.navigate(['/auth/login']);
    }, 2500);
  }

  irAForgot() { this.router.navigate(['/auth/forgot-password']); }
  irALogin()  { this.router.navigate(['/auth/login']); }
}
