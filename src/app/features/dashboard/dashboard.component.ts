import { Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SupabaseService } from '../../core/services/supabase.service';
import { N8nService } from '../../core/services/n8n.service';
import { EvolutionService } from '../../core/services/evolution.service';
import { ToastService } from '../../core/services/toast.service';

Chart.register(...registerables);

interface KPI { label: string; value: string | number; trend?: string; trendUp?: boolean; icon?: string; }
interface Alerta { tipo: string; titulo: string; msg: string; }
type ServiceStatus = 'online' | 'offline' | 'checking' | 'warning';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Sistema</span>
      <h2 class="page-header__title">Dashboard</h2>
    </div>

    <!-- ── KPIs ── -->
    <div class="stats-grid" style="margin-bottom:28px;">
      @for (kpi of kpis(); track kpi.label) {
        <div class="stat-card">
          <div class="stat-card__label">{{ kpi.label }}</div>
          <div class="stat-card__value" style="margin-top:8px;">{{ kpi.value }}</div>
          @if (kpi.trend) {
            <div class="stat-card__trend" [class.up]="kpi.trendUp" [class.down]="!kpi.trendUp">
              {{ kpi.trend }}
            </div>
          }
        </div>
      }
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;" class="charts-grid">

      <!-- Gráfico cobros 6 meses -->
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Cobros (últimos 6 meses)</span>
        </div>
        <div style="padding:20px;">
          <canvas #barChart style="max-height:200px;"></canvas>
        </div>
      </div>

      <!-- Gráfico distribución planes -->
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Distribución por Plan</span>
        </div>
        <div style="padding:20px;display:flex;align-items:center;justify-content:center;">
          <canvas #donutChart style="max-height:200px;max-width:200px;"></canvas>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;" class="bottom-grid">

      <!-- Estado de servicios -->
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Estado de Servicios</span>
          <button class="btn btn--ghost btn--sm" (click)="refreshStatus()">↻</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">

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
              <div class="service-card__name">WhatsApp · jauriaCrossfit</div>
              <div class="service-card__detail">Evolution API</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="status-indicator" [class]="'status-indicator--' + waStatus()">
                <div class="dot"></div>{{ statusLabel(waStatus()) }}
              </div>
              @if (waStatus() !== 'online') {
                <button class="btn btn--ghost btn--sm" (click)="reconectarWA()">Reconectar</button>
              }
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

      <!-- Alertas + actividad -->
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Alertas Activas</span>
        </div>
        <div style="padding:16px;">
          @if (alertas().length === 0) {
            <div style="text-align:center;padding:24px;color:#4caf50;">
              ✓ Sin alertas activas
            </div>
          } @else {
            @for (a of alertas(); track a.titulo) {
              <div class="alert alert--{{ a.tipo }}" style="margin-bottom:8px;">
                <strong>{{ a.titulo }}</strong> — {{ a.msg }}
              </div>
            }
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    @media (max-width: 1024px) {
      .charts-grid, .bottom-grid { grid-template-columns: 1fr !important; }
    }
  `],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('barChart')   barChartEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutChart') donutChartEl!: ElementRef<HTMLCanvasElement>;

  private supabase = inject(SupabaseService);
  private n8n      = inject(N8nService);
  private evolution = inject(EvolutionService);
  private toast    = inject(ToastService);

  kpis      = signal<KPI[]>([]);
  alertas   = signal<Alerta[]>([]);
  n8nStatus = signal<ServiceStatus>('checking');
  waStatus  = signal<ServiceStatus>('offline');
  wfCount   = signal(0);

  private barChartInstance?: Chart;
  private donutChartInstance?: Chart;

  ngOnInit()        { this.loadData(); this.refreshStatus(); }
  ngAfterViewInit() { /* charts se crean después de loadData */ }

  ngOnDestroy() {
    this.barChartInstance?.destroy();
    this.donutChartInstance?.destroy();
  }

  async loadData() {
    const [clientes, pagos, convs, leads] = await Promise.all([
      this.supabase.getClientes(),
      this.supabase.getHistorialPagos(),
      this.supabase.getConversacionesActivas(),
      this.supabase.getLeads(),
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

    this.kpis.set([
      { label: 'Clientes Activos',  value: activos,              trend: `${total} total`,         trendUp: true,          icon: '👥' },
      { label: 'Total Cobrado',     value: `$${totalCobrado.toFixed(0)}`, trend: `${pd.length} pagos`,  trendUp: true,  icon: '💰' },
      { label: 'Tasa de Pago',      value: `${tasaPago}%`,       trend: tasaPago >= 70 ? 'Saludable' : 'Revisar',  trendUp: tasaPago >= 70, icon: '📈' },
      { label: 'Conv. Activas WA',  value: cvd.length,           icon: '💬' },
      { label: 'Leads Landing',     value: ld.length,            icon: '📋' },
    ]);

    // Alertas
    const alerts: Alerta[] = [];
    if (vencidos > 0) alerts.push({ tipo: 'warning', titulo: 'Clientes Vencidos', msg: `${vencidos} con membresía vencida` });
    if (cvd.length > 0) alerts.push({ tipo: 'info', titulo: 'Conversaciones WA', msg: `${cvd.length} conversación(es) esperando respuesta` });
    this.alertas.set(alerts);

    // Charts después del DOM
    setTimeout(() => this.initCharts(pd, cd), 100);
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
        datasets: [{ label: 'USD cobrados', data: totals, backgroundColor: 'rgba(183,28,28,0.7)', borderColor: '#B71C1C', borderWidth: 1, borderRadius: 4 }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#666' }, grid: { color: '#1e1e1e' } },
          y: { ticks: { color: '#666', callback: v => `$${v}` }, grid: { color: '#1e1e1e' } },
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
        datasets: [{ data: counts, backgroundColor: ['rgba(183,28,28,0.8)', 'rgba(156,39,176,0.8)', 'rgba(255,152,0,0.8)'], borderColor: '#141414', borderWidth: 2 }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#aaa', padding: 12, font: { size: 12 } } },
        },
      },
    };
    this.donutChartInstance = new Chart(this.donutChartEl.nativeElement, cfg);
  }

  refreshStatus() {
    this.n8nStatus.set('checking');
    this.n8n.getWorkflows().subscribe({
      next: res => { this.wfCount.set(res.data?.filter(w => w.active).length ?? 0); this.n8nStatus.set('online'); },
      error: () => this.n8nStatus.set('offline'),
    });
    this.evolution.getInstances().subscribe({
      next: instances => {
        const list = Array.isArray(instances) ? instances : [instances];
        const j = list.find(i => i.instance?.instanceName === 'jauriaCrossfit');
        this.waStatus.set(j?.instance?.connectionStatus === 'open' ? 'online' : 'offline');
        if (j?.instance?.connectionStatus !== 'open') {
          this.alertas.update(a => {
            const f = a.filter(al => al.titulo !== 'WhatsApp Desconectada');
            return [...f, { tipo: 'error', titulo: 'WhatsApp Desconectada', msg: 'Instancia jauriaCrossfit offline — requiere QR' }];
          });
        }
      },
      error: () => this.waStatus.set('offline'),
    });
  }

  reconectarWA() {
    this.evolution.connectInstance().subscribe({
      next: res => { if (res?.code) this.toast.info('Escanea el QR desde WhatsApp para reconectar.'); },
      error: () => this.toast.error('No se pudo conectar con Evolution API'),
    });
  }

  statusLabel(s: ServiceStatus): string {
    return { online: 'En línea', offline: 'Offline', checking: 'Verificando...', warning: 'Advertencia' }[s];
  }
}
