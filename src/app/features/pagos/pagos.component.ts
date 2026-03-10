import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { PlanLabelPipe } from '../../shared/pipes/plan-label.pipe';

interface Pago {
  id: number;
  id_cliente: string;
  nombre_cliente: string;
  fecha_pago: string;
  monto: number;
  metodo: string;
  banco: string;
  referencia_transaccion: string;
  estado: string;
}

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe, PlanLabelPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Historial</span>
      <h2 class="page-header__title">Pagos</h2>
    </div>

    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-card__label">Resultados</div>
        <div class="stat-card__value">{{ filtered().length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Monto filtrado</div>
        <div class="stat-card__value">$ {{ totalFiltrado().toFixed(2) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Pendientes</div>
        <div class="stat-card__value">{{ pagosPendientes() }}</div>
      </div>
    </div>

    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Historial de Pagos</span>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div class="search-input">
            <input type="text" placeholder="Buscar por cliente o ID" [(ngModel)]="searchTerm" (input)="applyFilter()" />
          </div>
          <select class="form-control" style="width:auto;height:38px;" [(ngModel)]="filterMetodo" (change)="applyFilter()">
            <option value="">Todos los métodos</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="PAYPHONE">Payphone</option>
          </select>
          <select class="form-control" style="width:auto;height:38px;" [(ngModel)]="filterEstado" (change)="applyFilter()">
            <option value="">Todos los estados</option>
            @for (estado of estadosDisponibles(); track estado) {
              <option [value]="estado">{{ estado }}</option>
            }
          </select>
          <select class="form-control" style="width:auto;height:38px;" [(ngModel)]="filterBanco" (change)="applyFilter()">
            <option value="">Todos los bancos</option>
            @for (banco of bancosDisponibles(); track banco) {
              <option [value]="banco">{{ banco }}</option>
            }
          </select>
        </div>
      </div>

      @if (loading()) {
        <div style="padding:40px;text-align:center;color:#666;">
          Cargando...
        </div>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Monto</th>
              <th>Método</th>
              <th>Banco</th>
              <th>Referencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td style="font-size:13px;">{{ p.fecha_pago | dateEc }}</td>
                <td>
                  <div style="font-weight:600;color:#fff;">{{ p.nombre_cliente }}</div>
                  <div style="font-size:12px;color:#666;">{{ p.id_cliente }}</div>
                </td>
                <td style="font-weight:600;color:#4caf50;">$ {{ p.monto }}</td>
                <td>
                  <span class="badge badge--{{ p.metodo === 'TRANSFERENCIA' ? 'mensual' : 'trimestral' }}">
                    {{ p.metodo }}
                  </span>
                </td>
                <td style="font-size:13px;">{{ p.banco || '—' }}</td>
                <td style="font-size:12px;color:#666;font-family:monospace;">
                  {{ formatReferencia(p.referencia_transaccion) }}
                </td>
                <td>
                  <span class="badge badge--{{ p.estado?.toLowerCase() }}">{{ p.estado }}</span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" style="text-align:center;padding:40px;color:#666;">
                  No hay pagos registrados
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class PagosComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  pagos = signal<Pago[]>([]);
  filtered = signal<Pago[]>([]);
  loading = signal(true);
  filterMetodo = '';
  filterEstado = '';
  filterBanco = '';
  searchTerm = '';

  estadosDisponibles = computed(() => [...new Set(this.pagos().map((p) => p.estado).filter(Boolean))]);
  bancosDisponibles = computed(() => [...new Set(this.pagos().map((p) => p.banco).filter(Boolean))]);
  totalFiltrado = computed(() => this.filtered().reduce((sum, pago) => sum + Number(pago.monto ?? 0), 0));
  pagosPendientes = computed(() => this.filtered().filter((p) => p.estado?.toLowerCase() !== 'completado').length);

  async ngOnInit() {
    const { data, error } = await this.supabase.getHistorialPagos();
    this.loading.set(false);
    if (error) {
      this.toast.error(error.message);
      return;
    }
    this.pagos.set((data ?? []) as Pago[]);
    this.filtered.set((data ?? []) as Pago[]);
  }

  applyFilter() {
    let result = this.pagos();
    const term = this.searchTerm.trim().toLowerCase();

    if (this.filterMetodo) result = result.filter((p) => p.metodo === this.filterMetodo);
    if (this.filterEstado) result = result.filter((p) => p.estado === this.filterEstado);
    if (this.filterBanco) result = result.filter((p) => p.banco === this.filterBanco);
    if (term) {
      result = result.filter((p) =>
        [p.nombre_cliente, p.id_cliente, p.referencia_transaccion]
          .some((value) => (value ?? '').toLowerCase().includes(term))
      );
    }

    this.filtered.set(result);
  }

  formatReferencia(referencia: string): string {
    if (!referencia) return '—';
    if (referencia.length <= 16) return referencia;
    return `${referencia.slice(0, 6)}...${referencia.slice(-6)}`;
  }
}
