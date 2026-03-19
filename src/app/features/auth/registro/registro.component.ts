import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__header">
          <img class="auth-card__logo" src="assets/logo.png" alt="Jauría CrossFit" />
          <p class="auth-card__subtitle">Activar cuenta de atleta</p>
        </div>

        <div class="auth-card__notice">
          <p style="margin:0;">
            Puedes crear tu cuenta solo si el coach ya registró tu membresía y
            tienes un <strong style="color:#f4f1eb;">plan activo</strong>.
            Usa el mismo email que diste al coach.
          </p>
        </div>

        @if (!cuentaCreada()) {
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label class="form-label" for="nombre">Nombre Completo</label>
              <input id="nombre" type="text" class="form-control" placeholder="Tu nombre" [(ngModel)]="nombre" name="nombre" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="email">Email (el mismo que diste al coach)</label>
              <input id="email" type="email" class="form-control" placeholder="tu@email.com" [(ngModel)]="email" name="email" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="password">Contraseña</label>
              <div class="auth-form__password-wrap">
                <input
                  id="password"
                  [type]="mostrarPassword() ? 'text' : 'password'"
                  class="form-control auth-form__password-input"
                  placeholder="Mínimo 8 caracteres"
                  [(ngModel)]="password"
                  name="password"
                  required
                  minlength="8"
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

            <button type="submit" class="btn btn--primary auth-form__submit" [disabled]="loading()">
              {{ loading() ? 'Verificando membresía...' : 'Crear Cuenta' }}
            </button>
          </form>
        } @else {
          <div class="alert alert--success" style="text-align:center;padding:24px;">
            <div class="auth-state-icon auth-state-icon--success"><i-lucide name="circle-check" /></div>
            <strong>¡Cuenta creada!</strong>
            <p style="margin-top:8px;font-size:13px;color:#d2cbc1;">
              Revisa tu correo para confirmar la cuenta si Supabase te lo pidió. Luego inicia sesión con el mismo email de tu membresía.
            </p>
          </div>
          <button class="btn btn--primary auth-form__submit" style="margin-top:16px;" (click)="irALogin()">
            Ir al inicio de sesión
          </button>
        }

        <div class="auth-card__footer auth-card__footer--stack">
          <span>¿Ya tienes cuenta?</span>
          <a routerLink="/auth/login">Ingresar</a>
          <span>¿Eres coach o admin?</span>
          <a routerLink="/auth/login">Volver al acceso del panel</a>
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
      }
    }

    .auth-form__password-wrap {
      position: relative;
    }

    .auth-form__password-input {
      padding-right: 52px;
    }

    .auth-form__password-toggle {
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
    }

    .auth-form__password-toggle:hover {
      color: #f4f1eb;
      background: rgba(255, 255, 255, 0.05);
    }

    .auth-form__password-toggle:focus-visible {
      outline: 2px solid rgba(166, 31, 36, 0.4);
      outline-offset: 1px;
    }

    .auth-form__submit {
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      font-size: 14px;
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
export class RegistroComponent {
  nombre     = '';
  email      = '';
  password   = '';
  loading    = signal(false);
  error      = signal('');
  cuentaCreada = signal(false);
  mostrarPassword = signal(false);

  private auth     = inject(AuthService);
  private supabase = inject(SupabaseService);
  private router   = inject(Router);

  async onSubmit() {
    if (!this.nombre || !this.email || !this.password) return;
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const normalizedEmail = this.email.trim().toLowerCase();

    try {
      const { data: rows, error: clienteErr } = await this.supabase.client
        .rpc('verificar_membresia_por_email', { p_email: normalizedEmail });

      if (clienteErr) {
        this.error.set('Error al verificar membresía. Intenta de nuevo.');
        return;
      }

      const membresia = rows as { id_cliente: string; nombre_completo: string; estado: string }[] | null;

      if (!membresia || membresia.length === 0) {
        this.error.set(
          'No encontramos una membresía con ese email. El coach debe registrarte primero antes de crear tu cuenta.'
        );
        return;
      }

      if (membresia[0].estado !== 'Activo') {
        this.error.set(
          `Tu membresía está en estado "${membresia[0].estado}". Solo puedes crear cuenta cuando esté Activa. Contacta al coach.`
        );
        return;
      }

      const cliente = membresia[0];
      const { error: authErr } = await this.auth.registro(
        normalizedEmail,
        this.password,
        cliente.nombre_completo
      );

      if (authErr) {
        this.error.set(authErr);
        return;
      }

      await this.supabase.client.auth.signOut();
      this.cuentaCreada.set(true);
    } catch {
      this.error.set('No se pudo completar el registro. Intenta nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  irALogin() { this.router.navigate(['/auth/login']); }

  togglePasswordVisibility() {
    this.mostrarPassword.update((visible) => !visible);
  }
}
