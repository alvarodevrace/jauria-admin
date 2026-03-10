import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

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
  imports: [CommonModule, FormsModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Landing Page</span>
      <h2 class="page-header__title">Leads</h2>
      <p class="page-header__subtitle">{{ filteredLeads().length }} visibles · {{ leads().length }} registrados</p>
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
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div class="search-input">
            <input type="text" placeholder="Buscar por nombre, email o teléfono" [(ngModel)]="searchTerm" />
          </div>
          <select class="form-control" style="width:auto;height:38px;" [(ngModel)]="filterPrograma">
            <option value="">Todos los programas</option>
            @for (programa of programasDisponibles(); track programa) {
              <option [value]="programa">{{ programa }}</option>
            }
          </select>
          <button class="btn btn--ghost btn--sm" (click)="exportCsv()">⬇ Exportar CSV</button>
        </div>
      </div>

      @if (loading()) {
        <div style="padding:40px;text-align:center;color:#666;">Cargando...</div>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Programa</th>
              <th>Mensaje</th>
            </tr>
          </thead>
          <tbody>
            @for (lead of filteredLeads(); track lead.id) {
              <tr>
                <td style="font-size:12px;">{{ lead.created_at | dateEc : 'dd/MM/yy HH:mm' }}</td>
                <td style="font-weight:600;color:#fff;">{{ lead.nombre }}</td>
                <td style="font-size:13px;">{{ lead.email }}</td>
                <td style="font-size:13px;">{{ lead.telefono || '—' }}</td>
                <td>
                  @if (lead.programa) {
                    <span class="badge badge--mensual">{{ lead.programa }}</span>
                  } @else {
                    <span style="color:#666;">—</span>
                  }
                </td>
                <td style="font-size:12px;color:#aaa;max-width:260px;">
                  <button class="btn btn--ghost btn--sm" (click)="selectedLead.set(lead)">
                    {{ lead.mensaje ? 'Ver mensaje' : 'Sin mensaje' }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" style="text-align:center;padding:40px;color:#666;">No hay leads aún</td></tr>
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
            <button class="btn btn--ghost btn--icon" (click)="selectedLead.set(null)">✕</button>
          </div>
          <div class="modal__body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="stat-card">
                <div class="stat-card__label">Nombre</div>
                <div class="stat-card__value" style="font-size:22px;">{{ selectedLead()!.nombre }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-card__label">Fecha</div>
                <div class="stat-card__value" style="font-size:22px;">{{ selectedLead()!.created_at | dateEc : 'dd/MM/yyyy HH:mm' }}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
              <div class="form-group">
                <label class="form-label">Email</label>
                <div class="form-control" style="display:flex;align-items:center;">{{ selectedLead()!.email }}</div>
              </div>
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
      const matchesTerm = !term || [lead.nombre, lead.email, lead.telefono]
        .some((value) => (value ?? '').toLowerCase().includes(term));
      return matchesPrograma && matchesTerm;
    });
  });

  programasDisponibles = computed(() => {
    return [...new Set(this.leads().map((lead) => lead.programa).filter(Boolean))];
  });

  leadsHoy = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
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
    const headers = ['Fecha', 'Nombre', 'Email', 'Teléfono', 'Programa', 'Mensaje'];
    const rows = this.filteredLeads().map((l) => [l.created_at, l.nombre, l.email, l.telefono, l.programa, l.mensaje]);
    const csv = [headers, ...rows].map((r) => r.map(String).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-jauria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
