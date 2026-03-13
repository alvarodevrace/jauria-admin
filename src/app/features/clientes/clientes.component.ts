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
      <h2 class="page-header__title">Clientes</h2>
      <p class="page-header__subtitle">{{ clientes().length }} clientes registrados</p>
    </div>

    <!-- Toolbar -->
    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Todos los Clientes</span>
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
          <button class="btn btn--primary btn--sm" (click)="abrirModal('crear')">+ Nuevo Cliente</button>
        </div>
      </div>

      @if (loading()) {
        <div style="padding:40px;text-align:center;color:#938C84;">Cargando clientes...</div>
      } @else {
        <table class="data-table data-table--stacked-mobile">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Método</th>
              <th>Vencimiento</th>
              <th>Último Pago</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (c of filtered(); track c.id_cliente) {
              <tr>
                <td class="data-table__cell--primary" data-label="">
                  <div class="mobile-primary">{{ c.nombre_completo }}</div>
                  <div class="mobile-secondary" style="margin-top:2px;">{{ c.email }}</div>
                  <div class="mobile-secondary">{{ displayPhone(c.telefono_whatsapp) }}</div>
                </td>
                <td data-label="Plan">
                  <span class="badge badge--{{ c.plan.toLowerCase() }}">
                    {{ c.plan | planLabel : c.monto_plan }}
                  </span>
                </td>
                <td data-label="Estado">
                  <span class="badge badge--{{ c.estado.toLowerCase() }}">{{ c.estado }}</span>
                </td>
                <td data-label="Método" style="font-size:13px;">{{ c.metodo_pago }}</td>
                <td data-label="Vencimiento">
                  <span [style.color]="diasColor(c.fecha_vencimiento)" style="font-size:13px;">
                    {{ c.fecha_vencimiento | dateEc }}
                  </span>
                  <div style="font-size:11px;color:#938C84;">{{ diasRestantes(c.fecha_vencimiento) }}</div>
                </td>
                <td data-label="Último pago" style="font-size:13px;">{{ c.ultimo_pago_fecha | dateEc }}</td>
                <td class="data-table__cell--actions" data-label="Acciones">
                  <div class="data-table__actions mobile-actions" style="justify-content:flex-end;flex-wrap:wrap;">
                    <button class="btn btn--ghost btn--sm btn--icon" title="Editar cliente" (click)="abrirModal('editar', c)"><i-lucide name="pencil" /></button>
                    <button class="btn btn--ghost btn--sm btn--icon" title="Ver historial pagos" (click)="verHistorial(c.id_cliente)"><i-lucide name="clipboard" /></button>
                    <button class="btn btn--ghost btn--sm btn--icon" title="Enviar recordatorio WhatsApp" aria-label="Enviar recordatorio WhatsApp" (click)="enviarRecordatorio(c)" [disabled]="loadingAccion() === c.id_cliente + '_rec'">
                      @if (loadingAccion() === c.id_cliente + '_rec') { ... } @else { <i-lucide name="send" /> }
                    </button>
                    <button
                      class="btn btn--sm"
                      [class.btn--danger]="c.estado !== 'Inactivo'"
                      [class.btn--secondary]="c.estado === 'Inactivo'"
                      [title]="c.estado === 'Inactivo' ? 'Reactivar cliente' : 'Dar de baja cliente'"
                      (click)="toggleEstadoCliente(c)"
                      [disabled]="loadingAccion() === c.id_cliente + '_status'"
                    >
                      {{ loadingAccion() === c.id_cliente + '_status' ? '...' : (c.estado === 'Inactivo' ? 'Reactivar' : 'Dar de baja') }}
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" style="text-align:center;padding:60px;color:#938C84;">
                  No hay clientes. <button class="btn btn--primary btn--sm" (click)="abrirModal('crear')">Crear primer cliente</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    <!-- Modal Crear / Editar -->
    @if (modalMode()) {
      <div class="modal-backdrop" (click)="cerrarModal()">
        <div class="modal modal--wide" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">{{ modalMode() === 'crear' ? 'Nuevo Cliente' : 'Editar Cliente' }}</h3>
            <button class="btn btn--ghost btn--icon" (click)="cerrarModal()"><i-lucide name="circle-x" /></button>
          </div>
          <div class="modal__body">
            <form (ngSubmit)="guardarCliente()">
              <div class="two-column-grid">

                <div class="form-group" style="grid-column:1/-1;">
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

                <div class="form-group">
                  <label class="form-label">Fecha Vencimiento</label>
                  <input class="form-control" type="date" [(ngModel)]="form.fecha_vencimiento" name="fvenc" />
                </div>

              </div>

              @if (modalMode() === 'crear') {
                <div class="alert alert--info" style="margin-top:8px;">
                  El ID de cliente se generará automáticamente (formato C001, C002...) y el estado inicial será Pendiente.
                </div>
              }

              @if (modalError()) {
                <div class="alert alert--error" style="margin-top:8px;">{{ modalError() }}</div>
              }

              <div class="modal__footer" style="padding:0;margin-top:24px;">
                <button type="button" class="btn btn--ghost" (click)="cerrarModal()">Cancelar</button>
                <button type="submit" class="btn btn--primary" [disabled]="guardando()">
                  {{ guardando() ? 'Guardando...' : (modalMode() === 'crear' ? 'Crear Cliente' : 'Guardar Cambios') }}
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
              <table class="data-table">
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
            }
          </div>
        </div>
      </div>
    }
  `,
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
  view = signal<ClientesView>('operativos');
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
      this.toast.error('No se pudieron cargar los clientes');
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
  }

  setView(view: ClientesView) {
    this.view.set(view);
    if (view === 'operativos' && this.filterEstado === 'Inactivo') this.filterEstado = '';
    if (view === 'inactivos') this.filterEstado = 'Inactivo';
    if (view === 'todos') this.filterEstado = '';
    this.applyFilter();
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
      this.form = { ...cliente, telefono_whatsapp: this.toLocalPhone(cliente.telefono_whatsapp) };
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
        title: 'Guardar cambios del cliente',
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
        const payload = {
          ...this.form,
          id_cliente: idCliente,
          telefono_whatsapp: telefonoNormalizado,
          estado: 'Pendiente',
        };
        const { error } = await this.supabase.createCliente(payload);
        if (error) {
          this.modalError.set(error.message);
          return;
        }

        this.toast.success(`Cliente ${idCliente} creado`);
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
        };

        const { error } = await this.supabase.updateCliente(this.editingId, payload);
        if (error) {
          this.modalError.set(error.message);
          return;
        }

        this.toast.success('Cliente actualizado');
      }

      this.cerrarModal();
      await this.cargarClientes();
    } catch (error) {
      this.sentry.captureError(error, {
        action: 'guardarCliente',
        mode: this.modalMode() ?? 'unknown',
        idCliente: this.editingId || undefined,
      });
      this.modalError.set('No se pudo guardar el cliente. Intenta nuevamente.');
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
    this.loadingAccion.set(c.id_cliente + '_rec');
    try {
      await firstValueFrom(this.clientsService.sendReminder(c.id_cliente));

      this.toast.success(`Flujo enviado para ${c.nombre_completo}`);
    } catch (error) {
      this.sentry.captureError(error, { action: 'sendClientReminder', idCliente: c.id_cliente });
      this.toast.error('No se pudo ejecutar el flujo desde el backend');
    } finally {
      this.loadingAccion.set('');
    }
  }

  async verHistorial(idCliente: string) {
    this.historialClienteId.set(idCliente);
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
      title: nextEstado === 'Inactivo' ? 'Dar de baja cliente' : 'Reactivar cliente',
      message: nextEstado === 'Inactivo'
        ? `Se marcará a ${cliente.nombre_completo} como Inactivo. Su historial se conserva y saldrá del flujo operativo normal.`
        : `Se reactivará a ${cliente.nombre_completo} y volverá a la operación diaria con estado ${nextEstado}.`,
      confirmLabel: nextEstado === 'Inactivo' ? 'Dar de baja' : 'Reactivar',
      cancelLabel: 'Cancelar',
      tone: nextEstado === 'Inactivo' ? 'danger' : 'primary',
    });

    if (!confirmed) return;

    this.loadingAccion.set(cliente.id_cliente + '_status');

    try {
      const { error } = await this.supabase.setClienteEstado(cliente.id_cliente, nextEstado);
      if (error) {
        this.sentry.captureError(error, { action: 'setClienteEstado', idCliente: cliente.id_cliente, estado: nextEstado });
        this.toast.error('No se pudo actualizar el estado del cliente');
        return;
      }

      this.toast.success(`Cliente ${nextEstado === 'Inactivo' ? 'marcado como Inactivo' : 'reactivado'}: ${cliente.nombre_completo}`);
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
    };
  }
}
