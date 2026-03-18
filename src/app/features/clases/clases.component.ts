import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { SentryService } from '../../core/services/sentry.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { LucideAngularModule } from 'lucide-angular';
import {
  formatEcuadorDate,
  getEcuadorNow,
  getEcuadorTodayYmd,
  getStartOfEcuadorWeek,
  parseEcuadorDateTime,
} from '../../shared/utils/date-ecuador';
import { addDays, addWeeks, subWeeks } from 'date-fns';

type WodFormat = 'AMRAP' | 'EMOM' | 'FOR TIME' | 'TABATA' | 'CHIPPER' | 'DEATH BY';
type WodBlockKey = 'warmup' | 'accessories' | 'main';

interface WodChip {
  label: string;
}

interface WodPlan {
  warmup: WodChip[];
  accessories: WodChip[];
  main: {
    format: WodFormat;
    items: WodChip[];
    notes?: string | null;
  };
}

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
  wod_formato: WodFormat;
  wod_plan: WodPlan;
  profiles?: { nombre_completo: string };
}

interface Inscripcion {
  id: number;
  clase_id: number;
  user_id: string;
  estado: string;
  profiles?: { nombre_completo: string; avatar_url: string | null };
}

interface MiInscripcion {
  id: number;
  clase_id: number;
  user_id: string;
  estado: string;
  clases?: {
    id: number;
    tipo: string;
    descripcion: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    capacidad_maxima: number;
    cancelada: boolean;
    wod_formato: WodFormat;
    wod_plan: WodPlan;
  };
}

type Vista = 'semana' | 'lista';

interface ClaseFormState {
  tipo: 'WOD';
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  capacidad_maxima: number;
  descripcion: string;
  wod_formato: WodFormat;
  wod_plan: WodPlan;
}

const WOD_FORMAT_OPTIONS: WodFormat[] = ['AMRAP', 'EMOM', 'FOR TIME', 'TABATA', 'CHIPPER', 'DEATH BY'];

const WOD_FORMAT_DESCRIPTIONS: Record<WodFormat, string> = {
  AMRAP: 'Tantas rondas como sea posible dentro de un tiempo fijo.',
  EMOM: 'Realizar una tarea cada minuto y descansar lo que sobre.',
  'FOR TIME': 'Completar una tarea específica en el menor tiempo posible.',
  TABATA: '20 segundos de esfuerzo máximo por 10 de descanso durante 8 series.',
  CHIPPER: 'Lista larga de ejercicios que se completa uno tras otro hasta el final.',
  'DEATH BY': 'Aumenta una repetición por minuto hasta no completar el trabajo dentro del minuto.',
};

const CLASE_THEME = {
  textStrong: '#f4f1eb',
  textMuted: '#938c84',
  border: '#2b3033',
  surface: '#151718',
  surfaceAlt: '#1d2022',
  primary: '#a61f24',
  primarySoft: 'rgba(166, 31, 36, 0.14)',
  primarySoftStrong: 'rgba(166, 31, 36, 0.24)',
  neutralSoft: 'rgba(147, 140, 132, 0.14)',
  neutralSoftStrong: 'rgba(147, 140, 132, 0.22)',
  accent: '#c12a30',
  accentSoftStrong: 'rgba(193, 42, 48, 0.24)',
  info: '#3d6e91',
  infoSoft: 'rgba(61, 110, 145, 0.16)',
} as const;

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
      <div class="alert alert--error clases-alert">
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
              {{ describeClase(proximaClaseInscrita()!) }}
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
    <div class="toolbar-row clases-toolbar">
      <div class="clases-toolbar__nav">
        <button class="btn btn--ghost btn--sm" (click)="semanaAnterior()" [disabled]="!puedeIrSemanaAnterior()">
          ‹
        </button>
        <span class="week-toolbar__label">
          {{ semanaLabel() }}
        </span>
        <button class="btn btn--ghost btn--sm" (click)="semanaSiguiente()">
          ›
        </button>
        <button class="btn btn--ghost btn--sm" (click)="irHoy()">Hoy</button>
      </div>
      <div class="clases-toolbar__actions">
        <div class="clases-view-toggle">
          <button
            class="btn btn--sm clases-view-toggle__button"
            [class]="vista() === 'semana' ? 'btn--primary' : 'btn--ghost'"
            (click)="vista.set('semana')"
          >
            Semana
          </button>
          <button
            class="btn btn--sm clases-view-toggle__button"
            [class]="vista() === 'lista' ? 'btn--primary' : 'btn--ghost'"
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
                  [ngClass]="['week-event', 'week-event--' + tipoClass(clase.tipo)]"
                  (click)="verClase(clase)"
                >
                  <div class="week-event__time">
                    {{ clase.hora_inicio }} – {{ clase.hora_fin }}
                  </div>
                  <div class="week-event__title">{{ describeClase(clase) }}</div>
                  <div
                    class="wod-format-chip"
                    [title]="formatDescription(clase.wod_formato)"
                  >
                    {{ clase.wod_formato }}
                  </div>
                  @if (clasePreview(clase)) {
                    <div class="week-event__desc">{{ clasePreview(clase) }}</div>
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
            class="form-control clases-filter-select"
            [ngModel]="filterFormato()"
            (ngModelChange)="onFilterFormatoChange($event)"
          >
            <option value="">Todos los formatos</option>
            @for (formatOption of wodFormatOptions; track formatOption) {
              <option [value]="formatOption">{{ formatOption }}</option>
            }
          </select>
        </div>
        @if (loading()) {
          <div class="clases-empty-state">
            Cargando...
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>WOD</th>
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
                    <div class="wod-table-cell">
                      <span
                        class="class-type-pill"
                        [style.background]="tipoBg(c.tipo)"
                        [style.color]="tipoColor(c.tipo)"
                      >
                        WOD
                      </span>
                      <span
                        class="wod-format-chip wod-format-chip--compact"
                        [title]="formatDescription(c.wod_formato)"
                      >
                        {{ c.wod_formato }}
                      </span>
                    </div>
                  </td>
                  <td class="clases-table-cell">
                    {{ c.fecha | dateEc: 'EEEE dd/MM' }}
                  </td>
                  <td class="clases-table-cell">
                    {{ c.hora_inicio }} – {{ c.hora_fin }}
                  </td>
                  <td class="clases-table-cell">
                    {{ c.profiles?.nombre_completo ?? '—' }}
                  </td>
                  <td class="clases-table-cell">
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
                          [disabled]="c.cancelada || isActionBusy('cancel', c.id) || isActionBusy('delete', c.id)"
                        >
                          {{ isActionBusy('cancel', c.id) ? 'Cancelando...' : (c.cancelada ? 'Cancelada' : 'Cancelar') }}
                        </button>
                        <button
                          class="btn btn--ghost btn--sm"
                          (click)="eliminarClase(c)"
                          [disabled]="isActionBusy('cancel', c.id) || isActionBusy('delete', c.id)"
                        >
                          {{ isActionBusy('delete', c.id) ? 'Eliminando...' : 'Eliminar' }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="clases-empty-state">
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
                  <label class="form-label">Clase</label>
                  <div class="clases-static-field">WOD</div>
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
                  <label class="form-label">Formato del WOD *</label>
                  <select
                    class="form-control"
                    [(ngModel)]="newClase.wod_formato"
                    (ngModelChange)="onFormatChange($event)"
                    name="wodFormato"
                    required
                  >
                    @for (formatOption of wodFormatOptions; track formatOption) {
                      <option [value]="formatOption">{{ formatOption }}</option>
                    }
                  </select>
                  <small class="form-helper">{{ formatDescription(newClase.wod_formato) }}</small>
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
                <div class="form-group clases-form-group--full">
                  <div class="wod-optional-sections">
                    <div class="wod-optional-sections__label">Bloques opcionales</div>
                    <div class="wod-optional-sections__actions">
                      @if (!isOptionalBlockActive('warmup')) {
                        <button type="button" class="btn btn--ghost btn--sm" (click)="activateOptionalBlock('warmup')">
                          + Calentamiento
                        </button>
                      }
                      @if (!isOptionalBlockActive('accessories')) {
                        <button type="button" class="btn btn--ghost btn--sm" (click)="activateOptionalBlock('accessories')">
                          + Accesorios
                        </button>
                      }
                    </div>
                  </div>
                </div>
                @if (isOptionalBlockActive('warmup')) {
                  <div class="form-group clases-form-group--full">
                    <div class="wod-section-card">
                      <div class="wod-section-card__header">
                        <label class="form-label">Calentamiento</label>
                        <button type="button" class="btn btn--ghost btn--sm" (click)="deactivateOptionalBlock('warmup')">
                          Quitar bloque
                        </button>
                      </div>
                      <div class="wod-chip-builder">
                        <input
                          class="form-control"
                          type="text"
                          [(ngModel)]="chipDrafts.warmup.label"
                          name="warmupLabel"
                          placeholder="Ej: 400m run"
                        />
                        <button type="button" class="btn btn--ghost btn--sm" (click)="addChip('warmup')">Agregar</button>
                      </div>
                      <div class="wod-chip-list">
                        @for (chip of newClase.wod_plan.warmup; track chip.label + $index) {
                          <button type="button" class="wod-detail__chip wod-detail__chip--editable" [title]="chipTooltip(chip)" (click)="removeChip('warmup', $index)">
                            <span>{{ chip.label }}</span>
                            <i-lucide name="circle-x" />
                          </button>
                        } @empty {
                          <div class="wod-empty-copy">Agrega solo si el WOD necesita una entrada guiada.</div>
                        }
                      </div>
                    </div>
                  </div>
                }
                @if (isOptionalBlockActive('accessories')) {
                  <div class="form-group clases-form-group--full">
                    <div class="wod-section-card">
                      <div class="wod-section-card__header">
                        <label class="form-label">Accesorios</label>
                        <button type="button" class="btn btn--ghost btn--sm" (click)="deactivateOptionalBlock('accessories')">
                          Quitar bloque
                        </button>
                      </div>
                      <div class="wod-chip-builder">
                        <input
                          class="form-control"
                          type="text"
                          [(ngModel)]="chipDrafts.accessories.label"
                          name="accessoryLabel"
                          placeholder="Ej: 3x12 strict press"
                        />
                        <button type="button" class="btn btn--ghost btn--sm" (click)="addChip('accessories')">Agregar</button>
                      </div>
                      <div class="wod-chip-list">
                        @for (chip of newClase.wod_plan.accessories; track chip.label + $index) {
                          <button type="button" class="wod-detail__chip wod-detail__chip--editable" [title]="chipTooltip(chip)" (click)="removeChip('accessories', $index)">
                            <span>{{ chip.label }}</span>
                            <i-lucide name="circle-x" />
                          </button>
                        } @empty {
                          <div class="wod-empty-copy">Úsalo para fuerza, técnica o trabajo complementario.</div>
                        }
                      </div>
                    </div>
                  </div>
                }
                <div class="form-group clases-form-group--full">
                  <div class="wod-section-card wod-section-card--primary">
                    <div class="wod-section-card__header">
                      <label class="form-label">WOD central</label>
                      <span class="wod-section-card__meta">Bloque obligatorio</span>
                    </div>
                    <div class="wod-chip-builder">
                      <input
                        class="form-control"
                        type="text"
                        [(ngModel)]="chipDrafts.main.label"
                        name="mainLabel"
                        placeholder="Ej: 12 thrusters + 12 pull-ups"
                      />
                      <button type="button" class="btn btn--ghost btn--sm" (click)="addChip('main')">Agregar</button>
                    </div>
                    <div class="wod-chip-list">
                      @for (chip of newClase.wod_plan.main.items; track chip.label + $index) {
                        <button type="button" class="wod-detail__chip wod-detail__chip--editable" [title]="chipTooltip(chip)" (click)="removeChip('main', $index)">
                          <span>{{ chip.label }}</span>
                          <i-lucide name="circle-x" />
                        </button>
                      } @empty {
                        <div class="wod-empty-copy">Agrega al menos un bloque al WOD central.</div>
                      }
                    </div>
                    <div class="wod-section-card__notes">
                      <label class="form-label">Notas del WOD</label>
                      <textarea
                        class="form-control"
                        [(ngModel)]="newClase.wod_plan.main.notes"
                        name="wodNotes"
                        rows="3"
                        placeholder="Escalas, score target o aclaraciones del día."
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal__footer clases-modal-footer">
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
              {{ describeClase(claseSeleccionada()!) }}
              <span class="modal__title-meta">
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
            <div class="wod-detail">
              <div class="wod-detail__header">
                <span
                  class="wod-format-chip wod-format-chip--strong"
                  [title]="formatDescription(claseSeleccionada()!.wod_formato)"
                >
                  {{ claseSeleccionada()!.wod_formato }}
                </span>
                <span class="wod-detail__format-copy">
                  {{ formatDescription(claseSeleccionada()!.wod_formato) }}
                </span>
              </div>

              @if (claseSeleccionada()!.wod_plan.warmup.length > 0) {
                <div class="wod-detail__section">
                  <div class="wod-detail__label">Calentamiento</div>
                  <div class="wod-detail__chips">
                    @for (chip of claseSeleccionada()!.wod_plan.warmup; track chip.label + $index) {
                      <span class="wod-detail__chip" [title]="chipTooltip(chip)">{{ chip.label }}</span>
                    }
                  </div>
                </div>
              }

              @if (claseSeleccionada()!.wod_plan.accessories.length > 0) {
                <div class="wod-detail__section">
                  <div class="wod-detail__label">Accesorios</div>
                  <div class="wod-detail__chips">
                    @for (chip of claseSeleccionada()!.wod_plan.accessories; track chip.label + $index) {
                      <span class="wod-detail__chip" [title]="chipTooltip(chip)">{{ chip.label }}</span>
                    }
                  </div>
                </div>
              }

              <div class="wod-detail__section">
                <div class="wod-detail__label">WOD central</div>
                <div class="wod-detail__chips">
                  @for (chip of claseSeleccionada()!.wod_plan.main.items; track chip.label + $index) {
                    <span class="wod-detail__chip wod-detail__chip--primary" [title]="chipTooltip(chip)">{{ chip.label }}</span>
                  } @empty {
                    <div class="wod-empty-copy">Sin ejercicios cargados todavía.</div>
                  }
                </div>
              </div>

              @if (claseSeleccionada()!.wod_plan.main.notes) {
                <div class="alert alert--info clases-description-alert">
                  <div class="clases-description-alert__body">
                    <i-lucide name="clipboard" />
                    <span>{{ claseSeleccionada()!.wod_plan.main.notes }}</span>
                  </div>
                </div>
              }
            </div>

            <div class="clases-modal-summary">
              <span class="modal__section-title">
                Inscritos ({{ inscritos().length }} /
                {{ claseSeleccionada()!.capacidad_maxima }})
              </span>
              <div class="clases-modal-summary__actions">
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
                @if (auth.isCoach()) {
                  <button
                    class="btn btn--danger btn--sm"
                    (click)="cancelarClase(claseSeleccionada()!)"
                    [disabled]="
                      claseSeleccionada()!.cancelada ||
                      isActionBusy('cancel', claseSeleccionada()!.id) ||
                      isActionBusy('delete', claseSeleccionada()!.id)
                    "
                  >
                    {{ isActionBusy('cancel', claseSeleccionada()!.id) ? 'Cancelando...' : (claseSeleccionada()!.cancelada ? 'Cancelada' : 'Cancelar') }}
                  </button>
                  <button
                    class="btn btn--ghost btn--sm"
                    (click)="eliminarClase(claseSeleccionada()!)"
                    [disabled]="
                      isActionBusy('cancel', claseSeleccionada()!.id) ||
                      isActionBusy('delete', claseSeleccionada()!.id)
                    "
                  >
                    {{ isActionBusy('delete', claseSeleccionada()!.id) ? 'Eliminando...' : 'Eliminar' }}
                  </button>
                }
              </div>
            </div>

            @if (inscritosLoading()) {
              <div class="clases-modal-empty-state">
                Cargando inscritos...
              </div>
            } @else if (inscritos().length === 0) {
              <div class="clases-modal-empty-state">
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
                      <td class="clases-atleta-cell">
                        <div class="clases-atleta-identity">
                          @if (avatarUrl(ins.profiles?.avatar_url)) {
                            <img
                              class="clases-atleta-avatar"
                              [src]="avatarUrl(ins.profiles?.avatar_url)!"
                              [alt]="'Avatar de ' + (ins.profiles?.nombre_completo ?? 'Atleta')"
                            />
                          } @else {
                            <div class="clases-atleta-avatar clases-atleta-avatar--fallback">
                              {{ profileInitials(ins.profiles?.nombre_completo) }}
                            </div>
                          }
                          <span>{{ ins.profiles?.nombre_completo ?? '—' }}</span>
                        </div>
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
                          <div class="clases-assistance-actions">
                            <button
                              class="btn btn--sm btn--ghost"
                              (click)="marcarAsistencia(ins.id, true)"
                              [disabled]="ins.estado === 'asistio' || isActionBusy('attendance', ins.id)"
                              title="Asistió"
                            >
                              Asistió
                            </button>
                            <button
                              class="btn btn--sm btn--danger"
                              (click)="marcarAsistencia(ins.id, false)"
                              [disabled]="ins.estado === 'no_asistio' || isActionBusy('attendance', ins.id)"
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
      .clases-alert {
        margin-bottom: 20px;
      }
      .clases-toolbar {
        margin-bottom: 20px;
      }
      .clases-toolbar__nav,
      .clases-toolbar__actions {
        display: flex;
        align-items: center;
      }
      .clases-toolbar__nav {
        gap: 12px;
      }
      .clases-toolbar__actions {
        gap: 10px;
      }
      .clases-view-toggle {
        display: flex;
        overflow: hidden;
        border: 1px solid #2b3033;
        border-radius: 8px;
      }
      .clases-view-toggle__button {
        border-radius: 0;
      }
      .clases-filter-select {
        width: auto;
        height: 38px;
      }
      .clases-empty-state,
      .clases-modal-empty-state {
        text-align: center;
        color: #938c84;
      }
      .clases-empty-state {
        padding: 40px;
      }
      .clases-modal-empty-state {
        padding: 24px;
      }
      .clases-table-cell {
        font-size: 13px;
      }
      .clases-form-group--full {
        grid-column: 1 / -1;
      }
      .clases-static-field {
        min-height: 42px;
        border: 1px solid #2b3033;
        border-radius: 10px;
        background: #1d2022;
        color: #f4f1eb;
        display: flex;
        align-items: center;
        padding: 0 14px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .form-helper {
        color: #938c84;
        font-size: 12px;
        line-height: 1.4;
      }
      .clases-modal-footer {
        margin-top: 20px;
        padding: 0;
      }
      .wod-optional-sections {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px;
        border: 1px dashed rgba(147, 140, 132, 0.32);
        border-radius: 14px;
        background: rgba(244, 241, 235, 0.03);
      }
      .wod-optional-sections__label {
        color: #938c84;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .wod-optional-sections__actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .wod-section-card {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
        border-radius: 16px;
        border: 1px solid rgba(244, 241, 235, 0.08);
        background: rgba(29, 32, 34, 0.84);
      }
      .wod-section-card--primary {
        border-color: rgba(166, 31, 36, 0.26);
        background: rgba(166, 31, 36, 0.08);
      }
      .wod-section-card__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .wod-section-card__meta {
        color: #938c84;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .wod-section-card__notes {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wod-table-cell {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wod-format-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(166, 31, 36, 0.28);
        background: rgba(166, 31, 36, 0.14);
        color: #f4f1eb;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .wod-format-chip--compact {
        padding: 4px 8px;
        font-size: 10px;
      }
      .wod-format-chip--strong {
        background: rgba(166, 31, 36, 0.2);
        border-color: rgba(166, 31, 36, 0.42);
      }
      .wod-chip-builder {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) auto;
        gap: 10px;
      }
      .wod-chip-list,
      .wod-detail__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      .wod-empty-copy {
        color: #938c84;
        font-size: 13px;
      }
      .wod-detail {
        display: flex;
        flex-direction: column;
        gap: 18px;
        margin-bottom: 18px;
      }
      .wod-detail__header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }
      .wod-detail__format-copy {
        color: #d2cbc1;
        font-size: 14px;
        line-height: 1.6;
      }
      .wod-detail__section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wod-detail__label {
        color: #938c84;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .wod-detail__chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(244, 241, 235, 0.06);
        border: 1px solid rgba(244, 241, 235, 0.08);
        color: #f4f1eb;
        font-size: 13px;
        line-height: 1.3;
      }
      .wod-detail__chip--primary {
        background: rgba(166, 31, 36, 0.14);
        border-color: rgba(166, 31, 36, 0.28);
      }
      .wod-detail__chip--editable {
        cursor: pointer;
      }
      .wod-detail__chip--editable i-lucide {
        width: 12px;
        height: 12px;
      }
      .week-calendar {
        background: #151718;
        border: 1px solid #2b3033;
        border-radius: 12px;
        overflow: hidden;
        overflow-x: auto;
      }
      .week-toolbar__label {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 16px;
        letter-spacing: 0.05em;
        color: #f4f1eb;
      }
      .class-type-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .modal__title-meta {
        font-family: 'Manrope', sans-serif;
        font-size: 14px;
        font-weight: 500;
        color: #938c84;
        text-transform: none;
      }
      .modal__section-title {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 16px;
        color: #f4f1eb;
        text-transform: uppercase;
      }
      .clases-description-alert {
        margin-bottom: 16px;
      }
      .clases-description-alert__body {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .clases-modal-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .clases-modal-summary__actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
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
      .clases-atleta-identity {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }
      .clases-atleta-avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid rgba(166, 31, 36, 0.35);
        flex-shrink: 0;
      }
      .clases-atleta-avatar--fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #a61f24, #6f161a);
        color: #f4f1eb;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .week-calendar__header {
        display: grid;
        grid-template-columns: repeat(7, minmax(140px, 1fr));
        border-bottom: 1px solid #2b3033;
      }
      .week-calendar__day-header {
        padding: 12px 8px;
        text-align: center;
        border-right: 1px solid #1d2022;
        &.today {
          background: rgba(166, 31, 36, 0.14);
        }
      }
      .week-calendar__day-name {
        font-family: 'Manrope', sans-serif;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #938c84;
      }
      .week-calendar__day-num {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 22px;
        color: #f4f1eb;
        line-height: 1.2;
        margin-top: 2px;
        &.today {
          color: #a61f24;
        }
      }
      .week-calendar__body {
        display: grid;
        grid-template-columns: repeat(7, minmax(140px, 1fr));
        min-height: 200px;
      }
      .week-calendar__col {
        border-right: 1px solid #1d2022;
        padding: 8px;
        min-height: 120px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        &.today {
          background: rgba(166, 31, 36, 0.08);
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
        border-left: 3px solid transparent;
        transition: transform 0.2s ease, border-color 0.2s ease;
        &:hover {
          transform: translateY(-1px);
        }
      }
      .week-event__time {
        font-family: 'Manrope', sans-serif;
        font-size: 10px;
        font-weight: 600;
        color: #938c84;
        margin-bottom: 2px;
      }
      .week-event__title {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 14px;
        letter-spacing: 0.05em;
        color: #f4f1eb;
      }
      .week-event__desc {
        font-size: 10px;
        color: rgba(244, 241, 235, 0.72);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 2px;
      }
      .week-event__coach {
        font-size: 10px;
        color: rgba(210, 203, 193, 0.7);
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
        color: rgba(244, 241, 235, 0.82);
      }
      .week-event--wod {
        background: rgba(166, 31, 36, 0.24);
        border-left-color: #a61f24;
      }
      .row-cancelled td {
        opacity: 0.5;
        text-decoration: line-through;
      }
      .clases-atleta-cell {
        color: #f4f1eb;
        font-weight: 600;
      }
      .clases-assistance-actions {
        display: flex;
        gap: 8px;
      }
      @media (max-width: 900px) {
        .clases-athlete-summary {
          grid-template-columns: 1fr;
        }
        .clases-modal-summary {
          flex-direction: column;
          align-items: stretch;
        }
        .clases-modal-summary__actions {
          justify-content: stretch;
        }
        .wod-optional-sections {
          flex-direction: column;
          align-items: stretch;
        }
        .wod-optional-sections__actions {
          justify-content: stretch;
        }
        .wod-section-card__header {
          align-items: flex-start;
        }
        .wod-chip-builder {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ClasesComponent implements OnInit {
  auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private confirmDialog = inject(ConfirmDialogService);
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
  actionLoading = signal<Record<string, boolean>>({});

  vista = signal<Vista>('semana');
  showFormClase = signal(false);
  claseSeleccionada = signal<Clase | null>(null);
  filterFormato = signal('');
  readonly wodFormatOptions = WOD_FORMAT_OPTIONS;
  optionalBlocks = signal<Record<Exclude<WodBlockKey, 'main'>, boolean>>({
    warmup: false,
    accessories: false,
  });
  chipDrafts = {
    warmup: { label: '' },
    accessories: { label: '' },
    main: { label: '' },
  };

  // Semana actual
  private semanaBase = signal(getStartOfEcuadorWeek());

  diasSemana = computed(() => {
    const lunes = this.semanaBase();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(lunes, i);
      return {
        fecha: formatEcuadorDate(d, 'yyyy-MM-dd'),
        nombre: formatEcuadorDate(d, 'EEE'),
        num: formatEcuadorDate(d, 'd'),
        esHoy: formatEcuadorDate(d, 'yyyy-MM-dd') === getEcuadorTodayYmd(),
      };
    });
  });

  semanaLabel = computed(() => {
    const lunes = this.semanaBase();
    const domingo = addDays(lunes, 6);
    return `${formatEcuadorDate(lunes, 'd MMM')} – ${formatEcuadorDate(domingo, 'd MMM yyyy')}`;
  });

  clasesFiltradas = computed(() => {
    const formato = this.filterFormato();
    if (!formato) return this.clases();
    return this.clases().filter((clase) => clase.wod_formato === formato);
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

  newClase: ClaseFormState = this.emptyClase();

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
    this.semanaBase.set(getStartOfEcuadorWeek());
    void this.cargarClases();
  }

  async cargarClases() {
    this.loading.set(true);
    const lunes = formatEcuadorDate(this.semanaBase(), 'yyyy-MM-dd');
    const domingo = formatEcuadorDate(addDays(this.semanaBase(), 6), 'yyyy-MM-dd');
    const hoy = getEcuadorTodayYmd();
    const fechaInicio = this.auth.isCoach() ? lunes : (lunes < hoy ? hoy : lunes);

    if (fechaInicio > domingo) {
      this.clases.set([]);
      this.inscritosPorClase.set({});
      this.loading.set(false);
      return;
    }

    try {
      const { data, error } = await this.supabase.getClases({
        semana: `${fechaInicio},${domingo}`,
      });

      if (error) {
        this.sentry.captureError(error, {
          action: 'cargarClases',
          semana: lunes,
        });
        this.toast.error('Error cargando clases');
        return;
      }

      const clases = ((data ?? []) as unknown as Clase[]).map((clase) => this.normalizeClase(clase));
      this.clases.set(clases);
      await this.cargarResumenInscritos(clases);
    } catch (error) {
      this.sentry.captureError(error, {
        action: 'cargarClasesUnexpected',
        semana: lunes,
      });
      this.toast.error('No se pudieron cargar las clases');
    } finally {
      this.loading.set(false);
    }
  }

  onFilterFormatoChange(formato: string) {
    this.filterFormato.set(formato);
  }

  onFormatChange(formato: WodFormat) {
    this.newClase.wod_formato = formato;
    this.newClase.wod_plan.main.format = formato;
  }

  async cargarMisInscripciones() {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    const { data } = await this.supabase.getInscripcionesByUser(userId);
    const inscripciones = ((data ?? []) as unknown as MiInscripcion[]).map((inscripcion) => ({
      ...inscripcion,
      clases: inscripcion.clases
        ? this.normalizeClase(inscripcion.clases as unknown as Clase)
        : inscripcion.clases,
    }));
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
    return this.semanaBase().getTime() > getStartOfEcuadorWeek().getTime();
  }

  puedeInscribirse(clase: Clase): boolean {
    return this.claseStart(clase).getTime() > new Date().getTime();
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
    if (this.auth.isCoach()) return true;
    return this.claseEnd(clase).getTime() > new Date().getTime();
  }

  private claseStart(clase: Pick<Clase, 'fecha' | 'hora_inicio'>): Date {
    return parseEcuadorDateTime(clase.fecha, clase.hora_inicio);
  }

  private claseEnd(clase: Pick<Clase, 'fecha' | 'hora_inicio' | 'hora_fin'>): Date {
    return parseEcuadorDateTime(clase.fecha, clase.hora_fin ?? clase.hora_inicio);
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
    this.resetChipDrafts();
    this.resetOptionalBlocks();
    this.showFormClase.set(true);
  }

  async crearClase() {
    if (!this.newClase.fecha || this.newClase.wod_plan.main.items.length === 0) {
      this.toast.warning('Agrega al menos un ejercicio al WOD central.');
      return;
    }

    const inicioClase = parseEcuadorDateTime(
      this.newClase.fecha,
      this.newClase.hora_inicio,
    );
    const finClase = parseEcuadorDateTime(
      this.newClase.fecha,
      this.newClase.hora_fin,
    );
    const ahora = getEcuadorNow();

    if (finClase.getTime() <= inicioClase.getTime()) {
      this.toast.warning('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    if (inicioClase.getTime() <= ahora.getTime()) {
      this.toast.warning('No puedes crear un WOD en una fecha u hora que ya pasó.');
      return;
    }

    this.savingClase.set(true);
    try {
      const coachId = this.auth.currentUser()?.id;
      const { error } = await this.supabase.createClase({
        ...this.newClase,
        tipo: 'WOD',
        cancelada: false,
        descripcion: this.buildDescription(this.newClase.wod_plan),
        wod_formato: this.newClase.wod_formato,
        wod_plan: this.newClase.wod_plan,
        coach_id: coachId,
      });
      if (error) {
        this.sentry.captureError(error, { action: 'crearClase' });
        this.toast.error(error.message);
        return;
      }
      this.toast.success('WOD creado');
      this.showFormClase.set(false);
      this.newClase = this.emptyClase();
      this.resetChipDrafts();
      this.resetOptionalBlocks();
      await this.cargarClases();
    } catch {
      this.toast.error('No se pudo guardar la clase');
    } finally {
      this.savingClase.set(false);
    }
  }

  async verClase(clase: Clase) {
    this.claseSeleccionada.set(clase);
    this.inscritos.set([]);
    this.inscritosLoading.set(true);
    try {
      const { data, error } = await this.supabase.getInscripcionesByClase(clase.id);
      if (error) {
        this.toast.error(error.message);
        return;
      }

      this.inscritos.set((data ?? []) as unknown as Inscripcion[]);
    } catch {
      this.toast.error('No se pudieron cargar los inscritos');
    } finally {
      this.inscritosLoading.set(false);
    }
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
    this.setActionBusy('attendance', inscripcionId, true);
    try {
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
    } catch {
      this.toast.error('No se pudo registrar la asistencia');
    } finally {
      this.setActionBusy('attendance', inscripcionId, false);
    }
  }

  async cancelarClase(clase: Clase) {
    if (this.isActionBusy('cancel', clase.id) || this.isActionBusy('delete', clase.id)) return;

    const motivo = prompt('Motivo de cancelación (opcional):') ?? '';
    this.setActionBusy('cancel', clase.id, true);
    try {
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
    } catch {
      this.toast.error('No se pudo cancelar la clase');
    } finally {
      this.setActionBusy('cancel', clase.id, false);
    }
  }

  async eliminarClase(clase: Clase) {
    const confirmacion = await this.confirmDialog.open({
      title: 'Eliminar clase',
      message: `Se eliminará "${this.describeClase(clase)}" del ${clase.fecha} a las ${clase.hora_inicio}. También se quitarán sus inscripciones.`,
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'No, cancelar',
      tone: 'danger',
    });

    if (!confirmacion) return;

    this.setActionBusy('delete', clase.id, true);
    try {
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
    } catch {
      this.toast.error('No se pudo eliminar la clase');
    } finally {
      this.setActionBusy('delete', clase.id, false);
    }
  }

  isActionBusy(action: string, id: number) {
    return this.actionLoading()[`${action}:${id}`] === true;
  }

  private setActionBusy(action: string, id: number, busy: boolean) {
    const key = `${action}:${id}`;
    this.actionLoading.update((state) => {
      if (!busy) {
        const { [key]: _removed, ...rest } = state;
        return rest;
      }

      return { ...state, [key]: true };
    });
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

  avatarUrl(path?: string | null) {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return this.supabase.getProfileAvatarUrl(path);
  }

  profileInitials(name?: string | null) {
    return (name ?? 'Atleta')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'AT';
  }

  tipoBg(tipo: string): string {
    return (
      (
        {
          WOD: CLASE_THEME.primarySoftStrong,
        } as Record<string, string>
      )[tipo] ?? CLASE_THEME.neutralSoft
    );
  }

  tipoColor(tipo: string): string {
    return (
      (
        {
          WOD: CLASE_THEME.primary,
        } as Record<string, string>
      )[tipo] ?? CLASE_THEME.textMuted
    );
  }

  tipoClass(tipo: string): string {
    return tipo.toLowerCase().replace(/\s+/g, '-');
  }

  formatDescription(formatOption: WodFormat): string {
    return WOD_FORMAT_DESCRIPTIONS[formatOption];
  }

  chipTooltip(chip: WodChip): string {
    return chip.label;
  }

  describeClase(clase: Pick<Clase, 'tipo' | 'wod_formato'>): string {
    return `${clase.tipo} · ${clase.wod_formato}`;
  }

  clasePreview(clase: Pick<Clase, 'wod_plan'>): string {
    const warmup = clase.wod_plan.warmup.map((chip) => chip.label);
    const accessories = clase.wod_plan.accessories.map((chip) => chip.label);
    const main = clase.wod_plan.main.items.map((chip) => chip.label);
    return [...warmup, ...accessories, ...main].slice(0, 3).join(' · ');
  }

  isOptionalBlockActive(block: Exclude<WodBlockKey, 'main'>) {
    return this.optionalBlocks()[block];
  }

  activateOptionalBlock(block: Exclude<WodBlockKey, 'main'>) {
    this.optionalBlocks.update((state) => ({ ...state, [block]: true }));
  }

  deactivateOptionalBlock(block: Exclude<WodBlockKey, 'main'>) {
    this.optionalBlocks.update((state) => ({ ...state, [block]: false }));

    if (block === 'warmup') {
      this.newClase.wod_plan.warmup = [];
    } else {
      this.newClase.wod_plan.accessories = [];
    }

    this.chipDrafts[block] = { label: '' };
  }

  addChip(block: WodBlockKey) {
    const draft = this.chipDrafts[block];
    const label = draft.label.trim();
    if (!label) return;

    const item: WodChip = { label };

    if (block === 'main') {
      this.newClase.wod_plan.main.items = [...this.newClase.wod_plan.main.items, item];
    } else {
      const currentList = block === 'warmup'
        ? this.newClase.wod_plan.warmup
        : this.newClase.wod_plan.accessories;
      const nextList = [...currentList, item];

      if (block === 'warmup') {
        this.newClase.wod_plan.warmup = nextList;
      } else {
        this.newClase.wod_plan.accessories = nextList;
      }
    }

    this.chipDrafts[block] = { label: '' };
  }

  removeChip(block: WodBlockKey, index: number) {
    if (block === 'main') {
      this.newClase.wod_plan.main.items = this.newClase.wod_plan.main.items.filter((_, itemIndex) => itemIndex !== index);
      return;
    }

    const currentList = block === 'warmup'
      ? this.newClase.wod_plan.warmup
      : this.newClase.wod_plan.accessories;
    const nextList = currentList.filter((_, itemIndex) => itemIndex !== index);

    if (block === 'warmup') {
      this.newClase.wod_plan.warmup = nextList;
    } else {
      this.newClase.wod_plan.accessories = nextList;
    }
  }

  private buildDescription(plan: WodPlan) {
    const labels = plan.main.items.map((item) => item.label).join(' · ');
    return plan.main.notes?.trim() || (labels ? `${plan.main.format}: ${labels}` : plan.main.format);
  }

  private normalizeClase<T extends Partial<Clase>>(clase: T): T & Pick<Clase, 'tipo' | 'wod_formato' | 'wod_plan' | 'descripcion'> {
    const rawPlan = clase.wod_plan as WodPlan | null | undefined;
    const mainFormat = rawPlan?.main?.format ?? clase.wod_formato ?? 'FOR TIME';

    return {
      ...clase,
      cancelada: clase.cancelada ?? false,
      tipo: 'WOD',
      wod_formato: mainFormat,
      descripcion: clase.descripcion ?? '',
      wod_plan: {
        warmup: this.normalizeChipList(rawPlan?.warmup),
        accessories: this.normalizeChipList(rawPlan?.accessories),
        main: {
          format: mainFormat,
          items: this.normalizeChipList(rawPlan?.main?.items),
          notes: rawPlan?.main?.notes ?? clase.descripcion ?? '',
        },
      },
    };
  }

  private normalizeChipList(list: WodChip[] | undefined | null): WodChip[] {
    return (list ?? [])
      .map((chip) => ({
        label: chip?.label?.trim() ?? '',
      }))
      .filter((chip) => chip.label.length > 0);
  }

  private emptyClase(): ClaseFormState {
    const now = getEcuadorNow();
    const startAt = this.roundToNextHalfHour(now);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

    return {
      tipo: 'WOD',
      fecha: getEcuadorTodayYmd(),
      hora_inicio: this.formatTime(startAt),
      hora_fin: this.formatTime(endAt),
      capacidad_maxima: 20,
      descripcion: '',
      wod_formato: 'FOR TIME' as WodFormat,
      wod_plan: {
        warmup: [],
        accessories: [],
        main: {
          format: 'FOR TIME' as WodFormat,
          items: [],
          notes: '',
        },
      },
    };
  }

  private resetChipDrafts() {
    this.chipDrafts = {
      warmup: { label: '' },
      accessories: { label: '' },
      main: { label: '' },
    };
  }

  private resetOptionalBlocks() {
    this.optionalBlocks.set({
      warmup: this.newClase.wod_plan.warmup.length > 0,
      accessories: this.newClase.wod_plan.accessories.length > 0,
    });
  }

  private roundToNextHalfHour(date: Date): Date {
    const next = new Date(date);
    next.setSeconds(0, 0);

    const minutes = next.getMinutes();

    if (minutes === 0 || minutes === 30) {
      return next;
    }

    if (minutes < 30) {
      next.setMinutes(30);
      return next;
    }

    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
