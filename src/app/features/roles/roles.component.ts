import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { AdminUsersService } from '../../core/services/admin-users.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
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
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe, LucideAngularModule],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Sistema</span>
      <h2 class="page-header__title">{{ canManageRoles() ? 'Usuarios y Roles' : 'Usuarios Registrados' }}</h2>
      <p class="page-header__subtitle">
        {{ profiles().length }} personas registradas
        @if (!canManageRoles()) {
          · vista operativa para coach
        }
      </p>
    </div>

    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Usuarios del Sistema</span>
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
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td class="data-table__cell--primary" data-label="">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:32px;height:32px;background:#A61F24;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:#f4f1eb;flex-shrink:0;">
                      {{ p.nombre_completo[0] }}
                    </div>
                    <span style="font-weight:600;color:#f4f1eb;">{{ p.nombre_completo }}</span>
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
                <td class="data-table__cell--actions" data-label="Acciones">
                  @if (canToggleProfile(p)) {
                    <div class="data-table__actions mobile-actions" style="align-items:center;">
                      <button
                        class="btn btn--sm"
                        [class.btn--danger]="p.activo"
                        [class.btn--secondary]="!p.activo"
                        (click)="toggleProfileStatus(p)"
                        [disabled]="deleting() === p.id"
                      >
                        {{ deleting() === p.id ? 'Procesando...' : (p.activo ? 'Desactivar' : 'Reactivar') }}
                      </button>
                    </div>
                  } @else {
                    <span style="font-size:12px;color:#938c84;font-style:italic;">Sin acción</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td [attr.colspan]="canManageRoles() ? 7 : 6" style="text-align:center;padding:40px;color:#938c84;">Sin personas registradas.</td></tr>
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
  private adminUsers = inject(AdminUsersService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast    = inject(ToastService);
  private sentry   = inject(SentryService);

  profiles   = signal<Profile[]>([]);
  filtered   = signal<Profile[]>([]);
  loading    = signal(true);
  changing   = signal<string | null>(null);
  deleting   = signal<string | null>(null);
  searchTerm = '';

  currentUserId = () => this.auth.currentUser()?.id ?? '';
  canManageRoles = () => this.auth.canManageRoles();

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

  canToggleProfile(profile: Profile) {
    if (profile.id === this.currentUserId()) return false;
    if (this.auth.isAdmin()) return profile.rol !== 'admin';
    return this.auth.isCoach() && profile.rol === 'atleta';
  }

  async toggleProfileStatus(profile: Profile) {
    if (!this.canToggleProfile(profile)) return;

    const nextActivo = !profile.activo;

    const confirmed = await this.confirmDialog.open({
      title: nextActivo ? 'Reactivar usuario' : 'Desactivar usuario',
      message: nextActivo
        ? `Se reactivará la cuenta de ${profile.nombre_completo} y podrá volver a ingresar al panel.`
        : `Se desactivará la cuenta de ${profile.nombre_completo}. Perderá acceso al panel hasta que la reactives.`,
      confirmLabel: nextActivo ? 'Reactivar usuario' : 'Desactivar usuario',
      cancelLabel: 'Cancelar',
      tone: nextActivo ? 'primary' : 'danger',
    });

    if (!confirmed) return;

    this.deleting.set(profile.id);

    this.adminUsers.updateUserStatus(profile.id, nextActivo).subscribe({
      next: async () => {
        this.profiles.update((list) => list.map((item) => item.id === profile.id ? { ...item, activo: nextActivo } : item));
        this.filtered.update((list) => list.map((item) => item.id === profile.id ? { ...item, activo: nextActivo } : item));
        this.toast.success(`Cuenta ${nextActivo ? 'reactivada' : 'desactivada'}: ${profile.nombre_completo}`);

        const actorId = this.auth.currentUser()?.id;
        if (actorId) {
          await this.supabase.logAuditoria(actorId, nextActivo ? 'reactivar_usuario' : 'desactivar_usuario', {
            target_user: profile.email,
            target_role: profile.rol,
            activo: nextActivo,
          });
        }
      },
      error: (error) => {
        this.sentry.captureError(error, { action: 'toggleUserStatus', targetUserId: profile.id, activo: nextActivo });
        const message = error?.error?.message ?? 'No se pudo actualizar el usuario';
        this.toast.error(message);
        this.deleting.set(null);
      },
      complete: () => {
        this.deleting.set(null);
      },
    });
  }
}
