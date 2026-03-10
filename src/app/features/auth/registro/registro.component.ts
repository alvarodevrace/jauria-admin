import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-card__header">
          <h1 class="auth-card__title">JAURÍA</h1>
          <p class="auth-card__subtitle">Crear Cuenta</p>
        </div>

        <!-- Instrucción al atleta -->
        <div style="background:#1e1e1e;border-radius:8px;padding:14px;margin-bottom:20px;border-left:3px solid #B71C1C;">
          <p style="font-family:'Inter',sans-serif;font-size:12px;color:#aaa;line-height:1.6;margin:0;">
            Puedes crear tu cuenta solo si el coach ya registró tu membresía y
            tienes un <strong style="color:#fff;">plan activo</strong>.
            Usa el mismo email que diste al coach.
          </p>
        </div>

        @if (!cuentaCreada()) {
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label class="form-label">Nombre Completo</label>
              <input type="text" class="form-control" placeholder="Tu nombre" [(ngModel)]="nombre" name="nombre" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email (el mismo que diste al coach)</label>
              <input type="email" class="form-control" placeholder="tu@email.com" [(ngModel)]="email" name="email" required />
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <input type="password" class="form-control" placeholder="Mínimo 8 caracteres" [(ngModel)]="password" name="password" required minlength="8" />
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
            <div style="font-size:32px;margin-bottom:12px;">✅</div>
            <strong>¡Cuenta creada!</strong>
            <p style="margin-top:8px;font-size:13px;color:#aaa;">
              Ahora puedes iniciar sesión y ver tus clases y membresía.
            </p>
          </div>
          <button class="btn btn--primary auth-form__submit" style="margin-top:16px;" (click)="irALogin()">
            Ir al inicio de sesión
          </button>
        }

        <p class="auth-card__footer">
          ¿Ya tienes cuenta? <a routerLink="/auth/login">Ingresar</a>
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
      max-width: 420px;
      &__header { text-align: center; margin-bottom: 20px; }
      &__title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 0.1em; color: #B71C1C; margin: 0; }
      &__subtitle { font-family: 'Inter', sans-serif; font-size: 13px; color: #666; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 4px; }
      &__footer { text-align: center; font-family: 'Inter', sans-serif; font-size: 13px; color: #666; margin-top: 20px;
        a { color: #B71C1C; font-weight: 600; &:hover { text-decoration: underline; } }
      }
    }
    .auth-form__submit { width: 100%; margin-top: 8px; padding: 12px; font-size: 14px; }
  `],
})
export class RegistroComponent {
  nombre     = '';
  email      = '';
  password   = '';
  loading    = signal(false);
  error      = signal('');
  cuentaCreada = signal(false);

  private auth     = inject(AuthService);
  private supabase = inject(SupabaseService);
  private router   = inject(Router);

  async onSubmit() {
    if (!this.nombre || !this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    // ── Paso 1: verificar que el email existe en clientes con estado='Activo' ──
    const { data: clientes, error: clienteErr } = await this.supabase.client
      .from('clientes')
      .select('id_cliente, nombre_completo, estado')
      .eq('email', this.email.toLowerCase().trim())
      .eq('estado', 'Activo')
      .limit(1);

    if (clienteErr) {
      this.error.set('Error al verificar membresía. Intenta de nuevo.');
      this.loading.set(false);
      return;
    }

    if (!clientes || clientes.length === 0) {
      // Puede que exista pero con estado distinto — verificar para dar mensaje preciso
      const { data: existe } = await this.supabase.client
        .from('clientes')
        .select('estado')
        .eq('email', this.email.toLowerCase().trim())
        .limit(1);

      if (existe && existe.length > 0) {
        const estado = (existe[0] as { estado: string }).estado;
        this.error.set(
          `Tu membresía está en estado "${estado}". Solo puedes crear cuenta cuando esté Activa. Contacta al coach.`
        );
      } else {
        this.error.set(
          'No encontramos una membresía con ese email. El coach debe registrarte primero antes de crear tu cuenta.'
        );
      }
      this.loading.set(false);
      return;
    }

    const cliente = clientes[0] as { id_cliente: string; nombre_completo: string; estado: string };

    // ── Paso 2: crear cuenta en Supabase Auth ──────────────────────────────────
    const { error: authErr } = await this.auth.registro(
      this.email.trim(),
      this.password,
      this.nombre || cliente.nombre_completo
    );

    if (authErr) {
      this.error.set(authErr);
      this.loading.set(false);
      return;
    }

    // ── Paso 3: login automático para obtener el ID del nuevo usuario ──────────
    const { error: loginErr } = await this.auth.login(this.email.trim(), this.password);

    if (loginErr) {
      this.error.set(
        'La cuenta se creó, pero no se pudo completar la vinculación con tu membresía. Contacta al coach antes de iniciar sesión.'
      );
      this.loading.set(false);
      return;
    }

    // Vincular id_cliente al profile recién creado
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      this.error.set(
        'La cuenta se creó, pero no se pudo identificar tu usuario para vincular la membresía. Contacta al coach.'
      );
      this.loading.set(false);
      return;
    }

    const { error: profileErr } = await this.supabase.updateProfile(userId, {
      id_cliente: cliente.id_cliente,
      rol: 'atleta',
      nombre_completo: this.nombre || cliente.nombre_completo,
    });

    if (profileErr) {
      this.error.set(
        'La cuenta se creó, pero no se pudo vincular tu membresía. Contacta al coach antes de iniciar sesión.'
      );
      this.loading.set(false);
      return;
    }

    // Hacer logout para que el atleta inicie sesión de forma limpia
    await this.auth.logout();

    this.loading.set(false);
    this.cuentaCreada.set(true);
  }

  irALogin() { this.router.navigate(['/auth/login']); }
}
