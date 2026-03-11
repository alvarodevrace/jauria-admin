import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { PlanLabelPipe } from '../../shared/pipes/plan-label.pipe';
import { environment } from '../../../environments/environment';
import { TablerIconsModule } from 'angular-tabler-icons';

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

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe, PlanLabelPipe, TablerIconsModule],
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
        <table class="data-table">
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
                <td>
                  <div style="font-weight:600;color:#f4f1eb;">{{ c.nombre_completo }}</div>
                  <div style="font-size:11px;color:#938C84;margin-top:2px;">{{ c.email }}</div>
                  <div style="font-size:11px;color:#938C84;">{{ c.telefono_whatsapp }}</div>
                </td>
                <td>
                  <span class="badge badge--{{ c.plan.toLowerCase() }}">
                    {{ c.plan | planLabel : c.monto_plan }}
                  </span>
                </td>
                <td>
                  <span class="badge badge--{{ c.estado.toLowerCase() }}">{{ c.estado }}</span>
                </td>
                <td style="font-size:13px;">{{ c.metodo_pago }}</td>
                <td>
                  <span [style.color]="diasColor(c.fecha_vencimiento)" style="font-size:13px;">
                    {{ c.fecha_vencimiento | dateEc }}
                  </span>
                  <div style="font-size:11px;color:#938C84;">{{ diasRestantes(c.fecha_vencimiento) }}</div>
                </td>
                <td style="font-size:13px;">{{ c.ultimo_pago_fecha | dateEc }}</td>
                <td>
                  <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
                    <button class="btn btn--ghost btn--sm btn--icon" title="Editar cliente" (click)="abrirModal('editar', c)"><i-tabler name="pencil" /></button>
                    <button class="btn btn--ghost btn--sm btn--icon" title="Ver historial pagos" (click)="verHistorial(c.id_cliente)"><i-tabler name="clipboard" /></button>
                    <button class="btn btn--ghost btn--sm" title="Enviar recordatorio WhatsApp" (click)="enviarRecordatorio(c)" [disabled]="loadingAccion() === c.id_cliente + '_rec'">
                      @if (loadingAccion() === c.id_cliente + '_rec') { ... } @else { <i-tabler name="send" /> }
                    </button>
                    @if (c.metodo_pago === 'PAYPHONE' || c.plan !== 'MENSUAL') {
                      <button class="btn btn--ghost btn--sm" title="Generar link Payphone" (click)="generarLinkPayphone(c)" [disabled]="loadingAccion() === c.id_cliente + '_pay'">
                        @if (loadingAccion() === c.id_cliente + '_pay') { ... } @else { <i-tabler name="link" /> }
                      </button>
                    }
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
            <button class="btn btn--ghost btn--icon" (click)="cerrarModal()"><i-tabler name="circle-x" /></button>
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
                  <input class="form-control" type="text" [(ngModel)]="form.telefono_whatsapp" name="tel" required placeholder="593987654321" />
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

                <div class="form-group">
                  <label class="form-label">Estado</label>
                  <select class="form-control" [(ngModel)]="form.estado" name="estado">
                    <option value="Activo">Activo</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Vencido">Vencido</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

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
                  El ID de cliente se generará automáticamente (formato C001, C002...).
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
            <button class="btn btn--ghost btn--icon" (click)="historialClienteId.set('')"><i-tabler name="circle-x" /></button>
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
  private toast = inject(ToastService);

  clientes = signal<Cliente[]>([]);
  filtered = signal<Cliente[]>([]);
  loading = signal(true);
  loadingAccion = signal('');
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
    const { data, error } = await this.supabase.getClientes();
    this.loading.set(false);
    if (error) { this.toast.error('Error: ' + error.message); return; }
    const list = (data ?? []) as Cliente[];
    this.clientes.set(list);
    this.filtered.set(list);
  }

  applyFilter() {
    let result = this.clientes();
    if (this.searchTerm) {
      const t = this.searchTerm.toLowerCase();
      result = result.filter(c =>
        c.nombre_completo.toLowerCase().includes(t) ||
        c.email.toLowerCase().includes(t) ||
        c.telefono_whatsapp.includes(t) ||
        c.id_cliente.toLowerCase().includes(t)
      );
    }
    if (this.filterEstado) result = result.filter(c => c.estado === this.filterEstado);
    if (this.filterPlan)   result = result.filter(c => c.plan === this.filterPlan);
    this.filtered.set(result);
  }

  // ── Fecha helpers ──────────────────────────────────────────────────────────

  diasRestantes(fechaVenc: string): string {
    if (!fechaVenc) return '';
    const diff = Math.ceil((new Date(fechaVenc).getTime() - Date.now()) / 86400000);
    if (diff > 0) return `${diff} días restantes`;
    if (diff === 0) return 'Vence hoy';
    return `Venció hace ${Math.abs(diff)} días`;
  }

  diasColor(fechaVenc: string): string {
    if (!fechaVenc) return '#666';
    const diff = Math.ceil((new Date(fechaVenc).getTime() - Date.now()) / 86400000);
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
      this.form = { ...cliente };
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
    const inicio = new Date(this.form.fecha_inicio);
    inicio.setDate(inicio.getDate() + (dias[this.form.plan] ?? 30));
    this.form.fecha_vencimiento = inicio.toISOString().slice(0, 10);
  }

  async guardarCliente() {
    if (!this.form.nombre_completo || !this.form.email || !this.form.telefono_whatsapp || !this.form.plan) {
      this.modalError.set('Completa todos los campos obligatorios.');
      return;
    }
    this.guardando.set(true);
    this.modalError.set('');

    if (this.modalMode() === 'crear') {
      // Generar ID
      const idCliente = await this.generarIdCliente();
      const payload = { ...this.form, id_cliente: idCliente };
      const { error } = await this.supabase.createCliente(payload);
      if (error) { this.modalError.set(error.message); this.guardando.set(false); return; }
      this.toast.success(`Cliente ${idCliente} creado`);
    } else {
      const { error } = await this.supabase.updateCliente(this.editingId, this.form);
      if (error) { this.modalError.set(error.message); this.guardando.set(false); return; }
      this.toast.success('Cliente actualizado');
    }

    this.guardando.set(false);
    this.cerrarModal();
    await this.cargarClientes();
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
      // Trigger WF1 vía webhook (si se crea uno por cliente — por ahora notifica al coach)
      const res = await fetch(`${environment.n8nApiUrl}/workflows/GzmYUYGMG1X8wnTm/run`, {
        method: 'POST',
        headers: { 'X-N8N-API-KEY': environment.n8nApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cliente: c.id_cliente }),
      });
      if (res.ok) this.toast.success(`Recordatorio enviado a ${c.nombre_completo}`);
      else this.toast.warning('WF1 ejecutado — verificar en n8n');
    } catch {
      this.toast.error('No se pudo conectar con n8n');
    }
    this.loadingAccion.set('');
  }

  async generarLinkPayphone(c: Cliente) {
    this.loadingAccion.set(c.id_cliente + '_pay');
    try {
      const montoCentavos = Math.round(c.monto_plan * 100);
      const res = await fetch('https://pay.payphonetodoesposible.com/api/Links', {
        method: 'POST',
        headers: { Authorization: `Bearer ${environment.n8nApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: montoCentavos,
          amountWithTax: 0,
          amountWithoutTax: montoCentavos,
          tax: 0,
          currency: 'USD',
          storeId: '5f49f41a-fa45-4e0d-842e-be9cc652a3be',
          clientTransactionId: c.id_cliente,
          responseUrl: 'https://n8n.alvarodevrace.tech/webhook/payphone-notificacion',
          cancellationUrl: 'https://n8n.alvarodevrace.tech/webhook/payphone-notificacion',
          reference: `Pago ${c.plan} ${c.nombre_completo}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const link = data.paymentUrl ?? data.link ?? '';
        if (link) {
          await this.supabase.updateCliente(c.id_cliente, { link_pago_actual: link });
          this.toast.success('Link Payphone generado y guardado');
          await this.cargarClientes();
        } else {
          this.toast.warning('Link generado pero URL no encontrada en respuesta');
        }
      } else {
        this.toast.error('Error Payphone: ' + res.status);
      }
    } catch {
      this.toast.error('No se pudo generar el link Payphone');
    }
    this.loadingAccion.set('');
  }

  async verHistorial(idCliente: string) {
    this.historialClienteId.set(idCliente);
    this.historialLoading.set(true);
    const { data } = await this.supabase.getHistorialPagos({ id_cliente: idCliente });
    this.historial.set((data ?? []) as Pago[]);
    this.historialLoading.set(false);
  }

  private emptyForm(): Partial<Cliente> & Record<string, unknown> {
    return {
      nombre_completo: '',
      email: '',
      telefono_whatsapp: '',
      plan: '',
      monto_plan: 0,
      metodo_pago: 'TRANSFERENCIA',
      estado: 'Activo',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_vencimiento: '',
    };
  }
}
