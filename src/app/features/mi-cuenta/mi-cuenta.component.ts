import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { PlanLabelPipe } from '../../shared/pipes/plan-label.pipe';
import { parseISO } from 'date-fns';

interface ClientePlan {
  estado: string;
  plan: string;
  monto_plan: number;
  fecha_vencimiento: string;
}

interface MiInscripcion {
  clase_id: number;
  clases?: {
    tipo: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    cancelada: boolean;
  };
}

interface ClaseDisponible {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cancelada: boolean;
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
      @if (auth.rol() === 'atleta' && cliente()) {
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
            <div class="stat-card">
              <div class="stat-card__label">Próxima Clase</div>
              @if (proximaClase()) {
                <div style="font-size:18px;color:#fff;margin-top:4px;">
                  {{ proximaClase()!.tipo }}
                </div>
                <div style="font-size:13px;color:#938C84;margin-top:6px;">
                  {{ proximaClase()!.fecha | dateEc: 'EEEE dd/MM' }}
                  · {{ proximaClase()!.hora_inicio }} – {{ proximaClase()!.hora_fin }}
                </div>
              } @else {
                <div style="font-size:14px;color:#938C84;margin-top:4px;">
                  No tienes clases futuras inscritas.
                </div>
              }
            </div>
            <div class="stat-card">
              <div class="stat-card__label">Clases Disponibles</div>
              <div style="font-size:18px;color:#fff;margin-top:4px;">
                {{ clasesDisponibles() }}
              </div>
              <div style="font-size:13px;color:#938C84;margin-top:6px;">
                Próximas clases a las que aún puedes inscribirte.
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
export class MiCuentaComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  nombre = '';
  saving = signal(false);
  perfilMsg = signal('');
  cliente = signal<ClientePlan | null>(null);
  proximaClase = signal<NonNullable<MiInscripcion['clases']> | null>(null);
  clasesDisponibles = signal(0);
  private perfilMsgTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private claseStart(fecha: string, horaInicio: string): number {
    return parseISO(`${fecha}T${horaInicio}`).getTime();
  }

  private claseEnd(fecha: string, horaInicio: string, horaFin?: string): number {
    return parseISO(`${fecha}T${horaFin ?? horaInicio}`).getTime();
  }

  async ngOnInit() {
    this.nombre = this.auth.profile()?.nombre_completo ?? '';

    const idCliente = this.auth.profile()?.id_cliente;
    if (idCliente) {
      const { data } = await this.supabase.getCliente(idCliente);
      this.cliente.set(data as ClientePlan);
    }

    const userId = this.auth.currentUser()?.id;
    if (userId && this.auth.rol() === 'atleta') {
      const [inscripcionesRes, clasesRes] = await Promise.all([
        this.supabase.getInscripcionesByUser(userId),
        this.supabase.getClasesDesde(new Date().toISOString().slice(0, 10)),
      ]);

      const inscripciones = ((inscripcionesRes.data ?? []) as unknown as MiInscripcion[])
        .filter((inscripcion) =>
          Boolean(
            inscripcion.clases &&
            !inscripcion.clases.cancelada &&
            this.claseEnd(
              inscripcion.clases.fecha,
              inscripcion.clases.hora_inicio,
              inscripcion.clases.hora_fin,
            ) > Date.now(),
          ),
        );

      const proxima = inscripciones
        .map((inscripcion) => inscripcion.clases)
        .filter((clase): clase is NonNullable<MiInscripcion['clases']> => Boolean(clase))
        .sort(
          (a, b) =>
            this.claseStart(a.fecha, a.hora_inicio)
            - this.claseStart(b.fecha, b.hora_inicio),
        )[0] ?? null;

      this.proximaClase.set(proxima);

      const inscritosIds = new Set(inscripciones.map((inscripcion) => inscripcion.clase_id));
      const disponibles = ((clasesRes.data ?? []) as unknown as ClaseDisponible[])
        .filter(
          (clase) =>
            !clase.cancelada
            && this.claseEnd(clase.fecha, clase.hora_inicio, clase.hora_fin) > Date.now()
            && !inscritosIds.has(clase.id),
        ).length;

      this.clasesDisponibles.set(disponibles);
    }
  }

  async onSavePerfil() {
    const userId = this.auth.currentUser()?.id;
    if (!userId || !this.nombre) return;
    this.saving.set(true);
    const { error } = await this.supabase.updateProfile(userId, { nombre_completo: this.nombre.trim() });
    this.saving.set(false);

    if (error) {
      this.toast.error('No se pudo actualizar el perfil');
      return;
    }

    this.perfilMsg.set('Perfil actualizado');
    this.toast.success('Perfil actualizado');
    if (this.perfilMsgTimeoutId) clearTimeout(this.perfilMsgTimeoutId);
    this.perfilMsgTimeoutId = setTimeout(() => this.perfilMsg.set(''), 3000);
  }

  ngOnDestroy() {
    if (this.perfilMsgTimeoutId) clearTimeout(this.perfilMsgTimeoutId);
  }
}
