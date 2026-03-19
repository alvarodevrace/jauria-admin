import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { PlanLabelPipe } from '../../shared/pipes/plan-label.pipe';
import { LucideAngularModule } from 'lucide-angular';

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
  imports: [CommonModule, FormsModule, DateEcPipe, PlanLabelPipe, LucideAngularModule],
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
          <button class="btn btn--ghost btn--sm filters-toggle" type="button" (click)="showFilters.set(!showFilters())">
            <i-lucide name="settings-2" />
            <span>Filtros</span>
          </button>
        </div>
      </div>
      <div class="filters-panel" [class.filters-panel--open]="showFilters()">
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
        <div class="pagos-accordion">
          @for (p of filtered(); track p.id) {
            <article class="pago-card" [class.pago-card--open]="isExpanded(p.id)">
              <button
                type="button"
                class="pago-card__summary"
                (click)="toggleExpanded(p.id)"
                [attr.aria-expanded]="isExpanded(p.id)"
              >
                <div class="pago-card__identity">
                  <strong>{{ p.nombre_cliente }}</strong>
                </div>

                <div class="pago-card__summary-side" aria-hidden="true">
                  <i-lucide class="pago-card__chevron" [name]="isExpanded(p.id) ? 'chevron-up' : 'chevron-down'" />
                </div>
              </button>

              @if (isExpanded(p.id)) {
                <div class="pago-card__details">
                  <div class="pago-card__info-grid">
                    <div class="pago-card__info-item">
                      <span class="pago-card__info-label">Cliente</span>
                      <strong>{{ p.nombre_cliente }}</strong>
                    </div>
                    <div class="pago-card__info-item">
                      <span class="pago-card__info-label">ID atleta</span>
                      <strong>{{ p.id_cliente }}</strong>
                    </div>
                    <div class="pago-card__info-item">
                      <span class="pago-card__info-label">Fecha</span>
                      <strong>{{ p.fecha_pago | dateEc }}</strong>
                    </div>
                    <div class="pago-card__info-item">
                      <span class="pago-card__info-label">Monto</span>
                      <strong class="pago-card__amount">$ {{ p.monto }}</strong>
                    </div>
                    <div class="pago-card__info-item">
                      <span class="pago-card__info-label">Método</span>
                      <span class="badge badge--{{ p.metodo === 'TRANSFERENCIA' ? 'mensual' : 'trimestral' }}">
                        {{ p.metodo }}
                      </span>
                    </div>
                    <div class="pago-card__info-item">
                      <span class="pago-card__info-label">Estado</span>
                      <span class="badge badge--{{ estadoBadge(p.estado) }}">{{ estadoLabel(p.estado) }}</span>
                    </div>
                    <div class="pago-card__info-item">
                      <span class="pago-card__info-label">Banco</span>
                      <strong>{{ p.banco || '—' }}</strong>
                    </div>
                    <div class="pago-card__info-item">
                      <span class="pago-card__info-label">Referencia</span>
                      <strong class="pago-card__reference">{{ p.referencia_transaccion || '—' }}</strong>
                    </div>
                  </div>
                </div>
              }
            </article>
          } @empty {
            <div style="text-align:center;padding:40px;color:#938C84;">
              No hay pagos registrados
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .pagos-accordion {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 18px;
      align-items: start;
    }

    .pago-card {
      border: 1px solid #2b3033;
      border-radius: 18px;
      background: rgba(21, 23, 24, 0.94);
      overflow: hidden;
    }

    .pago-card--open {
      border-color: rgba(166, 31, 36, 0.5);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
    }

    .pago-card__summary {
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

    .pago-card__identity {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .pago-card__identity strong {
      color: #f4f1eb;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pago-card__summary-side {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }

    .pago-card__chevron {
      width: 18px;
      height: 18px;
      color: #938c84;
      flex-shrink: 0;
    }

    .pago-card__details {
      border-top: 1px solid rgba(43, 48, 51, 0.9);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .pago-card__info-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .pago-card__info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(244, 241, 235, 0.03);
      border: 1px solid rgba(244, 241, 235, 0.06);
      min-width: 0;
    }

    .pago-card__info-label {
      color: #938c84;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .pago-card__info-item strong {
      color: #f4f1eb;
      font-size: 13px;
      line-height: 1.3;
      min-width: 0;
    }

    .pago-card__amount {
      color: #3d8b6d;
    }

    .pago-card__reference {
      font-family: monospace;
      font-size: 12px;
      color: #938c84;
      overflow-wrap: anywhere;
    }

    @media (max-width: 900px) and (min-width: 641px) {
      .pagos-accordion {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .pagos-accordion {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      .pago-card__info-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .pagos-accordion {
        padding: 14px;
      }

      .pago-card__summary {
        padding: 13px 14px;
      }

      .pago-card__details {
        padding: 12px;
      }

      .pago-card__info-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
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
  showFilters = signal(false);
  expandedPagoId = signal<number | null>(null);

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
    if (this.expandedPagoId() && !result.some((pago) => pago.id === this.expandedPagoId())) {
      this.expandedPagoId.set(null);
    }
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

  toggleExpanded(idPago: number) {
    this.expandedPagoId.update((current) => current === idPago ? null : idPago);
  }

  isExpanded(idPago: number) {
    return this.expandedPagoId() === idPago;
  }
}
