import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { N8nService, WorkflowSummary, Execution } from '../../core/services/n8n.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

@Pipe({ name: 'activeCount', standalone: true })
export class ActiveCountPipe implements PipeTransform {
  transform(wfs: WorkflowSummary[]): number { return wfs.filter(w => w.active).length; }
}

@Component({
  selector: 'app-workflows',
  standalone: true,
  imports: [CommonModule, DateEcPipe, ActiveCountPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Sistema</span>
      <h2 class="page-header__title">Workflows n8n</h2>
      <p class="page-header__subtitle">
        {{ workflows().length }} workflows ·
        <span style="color:#4caf50;">{{ workflows() | activeCount }} activos</span>
      </p>
    </div>

    @if (loading()) {
      <div style="text-align:center;padding:60px;color:#666;">Cargando...</div>
    } @else {
      <div style="display:grid;gap:16px;margin-bottom:32px;">
        @for (wf of workflows(); track wf.id) {
          <div class="data-table-wrapper">
            <div class="data-table-wrapper__header">
              <div style="display:flex;align-items:center;gap:12px;">
                <div class="status-indicator" [class]="wf.active ? 'status-indicator--online' : 'status-indicator--offline'">
                  <div class="dot"></div>
                </div>
                <div>
                  <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:0.05em;color:#fff;">{{ wf.name }}</div>
                  <div style="font-size:11px;color:#555;font-family:'Inter',sans-serif;">ID: {{ wf.id }}</div>
                </div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn--sm" [class]="wf.active ? 'btn--danger' : 'btn--primary'"
                  (click)="toggleWorkflow(wf)" [disabled]="toggling() === wf.id">
                  {{ toggling() === wf.id ? '...' : (wf.active ? 'Desactivar' : 'Activar') }}
                </button>
                <button class="btn btn--ghost btn--sm" (click)="loadExecutions(wf.id)">
                  {{ expandedWf() === wf.id ? '▲ Ocultar' : '▼ Ejecuciones' }}
                </button>
              </div>
            </div>

            @if (expandedWf() === wf.id) {
              <div style="padding:0 0 8px;">
                @if (execLoading()) {
                  <div style="padding:20px;text-align:center;color:#666;font-size:13px;">Cargando ejecuciones...</div>
                } @else if (executions().length === 0) {
                  <div style="padding:20px;text-align:center;color:#666;font-size:13px;">Sin ejecuciones recientes.</div>
                } @else {
                  <table class="data-table">
                    <thead>
                      <tr><th>ID</th><th>Modo</th><th>Estado</th><th>Inicio</th><th>Fin</th></tr>
                    </thead>
                    <tbody>
                      @for (ex of executions(); track ex.id) {
                        <tr>
                          <td style="font-size:12px;font-family:monospace;color:#666;">{{ ex.id }}</td>
                          <td style="font-size:12px;">{{ ex.mode }}</td>
                          <td><span class="badge badge--{{ exBadge(ex.status) }}">{{ ex.status }}</span></td>
                          <td style="font-size:12px;">{{ ex.startedAt | dateEc : 'dd/MM HH:mm' }}</td>
                          <td style="font-size:12px;">{{ ex.stoppedAt | dateEc : 'dd/MM HH:mm' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class WorkflowsComponent implements OnInit {
  private n8n   = inject(N8nService);
  private toast = inject(ToastService);

  workflows   = signal<WorkflowSummary[]>([]);
  executions  = signal<Execution[]>([]);
  loading     = signal(true);
  execLoading = signal(false);
  toggling    = signal<string | null>(null);
  expandedWf  = signal<string | null>(null);

  ngOnInit() {
    this.n8n.getWorkflows().subscribe({
      next: res => { this.workflows.set(res.data ?? []); this.loading.set(false); },
      error: err => { this.toast.error('Error: ' + err.message); this.loading.set(false); },
    });
  }

  toggleWorkflow(wf: WorkflowSummary) {
    this.toggling.set(wf.id);
    const action$ = wf.active ? this.n8n.deactivateWorkflow(wf.id) : this.n8n.activateWorkflow(wf.id);
    action$.subscribe({
      next: () => {
        this.workflows.update(list => list.map(w => w.id === wf.id ? { ...w, active: !w.active } : w));
        this.toast.success(`Workflow ${wf.active ? 'desactivado' : 'activado'}`);
        this.toggling.set(null);
      },
      error: err => { this.toast.error(err.message); this.toggling.set(null); },
    });
  }

  loadExecutions(wfId: string) {
    if (this.expandedWf() === wfId) { this.expandedWf.set(null); return; }
    this.expandedWf.set(wfId);
    this.execLoading.set(true);
    this.executions.set([]);
    this.n8n.getExecutions(wfId, 10).subscribe({
      next: res => { this.executions.set(res.data ?? []); this.execLoading.set(false); },
      error: () => this.execLoading.set(false),
    });
  }

  exBadge(status: string): string {
    return ({ success: 'activo', error: 'fallido', waiting: 'esperando', running: 'pendiente' } as Record<string, string>)[status] ?? 'inactivo';
  }
}
