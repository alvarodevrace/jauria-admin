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
        <div class="toolbar-row">
          <button class="btn btn--ghost btn--sm filters-toggle" type="button" (click)="showFilters.set(!showFilters())">
            <i-lucide name="settings-2" />
            <span>Filtros</span>
          </button>
        </div>
      </div>
      <div class="filters-panel" [class.filters-panel--open]="showFilters()">
        <div class="toolbar-row">
          <div class="search-input">
            <input type="text" placeholder="Buscar..." [(ngModel)]="searchTerm" (input)="applyFilter()" />
          </div>
        </div>
      </div>

      @if (loading()) {
        <div style="padding:40px;text-align:center;color:#938c84;">Cargando...</div>
      } @else {
        <table class="data-table usuarios-table">
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
                <td>
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
                <td style="font-size:13px;color:#d2cbc1;">{{ p.email }}</td>
                <td>
                  <span class="badge badge--{{ rolBadge(p.rol) }}">{{ p.rol }}</span>
                </td>
                <td style="font-size:12px;color:#938c84;">{{ p.created_at | dateEc }}</td>
                <td>
                  <span style="display:inline-flex;align-items:center;gap:8px;" [style.color]="p.activo ? '#3D8B6D' : '#938C84'">
                    <i-lucide [name]="p.activo ? 'circle-check' : 'circle-x'"></i-lucide>
                    {{ p.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                @if (canManageRoles()) {
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

        <div class="usuarios-accordion">
          @for (p of filtered(); track p.id) {
            <article class="usuario-card" [class.usuario-card--open]="isExpanded(p.id)">
              <button
                type="button"
                class="usuario-card__summary"
                (click)="toggleExpanded(p.id)"
                [attr.aria-expanded]="isExpanded(p.id)"
              >
                <div class="usuario-card__identity">
                  @if (avatarUrl(p.avatar_url)) {
                    <img
                      class="usuario-card__avatar"
                      [src]="avatarUrl(p.avatar_url)!"
                      [alt]="'Avatar de ' + p.nombre_completo"
                    />
                  } @else {
                    <div class="usuario-card__avatar usuario-card__avatar--fallback">
                      {{ profileInitials(p.nombre_completo) }}
                    </div>
                  }
                  <strong>{{ p.nombre_completo }}</strong>
                </div>

                <div class="usuario-card__summary-side" aria-hidden="true">
                  <i-lucide class="usuario-card__chevron" [name]="isExpanded(p.id) ? 'chevron-up' : 'chevron-down'" />
                </div>
              </button>

              @if (isExpanded(p.id)) {
                <div class="usuario-card__details">
                  <div class="usuario-card__info-grid">
                    <div class="usuario-card__info-item">
                      <span class="usuario-card__info-label">Email</span>
                      <strong>{{ p.email }}</strong>
                    </div>
                    <div class="usuario-card__info-item">
                      <span class="usuario-card__info-label">Rol actual</span>
                      <span class="badge badge--{{ rolBadge(p.rol) }}">{{ p.rol }}</span>
                    </div>
                    <div class="usuario-card__info-item">
                      <span class="usuario-card__info-label">Creado</span>
                      <strong>{{ p.created_at | dateEc }}</strong>
                    </div>
                    <div class="usuario-card__info-item">
                      <span class="usuario-card__info-label">Estado</span>
                      <strong [style.color]="p.activo ? '#3D8B6D' : '#938C84'">
                        {{ p.activo ? 'Activo' : 'Inactivo' }}
                      </strong>
                    </div>
                  </div>

                  @if (canManageRoles()) {
                    <div class="usuario-card__actions">
                      @if (p.id !== currentUserId()) {
                        <select
                          class="form-control usuario-card__role-select"
                          [ngModel]="p.rol"
                          (ngModelChange)="cambiarRol(p, $event)"
                          [disabled]="changing() === p.id"
                        >
                          <option value="atleta">Atleta</option>
                          <option value="coach">coach</option>
                          <option value="admin">admin</option>
                        </select>
                        @if (changing() === p.id) {
                          <span class="usuario-card__action-note">guardando...</span>
                        }
                      } @else {
                        <span class="usuario-card__action-note">Tu cuenta</span>
                      }
                    </div>
                  }
                </div>
              }
            </article>
          } @empty {
            <div style="text-align:center;padding:40px;color:#938c84;">Sin usuarios registrados.</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .usuarios-table {
      display: table;
    }

    .usuarios-accordion {
      display: none;
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 18px;
      align-items: start;
    }

    .usuario-card {
      border: 1px solid #2b3033;
      border-radius: 18px;
      background: rgba(21, 23, 24, 0.94);
      overflow: hidden;
    }

    .usuario-card--open {
      border-color: rgba(166, 31, 36, 0.5);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
    }

    .usuario-card__summary {
      width: 100%;
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 14px 18px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      text-align: left;
    }

    .usuario-card__identity {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .usuario-card__identity strong {
      color: #f4f1eb;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .usuario-card__avatar {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      object-fit: cover;
      border: 1px solid rgba(212, 167, 98, 0.18);
      background: #f6f1eb;
      flex-shrink: 0;
    }

    .usuario-card__avatar--fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f4e6cf 0%, #ead7b5 100%);
      font-family: 'Bebas Neue', sans-serif;
      font-size: 16px;
      color: #7a4b12;
    }

    .usuario-card__summary-side {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }

    .usuario-card__chevron {
      width: 18px;
      height: 18px;
      color: #938c84;
      flex-shrink: 0;
    }

    .usuario-card__details {
      border-top: 1px solid rgba(43, 48, 51, 0.9);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .usuario-card__info-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .usuario-card__info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(244, 241, 235, 0.03);
      border: 1px solid rgba(244, 241, 235, 0.06);
      min-width: 0;
    }

    .usuario-card__info-label {
      color: #938c84;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .usuario-card__info-item strong {
      color: #f4f1eb;
      font-size: 13px;
      line-height: 1.3;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .usuario-card__actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .usuario-card__role-select {
      width: auto;
      min-width: 180px;
      height: 38px;
    }

    .usuario-card__action-note {
      font-size: 12px;
      color: #938c84;
      font-style: italic;
    }

    @media (max-width: 900px) and (min-width: 641px) {
      .usuarios-table {
        display: none;
      }

      .usuarios-accordion {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .usuarios-table {
        display: none;
      }

      .usuarios-accordion {
        display: grid;
        padding: 14px;
        grid-template-columns: 1fr;
      }

      .usuario-card__summary {
        padding: 13px 14px;
      }

      .usuario-card__details {
        padding: 12px;
      }

      .usuario-card__info-grid {
        grid-template-columns: 1fr;
      }

      .usuario-card__role-select {
        width: 100%;
      }
    }
  `],
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
  expandedProfileId = signal('');
  showFilters = signal(false);
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
    const result =
      t ? this.profiles().filter(p => p.nombre_completo.toLowerCase().includes(t) || p.email.includes(t))
        : this.profiles();
    this.filtered.set(result);
    if (this.expandedProfileId() && !result.some((profile) => profile.id === this.expandedProfileId())) {
      this.expandedProfileId.set('');
    }
  }

  toggleExpanded(profileId: string) {
    this.expandedProfileId.update((current) => current === profileId ? '' : profileId);
  }

  isExpanded(profileId: string) {
    return this.expandedProfileId() === profileId;
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
