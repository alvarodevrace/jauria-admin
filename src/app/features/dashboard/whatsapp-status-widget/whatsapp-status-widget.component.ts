import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminOpsService, ServiceStatus } from '../../../core/services/admin-ops.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-whatsapp-status-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wa-widget" role="status" aria-live="polite">
      <div class="wa-widget__header">
        <div>
          <p class="wa-widget__eyebrow">WhatsApp · jauriaCrossfit</p>
          <h3 class="wa-widget__title">Estado de sesión</h3>
        </div>
        <button
          class="btn btn--ghost btn--sm"
          type="button"
          (click)="loadStatus()"
          [disabled]="refreshingStatus()"
        >
          {{ refreshingStatus() ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </div>

      <div class="wa-widget__body">
        <div class="wa-status-row">
          <div class="status-indicator" [class]="'status-indicator--' + status()">
            <span class="dot"></span>{{ statusLabel(status()) }}
          </div>
          <div class="wa-detail">
            <span class="wa-detail__label">Conexión</span>
            <strong>{{ formatConnection(connectionStatus()) }}</strong>
          </div>
        </div>

        @if (instanceName()) {
          <div class="wa-detail-line">
            <span class="wa-detail__label">Instancia</span>
            <strong>{{ instanceName() }}</strong>
          </div>
        }
        @if (detailLine()) {
          <div class="wa-detail-line">
            <span class="wa-detail__label">Detalles</span>
            <strong>{{ detailLine() }}</strong>
          </div>
        }

        <div class="wa-detail-line">
          <span class="wa-detail__label">Última verificación</span>
          <strong>{{ formatTimestamp(lastChecked()) }}</strong>
        </div>

        <button
          class="btn btn--primary"
          type="button"
          (click)="reconnect()"
          [disabled]="!canManageInfrastructure() || reconnecting() || status() === 'online'"
        >
          {{ reconnecting() ? 'Reconectando...' : 'Reconectar sesión' }}
        </button>

        @if (whatsappReconnectInfo()) {
          <p class="wa-reconnect-note">
            @if (whatsappReconnectInfo()?.code) {
              Código QR temporal: <strong>{{ whatsappReconnectInfo()!.code }}</strong>
            } @else if (whatsappReconnectInfo()?.count) {
              Reconexión en cola (#{{ whatsappReconnectInfo()!.count }})
            } @else {
              Reconectando...
            }
          </p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .wa-widget {
        border-radius: 20px;
        padding: 20px;
        background: linear-gradient(135deg, #0b1530, #131c38, #0f1427);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 20px 60px rgba(5, 10, 30, 0.4);
        color: #ecedf2;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .wa-widget__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .wa-widget__eyebrow {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.6);
      }

      .wa-widget__title {
        margin: 4px 0 0;
        font-size: 20px;
        font-weight: 600;
      }

      .wa-widget__body {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .wa-status-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }

      .status-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 14px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        font-weight: 600;
      }

      .status-indicator .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: currentColor;
        display: inline-block;
        box-shadow: 0 0 8px currentColor;
      }

      .status-indicator--online {
        color: #6ee7b7;
        background: rgba(110, 231, 183, 0.14);
      }

      .status-indicator--offline {
        color: #f87171;
        background: rgba(248, 113, 113, 0.15);
      }

      .status-indicator--checking {
        color: #a5b4fc;
        background: rgba(165, 180, 252, 0.18);
      }

      .status-indicator--warning {
        color: #facc15;
        background: rgba(250, 204, 21, 0.15);
      }

      .wa-detail {
        display: flex;
        flex-direction: column;
        max-width: 160px;
      }

      .wa-detail__label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: rgba(255, 255, 255, 0.5);
      }

      .wa-detail-line {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 13px;
      }

      .wa-detail-line strong {
        font-size: 14px;
      }

      .btn--primary {
        width: 100%;
      }

      .wa-reconnect-note {
        margin: 0;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      @media (max-width: 768px) {
        .wa-status-row {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class WhatsappStatusWidgetComponent implements OnInit {
  private adminOps = inject(AdminOpsService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  status = signal<ServiceStatus>('checking');
  connectionStatus = signal<'open' | 'connecting' | 'close' | null>(null);
  instanceName = signal<string | null>(null);
  detailLine = signal<string | null>(null);
  lastChecked = signal<Date | null>(null);
  refreshingStatus = signal(false);
  reconnecting = signal(false);
  whatsappReconnectInfo = signal<{ code?: string; count?: number } | null>(null);

  readonly statusLabel = (status: ServiceStatus) => ({
    online: 'En línea',
    offline: 'Offline',
    checking: 'Verificando...',
    warning: 'Advertencia',
  }[status]);

  ngOnInit() {
    this.loadStatus();
  }

  loadStatus() {
    if (this.refreshingStatus()) return;
    this.refreshingStatus.set(true);
    this.adminOps.getWhatsAppStatus().subscribe({
      next: (payload) => {
        this.status.set(payload.status);
        this.connectionStatus.set(payload.connectionStatus ?? null);
        this.instanceName.set(payload.instanceName ?? null);
        this.detailLine.set(payload.details ?? null);
        const parsedTimestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
        this.lastChecked.set(Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp);
        this.refreshingStatus.set(false);
      },
      error: () => {
        this.status.set('warning');
        this.refreshingStatus.set(false);
        this.lastChecked.set(new Date());
      },
    });
  }

  reconnect() {
    if (this.reconnecting() || !this.canManageInfrastructure()) return;
    this.reconnecting.set(true);
    this.adminOps.connectWhatsApp().subscribe({
      next: (info) => {
        this.whatsappReconnectInfo.set(info ?? null);
        if (info?.code) {
          this.toast.info('Escanea el QR desde WhatsApp para reconectar.');
        } else {
          this.toast.success('Reconexión iniciada.');
        }
        this.reconnecting.set(false);
      },
      error: () => {
        this.toast.error('No se pudo reconectar la instancia de WhatsApp');
        this.whatsappReconnectInfo.set(null);
        this.reconnecting.set(false);
      },
    });
  }

  formatConnection(value: 'open' | 'connecting' | 'close' | null): string {
    if (!value) return 'Pendiente';
    return value === 'open'
      ? 'Abierta'
      : value === 'connecting'
        ? 'Conectando'
        : 'Cerrada';
  }

  formatTimestamp(value: Date | null): string {
    if (!value) return 'Pendiente';
    return new Intl.DateTimeFormat('es-EC', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value);
  }

  canManageInfrastructure() {
    return this.auth.canManageInfrastructure();
  }
}
