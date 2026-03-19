import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../core/services/supabase.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ClientsService } from '../../core/services/clients.service';
import { SentryService } from '../../core/services/sentry.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { PlanLabelPipe } from '../../shared/pipes/plan-label.pipe';
import { LucideAngularModule } from 'lucide-angular';
import { addDaysToEcuadorDate, getDaysFromTodayInEcuador, getEcuadorTodayYmd } from '../../shared/utils/date-ecuador';

interface Cliente {
  id_cliente: string;
  nombre_completo: string;
  email: string;
  telefono_whatsapp: string;
  plan: string;
  monto_plan: number;
  estado: string;
  metodo_pago: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  fecha_nacimiento?: string | null;
  consentimiento_whatsapp?: boolean;
  ultimo_pago_fecha: string;
  link_pago_actual: string;
}

interface Pago {
  id: number;
  fecha_pago: string;
  monto: number;
  metodo: string;
  banco: string;
  estado: string;
}

type ModalMode = 'crear' | 'editar' | null;
type ClientesView = 'operativos' | 'inactivos' | 'todos';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe, PlanLabelPipe, LucideAngularModule],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Gestión</span>
      <h2 class="page-header__title">Atletas</h2>
      <p class="page-header__subtitle">{{ clientes().length }} atletas registrados</p>
    </div>

    <!-- Toolbar -->
    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Todos los atletas</span>
        <div class="toolbar-row">
          <button class="btn btn--ghost btn--sm filters-toggle" type="button" (click)="showFilters.set(!showFilters())">
            <i-lucide name="settings-2" />
            <span>Filtros</span>
          </button>
          <button class="btn btn--primary btn--sm" (click)="abrirModal('crear')">+ Nuevo atleta</button>
        </div>
      </div>
      <div class="filters-panel" [class.filters-panel--open]="showFilters()">
        <div class="toolbar-row">
          <div class="toolbar-group">
            <button class="btn btn--sm" [class.btn--primary]="view() === 'operativos'" [class.btn--ghost]="view() !== 'operativos'" (click)="setView('operativos')">Operativos</button>
            <button class="btn btn--sm" [class.btn--primary]="view() === 'inactivos'" [class.btn--ghost]="view() !== 'inactivos'" (click)="setView('inactivos')">Inactivos</button>
            <button class="btn btn--sm" [class.btn--primary]="view() === 'todos'" [class.btn--ghost]="view() !== 'todos'" (click)="setView('todos')">Todos</button>
          </div>
          <div class="search-input">
            <input type="text" placeholder="Buscar..." [(ngModel)]="searchTerm" (input)="applyFilter()" />
          </div>
          <select class="form-control" style="width:auto;height:38px;" [(ngModel)]="filterEstado" (change)="applyFilter()">
            <option value="">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Vencido">Vencido</option>
            <option value="Inactivo">Inactivo</option>
          </select>
          <select class="form-control" style="width:auto;height:38px;" [(ngModel)]="filterPlan" (change)="applyFilter()">
            <option value="">Todos los planes</option>
            <option value="MENSUAL">Mensual</option>
            <option value="TRIMESTRAL">Trimestral</option>
            <option value="ANUAL">Anual</option>
          </select>
        </div>
      </div>

      @if (loading()) {
        <div style="padding:40px;text-align:center;color:#938C84;">Cargando atletas...</div>
      } @else {
        <div class="clientes-accordion">
          @for (c of filtered(); track c.id_cliente) {
            <article class="cliente-card" [class.cliente-card--open]="isExpanded(c.id_cliente)">
              <button
                type="button"
                class="cliente-card__summary"
                (click)="toggleExpanded(c.id_cliente)"
                [attr.aria-expanded]="isExpanded(c.id_cliente)"
              >
                <div class="cliente-card__identity">
                  <strong>{{ c.nombre_completo }}</strong>
                </div>

                <div class="cliente-card__summary-side" aria-hidden="true">
                  <i-lucide class="cliente-card__chevron" [name]="isExpanded(c.id_cliente) ? 'chevron-up' : 'chevron-down'" />
                </div>
              </button>

              @if (isExpanded(c.id_cliente)) {
                <div class="cliente-card__details">
                  <div class="cliente-card__info-grid">
                    <div class="cliente-card__info-item">
                      <span class="cliente-card__info-label">ID atleta</span>
                      <strong>{{ c.id_cliente }}</strong>
                    </div>
                    <div class="cliente-card__info-item">
                      <span class="cliente-card__info-label">Método de pago</span>
                      <strong>{{ c.metodo_pago }}</strong>
                    </div>
                    <div class="cliente-card__info-item">
                      <span class="cliente-card__info-label">Último pago</span>
                      <strong>{{ c.ultimo_pago_fecha | dateEc }}</strong>
                    </div>
                    <div class="cliente-card__info-item">
                      <span class="cliente-card__info-label">Estado de vencimiento</span>
                      <strong [style.color]="diasColor(c.fecha_vencimiento)">{{ diasRestantes(c.fecha_vencimiento) }}</strong>
                    </div>
                    <div class="cliente-card__info-item">
                      <span class="cliente-card__info-label">Inicio</span>
                      <strong>{{ c.fecha_inicio | dateEc }}</strong>
                    </div>
                    <div class="cliente-card__info-item">
                      <span class="cliente-card__info-label">Nacimiento</span>
                      <strong>{{ c.fecha_nacimiento ? (c.fecha_nacimiento | dateEc) : '—' }}</strong>
                    </div>
                  </div>

                  <div class="cliente-card__actions">
                    <button class="btn btn--ghost btn--sm" type="button" (click)="abrirModal('editar', c)">
                      <i-lucide name="pencil" />
                      <span>Editar</span>
                    </button>
                    <button class="btn btn--ghost btn--sm" type="button" (click)="verHistorial(c.id_cliente)">
                      <i-lucide name="clipboard" />
                      <span>Historial</span>
                    </button>
                    <button class="btn btn--ghost btn--sm" type="button" (click)="enviarRecordatorio(c)">
                      @if (isReminderBusy(c.id_cliente)) {
                        <i-lucide class="icon-spin" name="settings-2" />
                      } @else {
                        <i-lucide name="send" />
                      }
                      <span>Recordar</span>
                    </button>
                    <button
                      class="btn btn--sm"
                      type="button"
                      [class.btn--danger]="c.estado !== 'Inactivo'"
                      [class.btn--secondary]="c.estado === 'Inactivo'"
                      (click)="toggleEstadoCliente(c)"
                      [disabled]="loadingAccion() === c.id_cliente + '_status'"
                    >
                      <span>{{ loadingAccion() === c.id_cliente + '_status' ? 'Procesando...' : (c.estado === 'Inactivo' ? 'Reactivar' : 'Dar de baja') }}</span>
                    </button>
                  </div>
                </div>
              }
            </article>
          } @empty {
            <div style="text-align:center;padding:60px;color:#938C84;">
              No hay atletas. <button class="btn btn--primary btn--sm" (click)="abrirModal('crear')">Crear primer atleta</button>
            </div>
          }
        </div>
      }
    </div>

    <!-- Modal Crear / Editar -->
    @if (modalMode()) {
      <div class="modal-backdrop" (click)="cerrarModal()">
        <div class="modal modal--wide" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">{{ modalMode() === 'crear' ? 'Nuevo atleta' : 'Editar atleta' }}</h3>
            <button class="btn btn--ghost btn--icon" (click)="cerrarModal()"><i-lucide name="circle-x" /></button>
          </div>
          <div class="modal__body">
            <form (ngSubmit)="guardarCliente()">
              <div class="two-column-grid">

                <div class="form-group">
                  <label class="form-label">Nombre Completo *</label>
                  <input class="form-control" type="text" [(ngModel)]="form.nombre_completo" name="nombre" required placeholder="Ej: JUAN CARLOS PÉREZ" />
                </div>

                <div class="form-group">
                  <label class="form-label">Email *</label>
                  <input class="form-control" type="email" [(ngModel)]="form.email" name="email" required placeholder="juan@email.com" />
                </div>

                <div class="form-group">
                  <label class="form-label">Teléfono WhatsApp *</label>
                  <input class="form-control" type="text" [(ngModel)]="form.telefono_whatsapp" name="tel" required placeholder="0987654321" />
                </div>

                <div class="form-group">
                  <label class="form-label">Fecha de nacimiento</label>
                  <input class="form-control" type="date" [(ngModel)]="form.fecha_nacimiento" name="fnac" />
                </div>

                <div class="form-group">
                  <label class="form-checkbox">
                    <input type="checkbox" [(ngModel)]="form.consentimiento_whatsapp" name="consentimiento" />
                    <span>Autorizo recibir novedades y recordatorios por WhatsApp.</span>
                  </label>
                </div>

                <div class="form-group">
                  <label class="form-label">Plan *</label>
                  <select class="form-control" [(ngModel)]="form.plan" name="plan" required (change)="onPlanChange()">
                    <option value="">Seleccionar</option>
                    <option value="MENSUAL">Mensual</option>
                    <option value="TRIMESTRAL">Trimestral</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Monto Plan (USD) *</label>
                  <input class="form-control" type="number" [(ngModel)]="form.monto_plan" name="monto" required min="1" step="0.01" />
                </div>

                <div class="form-group">
                  <label class="form-label">Método de Pago *</label>
                  <select class="form-control" [(ngModel)]="form.metodo_pago" name="metodo" required>
                    <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                    <option value="PAYPHONE">Payphone (tarjeta)</option>
                  </select>
                </div>

                @if (modalMode() === 'editar') {
                  <div class="form-group">
                    <label class="form-label">Estado</label>
                    <select class="form-control" [(ngModel)]="form.estado" name="estado">
                      <option value="Activo">Activo</option>
                      <option value="Pendiente">Pendiente</option>
                      <option value="Vencido">Vencido</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>
                } @else {
                  <div class="form-group">
                    <label class="form-label">Estado inicial</label>
                    <input class="form-control" type="text" value="Pendiente" readonly />
                  </div>
                }

                <div class="form-group">
                  <label class="form-label">Fecha Inicio *</label>
                  <input class="form-control" type="date" [(ngModel)]="form.fecha_inicio" name="finicio" required (change)="calcFechaVencimiento()" />
                </div>

                @if (modalMode() === 'editar') {
                  <div class="form-group">
                    <label class="form-label">Fecha Vencimiento</label>
                    <input class="form-control" type="date" [(ngModel)]="form.fecha_vencimiento" name="fvenc" />
                  </div>
                }

              </div>

              @if (modalMode() === 'crear') {
                <div class="alert alert--info" style="margin-top:8px;">
                  El ID del atleta se generará automáticamente (formato C001, C002...) y el estado inicial será Pendiente.
                </div>
              }

              @if (modalError()) {
                <div class="alert alert--error" style="margin-top:8px;">{{ modalError() }}</div>
              }

              <div class="modal__footer" style="padding:0;margin-top:24px;">
                <button type="button" class="btn btn--ghost" (click)="cerrarModal()">Cancelar</button>
                <button type="submit" class="btn btn--primary" [disabled]="guardando()">
                  {{ guardando() ? 'Guardando...' : (modalMode() === 'crear' ? 'Crear atleta' : 'Guardar cambios') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- Modal Historial -->
    @if (historialClienteId()) {
      <div class="modal-backdrop" (click)="historialClienteId.set('')">
        <div class="modal modal--wide" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">Historial de Pagos</h3>
            <button class="btn btn--ghost btn--icon" (click)="historialClienteId.set('')"><i-lucide name="circle-x" /></button>
          </div>
          <div class="modal__body">
            @if (historialLoading()) {
              <div style="text-align:center;padding:40px;color:#938C84;">Cargando...</div>
            } @else if (historial().length === 0) {
              <div style="text-align:center;padding:40px;color:#938C84;">Sin pagos registrados.</div>
            } @else {
              <table class="data-table historial-table">
                <thead>
                  <tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Banco</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  @for (p of historial(); track p.id) {
                    <tr>
                      <td style="font-size:13px;">{{ p.fecha_pago | dateEc }}</td>
                      <td style="font-weight:600;color:#3D8B6D;">$ {{ p.monto }}</td>
                      <td><span class="badge badge--mensual">{{ p.metodo }}</span></td>
                      <td style="font-size:13px;">{{ p.banco || '—' }}</td>
                      <td><span class="badge badge--{{ p.estado.toLowerCase() }}">{{ p.estado }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>

              <div class="historial-mobile-list">
                @for (p of historial(); track p.id) {
                  <article class="historial-mobile-card" [class.historial-mobile-card--open]="isHistorialPagoExpanded(p.id)">
                    <button
                      type="button"
                      class="historial-mobile-card__summary"
                      (click)="toggleExpandedHistorialPago(p.id)"
                      [attr.aria-expanded]="isHistorialPagoExpanded(p.id)"
                    >
                      <div class="historial-mobile-card__summary-copy">
                        <strong>{{ p.fecha_pago | dateEc }}</strong>
                      </div>
                      <i-lucide class="historial-mobile-card__chevron" [name]="isHistorialPagoExpanded(p.id) ? 'chevron-up' : 'chevron-down'" />
                    </button>

                    @if (isHistorialPagoExpanded(p.id)) {
                      <div class="historial-mobile-card__details">
                        <div class="historial-mobile-card__info-grid">
                          <div class="historial-mobile-card__info-item">
                            <span class="historial-mobile-card__info-label">Fecha</span>
                            <strong>{{ p.fecha_pago | dateEc }}</strong>
                          </div>
                          <div class="historial-mobile-card__info-item">
                            <span class="historial-mobile-card__info-label">Monto</span>
                            <strong class="historial-mobile-card__amount">$ {{ p.monto }}</strong>
                          </div>
                          <div class="historial-mobile-card__info-item">
                            <span class="historial-mobile-card__info-label">Método</span>
                            <span class="badge badge--mensual">{{ p.metodo }}</span>
                          </div>
                          <div class="historial-mobile-card__info-item">
                            <span class="historial-mobile-card__info-label">Banco</span>
                            <strong>{{ p.banco || '—' }}</strong>
                          </div>
                          <div class="historial-mobile-card__info-item">
                            <span class="historial-mobile-card__info-label">Estado</span>
                            <span class="badge badge--{{ p.estado.toLowerCase() }}">{{ p.estado }}</span>
                          </div>
                        </div>
                      </div>
                    }
                  </article>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .clientes-accordion {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 18px;
      align-items: start;
    }

    .cliente-card {
      border: 1px solid #2b3033;
      border-radius: 18px;
      background: rgba(21, 23, 24, 0.94);
      overflow: hidden;
    }

    .cliente-card--open {
      border-color: rgba(166, 31, 36, 0.5);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
    }

    .cliente-card__summary {
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

    .cliente-card__identity {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .cliente-card__identity strong {
      color: #f4f1eb;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cliente-card__summary-side {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }

    .cliente-card__summary-label,
    .cliente-card__info-label {
      color: #938c84;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .cliente-card__summary-meta strong,
    .cliente-card__info-item strong {
      color: #f4f1eb;
      font-size: 13px;
      line-height: 1.3;
    }

    .cliente-card__chevron {
      width: 18px;
      height: 18px;
      color: #938c84;
      flex-shrink: 0;
    }

    .cliente-card__details {
      border-top: 1px solid rgba(43, 48, 51, 0.9);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cliente-card__info-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .cliente-card__info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(244, 241, 235, 0.03);
      border: 1px solid rgba(244, 241, 235, 0.06);
      min-width: 0;
    }

    .cliente-card__actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .cliente-card__actions .btn {
      width: 100%;
      justify-content: center;
      gap: 6px;
      min-height: 38px;
      padding: 8px 10px;
    }

    .historial-mobile-list {
      display: none;
    }

    .historial-mobile-card {
      border: 1px solid #2b3033;
      border-radius: 16px;
      background: rgba(21, 23, 24, 0.94);
      overflow: hidden;
    }

    .historial-mobile-card--open {
      border-color: rgba(166, 31, 36, 0.5);
    }

    .historial-mobile-card__summary {
      width: 100%;
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 14px 16px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      text-align: left;
    }

    .historial-mobile-card__summary-copy strong {
      color: #f4f1eb;
      font-size: 14px;
      line-height: 1.25;
    }

    .historial-mobile-card__chevron {
      width: 18px;
      height: 18px;
      color: #938c84;
      flex-shrink: 0;
    }

    .historial-mobile-card__details {
      border-top: 1px solid rgba(43, 48, 51, 0.9);
      padding: 12px;
    }

    .historial-mobile-card__info-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .historial-mobile-card__info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(244, 241, 235, 0.03);
      border: 1px solid rgba(244, 241, 235, 0.06);
      min-width: 0;
    }

    .historial-mobile-card__info-label {
      color: #938c84;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .historial-mobile-card__info-item strong {
      color: #f4f1eb;
      font-size: 13px;
      line-height: 1.3;
      min-width: 0;
    }

    .historial-mobile-card__amount {
      color: #3D8B6D;
    }

    @media (max-width: 900px) and (min-width: 641px) {
      .clientes-accordion {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .clientes-accordion {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      .cliente-card__info-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .cliente-card__actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .clientes-accordion {
        padding: 14px;
      }

      .cliente-card__summary {
        padding: 13px 14px;
      }

      .cliente-card__details {
        padding: 12px;
      }

      .cliente-card__info-grid,
      .cliente-card__actions {
        grid-template-columns: 1fr;
      }

      .historial-table {
        display: none;
      }

      .historial-mobile-list {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
  `],
})
export class ClientesComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private confirmDialog = inject(ConfirmDialogService);
  private clientsService = inject(ClientsService);
  private sentry = inject(SentryService);
  private toast = inject(ToastService);

  clientes = signal<Cliente[]>([]);
  filtered = signal<Cliente[]>([]);
  loading = signal(true);
  loadingAccion = signal('');
  reminderQueueState = signal<Record<string, number>>({});
  view = signal<ClientesView>('operativos');
  expandedClienteId = signal('');
  showFilters = signal(false);
  searchTerm = '';
  filterEstado = '';
  filterPlan = '';

  // Modal
  modalMode = signal<ModalMode>(null);
  guardando = signal(false);
  modalError = signal('');
  editingId = '';
  form = this.emptyForm();

  // Historial
  historialClienteId = signal('');
  historial = signal<Pago[]>([]);
  historialLoading = signal(false);
  expandedHistorialPagoId = signal<number | null>(null);
  private reminderQueue = new Map<string, Promise<void>>();

  async ngOnInit() {
    await this.cargarClientes();
  }

  async cargarClientes() {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.getClientes();
      if (error) {
        this.toast.error('Error: ' + error.message);
        return;
      }

      const list = (data ?? []) as Cliente[];
      this.clientes.set(list);
      this.applyFilter();
    } catch (error) {
      this.sentry.captureError(error, { action: 'cargarClientes' });
      this.toast.error('No se pudieron cargar los atletas');
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    let result = this.clientes();
    if (this.view() === 'operativos') result = result.filter(c => c.estado !== 'Inactivo');
    if (this.view() === 'inactivos') result = result.filter(c => c.estado === 'Inactivo');
    if (this.searchTerm) {
      const t = this.searchTerm.toLowerCase();
      result = result.filter(c =>
        c.nombre_completo.toLowerCase().includes(t) ||
        c.email.toLowerCase().includes(t) ||
        c.telefono_whatsapp.includes(t) ||
        this.toLocalPhone(c.telefono_whatsapp).includes(t) ||
        c.id_cliente.toLowerCase().includes(t)
      );
    }
    if (this.filterEstado) result = result.filter(c => c.estado === this.filterEstado);
    if (this.filterPlan)   result = result.filter(c => c.plan === this.filterPlan);
    this.filtered.set(result);
    if (this.expandedClienteId() && !result.some((cliente) => cliente.id_cliente === this.expandedClienteId())) {
      this.expandedClienteId.set('');
    }
  }

  setView(view: ClientesView) {
    this.view.set(view);
    if (view === 'operativos' && this.filterEstado === 'Inactivo') this.filterEstado = '';
    if (view === 'inactivos') this.filterEstado = 'Inactivo';
    if (view === 'todos') this.filterEstado = '';
    this.applyFilter();
  }

  toggleExpanded(idCliente: string) {
    this.expandedClienteId.update((current) => current === idCliente ? '' : idCliente);
  }

  isExpanded(idCliente: string) {
    return this.expandedClienteId() === idCliente;
  }

  // ── Fecha helpers ──────────────────────────────────────────────────────────

  diasRestantes(fechaVenc: string): string {
    if (!fechaVenc) return '';
    const diff = getDaysFromTodayInEcuador(fechaVenc);
    if (diff > 0) return `${diff} días restantes`;
    if (diff === 0) return 'Vence hoy';
    return `Venció hace ${Math.abs(diff)} días`;
  }

  diasColor(fechaVenc: string): string {
    if (!fechaVenc) return '#666';
    const diff = getDaysFromTodayInEcuador(fechaVenc);
    if (diff > 5) return '#4caf50';
    if (diff >= 0) return '#ff9800';
    return '#ef5350';
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  abrirModal(mode: ModalMode, cliente?: Cliente) {
    this.modalMode.set(mode);
    this.modalError.set('');
    if (mode === 'editar' && cliente) {
      this.editingId = cliente.id_cliente;
      this.form = {
        ...cliente,
        telefono_whatsapp: this.toLocalPhone(cliente.telefono_whatsapp),
        fecha_nacimiento: cliente.fecha_nacimiento ?? '',
        consentimiento_whatsapp: cliente.consentimiento_whatsapp ?? false,
      };
    } else {
      this.editingId = '';
      this.form = this.emptyForm();
    }
  }

  cerrarModal() {
    this.modalMode.set(null);
    this.editingId = '';
    this.form = this.emptyForm();
  }

  onPlanChange() {
    // Auto-set monto según plan (valores de referencia)
    const defaults: Record<string, number> = { MENSUAL: 55, TRIMESTRAL: 150, ANUAL: 550 };
    const plan = this.form.plan ?? '';
    if (!this.form.monto_plan) this.form.monto_plan = defaults[plan] ?? 0;
    // Auto-set método de pago
    this.form.metodo_pago = this.form.plan === 'MENSUAL' ? 'TRANSFERENCIA' : 'PAYPHONE';
    this.calcFechaVencimiento();
  }

  calcFechaVencimiento() {
    if (this.modalMode() === 'crear') return;
    if (!this.form.fecha_inicio || !this.form.plan) return;
    const dias: Record<string, number> = { MENSUAL: 30, TRIMESTRAL: 90, ANUAL: 365 };
    this.form.fecha_vencimiento = addDaysToEcuadorDate(this.form.fecha_inicio as string, dias[this.form.plan] ?? 30);
  }

  async guardarCliente() {
    if (!this.form.nombre_completo || !this.form.email || !this.form.telefono_whatsapp || !this.form.plan) {
      this.modalError.set('Completa todos los campos obligatorios.');
      return;
    }

    if (this.modalMode() === 'editar') {
      const confirmed = await this.confirmDialog.open({
        title: 'Guardar cambios del atleta',
        message: `Se actualizará la ficha de ${this.form.nombre_completo}.`,
        confirmLabel: 'Guardar cambios',
        cancelLabel: 'Cancelar',
        tone: 'primary',
      });

      if (!confirmed) return;
    }

    this.guardando.set(true);
    this.modalError.set('');

    try {
      const telefonoNormalizado = this.normalizePhoneForStorage(String(this.form.telefono_whatsapp ?? ''));

      if (this.modalMode() === 'crear') {
        const idCliente = await this.generarIdCliente();
        const { fecha_vencimiento: _fv, ...formSinFechaVenc } = this.form;
        const payload = {
          ...formSinFechaVenc,
          id_cliente: idCliente,
          telefono_whatsapp: telefonoNormalizado,
          estado: 'Pendiente',
          fecha_vencimiento: null,
          fecha_nacimiento: this.form.fecha_nacimiento ? this.form.fecha_nacimiento : null,
          consentimiento_whatsapp: Boolean(this.form.consentimiento_whatsapp),
        };
        const { error } = await this.supabase.createCliente(payload);
        if (error) {
          this.modalError.set(error.message);
          return;
        }

        this.toast.success(`Atleta ${idCliente} creado`);
      } else {
        const payload = {
          nombre_completo: this.form.nombre_completo,
          email: this.form.email,
          telefono_whatsapp: telefonoNormalizado,
          plan: this.form.plan,
          monto_plan: this.form.monto_plan,
          metodo_pago: this.form.metodo_pago,
          estado: this.form.estado,
          fecha_inicio: this.form.fecha_inicio,
          fecha_vencimiento: this.form.fecha_vencimiento,
          fecha_nacimiento: this.form.fecha_nacimiento ? this.form.fecha_nacimiento : null,
          consentimiento_whatsapp: Boolean(this.form.consentimiento_whatsapp),
        };

        const { error } = await this.supabase.updateCliente(this.editingId, payload);
        if (error) {
          this.modalError.set(error.message);
          return;
        }

        this.toast.success('Atleta actualizado');
      }

      this.cerrarModal();
      await this.cargarClientes();
    } catch (error) {
      this.sentry.captureError(error, {
        action: 'guardarCliente',
        mode: this.modalMode() ?? 'unknown',
        idCliente: this.editingId || undefined,
      });
      this.modalError.set('No se pudo guardar el atleta. Intenta nuevamente.');
    } finally {
      this.guardando.set(false);
    }
  }

  private async generarIdCliente(): Promise<string> {
    const { data } = await this.supabase.getClientes();
    const count = (data?.length ?? 0) + 1;
    return `C${String(count).padStart(3, '0')}`;
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  async enviarRecordatorio(c: Cliente) {
    const queueKey = c.id_cliente;
    this.bumpReminderQueue(queueKey, 1);

    const previous = this.reminderQueue.get(queueKey) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        try {
          await firstValueFrom(this.clientsService.sendReminder(c.id_cliente));
          this.toast.success(`Flujo enviado para ${c.nombre_completo}`);
        } catch (error) {
          this.sentry.captureError(error, { action: 'sendClientReminder', idCliente: c.id_cliente });
          this.toast.error('No se pudo ejecutar el flujo desde el backend');
        } finally {
          this.bumpReminderQueue(queueKey, -1);
        }
      });

    this.reminderQueue.set(queueKey, next);
    void next.finally(() => {
      if (this.reminderQueue.get(queueKey) === next) {
        this.reminderQueue.delete(queueKey);
      }
    });
  }

  async verHistorial(idCliente: string) {
    this.historialClienteId.set(idCliente);
    this.expandedHistorialPagoId.set(null);
    this.historialLoading.set(true);
    try {
      const { data, error } = await this.supabase.getHistorialPagos({ id_cliente: idCliente });
      if (error) {
        this.toast.error(error.message);
        return;
      }

      this.historial.set((data ?? []) as Pago[]);
    } catch (error) {
      this.sentry.captureError(error, { action: 'verHistorialPagos', idCliente });
      this.toast.error('No se pudo cargar el historial de pagos');
    } finally {
      this.historialLoading.set(false);
    }
  }

  toggleExpandedHistorialPago(idPago: number) {
    this.expandedHistorialPagoId.update((current) => current === idPago ? null : idPago);
  }

  isHistorialPagoExpanded(idPago: number) {
    return this.expandedHistorialPagoId() === idPago;
  }

  private nextEstadoCliente(cliente: Cliente) {
    if (cliente.estado === 'Inactivo') {
      const dias = getDaysFromTodayInEcuador(cliente.fecha_vencimiento);
      return dias > 5 ? 'Activo' : 'Pendiente';
    }

    return 'Inactivo';
  }

  async toggleEstadoCliente(cliente: Cliente) {
    const nextEstado = this.nextEstadoCliente(cliente);
    const confirmed = await this.confirmDialog.open({
      title: nextEstado === 'Inactivo' ? 'Dar de baja atleta' : 'Reactivar atleta',
      message: nextEstado === 'Inactivo'
        ? `Se marcará a ${cliente.nombre_completo} como Inactivo. Su historial se conserva y saldrá del flujo operativo normal.`
        : `Se reactivará a ${cliente.nombre_completo} y volverá a la operación diaria con estado ${nextEstado}.`,
      confirmLabel: nextEstado === 'Inactivo' ? 'Dar de baja atleta' : 'Reactivar atleta',
      cancelLabel: 'Cancelar',
      tone: nextEstado === 'Inactivo' ? 'danger' : 'primary',
    });

    if (!confirmed) return;

    this.loadingAccion.set(cliente.id_cliente + '_status');

    try {
      const { error } = await this.supabase.setClienteEstado(cliente.id_cliente, nextEstado);
      if (error) {
        this.sentry.captureError(error, { action: 'setClienteEstado', idCliente: cliente.id_cliente, estado: nextEstado });
        this.toast.error('No se pudo actualizar el estado del atleta');
        return;
      }

      this.toast.success(`Atleta ${nextEstado === 'Inactivo' ? 'marcado como Inactivo' : 'reactivado'}: ${cliente.nombre_completo}`);
      await this.cargarClientes();
    } finally {
      this.loadingAccion.set('');
    }
  }

  displayPhone(phone: string): string {
    return this.toLocalPhone(phone);
  }

  private toLocalPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('593') && digits.length === 12) {
      return `0${digits.slice(3)}`;
    }

    if (digits.startsWith('9') && digits.length === 9) {
      return `0${digits}`;
    }

    return digits || phone;
  }

  private normalizePhoneForStorage(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('593') && digits.length === 12) {
      return digits;
    }

    if (digits.startsWith('09') && digits.length === 10) {
      return `593${digits.slice(1)}`;
    }

    if (digits.startsWith('9') && digits.length === 9) {
      return `593${digits}`;
    }

    return digits;
  }

  reminderPendingCount(idCliente: string): number {
    return this.reminderQueueState()[idCliente] ?? 0;
  }

  isReminderBusy(idCliente: string): boolean {
    return this.reminderPendingCount(idCliente) > 0;
  }

  private bumpReminderQueue(idCliente: string, delta: number) {
    this.reminderQueueState.update((state) => {
      const nextCount = Math.max(0, (state[idCliente] ?? 0) + delta);
      if (nextCount === 0) {
        const { [idCliente]: _removed, ...rest } = state;
        return rest;
      }

      return { ...state, [idCliente]: nextCount };
    });
  }

  private emptyForm(): Partial<Cliente> & Record<string, unknown> {
    return {
      nombre_completo: '',
      email: '',
      telefono_whatsapp: '',
      plan: '',
      monto_plan: 0,
      metodo_pago: 'TRANSFERENCIA',
      estado: 'Pendiente',
      fecha_inicio: getEcuadorTodayYmd(),
      fecha_vencimiento: '',
      fecha_nacimiento: '',
      consentimiento_whatsapp: false,
    };
  }
}
