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

type PagoEstadoBadge =
  | 'completado'
  | 'pendiente'
  | 'fallido'
  | 'devuelto'
  | 'vencido'
  | 'inactivo'
  | 'esperando';

interface PagoEstadoOption {
  value: PagoEstadoBadge;
  label: string;
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
        <div class="toolbar-row">
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
            @for (estado of estadosDisponibles(); track estado.value) {
              <option [value]="estado.value">{{ estado.label }}</option>
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
        <div style="padding:40px;text-align:center;color:#938C84;">
          Cargando...
        </div>
      } @else {
        <table class="data-table data-table--stacked-mobile">
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
                <td class="data-table__cell--primary" data-label="">
                  <div class="mobile-primary">{{ p.nombre_cliente }}</div>
                  <div class="mobile-secondary">{{ p.id_cliente }}</div>
                </td>
                <td data-label="Fecha" style="font-size:13px;">{{ p.fecha_pago | dateEc }}</td>
                <td data-label="Monto" style="font-weight:600;color:#3D8B6D;">$ {{ p.monto }}</td>
                <td data-label="Método">
                  <span class="badge badge--{{ p.metodo === 'TRANSFERENCIA' ? 'mensual' : 'trimestral' }}">
                    {{ p.metodo }}
                  </span>
                </td>
                <td data-label="Banco" style="font-size:13px;">{{ p.banco || '—' }}</td>
                <td data-label="Referencia" style="font-size:12px;color:#938C84;font-family:monospace;">
                  {{ formatReferencia(p.referencia_transaccion) }}
                </td>
                <td data-label="Estado">
                  <span class="badge badge--{{ estadoBadge(p.estado) }}">{{ estadoLabel(p.estado) }}</span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" style="text-align:center;padding:40px;color:#938C84;">
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

  estadosDisponibles = computed<PagoEstadoOption[]>(() => {
    const order: PagoEstadoBadge[] = ['completado', 'pendiente', 'esperando', 'fallido', 'devuelto', 'vencido', 'inactivo'];
    const present = new Set(this.pagos().map((p) => this.estadoBadge(p.estado)));

    return order
      .filter((value) => present.has(value))
      .map((value) => ({ value, label: this.estadoFilterLabel(value) }));
  });
  bancosDisponibles = computed(() => [...new Set(this.pagos().map((p) => p.banco).filter(Boolean))]);
  totalFiltrado = computed(() =>
    this.filtered()
      .filter((pago) => this.estadoBadge(pago.estado) === 'completado')
      .reduce((sum, pago) => sum + Number(pago.monto ?? 0), 0),
  );
  pagosPendientes = computed(() => this.filtered().filter((p) => this.estadoBadge(p.estado) !== 'completado').length);

  async ngOnInit() {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.getHistorialPagos();
      if (error) {
        this.toast.error(error.message);
        return;
      }

      this.pagos.set((data ?? []) as Pago[]);
      this.filtered.set((data ?? []) as Pago[]);
    } catch {
      this.toast.error('No se pudieron cargar los pagos');
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    let result = this.pagos();
    const term = this.searchTerm.trim().toLowerCase();

    if (this.filterMetodo) result = result.filter((p) => p.metodo === this.filterMetodo);
    if (this.filterEstado) result = result.filter((p) => this.estadoBadge(p.estado) === this.filterEstado);
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

  estadoBadge(estado: string): PagoEstadoBadge {
    const normalized = (estado ?? '').trim().toLowerCase();

    if (['completado', 'confirmado', 'approved', 'aprobado', 'success', 'exitoso'].includes(normalized)) {
      return 'completado';
    }

    if (['pendiente', 'pending'].includes(normalized)) {
      return 'pendiente';
    }

    if (['devuelto', 'refunded'].includes(normalized)) {
      return 'devuelto';
    }

    if (['fallido', 'failed', 'rechazado', 'denegado', 'cancelado', 'canceled', 'anulado', 'voided'].includes(normalized)) {
      return 'fallido';
    }

    if (['esperando', 'processing', 'procesando'].includes(normalized)) {
      return 'esperando';
    }

    if (['vencido'].includes(normalized)) {
      return 'vencido';
    }

    if (['inactivo'].includes(normalized)) {
      return 'inactivo';
    }

    return 'inactivo';
  }

  estadoLabel(estado: string): string {
    return this.estadoBadge(estado) === 'completado' ? 'Completado' : estado;
  }

  estadoFilterLabel(estado: PagoEstadoBadge): string {
    return (
      {
        completado: 'Completado',
        pendiente: 'Pendiente',
        esperando: 'Esperando',
        fallido: 'Anulado',
        devuelto: 'Devuelto',
        vencido: 'Vencido',
        inactivo: 'Inactivo',
      } satisfies Record<PagoEstadoBadge, string>
    )[estado];
  }
}
