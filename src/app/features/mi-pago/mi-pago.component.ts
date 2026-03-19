import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { PlanLabelPipe } from '../../shared/pipes/plan-label.pipe';
import { getDaysFromTodayInEcuador } from '../../shared/utils/date-ecuador';

interface ClientePlan {
  id_cliente: string;
  estado: string;
  plan: string;
  monto_plan: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
  metodo_pago: string;
  link_pago_actual: string;
  ultimo_pago_fecha: string;
}

interface Pago {
  id: number;
  fecha_pago: string;
  monto: number;
  metodo: string;
  banco: string;
  estado: string;
}

@Component({
  selector: 'app-mi-pago',
  standalone: true,
  imports: [CommonModule, DateEcPipe, PlanLabelPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Mi cuenta</span>
      <h2 class="page-header__title">Mi Pago</h2>
    </div>

    @if (loading()) {
      <div style="text-align:center;padding:60px;color:#938C84;">Cargando...</div>
    } @else if (!cliente()) {
      <div class="alert alert--info">
        No se encontró un plan asociado a tu cuenta. Contacta al coach para más información.
      </div>
    } @else {
      <div class="pago-grid">

        <!-- Estado actual -->
        <div class="data-table-wrapper">
          <div class="data-table-wrapper__header">
            <span class="data-table-wrapper__title">Estado Actual</span>
          </div>
          <div class="pago-summary-grid">

            <div class="stat-card pago-summary-card">
              <div class="stat-card__label">Estado de Membresía</div>
              <div class="pago-summary-card__content">
                <span class="badge badge--{{ cliente()!.estado.toLowerCase() }}" style="font-size:14px;padding:8px 16px;">
                  {{ cliente()!.estado }}
                </span>
              </div>
            </div>

            <div class="stat-card pago-summary-card">
              <div class="stat-card__label">Plan</div>
              <div class="pago-summary-card__headline">
                {{ cliente()!.plan | planLabel : cliente()!.monto_plan }}
              </div>
              <div class="pago-summary-card__meta">Método: {{ cliente()!.metodo_pago }}</div>
            </div>

            <div class="stat-card pago-summary-card">
              <div class="stat-card__label">Vencimiento</div>
              <div class="pago-summary-card__headline pago-summary-card__headline--compact" [style.color]="diasColor()">
                {{ cliente()!.fecha_vencimiento | dateEc }}
              </div>
              <div class="pago-summary-card__meta" [style.color]="diasColor()">
                {{ diasRestantesLabel() }}
              </div>
            </div>

            <div class="stat-card pago-summary-card">
              <div class="stat-card__label">Último Pago</div>
              <div class="pago-summary-card__headline pago-summary-card__headline--compact">
                {{ cliente()!.ultimo_pago_fecha | dateEc }}
              </div>
            </div>

          </div>
        </div>

        <!-- Acción de pago -->
        <div>
          @if (cliente()!.metodo_pago === 'TRANSFERENCIA') {
            <div class="data-table-wrapper" style="margin-bottom:20px;">
              <div class="data-table-wrapper__header">
                <span class="data-table-wrapper__title">Pagar por Transferencia</span>
              </div>
              <div style="padding:24px;">
                <p style="font-family:'Manrope',sans-serif;font-size:13px;color:#d2cbc1;margin-bottom:16px;">
                  Realiza una transferencia bancaria y envía el comprobante por WhatsApp al número del coach.
                  El sistema lo validará automáticamente.
                </p>
                <div style="background:#1d2022;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;">
                  <div style="display:flex;justify-content:space-between;">
                    <span style="font-size:12px;color:#938C84;text-transform:uppercase;letter-spacing:0.1em;">Monto</span>
                    <span style="font-weight:700;color:#3D8B6D;font-size:16px;">$ {{ cliente()!.monto_plan }}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;">
                    <span style="font-size:12px;color:#938C84;text-transform:uppercase;letter-spacing:0.1em;">Bancos aceptados</span>
                    <span style="font-size:13px;color:#d2cbc1;">Pichincha · Produbanco · Guayaquil · Pacífico</span>
                  </div>
                </div>
                <p style="font-size:12px;color:#938C84;margin-top:12px;">
                  Envía el comprobante por WhatsApp al coach. El sistema procesará automáticamente.
                </p>
              </div>
            </div>
          }

          @if (cliente()!.metodo_pago === 'PAYPHONE' && cliente()!.link_pago_actual) {
            <div class="data-table-wrapper" style="margin-bottom:20px;">
              <div class="data-table-wrapper__header">
                <span class="data-table-wrapper__title">Pagar con Tarjeta</span>
              </div>
              <div style="padding:24px;">
                <p style="font-family:'Manrope',sans-serif;font-size:13px;color:#d2cbc1;margin-bottom:16px;">
                  Tu link de pago con tarjeta de crédito/débito está listo.
                </p>
                <a [href]="cliente()!.link_pago_actual" target="_blank" class="btn btn--primary" style="display:inline-flex;width:100%;justify-content:center;">
                  Pagar con Payphone
                </a>
              </div>
            </div>
          }

          <!-- Historial de pagos -->
          <div class="data-table-wrapper">
            <div class="data-table-wrapper__header">
              <span class="data-table-wrapper__title">Historial</span>
            </div>
            @if (pagos().length === 0) {
              <div class="pago-history-empty">Sin pagos registrados.</div>
            } @else {
              <div class="pago-history-list">
                @for (p of pagos(); track p.id) {
                  <article class="pago-history-item">
                    <div class="pago-history-item__main">
                      <div class="pago-history-item__label">Fecha de pago</div>
                      <div class="pago-history-item__value">{{ p.fecha_pago | dateEc }}</div>
                    </div>
                    <div class="pago-history-item__aside">
                      <div class="pago-history-item__amount">$ {{ p.monto }}</div>
                      <span class="badge badge--{{ p.estado.toLowerCase() }}">{{ p.estado }}</span>
                    </div>
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
    .pago-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 24px;
      max-width: 960px;
      align-items: start;
    }

    .pago-summary-grid {
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .pago-summary-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 148px;
    }

    .pago-summary-card__content {
      display: flex;
      align-items: center;
      min-height: 56px;
    }

    .pago-summary-card__headline {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 24px;
      color: #f4f1eb;
      margin-top: 6px;
      line-height: 1.1;
    }

    .pago-summary-card__headline--compact {
      font-family: 'Manrope', sans-serif;
      font-size: 20px;
      font-weight: 700;
    }

    .pago-summary-card__meta {
      font-size: 13px;
      color: #938C84;
      margin-top: 6px;
      line-height: 1.4;
    }

    .pago-history-empty {
      padding: 24px;
      text-align: center;
      color: #938C84;
    }

    .pago-history-list {
      padding: 20px 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .pago-history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 18px;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      background: #141414;
    }

    .pago-history-item__main,
    .pago-history-item__aside {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .pago-history-item__aside {
      align-items: flex-end;
    }

    .pago-history-item__label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #938C84;
    }

    .pago-history-item__value {
      font-size: 14px;
      font-weight: 600;
      color: #f4f1eb;
      line-height: 1.3;
    }

    .pago-history-item__amount {
      font-size: 18px;
      font-weight: 700;
      color: #3D8B6D;
      line-height: 1;
    }

    @media (max-width: 768px) {
      .pago-grid {
        grid-template-columns: 1fr !important;
      }

      .pago-summary-grid {
        grid-template-columns: 1fr;
      }

      .pago-history-item {
        flex-direction: column;
        align-items: flex-start;
      }

      .pago-history-item__aside {
        width: 100%;
        align-items: flex-start;
      }
    }
  `],
})
export class MiPagoComponent implements OnInit {
  private auth     = inject(AuthService);
  private supabase = inject(SupabaseService);

  loading = signal(true);
  cliente = signal<ClientePlan | null>(null);
  pagos   = signal<Pago[]>([]);

  async ngOnInit() {
    const idCliente = this.auth.profile()?.id_cliente;
    if (!idCliente) { this.loading.set(false); return; }

    this.loading.set(true);
    try {
      const [clienteRes, pagosRes] = await Promise.all([
        this.supabase.getCliente(idCliente),
        this.supabase.getHistorialPagos({ id_cliente: idCliente }),
      ]);

      this.cliente.set(clienteRes.data as ClientePlan);
      this.pagos.set((pagosRes.data ?? []) as Pago[]);
    } finally {
      this.loading.set(false);
    }
  }

  diasRestantesLabel(): string {
    const venc = this.cliente()?.fecha_vencimiento;
    if (!venc) return '';
    const diff = getDaysFromTodayInEcuador(venc);
    if (diff > 0) return `${diff} días restantes`;
    if (diff === 0) return 'Vence hoy';
    return `Venció hace ${Math.abs(diff)} días`;
  }

  diasColor(): string {
    const venc = this.cliente()?.fecha_vencimiento;
    if (!venc) return '#938C84';
    const diff = getDaysFromTodayInEcuador(venc);
    if (diff > 5) return '#3D8B6D';
    if (diff >= 0) return '#C58A2A';
    return '#C1454A';
  }
}
