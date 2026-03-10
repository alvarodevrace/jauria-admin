import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SentryService } from '../../core/services/sentry.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isWithinInterval,
  parseISO,
  differenceInMinutes,
} from 'date-fns';
import { es } from 'date-fns/locale';

interface Clase {
  id: number;
  tipo: string;
  descripcion: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  capacidad_maxima: number;
  coach_id: string;
  cancelada: boolean;
  profiles?: { nombre_completo: string };
}

interface Inscripcion {
  id: number;
  clase_id: number;
  user_id: string;
  estado: string;
  profiles?: { nombre_completo: string; avatar_url: string };
}

type Vista = 'semana' | 'lista';

@Component({
  selector: 'app-clases',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Calendario</span>
      <h2 class="page-header__title">Clases</h2>
    </div>

    <!-- Alerta membresía inactiva (solo atletas) -->
    @if (!auth.isCoach() && membresiaActiva() === false) {
      <div class="alert alert--error" style="margin-bottom:20px;">
        <strong>Membresía inactiva</strong> — Tu plan no está activo. No puedes
        inscribirte a clases. Ve a <strong>Mi Pago</strong> para ver el estado
        de tu membresía o contacta al coach.
      </div>
    }

    <!-- Toolbar -->
    <div
      style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;"
    >
      <!-- Navegación de semana -->
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn--ghost btn--sm" (click)="semanaAnterior()">
          ‹
        </button>
        <span
          style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:0.05em;color:#fff;"
        >
          {{ semanaLabel() }}
        </span>
        <button class="btn btn--ghost btn--sm" (click)="semanaSiguiente()">
          ›
        </button>
        <button class="btn btn--ghost btn--sm" (click)="irHoy()">Hoy</button>
      </div>
      <!-- Vista + acciones -->
      <div style="display:flex;gap:10px;align-items:center;">
        <div
          style="display:flex;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;"
        >
          <button
            class="btn btn--sm"
            [class]="vista() === 'semana' ? 'btn--primary' : 'btn--ghost'"
            style="border-radius:0;"
            (click)="vista.set('semana')"
          >
            Semana
          </button>
          <button
            class="btn btn--sm"
            [class]="vista() === 'lista' ? 'btn--primary' : 'btn--ghost'"
            style="border-radius:0;"
            (click)="vista.set('lista')"
          >
            Lista
          </button>
        </div>
        @if (auth.isCoach()) {
          <button class="btn btn--primary btn--sm" (click)="abrirFormClase()">
            + Nueva Clase
          </button>
        }
      </div>
    </div>

    <!-- ══ VISTA SEMANA ══════════════════════════════════════════════════════ -->
    @if (vista() === 'semana') {
      <div class="week-calendar">
        <!-- Cabecera días -->
        <div class="week-calendar__header">
          <div class="week-calendar__time-col"></div>
          @for (dia of diasSemana(); track dia.fecha) {
            <div class="week-calendar__day-header" [class.today]="dia.esHoy">
              <div class="week-calendar__day-name">{{ dia.nombre }}</div>
              <div class="week-calendar__day-num" [class.today]="dia.esHoy">
                {{ dia.num }}
              </div>
            </div>
          }
        </div>
        <!-- Grid -->
        <div class="week-calendar__body">
          @for (dia of diasSemana(); track dia.fecha) {
            <div class="week-calendar__col" [class.today]="dia.esHoy">
              @for (clase of clasesDelDia(dia.fecha); track clase.id) {
                <div
                  class="week-event"
                  [class]="'week-event--' + tipoClass(clase.tipo)"
                  (click)="verClase(clase)"
                >
                  <div class="week-event__time">
                    {{ clase.hora_inicio }} – {{ clase.hora_fin }}
                  </div>
                  <div class="week-event__title">{{ clase.tipo }}</div>
                  @if (clase.descripcion) {
                    <div class="week-event__desc">{{ clase.descripcion }}</div>
                  }
                  <div class="week-event__coach">
                    {{ clase.profiles?.nombre_completo ?? '—' }}
                  </div>
                </div>
              }
              @if (clasesDelDia(dia.fecha).length === 0) {
                <div class="week-calendar__empty"></div>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- ══ VISTA LISTA ═══════════════════════════════════════════════════════ -->
    @if (vista() === 'lista') {
      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Clases de la semana</span>
          <select
            class="form-control"
            style="width:auto;height:38px;"
            [ngModel]="filterTipo()"
            (ngModelChange)="onFilterTipoChange($event)"
          >
            <option value="">Todos los tipos</option>
            <option value="WOD">WOD</option>
            <option value="Open Gym">Open Gym</option>
            <option value="Barbell Club">Barbell Club</option>
            <option value="Fundamentos">Fundamentos</option>
          </select>
        </div>
        @if (loading()) {
          <div style="padding:40px;text-align:center;color:#666;">
            Cargando...
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Coach</th>
                <th>Cupos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (c of clasesFiltradas(); track c.id) {
                <tr [class.row-cancelled]="c.cancelada">
                  <td>
                    <span
                      [style.background]="tipoBg(c.tipo)"
                      [style.color]="tipoColor(c.tipo)"
                      style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;"
                    >
                      {{ c.tipo }}
                    </span>
                  </td>
                  <td style="font-size:13px;">
                    {{ c.fecha | dateEc: 'EEEE dd/MM' }}
                  </td>
                  <td style="font-size:13px;">
                    {{ c.hora_inicio }} – {{ c.hora_fin }}
                  </td>
                  <td style="font-size:13px;">
                    {{ c.profiles?.nombre_completo ?? '—' }}
                  </td>
                  <td style="font-size:13px;">
                    {{ c.capacidad_maxima }} personas
                  </td>
                  <td>
                    <div class="data-table__actions">
                      <button
                        class="btn btn--ghost btn--sm"
                        (click)="inscribirseOCancelar(c)"
                        [disabled]="
                          loadingClase() === c.id ||
                          (!inscritoEn(c.id) && !membresiaActiva())
                        "
                        [title]="
                          !membresiaActiva() && !inscritoEn(c.id)
                            ? 'Membresía no activa'
                            : ''
                        "
                      >
                        {{ inscritoEn(c.id) ? '✕ Cancelar' : '✓ Inscribirse' }}
                      </button>
                      <button
                        class="btn btn--ghost btn--sm"
                        (click)="verClase(c)"
                        title="Ver inscritos"
                      >
                        👥
                      </button>
                      @if (auth.isCoach()) {
                        <button
                          class="btn btn--danger btn--sm"
                          (click)="cancelarClase(c)"
                          [disabled]="c.cancelada"
                        >
                          {{ c.cancelada ? 'Cancelada' : 'Cancelar' }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td
                    colspan="6"
                    style="text-align:center;padding:40px;color:#666;"
                  >
                    Sin clases esta semana.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }

    <!-- ══ MODAL NUEVA CLASE ════════════════════════════════════════════════ -->
    @if (showFormClase()) {
      <div class="modal-backdrop" (click)="showFormClase.set(false)">
        <div class="modal modal--wide" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">Nueva Clase</h3>
            <button
              class="btn btn--ghost btn--icon"
              (click)="showFormClase.set(false)"
            >
              ✕
            </button>
          </div>
          <div class="modal__body">
            <form (ngSubmit)="crearClase()">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group">
                  <label class="form-label">Tipo *</label>
                  <select
                    class="form-control"
                    [(ngModel)]="newClase.tipo"
                    name="tipo"
                    required
                  >
                    <option value="">Seleccionar</option>
                    <option value="WOD">WOD</option>
                    <option value="Open Gym">Open Gym</option>
                    <option value="Barbell Club">Barbell Club</option>
                    <option value="Fundamentos">Fundamentos</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Fecha *</label>
                  <input
                    class="form-control"
                    type="date"
                    [(ngModel)]="newClase.fecha"
                    name="fecha"
                    required
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Hora Inicio *</label>
                  <input
                    class="form-control"
                    type="time"
                    [(ngModel)]="newClase.hora_inicio"
                    name="hinicio"
                    required
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Hora Fin *</label>
                  <input
                    class="form-control"
                    type="time"
                    [(ngModel)]="newClase.hora_fin"
                    name="hfin"
                    required
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Capacidad Máx.</label>
                  <input
                    class="form-control"
                    type="number"
                    [(ngModel)]="newClase.capacidad_maxima"
                    name="cap"
                    min="1"
                    max="100"
                  />
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                  <label class="form-label">Descripción / WOD del día</label>
                  <input
                    class="form-control"
                    type="text"
                    [(ngModel)]="newClase.descripcion"
                    name="desc"
                    placeholder="Ej: 3 rounds: 10 thrusters, 10 pull-ups..."
                  />
                </div>
              </div>
              <div class="modal__footer" style="padding:0;margin-top:20px;">
                <button
                  type="button"
                  class="btn btn--ghost"
                  (click)="showFormClase.set(false)"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="btn btn--primary"
                  [disabled]="savingClase()"
                >
                  {{ savingClase() ? 'Guardando...' : 'Crear Clase' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- ══ MODAL VER CLASE (inscritos + asistencia) ══════════════════════════ -->
    @if (claseSeleccionada()) {
      <div class="modal-backdrop" (click)="claseSeleccionada.set(null)">
        <div class="modal modal--wide" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">
              {{ claseSeleccionada()!.tipo }}
              <span
                style="font-size:14px;font-weight:400;color:#666;text-transform:none;font-family:'Inter',sans-serif;"
              >
                · {{ claseSeleccionada()!.fecha | dateEc: 'EEEE dd/MM' }}
                {{ claseSeleccionada()!.hora_inicio }} –
                {{ claseSeleccionada()!.hora_fin }}
              </span>
            </h3>
            <button
              class="btn btn--ghost btn--icon"
              (click)="claseSeleccionada.set(null)"
            >
              ✕
            </button>
          </div>
          <div class="modal__body">
            @if (claseSeleccionada()!.descripcion) {
              <div class="alert alert--info" style="margin-bottom:16px;">
                📋 {{ claseSeleccionada()!.descripcion }}
              </div>
            }

            <div
              style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"
            >
              <span
                style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:#fff;text-transform:uppercase;"
              >
                Inscritos ({{ inscritos().length }} /
                {{ claseSeleccionada()!.capacidad_maxima }})
              </span>
              <button
                class="btn btn--primary btn--sm"
                (click)="inscribirseOCancelar(claseSeleccionada()!)"
                [disabled]="
                  loadingClase() === claseSeleccionada()!.id ||
                  (!inscritoEn(claseSeleccionada()!.id) && !membresiaActiva())
                "
                [title]="
                  !membresiaActiva() && !inscritoEn(claseSeleccionada()!.id)
                    ? 'Membresía no activa'
                    : ''
                "
              >
                {{
                  inscritoEn(claseSeleccionada()!.id)
                    ? '✕ Cancelar inscripción'
                    : '✓ Inscribirse'
                }}
              </button>
            </div>

            @if (inscritosLoading()) {
              <div style="text-align:center;padding:24px;color:#666;">
                Cargando inscritos...
              </div>
            } @else if (inscritos().length === 0) {
              <div style="text-align:center;padding:24px;color:#666;">
                Sin inscritos todavía.
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Atleta</th>
                    <th>Estado</th>
                    @if (auth.isCoach()) {
                      <th>Asistencia</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (ins of inscritos(); track ins.id) {
                    <tr>
                      <td style="font-weight:600;color:#fff;">
                        {{ ins.profiles?.nombre_completo ?? '—' }}
                      </td>
                      <td>
                        <span
                          class="badge badge--{{
                            inscripcionBadge(ins.estado)
                          }}"
                          >{{ ins.estado }}</span
                        >
                      </td>
                      @if (auth.isCoach()) {
                        <td>
                          <div style="display:flex;gap:8px;">
                            <button
                              class="btn btn--sm btn--ghost"
                              (click)="marcarAsistencia(ins.id, true)"
                              [disabled]="ins.estado === 'asistio'"
                              title="Asistió"
                            >
                              ✓ Asistió
                            </button>
                            <button
                              class="btn btn--sm btn--danger"
                              (click)="marcarAsistencia(ins.id, false)"
                              [disabled]="ins.estado === 'no_asistio'"
                              title="No asistió"
                            >
                              ✕ No asistió
                            </button>
                          </div>
                        </td>
                      }
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
  styles: [
    `
      .week-calendar {
        background: #141414;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        overflow: hidden;
        overflow-x: auto;
      }
      .week-calendar__header {
        display: grid;
        grid-template-columns: 60px repeat(7, 1fr);
        border-bottom: 1px solid #2a2a2a;
      }
      .week-calendar__time-col {
        padding: 12px 8px;
        border-right: 1px solid #1e1e1e;
      }
      .week-calendar__day-header {
        padding: 12px 8px;
        text-align: center;
        border-right: 1px solid #1e1e1e;
        &.today {
          background: rgba(183, 28, 28, 0.08);
        }
      }
      .week-calendar__day-name {
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #666;
      }
      .week-calendar__day-num {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 22px;
        color: #fff;
        line-height: 1.2;
        margin-top: 2px;
        &.today {
          color: #b71c1c;
        }
      }
      .week-calendar__body {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        min-height: 200px;
      }
      .week-calendar__col {
        border-right: 1px solid #1e1e1e;
        padding: 8px;
        min-height: 120px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        &.today {
          background: rgba(183, 28, 28, 0.04);
        }
        &:last-child {
          border-right: none;
        }
      }
      .week-calendar__empty {
        flex: 1;
      }
      .week-event {
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        transition: filter 0.2s ease;
        &:hover {
          filter: brightness(1.15);
        }
      }
      .week-event__time {
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 600;
        opacity: 0.7;
        margin-bottom: 2px;
      }
      .week-event__title {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 14px;
        letter-spacing: 0.05em;
        color: #fff;
      }
      .week-event__desc {
        font-size: 10px;
        opacity: 0.6;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 2px;
      }
      .week-event__coach {
        font-size: 10px;
        opacity: 0.5;
        margin-top: 4px;
      }
      .week-event--wod {
        background: rgba(183, 28, 28, 0.25);
        border-left: 3px solid #b71c1c;
      }
      .week-event--open-gym {
        background: rgba(80, 80, 80, 0.3);
        border-left: 3px solid #888;
      }
      .week-event--barbell-club {
        background: rgba(123, 17, 17, 0.3);
        border-left: 3px solid #7b1111;
      }
      .week-event--fundamentos {
        background: rgba(33, 150, 243, 0.2);
        border-left: 3px solid #42a5f5;
      }
      .row-cancelled td {
        opacity: 0.5;
        text-decoration: line-through;
      }
    `,
  ],
})
export class ClasesComponent implements OnInit {
  auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private sentry = inject(SentryService);

  clases = signal<Clase[]>([]);
  inscritos = signal<Inscripcion[]>([]);
  misInscritas = signal<number[]>([]);

  // Estado de membresía del atleta logueado
  membresiaActiva = signal<boolean | null>(null); // null = cargando

  loading = signal(true);
  inscritosLoading = signal(false);
  savingClase = signal(false);
  loadingClase = signal<number | null>(null);

  vista = signal<Vista>('semana');
  showFormClase = signal(false);
  claseSeleccionada = signal<Clase | null>(null);
  filterTipo = signal('');

  // Semana actual
  private semanaBase = signal(startOfWeek(new Date(), { weekStartsOn: 1 }));

  diasSemana = computed(() => {
    const lunes = this.semanaBase();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(lunes, i);
      return {
        fecha: format(d, 'yyyy-MM-dd'),
        nombre: format(d, 'EEE', { locale: es }),
        num: format(d, 'd'),
        esHoy: isSameDay(d, new Date()),
      };
    });
  });

  semanaLabel = computed(() => {
    const lunes = this.semanaBase();
    const domingo = addDays(lunes, 6);
    return `${format(lunes, 'd MMM', { locale: es })} – ${format(domingo, 'd MMM yyyy', { locale: es })}`;
  });

  clasesFiltradas = computed(() => {
    const tipo = this.filterTipo();
    if (!tipo) return this.clases();
    return this.clases().filter((clase) => clase.tipo === tipo);
  });

  newClase = this.emptyClase();

  async ngOnInit() {
    await Promise.all([
      this.cargarClases(),
      this.cargarMisInscripciones(),
      this.verificarMembresia(),
    ]);
  }

  /** Verifica si el atleta logueado tiene membresía activa.
   *  Coach y admin siempre pueden inscribirse (gestionan el gym). */
  async verificarMembresia() {
    // Coach y admin no necesitan membresía para inscribirse
    if (this.auth.isCoach()) {
      this.membresiaActiva.set(true);
      return;
    }

    const idCliente = this.auth.profile()?.id_cliente;
    if (!idCliente) {
      // Sin cliente vinculado → no puede inscribirse
      this.membresiaActiva.set(false);
      return;
    }

    const { data } = await this.supabase.getCliente(idCliente);
    if (!data) {
      this.membresiaActiva.set(false);
      return;
    }

    // Solo estado 'Activo' permite inscribirse
    this.membresiaActiva.set((data as { estado: string }).estado === 'Activo');
  }

  semanaAnterior() {
    this.semanaBase.update((d) => subWeeks(d, 1));
    this.cargarClases();
  }
  semanaSiguiente() {
    this.semanaBase.update((d) => addWeeks(d, 1));
    this.cargarClases();
  }
  irHoy() {
    this.semanaBase.set(startOfWeek(new Date(), { weekStartsOn: 1 }));
    this.cargarClases();
  }

  async cargarClases() {
    this.loading.set(true);
    const lunes = format(this.semanaBase(), 'yyyy-MM-dd');
    const domingo = format(addDays(this.semanaBase(), 6), 'yyyy-MM-dd');
    const { data, error } = await this.supabase.getClases({
      semana: `${lunes},${domingo}`,
    });
    this.loading.set(false);
    if (error) {
      this.sentry.captureError(error, {
        action: 'cargarClases',
        semana: lunes,
      });
      this.toast.error('Error cargando clases');
      return;
    }
    this.clases.set((data ?? []) as unknown as Clase[]);
  }

  onFilterTipoChange(tipo: string) {
    this.filterTipo.set(tipo);
  }

  async cargarMisInscripciones() {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    const { data } = await this.supabase.getInscripcionesByUser(userId);
    this.misInscritas.set(
      ((data ?? []) as Record<string, unknown>[]).map(
        (i) => i['clase_id'] as number,
      ),
    );
  }

  clasesDelDia(fecha: string): Clase[] {
    return this.clasesFiltradas().filter((c) => c.fecha === fecha);
  }

  inscritoEn(claseId: number): boolean {
    return this.misInscritas().includes(claseId);
  }

  abrirFormClase() {
    this.newClase = this.emptyClase();
    this.showFormClase.set(true);
  }

  async crearClase() {
    if (!this.newClase.tipo || !this.newClase.fecha) return;
    this.savingClase.set(true);
    const coachId = this.auth.currentUser()?.id;
    const { error } = await this.supabase.createClase({
      ...this.newClase,
      coach_id: coachId,
    });
    this.savingClase.set(false);
    if (error) {
      this.sentry.captureError(error, { action: 'crearClase' });
      this.toast.error(error.message);
      return;
    }
    this.toast.success('Clase creada');
    this.showFormClase.set(false);
    this.newClase = this.emptyClase();
    await this.cargarClases();
  }

  async verClase(clase: Clase) {
    this.claseSeleccionada.set(clase);
    this.inscritos.set([]);
    this.inscritosLoading.set(true);
    const { data } = await this.supabase.getInscripcionesByClase(clase.id);
    this.inscritosLoading.set(false);
    this.inscritos.set((data ?? []) as unknown as Inscripcion[]);
  }

  async inscribirseOCancelar(clase: Clase) {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      this.toast.error('Debes iniciar sesión');
      return;
    }

    // Verificar membresía activa antes de inscribirse (no aplica al cancelar)
    if (!this.inscritoEn(clase.id) && !this.membresiaActiva()) {
      if (this.membresiaActiva() === false) {
        this.toast.error(
          'Tu membresía no está activa. Contacta al coach para renovar tu plan.',
        );
      } else {
        this.toast.error(
          'Verificando membresía, intenta de nuevo en un momento.',
        );
      }
      return;
    }

    this.loadingClase.set(clase.id);

    if (this.inscritoEn(clase.id)) {
      await this.supabase.cancelarInscripcion(clase.id, userId);
      this.misInscritas.update((ids) => ids.filter((id) => id !== clase.id));
      this.toast.info('Inscripción cancelada');
    } else {
      // Verificar cupos disponibles
      const { data: ins } = await this.supabase.getInscripcionesByClase(
        clase.id,
      );
      const ocupados = ins?.length ?? 0;
      if (ocupados >= clase.capacidad_maxima) {
        this.toast.warning('Esta clase ya no tiene cupos disponibles');
        this.loadingClase.set(null);
        return;
      }
      const { error } = await this.supabase.inscribirseAClase(clase.id, userId);
      if (error?.code === '23505') {
        this.toast.warning('Ya estás inscrito');
      } else if (error) {
        this.toast.error(error.message);
      } else {
        this.misInscritas.update((ids) => [...ids, clase.id]);
        this.toast.success('¡Inscripción confirmada!');
        this.sentry.addBreadcrumb(
          `Inscripción clase ${clase.tipo} ${clase.fecha}`,
          'clases',
        );
      }
    }

    this.loadingClase.set(null);
    // Refrescar inscritos si hay modal abierto
    if (this.claseSeleccionada()?.id === clase.id) await this.verClase(clase);
  }

  async marcarAsistencia(inscripcionId: number, asistio: boolean) {
    const { error } = await this.supabase.marcarAsistencia(
      inscripcionId,
      asistio,
    );
    if (error) {
      this.toast.error(error.message);
      return;
    }
    this.inscritos.update((list) =>
      list.map((i) =>
        i.id === inscripcionId
          ? { ...i, estado: asistio ? 'asistio' : 'no_asistio' }
          : i,
      ),
    );
    this.toast.success(
      asistio ? 'Asistencia confirmada' : 'Marcado como ausente',
    );
  }

  async cancelarClase(clase: Clase) {
    const motivo = prompt('Motivo de cancelación (opcional):') ?? '';
    const { error } = await this.supabase.updateClase(clase.id, {
      cancelada: true,
      motivo_cancelacion: motivo,
    });
    if (error) {
      this.toast.error(error.message);
      return;
    }
    this.toast.info('Clase cancelada');
    await this.cargarClases();
  }

  inscripcionBadge(estado: string): string {
    return (
      (
        {
          inscrito: 'esperando',
          asistio: 'activo',
          no_asistio: 'vencido',
          cancelado: 'inactivo',
        } as Record<string, string>
      )[estado] ?? 'inactivo'
    );
  }

  tipoBg(tipo: string): string {
    return (
      (
        {
          WOD: 'rgba(183,28,28,0.2)',
          'Open Gym': 'rgba(80,80,80,0.2)',
          'Barbell Club': 'rgba(123,17,17,0.2)',
          Fundamentos: 'rgba(33,150,243,0.2)',
        } as Record<string, string>
      )[tipo] ?? 'rgba(80,80,80,0.2)'
    );
  }

  tipoColor(tipo: string): string {
    return (
      (
        {
          WOD: '#B71C1C',
          'Open Gym': '#CCCCCC',
          'Barbell Club': '#7B1111',
          Fundamentos: '#42a5f5',
        } as Record<string, string>
      )[tipo] ?? '#aaa'
    );
  }

  tipoClass(tipo: string): string {
    return tipo.toLowerCase().replace(/\s+/g, '-');
  }

  private emptyClase() {
    return {
      tipo: '',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      hora_inicio: '06:00',
      hora_fin: '07:00',
      capacidad_maxima: 20,
      descripcion: '',
    };
  }
}
