import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { PlanLabelPipe } from '../../shared/pipes/plan-label.pipe';

interface ClientePlan {
  estado: string;
  plan: string;
  monto_plan: number;
  fecha_vencimiento: string;
}

@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [FormsModule, CommonModule, DateEcPipe, PlanLabelPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Personal</span>
      <h2 class="page-header__title">Mi Cuenta</h2>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:900px;" class="cuenta-grid">

      <!-- Perfil -->
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Perfil</span>
        </div>
        <div style="padding:24px;">
          <form (ngSubmit)="onSavePerfil()">
            <div class="form-group">
              <label class="form-label">Nombre Completo</label>
              <input type="text" class="form-control" [(ngModel)]="nombre" name="nombre" />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" [value]="auth.profile()?.email ?? ''" disabled />
            </div>
            <div class="form-group">
              <label class="form-label">Rol</label>
              <input type="text" class="form-control" [value]="auth.rol() ?? ''" disabled />
            </div>
            @if (perfilMsg()) {
              <div class="alert alert--success">{{ perfilMsg() }}</div>
            }
            <button type="submit" class="btn btn--primary" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Guardar' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Estado de pago (solo usuarios) -->
      @if (auth.rol() === 'usuario' && cliente()) {
        <div class="data-table-wrapper">
          <div class="data-table-wrapper__header">
            <span class="data-table-wrapper__title">Mi Plan</span>
          </div>
          <div style="padding:24px;display:flex;flex-direction:column;gap:16px;">
            <div class="stat-card">
              <div class="stat-card__label">Estado</div>
              <div style="margin-top:8px;">
                <span class="badge badge--{{ cliente()!.estado.toLowerCase() }}">
                  {{ cliente()!.estado }}
                </span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-card__label">Plan Actual</div>
              <div style="font-size:18px;color:#fff;margin-top:4px;">
                {{ cliente()!.plan | planLabel : cliente()!.monto_plan }}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-card__label">Vencimiento</div>
              <div style="font-size:16px;color:#fff;margin-top:4px;">
                {{ cliente()!.fecha_vencimiento | dateEc }}
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @media (max-width: 768px) {
      .cuenta-grid { grid-template-columns: 1fr !important; }
    }
  `],
})
export class MiCuentaComponent implements OnInit {
  auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  nombre = '';
  saving = signal(false);
  perfilMsg = signal('');
  cliente = signal<ClientePlan | null>(null);

  async ngOnInit() {
    this.nombre = this.auth.profile()?.nombre_completo ?? '';

    const idCliente = this.auth.profile()?.id_cliente;
    if (idCliente) {
      const { data } = await this.supabase.getCliente(idCliente);
      this.cliente.set(data as ClientePlan);
    }
  }

  async onSavePerfil() {
    const userId = this.auth.currentUser()?.id;
    if (!userId || !this.nombre) return;
    this.saving.set(true);
    await this.supabase.updateProfile(userId, { nombre_completo: this.nombre });
    this.saving.set(false);
    this.perfilMsg.set('Perfil actualizado');
    this.toast.success('Perfil actualizado');
    setTimeout(() => this.perfilMsg.set(''), 3000);
  }
}
