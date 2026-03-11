import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SentryService } from '../../core/services/sentry.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { LucideAngularModule } from 'lucide-angular';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
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

interface MiInscripcion {
  id: number;
  clase_id: number;
  user_id: string;
  estado: string;
  clases?: {
    id: number;
    tipo: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    capacidad_maxima: number;
    cancelada: boolean;
  };
}

type Vista = 'semana' | 'lista';

@Component({
  selector: 'app-clases',
  standalone: true,
  imports: [CommonModule, FormsModule, DateEcPipe, LucideAngularModule],
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

    @if (!auth.isCoach()) {
      <div class="clases-athlete-summary">
        <div class="stat-card">
          <div class="stat-card__label">Próxima clase inscrita</div>
          @if (proximaClaseInscrita()) {
            <div class="stat-card__value clases-athlete-summary__value">
              {{ proximaClaseInscrita()!.tipo }}
            </div>
            <div class="stat-card__trend">
              {{ proximaClaseInscrita()!.fecha | dateEc: 'EEEE dd/MM' }}
              · {{ proximaClaseInscrita()!.hora_inicio }} – {{ proximaClaseInscrita()!.hora_fin }}
            </div>
          } @else {
            <div class="clases-athlete-summary__empty">
              No tienes clases futuras inscritas.
            </div>
          }
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Clases disponibles</div>
          <div class="stat-card__value clases-athlete-summary__value">
            {{ clasesDisponiblesParaInscripcion() }}
          </div>
          <div class="stat-card__trend">
            Solo se muestran clases de hoy en adelante.
          </div>
        </div>
      </div>
    }

    <!-- Toolbar -->
    <div class="toolbar-row" style="margin-bottom:20px;">
      <!-- Navegación de semana -->
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn--ghost btn--sm" (click)="semanaAnterior()" [disabled]="!puedeIrSemanaAnterior()">
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
                  <div class="week-event__meta">
                    <span>{{ inscritosCount(clase.id) }}/{{ clase.capacidad_maxima }}</span>
                    @if (inscritoEn(clase.id)) {
                      <span>Inscrito</span>
                    }
                  </div>
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
              @for (c of clasesVisibles(); track c.id) {
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
                    {{ inscritosCount(c.id) }} / {{ c.capacidad_maxima }}
                  </td>
                  <td>
                    <div class="data-table__actions">
                      <button
                        class="btn btn--ghost btn--sm"
                        (click)="inscribirseOCancelar(c)"
                        [disabled]="
                          loadingClase() === c.id ||
                          (!inscritoEn(c.id) && (!membresiaActiva() || !puedeInscribirse(c)))
                        "
                        [title]="
                          actionTitle(c)
                        "
                      >
                        {{ inscritoEn(c.id) ? 'Cancelar' : 'Inscribirse' }}
                      </button>
                      <button
                        class="btn btn--ghost btn--sm btn--icon"
                        (click)="verClase(c)"
                        title="Ver inscritos"
                      >
                        <i-lucide name="users" />
                      </button>
                      @if (auth.isCoach()) {
                        <button
                          class="btn btn--danger btn--sm"
                          (click)="cancelarClase(c)"
                          [disabled]="c.cancelada"
                        >
                          {{ c.cancelada ? 'Cancelada' : 'Cancelar' }}
                        </button>
                        <button
                          class="btn btn--ghost btn--sm"
                          (click)="eliminarClase(c)"
                        >
                          Eliminar
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
                    Sin clases disponibles hoy o en el futuro.
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
              <i-lucide name="circle-x" />
            </button>
          </div>
          <div class="modal__body">
            <form (ngSubmit)="crearClase()">
              <div class="two-column-grid">
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
              <i-lucide name="circle-x" />
            </button>
          </div>
          <div class="modal__body">
            @if (claseSeleccionada()!.descripcion) {
              <div class="alert alert--info" style="margin-bottom:16px;">
                <div style="display:flex;align-items:flex-start;gap:10px;">
                  <i-lucide name="clipboard" />
                  <span>{{ claseSeleccionada()!.descripcion }}</span>
                </div>
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
                    ? 'Cancelar inscripción'
                    : 'Inscribirse'
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
                              Asistió
                            </button>
                            <button
                              class="btn btn--sm btn--danger"
                              (click)="marcarAsistencia(ins.id, false)"
                              [disabled]="ins.estado === 'no_asistio'"
                              title="No asistió"
                            >
                              No asistió
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
      .clases-athlete-summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .clases-athlete-summary__value {
        font-size: 28px;
      }
      .clases-athlete-summary__empty {
        color: #938c84;
        font-size: 14px;
        line-height: 1.4;
      }
      .week-calendar__header {
        display: grid;
        grid-template-columns: repeat(7, minmax(140px, 1fr));
        border-bottom: 1px solid #2a2a2a;
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
        grid-template-columns: repeat(7, minmax(140px, 1fr));
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
      .week-event__meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 6px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.8;
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
      @media (max-width: 900px) {
        .clases-athlete-summary {
          grid-template-columns: 1fr;
        }
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
  misInscripcionesDetalle = signal<MiInscripcion[]>([]);
  inscritosPorClase = signal<Record<number, number>>({});

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

  clasesVisibles = computed(() =>
    this.clasesFiltradas().filter((clase) => this.esClaseVisible(clase)),
  );

  proximaClaseInscrita = computed(() => {
    const proximas = this.misInscripcionesDetalle()
      .map((inscripcion) => inscripcion.clases)
      .filter((clase): clase is NonNullable<MiInscripcion['clases']> =>
        Boolean(clase && !clase.cancelada && this.esClaseVisible(clase)),
      )
      .sort((a, b) => this.claseStart(a).getTime() - this.claseStart(b).getTime());

    return proximas[0] ?? null;
  });

  clasesDisponiblesParaInscripcion = computed(
    () =>
      this.clasesVisibles().filter(
        (clase) =>
          !this.inscritoEn(clase.id) && this.puedeInscribirse(clase),
      ).length,
  );

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
    if (!this.puedeIrSemanaAnterior()) return;
    this.semanaBase.update((d) => subWeeks(d, 1));
    void this.cargarClases();
  }
  semanaSiguiente() {
    this.semanaBase.update((d) => addWeeks(d, 1));
    void this.cargarClases();
  }
  irHoy() {
    this.semanaBase.set(startOfWeek(new Date(), { weekStartsOn: 1 }));
    void this.cargarClases();
  }

  async cargarClases() {
    this.loading.set(true);
    const lunes = format(this.semanaBase(), 'yyyy-MM-dd');
    const domingo = format(addDays(this.semanaBase(), 6), 'yyyy-MM-dd');
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const fechaInicio = lunes < hoy ? hoy : lunes;

    if (fechaInicio > domingo) {
      this.clases.set([]);
      this.inscritosPorClase.set({});
      this.loading.set(false);
      return;
    }

    const { data, error } = await this.supabase.getClases({
      semana: `${fechaInicio},${domingo}`,
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
    const clases = (data ?? []) as unknown as Clase[];
    this.clases.set(clases);
    await this.cargarResumenInscritos(clases);
  }

  onFilterTipoChange(tipo: string) {
    this.filterTipo.set(tipo);
  }

  async cargarMisInscripciones() {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    const { data } = await this.supabase.getInscripcionesByUser(userId);
    const inscripciones = (data ?? []) as unknown as MiInscripcion[];
    const futuras = inscripciones.filter((inscripcion) =>
      Boolean(
        inscripcion.clases &&
        !inscripcion.clases.cancelada &&
        this.esClaseVisible(inscripcion.clases),
      ),
    );

    this.misInscripcionesDetalle.set(futuras);
    this.misInscritas.set(futuras.map((inscripcion) => inscripcion.clase_id));
  }

  clasesDelDia(fecha: string): Clase[] {
    return this.clasesVisibles().filter((c) => c.fecha === fecha);
  }

  inscritoEn(claseId: number): boolean {
    return this.misInscritas().includes(claseId);
  }

  inscritosCount(claseId: number): number {
    return this.inscritosPorClase()[claseId] ?? 0;
  }

  puedeIrSemanaAnterior(): boolean {
    return this.semanaBase().getTime() > startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
  }

  puedeInscribirse(clase: Clase): boolean {
    return this.claseStart(clase).getTime() > Date.now();
  }

  actionTitle(clase: Clase): string {
    if (this.inscritoEn(clase.id)) return 'Cancelar inscripción';
    if (this.membresiaActiva() === null) return 'Verificando membresía';
    if (this.membresiaActiva() === false) return 'Membresía no activa';
    if (!this.puedeInscribirse(clase)) return 'La clase ya comenzó o ya pasó';
    if (this.inscritosCount(clase.id) >= clase.capacidad_maxima) return 'Clase sin cupos';
    return 'Inscribirse';
  }

  esClaseVisible(clase: Pick<Clase, 'fecha' | 'hora_inicio' | 'hora_fin'>): boolean {
    return this.claseEnd(clase).getTime() > Date.now();
  }

  private claseStart(clase: Pick<Clase, 'fecha' | 'hora_inicio'>): Date {
    return parseISO(`${clase.fecha}T${clase.hora_inicio}`);
  }

  private claseEnd(clase: Pick<Clase, 'fecha' | 'hora_inicio' | 'hora_fin'>): Date {
    return parseISO(`${clase.fecha}T${clase.hora_fin ?? clase.hora_inicio}`);
  }

  private async cargarResumenInscritos(clases: Clase[]) {
    const ids = clases.map((clase) => clase.id);
    const { data, error } = await this.supabase.getInscripcionesResumen(ids);

    if (error) {
      this.sentry.captureError(error, { action: 'cargarResumenInscritos' });
      return;
    }

    const resumen = ((data ?? []) as Array<{ clase_id: number }>).reduce<Record<number, number>>(
      (acc, item) => {
        acc[item.clase_id] = (acc[item.clase_id] ?? 0) + 1;
        return acc;
      },
      {},
    );

    this.inscritosPorClase.set(resumen);
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

    if (!this.inscritoEn(clase.id) && !this.puedeInscribirse(clase)) {
      this.toast.warning('No puedes inscribirte a una clase que ya comenzó o ya pasó.');
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
      this.toast.info('Inscripción cancelada');
    } else {
      const { data: existente } = await this.supabase.getInscripcionByClaseYUsuario(
        clase.id,
        userId,
      );

      if (existente?.estado && existente.estado !== 'cancelado') {
        this.toast.info('Ya estabas inscrito en esta clase.');
        await Promise.all([this.cargarMisInscripciones(), this.cargarClases()]);
        this.loadingClase.set(null);
        return;
      }

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

      if (existente?.estado === 'cancelado') {
        const { error } = await this.supabase.reactivarInscripcion(existente.id);
        if (error) {
          this.toast.error(error.message);
        } else {
          this.toast.success('¡Inscripción confirmada!');
          this.sentry.addBreadcrumb(
            `Reactivacion clase ${clase.tipo} ${clase.fecha}`,
            'clases',
          );
        }
      } else {
        const { error } = await this.supabase.inscribirseAClase(clase.id, userId);
        if (error?.code === '23505') {
          this.toast.info('Ya estabas inscrito en esta clase.');
          await Promise.all([this.cargarMisInscripciones(), this.cargarClases()]);
          this.loadingClase.set(null);
          return;
        } else if (error) {
          this.toast.error(error.message);
        } else {
          this.toast.success('¡Inscripción confirmada!');
          this.sentry.addBreadcrumb(
            `Inscripción clase ${clase.tipo} ${clase.fecha}`,
            'clases',
          );
        }
      }
    }

    this.loadingClase.set(null);
    await Promise.all([this.cargarMisInscripciones(), this.cargarClases()]);
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

  async eliminarClase(clase: Clase) {
    const confirmacion = window.confirm(
      `Eliminar "${clase.tipo}" del ${clase.fecha} a las ${clase.hora_inicio}. Esta acción quitará también sus inscripciones.`,
    );

    if (!confirmacion) return;

    const { error: inscripcionesError } = await this.supabase.deleteInscripcionesByClase(
      clase.id,
    );

    if (inscripcionesError) {
      this.toast.error(inscripcionesError.message);
      return;
    }

    const { error } = await this.supabase.deleteClase(clase.id);
    if (error) {
      this.toast.error(error.message);
      return;
    }

    if (this.claseSeleccionada()?.id === clase.id) {
      this.claseSeleccionada.set(null);
    }

    this.toast.success('Clase eliminada');
    await Promise.all([this.cargarMisInscripciones(), this.cargarClases()]);
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
