import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Landing Page</span>
      <h2 class="page-header__title">Leads</h2>
      <p class="page-header__subtitle">{{ leads().length }} leads registrados</p>
    </div>

    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Formulario de Contacto</span>
        <button class="btn btn--ghost btn--sm" (click)="exportCsv()">⬇ Exportar CSV</button>
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
            @for (lead of leads(); track lead.id) {
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
                <td style="font-size:12px;color:#aaa;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  {{ lead.mensaje || '—' }}
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" style="text-align:center;padding:40px;color:#666;">No hay leads aún</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class LeadsComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  leads = signal<Lead[]>([]);
  loading = signal(true);

  async ngOnInit() {
    const { data, error } = await this.supabase.getLeads();
    this.loading.set(false);
    if (error) { this.toast.error(error.message); return; }
    this.leads.set((data ?? []) as Lead[]);
  }

  exportCsv() {
    const headers = ['Fecha', 'Nombre', 'Email', 'Teléfono', 'Programa', 'Mensaje'];
    const rows = this.leads().map((l) => [l.created_at, l.nombre, l.email, l.telefono, l.programa, l.mensaje]);
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
