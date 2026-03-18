import { Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SupabaseService } from '../../core/services/supabase.service';
import { AdminOpsService } from '../../core/services/admin-ops.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { WhatsappStatusWidgetComponent } from './whatsapp-status-widget/whatsapp-status-widget.component';

Chart.register(...registerables);

interface KPI {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  actionLabel?: string;
  actionHint?: string;
}
interface Alerta { tipo: string; titulo: string; msg: string; }
type ServiceStatus = 'online' | 'offline' | 'checking' | 'warning';

const BRAND_CHART = {
  primaryFill: 'rgba(29, 78, 137, 0.82)',
  primaryBorder: '#1d4e89',
  planMonthlyFill: 'rgba(23, 121, 103, 0.86)',
  planQuarterlyFill: 'rgba(212, 137, 26, 0.86)',
  planAnnualFill: 'rgba(111, 76, 155, 0.82)',
  surface: '#151718',
  grid: 'rgba(58, 64, 68, 0.6)',
  tick: '#938c84',
  legend: '#d2cbc1',
  fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, WhatsappStatusWidgetComponent],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">{{ auth.canViewTechnicalDashboard() ? 'Sistema' : 'Operación' }}</span>
      <h2 class="page-header__title">Dashboard</h2>
      <p class="page-header__subtitle">
        {{ auth.canViewTechnicalDashboard()
          ? 'Control operativo del box y salud técnica del sistema.'
          : 'Resumen operativo del box para seguimiento diario del coach.' }}
      </p>
    </div>

    <div class="dashboard-kpis stats-grid">
      @for (kpi of kpis(); track kpi.label) {
        <div class="stat-card">
          <div class="stat-card__label">{{ kpi.label }}</div>
          <div class="dashboard-kpi-value stat-card__value">{{ kpi.value }}</div>
          @if (kpi.actionLabel) {
            <button class="btn btn--secondary btn--sm dashboard-kpi-action" type="button" (click)="handleKpiAction(kpi)">
              {{ kpi.actionLabel }}
            </button>
            @if (kpi.actionHint) {
              <div class="stat-card__trend">{{ kpi.actionHint }}</div>
            }
          } @else if (kpi.trend) {
            <div class="stat-card__trend" [class.up]="kpi.trendUp" [class.down]="!kpi.trendUp">
              {{ kpi.trend }}
            </div>
          }
        </div>
      }
    </div>

    <div class="charts-grid dashboard-grid">
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Cobros (últimos 6 meses)</span>
        </div>
        <div class="dashboard-card-body">
          <canvas #barChart class="dashboard-chart-canvas"></canvas>
        </div>
      </div>

      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Distribución por Plan</span>
        </div>
        <div class="dashboard-card-body dashboard-card-body--centered">
          <canvas #donutChart class="dashboard-chart-canvas dashboard-chart-canvas--donut"></canvas>
        </div>
      </div>
    </div>

    <div class="bottom-grid dashboard-grid" [class.dashboard-grid--single]="!auth.canViewTechnicalDashboard()">
      <div class="data-table-wrapper whatsapp-widget-column">
        <app-whatsapp-status-widget></app-whatsapp-status-widget>
      </div>
      @if (auth.canViewTechnicalDashboard()) {
        <div class="data-table-wrapper">
          <div class="data-table-wrapper__header">
            <span class="data-table-wrapper__title">Estado de Servicios</span>
            <button class="btn btn--ghost btn--sm" (click)="refreshStatus()" [disabled]="refreshingStatus()">↻</button>
          </div>
          <div class="dashboard-status-body">
            <div class="service-card">
              <div>
                <div class="service-card__name">n8n</div>
                <div class="service-card__detail">{{ wfCount() }} workflows activos</div>
              </div>
              <div class="status-indicator" [class]="'status-indicator--' + n8nStatus()">
                <div class="dot"></div>{{ statusLabel(n8nStatus()) }}
              </div>
            </div>

            <div class="service-card">
              <div>
                <div class="service-card__name">Supabase</div>
                <div class="service-card__detail">PostgreSQL 17.6 · us-east-1</div>
              </div>
              <div class="status-indicator status-indicator--online">
                <div class="dot"></div>Healthy
              </div>
            </div>
          </div>
        </div>
      }

      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">{{ auth.canViewTechnicalDashboard() ? 'Alertas Activas' : 'Alertas Operativas' }}</span>
        </div>
        <div class="dashboard-alerts-body">
          @if (alertas().length === 0) {
            <div class="dashboard-alerts-empty">
              Sin alertas activas
            </div>
          } @else {
            @for (a of alertas(); track a.titulo) {
              <div class="alert dashboard-alert alert--{{ a.tipo }}">
                <strong>{{ a.titulo }}</strong> — {{ a.msg }}
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-kpis {
      margin-bottom: 28px;
    }

    .dashboard-kpi-value {
      margin-top: 8px;
    }

    .dashboard-kpi-action {
      margin-top: 12px;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }

    .dashboard-grid--single {
      grid-template-columns: minmax(0, 1fr);
    }

    .charts-grid {
      margin-bottom: 28px;
    }

    .dashboard-card-body {
      padding: 20px;
    }

    .dashboard-chart-canvas {
      display: block;
      width: 100%;
      max-height: 200px;
    }

    .dashboard-chart-canvas--donut {
      max-width: 200px;
    }

    .dashboard-card-body--centered {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dashboard-status-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .whatsapp-widget-column {
      min-height: 100%;
    }

    .dashboard-alerts-body {
      padding: 16px;
    }

    .dashboard-alerts-empty {
      padding: 24px;
      text-align: center;
      color: #938c84;
    }

    .dashboard-alert {
      margin-bottom: 8px;
    }

    .dashboard-service-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    @media (max-width: 1024px) {
      .charts-grid, .bottom-grid { grid-template-columns: 1fr !important; }
    }
  `],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('barChart')   barChartEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutChart') donutChartEl!: ElementRef<HTMLCanvasElement>;

  private supabase = inject(SupabaseService);
  private adminOps = inject(AdminOpsService);
  private toast    = inject(ToastService);
  private router   = inject(Router);
  protected auth   = inject(AuthService);

  kpis      = signal<KPI[]>([]);
  alertas   = signal<Alerta[]>([]);
  n8nStatus = signal<ServiceStatus>('checking');
  wfCount   = signal(0);
  refreshingStatus = signal(false);

  private barChartInstance?: Chart;
  private donutChartInstance?: Chart;
  private chartsInitTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit()        { this.loadData(); if (this.auth.canViewTechnicalDashboard()) this.refreshStatus(); }
  ngAfterViewInit() { /* charts se crean después de loadData */ }

  ngOnDestroy() {
    if (this.chartsInitTimeoutId) clearTimeout(this.chartsInitTimeoutId);
    this.barChartInstance?.destroy();
    this.donutChartInstance?.destroy();
  }

  async loadData() {
    const [clientes, pagos, convs, leads] = await Promise.all([
      this.supabase.getClientes(),
      this.supabase.getHistorialPagos(),
      this.auth.canViewTechnicalDashboard() ? this.supabase.getConversacionesActivas() : Promise.resolve({ data: [], error: null }),
      this.auth.canViewLeadInbox() ? this.supabase.getLeads() : Promise.resolve({ data: [], error: null }),
    ]);

    const cd = (clientes.data ?? []) as Record<string, unknown>[];
    const pd = (pagos.data ?? []) as Record<string, unknown>[];
    const cvd = (convs.data ?? []) as Record<string, unknown>[];
    const ld = (leads.data ?? []) as Record<string, unknown>[];

    const activos = cd.filter(c => c['estado'] === 'Activo').length;
    const vencidos = cd.filter(c => c['estado'] === 'Vencido').length;
    const total = cd.length;
    const tasaPago = total ? Math.round(activos / total * 100) : 0;
    const totalCobrado = pd.reduce((s, p) => s + Number(p['monto'] ?? 0), 0);
    const pendingPayments = pd.filter((p) => this.paymentStatusBadge(String(p['estado'] ?? '')) !== 'completado');
    const pagosPendientes = pendingPayments.length;
    const nextPendingPayment = pendingPayments[0] ?? null;
    const nestedClientName = nextPendingPayment?.['clientes'] && typeof nextPendingPayment['clientes'] === 'object'
      ? String((nextPendingPayment['clientes'] as Record<string, unknown>)['nombre_completo'] ?? '')
      : '';
    const pendingClientName = String(nextPendingPayment?.['nombre_cliente'] ?? nestedClientName).trim();
    const pendingClientId = String(nextPendingPayment?.['id_cliente'] ?? '').trim();

    const kpis: KPI[] = [
      { label: 'Clientes Activos', value: activos, trend: `${total} total`, trendUp: true },
      { label: 'Total Cobrado', value: `$${totalCobrado.toFixed(0)}`, trend: `${pd.length} pagos`, trendUp: true },
      { label: 'Tasa de Pago', value: `${tasaPago}%`, trend: tasaPago >= 70 ? 'Saludable' : 'Revisar', trendUp: tasaPago >= 70 },
      {
        label: 'Pagos Pendientes',
        value: pagosPendientes,
        trend: pagosPendientes === 0 ? 'Al día' : undefined,
        trendUp: pagosPendientes === 0,
        actionLabel: pagosPendientes > 0 ? 'Revisar cobro' : undefined,
        actionHint: pagosPendientes > 0
          ? `${pendingClientName || 'Cliente pendiente'}${pendingClientId ? ` · ${pendingClientId}` : ''}`
          : undefined,
      },
      { label: 'Clientes Vencidos', value: vencidos, trend: vencidos === 0 ? 'Sin alertas' : 'Seguimiento requerido', trendUp: vencidos === 0 },
    ];

    if (this.auth.canViewLeadInbox()) {
      kpis.push({ label: 'Leads Landing', value: ld.length });
    }

    this.kpis.set(kpis);

    // Alertas
    const alerts: Alerta[] = [];
    if (vencidos > 0) alerts.push({ tipo: 'warning', titulo: 'Clientes Vencidos', msg: `${vencidos} con membresía vencida` });
    if (pagosPendientes > 0) alerts.push({ tipo: 'info', titulo: 'Pagos Pendientes', msg: `${pagosPendientes} pago(s) requieren revisión` });
    if (this.auth.canViewTechnicalDashboard() && cvd.length > 0) {
      alerts.push({ tipo: 'info', titulo: 'Conversaciones WA', msg: `${cvd.length} conversación(es) esperando respuesta` });
    }
    this.alertas.set(alerts);

    // Charts después del DOM
    if (this.chartsInitTimeoutId) clearTimeout(this.chartsInitTimeoutId);
    this.chartsInitTimeoutId = setTimeout(() => this.initCharts(pd, cd), 100);
  }

  private initCharts(pagos: Record<string, unknown>[], clientes: Record<string, unknown>[]) {
    this.buildBarChart(pagos);
    this.buildDonutChart(clientes);
  }

  private buildBarChart(pagos: Record<string, unknown>[]) {
    if (!this.barChartEl) return;
    this.barChartInstance?.destroy();

    // Agrupar por mes (últimos 6)
    const months: string[] = [];
    const totals: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('es', { month: 'short', year: '2-digit' });
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = pagos
        .filter(p => String(p['fecha_pago'] ?? '').startsWith(ym))
        .reduce((s, p) => s + Number(p['monto'] ?? 0), 0);
      months.push(label);
      totals.push(total);
    }

    const cfg: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'USD cobrados',
          data: totals,
          backgroundColor: BRAND_CHART.primaryFill,
          borderColor: BRAND_CHART.primaryBorder,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: BRAND_CHART.tick, font: { family: BRAND_CHART.fontFamily, size: 11 } },
            grid: { color: BRAND_CHART.grid },
          },
          y: {
            ticks: {
              color: BRAND_CHART.tick,
              callback: (v) => `$${v}`,
              font: { family: BRAND_CHART.fontFamily, size: 11 },
            },
            grid: { color: BRAND_CHART.grid },
          },
        },
      },
    };
    this.barChartInstance = new Chart(this.barChartEl.nativeElement, cfg);
  }

  private buildDonutChart(clientes: Record<string, unknown>[]) {
    if (!this.donutChartEl) return;
    this.donutChartInstance?.destroy();

    const planes = ['MENSUAL', 'TRIMESTRAL', 'ANUAL'];
    const counts = planes.map(p => clientes.filter(c => c['plan'] === p).length);

    const cfg: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: ['Mensual', 'Trimestral', 'Anual'],
        datasets: [{
          data: counts,
          backgroundColor: [
            BRAND_CHART.planMonthlyFill,
            BRAND_CHART.planQuarterlyFill,
            BRAND_CHART.planAnnualFill,
          ],
          borderColor: BRAND_CHART.surface,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: BRAND_CHART.legend,
              padding: 12,
              font: { family: BRAND_CHART.fontFamily, size: 12, weight: 600 },
            },
          },
        },
      },
    };
    this.donutChartInstance = new Chart(this.donutChartEl.nativeElement, cfg);
  }

  refreshStatus() {
    if (!this.auth.canViewTechnicalDashboard() || this.refreshingStatus()) return;

    this.refreshingStatus.set(true);
    this.n8nStatus.set('checking');

    this.adminOps.getOpsStatus().subscribe({
      next: (status) => {
        this.wfCount.set(Number(status.n8n.activeWorkflows ?? 0));
        this.n8nStatus.set(status.n8n.status);
        this.alertas.update((current) => {
          const filtered = current.filter((alert) =>
            ![
              'WhatsApp Desconectada',
              'WhatsApp desconectada',
              'n8n no verificado',
              'Evolution no verificado',
              'Supabase no verificado',
            ].includes(alert.titulo),
          );

          return [...filtered, ...status.alerts];
        });
        this.refreshingStatus.set(false);
      },
      error: () => {
        this.n8nStatus.set('warning');
        this.refreshingStatus.set(false);
      },
    });
  }

  statusLabel(s: ServiceStatus): string {
    return { online: 'En línea', offline: 'Offline', checking: 'Verificando...', warning: 'Advertencia' }[s];
  }

  handleKpiAction(kpi: KPI) {
    if (kpi.label !== 'Pagos Pendientes') return;
    void this.router.navigate(['/app/pagos']);
  }

  private paymentStatusBadge(estado: string): 'completado' | 'pendiente' | 'otro' {
    const normalized = (estado ?? '').trim().toLowerCase();
    if (['completado', 'confirmado', 'approved', 'aprobado', 'success', 'exitoso'].includes(normalized)) {
      return 'completado';
    }
    if (['pendiente', 'pending'].includes(normalized)) {
      return 'pendiente';
    }
    return 'otro';
  }
}
