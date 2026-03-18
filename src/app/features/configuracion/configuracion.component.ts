import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CoolifyService, CoolifyEnvVar } from '../../core/services/coolify.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

interface AuditRow {
  id: number;
  accion: string;
  detalle: Record<string, unknown>;
  created_at: string;
  profiles?: { nombre_completo: string; rol: string };
}

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [FormsModule, CommonModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Sistema</span>
      <h2 class="page-header__title">Configuración</h2>
      <p class="page-header__subtitle">Variables del gimnasio y sistema de cobros</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;" class="config-grid">

      <!-- Variables del sistema -->
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Variables n8n / Coolify</span>
        </div>
        <div style="padding:24px;">
          <div class="alert alert--warning" style="margin-bottom:20px;">
            Estos cambios actualizan las env vars en Coolify y se aplican en n8n en ~1 min.
            Se registran en el audit log.
          </div>

          @if (loading()) {
            <div style="padding:40px;text-align:center;color:#938C84;">Cargando configuración actual...</div>
          } @else {
          <form (ngSubmit)="onSave()">

            <div class="form-group">
              <label class="form-label">Nombre del Gimnasio</label>
              <input class="form-control" type="text" [(ngModel)]="cfg.nombre_gym" name="gym" placeholder="Jauría Strength and Fitness" />
            </div>

            <div class="form-group">
              <label class="form-label">Teléfono Coach (formato 593XXXXXXXXX)</label>
              <input class="form-control" type="text" [(ngModel)]="cfg.telefono_coach" name="tel" placeholder="593983936154" />
            </div>

            <div class="form-group">
              <label class="form-label">Correo Coach</label>
              <input class="form-control" type="email" [(ngModel)]="cfg.correo_coach" name="email" placeholder="coach@gym.com" />
            </div>

            <div class="form-group">
              <label class="form-label">Nombre Beneficiario (cuenta bancaria)</label>
              <input class="form-control" type="text" [(ngModel)]="cfg.beneficiario" name="benef" placeholder="APELLIDO NOMBRE" />
            </div>

            <div class="form-group">
              <label class="form-label">Número de Cuenta Bancaria</label>
              <input class="form-control" type="text" [(ngModel)]="cfg.cuenta_bancaria" name="cuenta" placeholder="2203266515" />
            </div>

            <div class="form-group">
              <label class="form-label">Días de recordatorio antes del vencimiento</label>
              <input class="form-control" type="number" [(ngModel)]="cfg.dias_recordatorio" name="dias" min="1" max="30" />
            </div>

            <div class="form-group">
              <label class="form-label">Bancos aceptados (separados por coma)</label>
              <input class="form-control" type="text" [(ngModel)]="cfg.bancos_aceptados" name="bancos" />
            </div>

            @if (successMsg()) {
              <div class="alert alert--success">{{ successMsg() }}</div>
            }
            @if (errorMsg()) {
              <div class="alert alert--error">{{ errorMsg() }}</div>
            }

            <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap;">
              <button type="submit" class="btn btn--primary" [disabled]="saving()">
                {{ saving() ? 'Guardando...' : 'Guardar Cambios' }}
              </button>
              <button type="button" class="btn btn--ghost" (click)="restartN8n()" [disabled]="restarting()">
                {{ restarting() ? 'Reiniciando...' : '↺ Restart n8n' }}
              </button>
            </div>
          </form>
          }
        </div>
      </div>

      <!-- Audit log -->
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Audit Log</span>
          <button class="btn btn--ghost btn--sm" (click)="loadAudit()" [disabled]="auditLoading()">↻</button>
        </div>
        @if (auditLoading()) {
          <div style="padding:40px;text-align:center;color:#938C84;">Cargando...</div>
        } @else if (auditRows().length === 0) {
          <div style="padding:40px;text-align:center;color:#938C84;">Sin registros aún.</div>
        } @else {
          <div style="max-height:500px;overflow-y:auto;">
            @for (row of auditRows(); track row.id) {
              <div style="padding:14px 20px;border-bottom:1px solid #2b3033;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                  <div>
                    <div style="font-family:'Manrope',sans-serif;font-size:13px;font-weight:600;color:#f4f1eb;">
                      {{ row.accion }}
                    </div>
                    @if (row.detalle['vars']) {
                      <div style="font-size:11px;color:#938C84;margin-top:3px;">
                        Vars: {{ $any(row.detalle['vars']).join(', ') }}
                      </div>
                    }
                    <div style="font-size:11px;color:#938C84;margin-top:2px;">
                      {{ row.profiles?.nombre_completo ?? 'Sistema' }}
                    </div>
                  </div>
                  <div style="font-size:11px;color:#938C84;white-space:nowrap;flex-shrink:0;">
                    {{ row.created_at | dateEc : 'dd/MM HH:mm' }}
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    @media (max-width: 1024px) { .config-grid { grid-template-columns: 1fr !important; } }
  `],
})
export class ConfiguracionComponent implements OnInit {
  private coolify  = inject(CoolifyService);
  private toast    = inject(ToastService);
  private auth     = inject(AuthService);
  private supabase = inject(SupabaseService);

  private readonly N8N_UUID = 'rwk0w08ggswcssc4c4ow4gwk';

  saving     = signal(false);
  restarting = signal(false);
  loading    = signal(true);
  successMsg = signal('');
  errorMsg   = signal('');

  auditRows    = signal<AuditRow[]>([]);
  auditLoading = signal(true);

  cfg = {
    nombre_gym:       '',
    telefono_coach:   '',
    correo_coach:     '',
    beneficiario:     '',
    cuenta_bancaria:  '',
    dias_recordatorio: '',
    bancos_aceptados: '',
  };

  private readonly keyMap: Record<string, keyof typeof this.cfg> = {
    NOMBRE_GYM:        'nombre_gym',
    TELEFONO_COACH:    'telefono_coach',
    CORREO_COACH:      'correo_coach',
    BENEFICIARIO:      'beneficiario',
    CUENTA_BANCARIA:   'cuenta_bancaria',
    DIAS_RECORDATORIO: 'dias_recordatorio',
    BANCOS_ACEPTADOS:  'bancos_aceptados',
  };

  ngOnInit() {
    this.loadEnvVars();
    this.loadAudit();
  }

  private loadEnvVars() {
    this.loading.set(true);
    this.coolify.getEnvVars(this.N8N_UUID).subscribe({
      next: (envs: CoolifyEnvVar[]) => {
        for (const env of envs) {
          const field = this.keyMap[env.key];
          if (field) {
            this.cfg[field] = env.value;
          }
        }
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudieron cargar las variables actuales');
        this.loading.set(false);
      },
    });
  }

  async loadAudit() {
    this.auditLoading.set(true);
    try {
      const { data, error } = await this.supabase.getAuditoria(30);
      if (error) {
        this.toast.error(error.message);
        return;
      }

      this.auditRows.set((data ?? []) as unknown as AuditRow[]);
    } catch {
      this.toast.error('No se pudo cargar el audit log');
    } finally {
      this.auditLoading.set(false);
    }
  }

  async onSave() {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    const vars = [
      { key: 'TELEFONO_COACH',   value: this.cfg.telefono_coach },
      { key: 'TELEFONO_ADMIN',   value: this.cfg.telefono_coach },
      { key: 'CORREO_COACH',     value: this.cfg.correo_coach },
      { key: 'CORREO_ADMIN',     value: this.cfg.correo_coach },
      { key: 'BENEFICIARIO',     value: this.cfg.beneficiario },
      { key: 'CUENTA_BANCARIA',  value: this.cfg.cuenta_bancaria },
      { key: 'DIAS_RECORDATORIO',value: this.cfg.dias_recordatorio },
      { key: 'BANCOS_ACEPTADOS', value: this.cfg.bancos_aceptados },
    ];

    this.coolify.updateEnvVars(this.N8N_UUID, vars).subscribe({
      next: async () => {
        const userId = this.auth.currentUser()?.id;
        if (userId) {
          await this.supabase.logAuditoria(userId, 'update_env_vars', {
            vars: vars.map(v => v.key),
            timestamp: new Date().toISOString(),
          });
          await this.loadAudit();
        }
        this.loadEnvVars();
        this.successMsg.set('Cambios aplicados. n8n los tomará en ~1 minuto.');
        this.toast.success('Configuración guardada en Coolify');
        this.saving.set(false);
        setTimeout(() => this.successMsg.set(''), 5000);
      },
      error: err => {
        this.errorMsg.set('Error Coolify: ' + (err.message ?? 'desconocido'));
        this.saving.set(false);
      },
    });
  }

  restartN8n() {
    this.restarting.set(true);
    this.coolify.restartService(this.N8N_UUID).subscribe({
      next: async () => {
        const userId = this.auth.currentUser()?.id;
        if (userId) await this.supabase.logAuditoria(userId, 'restart_n8n', {});
        this.toast.success('n8n reiniciando... tardará ~2 minutos en estar disponible.');
        this.restarting.set(false);
        await this.loadAudit();
      },
      error: () => {
        this.toast.error('No se pudo reiniciar n8n');
        this.restarting.set(false);
      },
    });
  }
}
