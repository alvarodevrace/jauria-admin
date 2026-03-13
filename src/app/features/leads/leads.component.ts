import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { getEcuadorTodayYmd } from '../../shared/utils/date-ecuador';

interface Lead {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
  programa: string;
  created_at: string;
}

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe, LucideAngularModule],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Landing Page</span>
      <h2 class="page-header__title">Leads</h2>
      <p class="page-header__subtitle">
        {{ auth.isAdmin() ? 'Inbox completo del formulario de contacto.' : 'Vista comercial recortada para seguimiento del coach.' }}
      </p>
    </div>

    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-card__label">Total</div>
        <div class="stat-card__value">{{ leads().length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Hoy</div>
        <div class="stat-card__value">{{ leadsHoy() }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Con programa</div>
        <div class="stat-card__value">{{ leadsConPrograma() }}</div>
      </div>
    </div>

    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Formulario de Contacto</span>
        <div class="toolbar-row">
          <div class="search-input">
            <input type="text" [placeholder]="auth.isAdmin() ? 'Buscar por nombre, email o teléfono' : 'Buscar por nombre o teléfono'" [(ngModel)]="searchTerm" />
          </div>
          <select class="form-control" style="width:auto;height:38px;" [(ngModel)]="filterPrograma">
            <option value="">Todos los programas</option>
            @for (programa of programasDisponibles(); track programa) {
              <option [value]="programa">{{ programa }}</option>
            }
          </select>
          @if (auth.canExportLeads()) {
            <button class="btn btn--ghost btn--sm" (click)="exportCsv()">⬇ Exportar CSV</button>
          }
        </div>
      </div>

      @if (loading()) {
        <div style="padding:40px;text-align:center;color:#938C84;">Cargando...</div>
      } @else {
        <table class="data-table data-table--stacked-mobile">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Nombre</th>
              @if (auth.isAdmin()) {
                <th>Email</th>
              }
              <th>Teléfono</th>
              <th>Programa</th>
              <th>Mensaje</th>
            </tr>
          </thead>
          <tbody>
            @for (lead of filteredLeads(); track lead.id) {
              <tr>
                <td class="data-table__cell--primary" data-label="">
                  <div class="mobile-primary">{{ lead.nombre }}</div>
                  <div class="mobile-secondary">{{ lead.created_at | dateEc : 'dd/MM/yy HH:mm' }}</div>
                </td>
                @if (auth.isAdmin()) {
                  <td data-label="Email" style="font-size:13px;">{{ lead.email }}</td>
                }
                <td data-label="Teléfono" style="font-size:13px;">{{ lead.telefono || '—' }}</td>
                <td data-label="Programa">
                  @if (lead.programa) {
                    <span class="badge badge--mensual">{{ lead.programa }}</span>
                  } @else {
                    <span style="color:#938C84;">—</span>
                  }
                </td>
                <td class="data-table__cell--actions" data-label="Mensaje" style="font-size:12px;color:#d2cbc1;max-width:260px;">
                  <button class="btn btn--ghost btn--sm" (click)="selectedLead.set(lead)">
                    {{ lead.mensaje ? 'Ver mensaje' : 'Sin mensaje' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td [attr.colspan]="auth.isAdmin() ? 6 : 5" style="text-align:center;padding:40px;color:#938C84;">No hay leads aún</td></tr>
            }
          </tbody>
        </table>
      }
    </div>

    @if (selectedLead()) {
      <div class="modal-backdrop" (click)="selectedLead.set(null)">
        <div class="modal modal--wide" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">Detalle del lead</h3>
            <button class="btn btn--ghost btn--icon" (click)="selectedLead.set(null)"><i-lucide name="circle-x" /></button>
          </div>
          <div class="modal__body">
            <div class="two-column-grid">
              <div class="stat-card">
                <div class="stat-card__label">Nombre</div>
                <div class="stat-card__value" style="font-size:22px;">{{ selectedLead()!.nombre }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-card__label">Fecha</div>
                <div class="stat-card__value" style="font-size:22px;">{{ selectedLead()!.created_at | dateEc : 'dd/MM/yyyy HH:mm' }}</div>
              </div>
            </div>
            <div class="two-column-grid" style="margin-top:16px;">
              @if (auth.isAdmin()) {
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <div class="form-control" style="display:flex;align-items:center;">{{ selectedLead()!.email }}</div>
                </div>
              }
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <div class="form-control" style="display:flex;align-items:center;">{{ selectedLead()!.telefono || '—' }}</div>
              </div>
            </div>
            <div class="form-group" style="margin-top:16px;">
              <label class="form-label">Programa de interés</label>
              <div class="form-control" style="display:flex;align-items:center;">{{ selectedLead()!.programa || 'Sin especificar' }}</div>
            </div>
            <div class="form-group" style="margin-top:16px;">
              <label class="form-label">Mensaje</label>
              <div class="form-control" style="min-height:140px;white-space:pre-wrap;line-height:1.6;">{{ selectedLead()!.mensaje || 'Sin mensaje' }}</div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--ghost" (click)="selectedLead.set(null)">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LeadsComponent implements OnInit {
  protected auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  leads = signal<Lead[]>([]);
  loading = signal(true);
  selectedLead = signal<Lead | null>(null);
  searchTerm = '';
  filterPrograma = '';

  filteredLeads = computed(() => {
    const term = this.searchTerm.trim().toLowerCase();
    const programa = this.filterPrograma;

    return this.leads().filter((lead) => {
      const matchesPrograma = !programa || lead.programa === programa;
      const searchableValues = this.auth.isAdmin()
        ? [lead.nombre, lead.email, lead.telefono]
        : [lead.nombre, lead.telefono, lead.mensaje];
      const matchesTerm = !term || searchableValues
        .some((value) => (value ?? '').toLowerCase().includes(term));
      return matchesPrograma && matchesTerm;
    });
  });

  programasDisponibles = computed(() => {
    return [...new Set(this.leads().map((lead) => lead.programa).filter(Boolean))];
  });

  leadsHoy = computed(() => {
    const today = getEcuadorTodayYmd();
    return this.leads().filter((lead) => lead.created_at.startsWith(today)).length;
  });

  leadsConPrograma = computed(() => this.leads().filter((lead) => !!lead.programa).length);

  async ngOnInit() {
    const { data, error } = await this.supabase.getLeads();
    this.loading.set(false);
    if (error) { this.toast.error(error.message); return; }
    this.leads.set((data ?? []) as Lead[]);
  }

  exportCsv() {
    const escapeCsv = (value: unknown) => {
      const normalized = String(value ?? '');
      return `"${normalized.replace(/"/g, '""')}"`;
    };

    const headers = ['Fecha', 'Nombre', 'Email', 'Teléfono', 'Programa', 'Mensaje'];
    const rows = this.filteredLeads().map((l) => [l.created_at, l.nombre, l.email, l.telefono, l.programa, l.mensaje]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-jauria-${getEcuadorTodayYmd()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
