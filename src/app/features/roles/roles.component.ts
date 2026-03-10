import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SentryService } from '../../core/services/sentry.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

interface Profile {
  id: string;
  nombre_completo: string;
  email: string;
  rol: 'atleta' | 'coach' | 'admin';
  activo: boolean;
  created_at: string;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Sistema</span>
      <h2 class="page-header__title">Gestión de Roles</h2>
      <p class="page-header__subtitle">{{ profiles().length }} personas registradas</p>
    </div>

    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Usuarios del Sistema</span>
        <div class="search-input">
          <input type="text" placeholder="Buscar..." [(ngModel)]="searchTerm" (input)="applyFilter()" />
        </div>
      </div>

      @if (loading()) {
        <div style="padding:40px;text-align:center;color:#666;">Cargando...</div>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol actual</th>
              <th>Creado</th>
              <th>Activo</th>
              <th>Cambiar Rol</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:32px;height:32px;background:#B71C1C;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:#fff;flex-shrink:0;">
                      {{ p.nombre_completo[0] }}
                    </div>
                    <span style="font-weight:600;color:#fff;">{{ p.nombre_completo }}</span>
                  </div>
                </td>
                <td style="font-size:13px;color:#aaa;">{{ p.email }}</td>
                <td>
                  <span class="badge badge--{{ rolBadge(p.rol) }}">{{ p.rol }}</span>
                </td>
                <td style="font-size:12px;color:#666;">{{ p.created_at | dateEc }}</td>
                <td>
                  <span [style.color]="p.activo ? '#4caf50' : '#666'">
                    {{ p.activo ? '✓ Activo' : '✕ Inactivo' }}
                  </span>
                </td>
                <td>
                  @if (p.id !== currentUserId()) {
                    <div style="display:flex;gap:8px;align-items:center;">
                      <select
                        class="form-control"
                        style="width:auto;height:34px;font-size:12px;"
                        [ngModel]="p.rol"
                        (ngModelChange)="cambiarRol(p, $event)"
                        [disabled]="changing() === p.id"
                      >
                        <option value="atleta">Atleta</option>
                        <option value="coach">coach</option>
                        <option value="admin">admin</option>
                      </select>
                      @if (changing() === p.id) {
                        <span style="font-size:12px;color:#666;">guardando...</span>
                      }
                    </div>
                  } @else {
                    <span style="font-size:12px;color:#555;font-style:italic;">tú</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" style="text-align:center;padding:40px;color:#666;">Sin personas registradas.</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class RolesComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private auth     = inject(AuthService);
  private toast    = inject(ToastService);
  private sentry   = inject(SentryService);

  profiles   = signal<Profile[]>([]);
  filtered   = signal<Profile[]>([]);
  loading    = signal(true);
  changing   = signal<string | null>(null);
  searchTerm = '';

  currentUserId = () => this.auth.currentUser()?.id ?? '';

  async ngOnInit() {
    const { data, error } = await this.supabase.getAllProfiles();
    this.loading.set(false);
    if (error) { this.toast.error(error.message); return; }
    const list = (data ?? []) as Profile[];
    this.profiles.set(list);
    this.filtered.set(list);
  }

  applyFilter() {
    const t = this.searchTerm.toLowerCase();
    this.filtered.set(
      t ? this.profiles().filter(p => p.nombre_completo.toLowerCase().includes(t) || p.email.includes(t))
        : this.profiles()
    );
  }

  async cambiarRol(profile: Profile, nuevoRol: string) {
    if (profile.rol === nuevoRol) return;
    this.changing.set(profile.id);

    const { error } = await this.supabase.updateProfileRole(profile.id, nuevoRol);

    if (error) {
      this.sentry.captureError(error, { action: 'cambiarRol', userId: profile.id, nuevoRol });
      this.toast.error('Error cambiando rol: ' + error.message);
    } else {
      this.profiles.update(list => list.map(p => p.id === profile.id ? { ...p, rol: nuevoRol as Profile['rol'] } : p));
      this.filtered.update(list => list.map(p => p.id === profile.id ? { ...p, rol: nuevoRol as Profile['rol'] } : p));
      this.toast.success(`Rol de ${profile.nombre_completo} → ${nuevoRol}`);
      this.sentry.addBreadcrumb(`Rol cambiado: ${profile.email} → ${nuevoRol}`, 'admin');

      // Log auditoria
      const adminId = this.auth.currentUser()?.id;
      if (adminId) {
        await this.supabase.logAuditoria(adminId, 'cambiar_rol', {
          target_user: profile.email,
          rol_anterior: profile.rol,
          rol_nuevo: nuevoRol,
        });
      }
    }
    this.changing.set(null);
  }

  rolBadge(rol: string): string {
    return ({ admin: 'activo', coach: 'pendiente', atleta: 'inactivo' } as Record<string, string>)[rol] ?? 'inactivo';
  }
}
