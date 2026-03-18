import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SentryService } from '../../core/services/sentry.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { LucideAngularModule } from 'lucide-angular';

interface Profile {
  id: string;
  nombre_completo: string;
  email: string;
  rol: 'atleta' | 'coach' | 'admin';
  activo: boolean;
  created_at: string;
  avatar_url?: string | null;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe, LucideAngularModule],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Sistema</span>
      <h2 class="page-header__title">{{ canManageRoles() ? 'Usuarios y roles' : 'Usuarios' }}</h2>
      <p class="page-header__subtitle">{{ profiles().length }} cuentas registradas</p>
    </div>

    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Cuentas del panel</span>
        <div class="search-input">
          <input type="text" placeholder="Buscar..." [(ngModel)]="searchTerm" (input)="applyFilter()" />
        </div>
      </div>

      @if (loading()) {
        <div style="padding:40px;text-align:center;color:#938c84;">Cargando...</div>
      } @else {
        <table class="data-table data-table--stacked-mobile">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol actual</th>
              <th>Creado</th>
              <th>Activo</th>
              @if (canManageRoles()) {
                <th>Cambiar Rol</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td class="data-table__cell--primary" data-label="">
                  <div style="display:flex;align-items:center;gap:10px;">
                    @if (avatarUrl(p.avatar_url)) {
                      <img
                        [src]="avatarUrl(p.avatar_url)!"
                        [alt]="'Avatar de ' + p.nombre_completo"
                        style="width:40px;height:40px;border-radius:14px;object-fit:cover;border:1px solid rgba(212,167,98,0.18);background:#f6f1eb;flex-shrink:0;"
                      />
                    } @else {
                      <div style="width:40px;height:40px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f4e6cf 0%,#ead7b5 100%);font-family:'Bebas Neue',sans-serif;font-size:16px;color:#7a4b12;flex-shrink:0;">
                        {{ profileInitials(p.nombre_completo) }}
                      </div>
                    }
                    <div style="min-width:0;">
                      <span style="display:block;font-weight:600;color:#f4f1eb;">{{ p.nombre_completo }}</span>
                      <span style="display:block;font-size:11px;color:#938c84;">{{ p.rol }}</span>
                    </div>
                  </div>
                </td>
                <td data-label="Email" style="font-size:13px;color:#d2cbc1;">{{ p.email }}</td>
                <td data-label="Rol actual">
                  <span class="badge badge--{{ rolBadge(p.rol) }}">{{ p.rol }}</span>
                </td>
                <td data-label="Creado" style="font-size:12px;color:#938c84;">{{ p.created_at | dateEc }}</td>
                <td data-label="Activo">
                  <span style="display:inline-flex;align-items:center;gap:8px;" [style.color]="p.activo ? '#3D8B6D' : '#938C84'">
                    <i-lucide [name]="p.activo ? 'circle-check' : 'circle-x'"></i-lucide>
                    {{ p.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                @if (canManageRoles()) {
                  <td data-label="Cambiar rol">
                    @if (p.id !== currentUserId()) {
                      <div class="mobile-actions" style="display:flex;gap:8px;align-items:center;">
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
                          <span style="font-size:12px;color:#938c84;">guardando...</span>
                        }
                      </div>
                    } @else {
                      <span style="font-size:12px;color:#938c84;font-style:italic;">tú</span>
                    }
                  </td>
                }
              </tr>
            } @empty {
              <tr><td [attr.colspan]="canManageRoles() ? 6 : 5" style="text-align:center;padding:40px;color:#938c84;">Sin usuarios registrados.</td></tr>
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
  canManageRoles = () => this.auth.canManageRoles();

  async ngOnInit() {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.getAllProfiles();
      if (error) {
        this.toast.error(error.message);
        return;
      }

      const list = (data ?? []) as Profile[];
      this.profiles.set(list);
      this.filtered.set(list);
    } catch (error) {
      this.sentry.captureError(error, { action: 'loadProfiles' });
      this.toast.error('No se pudieron cargar los usuarios');
    } finally {
      this.loading.set(false);
    }
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

  avatarUrl(path?: string | null) {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return this.supabase.getProfileAvatarUrl(path);
  }

  profileInitials(name?: string | null) {
    return (name ?? 'Atleta')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'AT';
  }
}
