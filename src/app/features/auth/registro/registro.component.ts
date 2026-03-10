import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

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

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label class="form-label">Nombre Completo</label>
            <input type="text" class="form-control" placeholder="Tu nombre" [(ngModel)]="nombre" name="nombre" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" placeholder="tu@email.com" [(ngModel)]="email" name="email" required />
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" class="form-control" placeholder="Min. 8 caracteres" [(ngModel)]="password" name="password" required minlength="8" />
          </div>

          @if (error()) {
            <div class="alert alert--error">{{ error() }}</div>
          }
          @if (success()) {
            <div class="alert alert--success">{{ success() }}</div>
          }

          <button type="submit" class="btn btn--primary auth-form__submit" [disabled]="loading()">
            {{ loading() ? 'Creando cuenta...' : 'Crear Cuenta' }}
          </button>
        </form>

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
      max-width: 400px;
      &__header { text-align: center; margin-bottom: 32px; }
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
  nombre = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  success = signal('');

  private auth = inject(AuthService);
  private router = inject(Router);

  async onSubmit() {
    if (!this.nombre || !this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    const { error } = await this.auth.registro(this.email, this.password, this.nombre);

    if (error) {
      this.error.set(error);
      this.loading.set(false);
      return;
    }

    this.success.set('Cuenta creada. Revisa tu email para confirmar tu cuenta.');
    this.loading.set(false);
    setTimeout(() => this.router.navigate(['/auth/login']), 3000);
  }
}
