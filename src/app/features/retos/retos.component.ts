import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SentryService } from '../../core/services/sentry.service';
import { Reto, RetoParticipante, RetoPayload, RetoTipo, RetoLeaderboardRow } from '../../core/models/reto.model';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

interface RetoForm {
  titulo: string;
  descripcion: string;
  tipo: RetoTipo;
  premio: string;
  meta_porcentaje: number;
  fecha_inicio: string;
  fecha_fin: string;
}

function emptyForm(): RetoForm {
  const today = new Date().toISOString().slice(0, 10);
  return { titulo: '', descripcion: '', tipo: 'manual', premio: '', meta_porcentaje: 90, fecha_inicio: today, fecha_fin: '' };
}

@Component({
  selector: 'app-retos',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Comunidad</span>
      <h2 class="page-header__title">Retos</h2>
      <p class="page-header__subtitle">
        @if (auth.canManageBusinessOperations()) {
          {{ retos().length }} reto{{ retos().length !== 1 ? 's' : '' }} en total
        } @else {
          Inscríbete en los retos activos y compite con tus compañeros.
        }
      </p>
    </div>

    <!-- ════ Vista Coach/Admin ════ -->
    @if (auth.canManageBusinessOperations()) {

      <div class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Todos los retos</span>
          <div class="toolbar-row">
            <label class="retos-toggle-label">
              <input type="checkbox" [(ngModel)]="mostrarInactivos" (ngModelChange)="cargarRetos()" />
              Mostrar inactivos
            </label>
            <button class="btn btn--primary btn--sm" type="button" (click)="abrirModalCrear()">
              <i-lucide name="plus" [size]="14" />
              Nuevo reto
            </button>
          </div>
        </div>

        @if (loadingRetos()) {
          <div class="retos-empty">Cargando retos...</div>
        } @else if (retos().length === 0) {
          <div class="retos-empty">No hay retos aún. Crea el primero.</div>
        } @else {
          <div class="retos-grid">
            @for (reto of retos(); track reto.id) {
              <article
                class="reto-card"
                [class.reto-card--selected]="selectedReto()?.id === reto.id"
                [class.reto-card--inactivo]="!reto.activo"
                (click)="seleccionarReto(reto)"
              >
                <div class="reto-card__header">
                  <span class="badge" [class.badge--activo]="reto.activo" [class.badge--inactivo]="!reto.activo">
                    {{ reto.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                  <span class="reto-card__tipo">{{ reto.tipo === 'asistencia' ? 'Asistencia' : 'Manual' }}</span>
                </div>
                <h3 class="reto-card__titulo">{{ reto.titulo }}</h3>
                @if (reto.descripcion) {
                  <p class="reto-card__descripcion">{{ reto.descripcion }}</p>
                }
                <div class="reto-card__premio">
                  <i-lucide name="trophy" [size]="13" />
                  <span>{{ reto.premio }}</span>
                </div>
                <div class="reto-card__fechas">
                  {{ reto.fecha_inicio | dateEc }} — {{ reto.fecha_fin ? (reto.fecha_fin | dateEc) : 'Sin fecha fin' }}
                </div>
                <div class="reto-card__actions" (click)="$event.stopPropagation()">
                  <button class="btn btn--ghost btn--sm btn--icon" title="Editar" (click)="abrirModalEditar(reto)">
                    <i-lucide name="pencil" [size]="14" />
                  </button>
                  <button class="btn btn--ghost btn--sm btn--icon" [title]="reto.activo ? 'Desactivar' : 'Activar'" (click)="toggleActivo(reto)">
                    <i-lucide [name]="reto.activo ? 'eye-off' : 'eye'" [size]="14" />
                  </button>
                </div>
              </article>
            }
          </div>
        }
      </div>

      <!-- Panel participantes / leaderboard (coach) -->
      @if (selectedReto()) {
        <div class="data-table-wrapper retos-participantes-panel">
          <div class="data-table-wrapper__header">
            <span class="data-table-wrapper__title">
              @if (selectedReto()!.tipo === 'asistencia') { Ranking de asistencia }
              @else { Participantes }
              — {{ selectedReto()!.titulo }}
            </span>
            <div class="toolbar-row">
              <button class="btn btn--ghost btn--sm" (click)="refrescarPanel()" [disabled]="loadingPanel()">
                <i-lucide name="loader-circle" [size]="14" [class.icon-spin]="loadingPanel()" />
                Actualizar
              </button>
              <button class="btn btn--ghost btn--sm btn--icon" (click)="selectedReto.set(null)">
                <i-lucide name="circle-x" [size]="16" />
              </button>
            </div>
          </div>

          @if (loadingPanel()) {
            <div class="retos-empty">Cargando...</div>
          } @else if (selectedReto()!.tipo === 'asistencia') {
            <!-- Leaderboard de asistencia -->
            @if (leaderboard().length === 0) {
              <div class="retos-empty">Ningún atleta inscrito aún.</div>
            } @else {
              <div class="retos-leaderboard">
                <div class="retos-lb-head">
                  <span>#</span>
                  <span>Atleta</span>
                  <span>Inscrito desde</span>
                  <span>Asistencias</span>
                  <span>%</span>
                  <span></span>
                </div>
                @for (row of leaderboard(); track row.user_id; let i = $index) {
                  <div class="retos-lb-row" [class.retos-lb-row--top]="i < 3">
                    <div class="retos-lb-rank">
                      @if (i === 0) { 🥇 }
                      @else if (i === 1) { 🥈 }
                      @else if (i === 2) { 🥉 }
                      @else { {{ i + 1 }} }
                    </div>
                    <div class="retos-lb-atleta">
                      @if (row.avatar_url) {
                        <img class="retos-lb-avatar" [src]="getAvatarUrl(row.avatar_url)" [alt]="row.nombre_atleta" />
                      } @else {
                        <div class="retos-lb-avatar retos-lb-avatar--initials">{{ initials(row.nombre_atleta) }}</div>
                      }
                      <div class="retos-lb-atleta-info">
                        <strong>{{ row.nombre_atleta }}</strong>
                        @if (row.id_cliente) { <span>{{ row.id_cliente }}</span> }
                      </div>
                    </div>
                    <div class="retos-lb-fecha">{{ row.fecha_desde | dateEc }}</div>
                    <div class="retos-lb-stat">
                      <span class="retos-lb-stat__num">{{ row.asistencias }}</span>
                      <span class="retos-lb-stat__label">días</span>
                    </div>
                    <div class="retos-lb-pct" [class.retos-lb-pct--meta]="row.porcentaje >= (selectedReto()!.meta_porcentaje ?? 90)">
                      {{ row.porcentaje }}%
                    </div>
                    <div class="retos-lb-actions">
                      <button class="btn btn--ghost btn--sm btn--icon" title="Quitar del reto" (click)="quitarParticipanteLb(row)">
                        <i-lucide name="trash" [size]="13" />
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          } @else {
            <!-- Lista simple para retos manuales -->
            @if (participantes().length === 0) {
              <div class="retos-empty">Ningún atleta inscrito aún.</div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Atleta</th>
                    <th>ID cliente</th>
                    <th>Inscrito el</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of participantes(); track p.id; let i = $index) {
                    <tr>
                      <td>{{ i + 1 }}</td>
                      <td class="data-table__cell--primary">
                        <div class="retos-atleta-cell">
                          @if (p['avatar_url']) {
                            <img class="retos-lb-avatar retos-lb-avatar--sm" [src]="getAvatarUrl(p['avatar_url'])" />
                          } @else {
                            <div class="retos-lb-avatar retos-lb-avatar--sm retos-lb-avatar--initials">{{ initials(p.nombre_atleta) }}</div>
                          }
                          {{ p.nombre_atleta || '—' }}
                        </div>
                      </td>
                      <td>{{ p.id_cliente || '—' }}</td>
                      <td>{{ p.inscrito_at | dateEc:'dd/MM/yyyy' }}</td>
                      <td class="data-table__cell--actions">
                        <button class="btn btn--ghost btn--sm btn--icon" title="Quitar del reto" (click)="quitarParticipante(p)">
                          <i-lucide name="trash" [size]="14" />
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        </div>
      }

    <!-- ════ Vista Atleta ════ -->
    } @else {

      @if (loadingRetos()) {
        <div class="retos-empty">Cargando retos...</div>
      } @else if (retos().length === 0) {
        <div class="retos-empty">No hay retos activos en este momento.</div>
      } @else {
        <div class="retos-grid">
          @for (reto of retos(); track reto.id) {
            <article
              class="reto-card"
              [class.reto-card--selected]="selectedReto()?.id === reto.id"
              (click)="seleccionarReto(reto)"
            >
              <div class="reto-card__header">
                <span class="badge badge--activo">Activo</span>
                <span class="reto-card__tipo">{{ reto.tipo === 'asistencia' ? 'Asistencia' : 'Manual' }}</span>
              </div>
              <h3 class="reto-card__titulo">{{ reto.titulo }}</h3>
              @if (reto.descripcion) {
                <p class="reto-card__descripcion">{{ reto.descripcion }}</p>
              }
              <div class="reto-card__premio">
                <i-lucide name="trophy" [size]="13" />
                <span>{{ reto.premio }}</span>
              </div>
              @if (reto.tipo === 'asistencia' && reto.meta_porcentaje) {
                <div class="reto-card__meta">
                  Meta: {{ reto.meta_porcentaje }}% de asistencia
                </div>
              }
              <div class="reto-card__fechas">
                {{ reto.fecha_inicio | dateEc }} — {{ reto.fecha_fin ? (reto.fecha_fin | dateEc) : 'Sin fecha fin' }}
              </div>
              <div class="reto-card__footer" (click)="$event.stopPropagation()">
                @if (estaInscrito(reto.id)) {
                  <button class="btn btn--ghost btn--sm" (click)="desinscribirse(reto)" [disabled]="inscribiendo()">Desinscribirme</button>
                  <span class="reto-card__inscrito-badge">✓ Inscrito</span>
                } @else {
                  <button class="btn btn--primary btn--sm" (click)="inscribirse(reto)" [disabled]="inscribiendo()">
                    {{ inscribiendo() ? 'Inscribiendo...' : 'Inscribirme' }}
                  </button>
                }
              </div>
            </article>
          }
        </div>

        <!-- Panel leaderboard / participantes (atleta) -->
        @if (selectedReto()) {
          <div class="data-table-wrapper retos-participantes-panel">
            <div class="data-table-wrapper__header">
              <span class="data-table-wrapper__title">
                @if (selectedReto()!.tipo === 'asistencia') { Ranking de asistencia }
                @else { Atletas inscritos }
                — {{ selectedReto()!.titulo }}
              </span>
              <button class="btn btn--ghost btn--sm btn--icon" (click)="selectedReto.set(null)">
                <i-lucide name="circle-x" [size]="16" />
              </button>
            </div>

            @if (loadingPanel()) {
              <div class="retos-empty">Cargando...</div>
            } @else if (selectedReto()!.tipo === 'asistencia') {
              @if (leaderboard().length === 0) {
                <div class="retos-empty">Sé el primero en inscribirte.</div>
              } @else {
                <div class="retos-leaderboard">
                  <div class="retos-lb-head retos-lb-head--atleta">
                    <span>#</span>
                    <span>Atleta</span>
                    <span>Asistencias</span>
                    <span>%</span>
                  </div>
                  @for (row of leaderboard(); track row.user_id; let i = $index) {
                    <div class="retos-lb-row" [class.retos-lb-row--top]="i < 3" [class.retos-lb-row--yo]="row.user_id === miUserId()">
                      <div class="retos-lb-rank">
                        @if (i === 0) { 🥇 }
                        @else if (i === 1) { 🥈 }
                        @else if (i === 2) { 🥉 }
                        @else { {{ i + 1 }} }
                      </div>
                      <div class="retos-lb-atleta">
                        @if (row.avatar_url) {
                          <img class="retos-lb-avatar" [src]="getAvatarUrl(row.avatar_url)" [alt]="row.nombre_atleta" />
                        } @else {
                          <div class="retos-lb-avatar retos-lb-avatar--initials">{{ initials(row.nombre_atleta) }}</div>
                        }
                        <div class="retos-lb-atleta-info">
                          <strong>{{ row.nombre_atleta }}{{ row.user_id === miUserId() ? ' (tú)' : '' }}</strong>
                        </div>
                      </div>
                      <div class="retos-lb-stat">
                        <span class="retos-lb-stat__num">{{ row.asistencias }}</span>
                        <span class="retos-lb-stat__label">días</span>
                      </div>
                      <div class="retos-lb-pct" [class.retos-lb-pct--meta]="row.porcentaje >= (selectedReto()!.meta_porcentaje ?? 90)">
                        {{ row.porcentaje }}%
                      </div>
                    </div>
                  }
                </div>
              }
            } @else {
              <!-- Lista simple para retos manuales -->
              @if (participantes().length === 0) {
                <div class="retos-empty">¡Sé el primero en inscribirte!</div>
              } @else {
                <div class="retos-atletas-list">
                  @for (p of participantes(); track p.id; let i = $index) {
                    <div class="retos-atleta-row">
                      <div class="retos-atleta-rank">{{ i + 1 }}</div>
                      <div class="retos-lb-atleta">
                        @if (p['avatar_url']) {
                          <img class="retos-lb-avatar retos-lb-avatar--sm" [src]="getAvatarUrl(p['avatar_url'])" />
                        } @else {
                          <div class="retos-lb-avatar retos-lb-avatar--sm retos-lb-avatar--initials">{{ initials(p.nombre_atleta) }}</div>
                        }
                        <div class="retos-lb-atleta-info">
                          <strong>{{ p.nombre_atleta || 'Atleta' }}{{ p.user_id === miUserId() ? ' (tú)' : '' }}</strong>
                        </div>
                      </div>
                      <div class="retos-atleta-fecha">{{ p.inscrito_at | dateEc:'dd/MM/yyyy' }}</div>
                    </div>
                  }
                </div>
              }
            }
          </div>
        }
      }
    }

    <!-- ════ Modal crear / editar ════ -->
    @if (modalMode()) {
      <div class="modal-backdrop" (click)="cerrarModal()">
        <div class="modal modal--wide" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">{{ modalMode() === 'crear' ? 'Nuevo reto' : 'Editar reto' }}</h3>
            <button class="btn btn--ghost btn--sm btn--icon" (click)="cerrarModal()">
              <i-lucide name="circle-x" [size]="18" />
            </button>
          </div>
          <div class="modal__body">
            <form (ngSubmit)="guardarReto()">
              <div class="two-column-grid">

                <div class="form-group" style="grid-column: 1 / -1">
                  <label class="form-label">Título *</label>
                  <input class="form-control" type="text" [(ngModel)]="form.titulo" name="titulo"
                    placeholder="Ej: Reto 30 días sin faltar" required />
                </div>

                <div class="form-group" style="grid-column: 1 / -1">
                  <label class="form-label">Descripción</label>
                  <textarea class="form-control" style="min-height:80px;resize:vertical"
                    [(ngModel)]="form.descripcion" name="descripcion"
                    placeholder="En qué consiste el reto..."></textarea>
                </div>

                <div class="form-group" style="grid-column: 1 / -1">
                  <label class="form-label">Premio *</label>
                  <input class="form-control" type="text" [(ngModel)]="form.premio" name="premio"
                    placeholder="Ej: Camiseta oficial + shoutout en redes" required />
                </div>

                <div class="form-group">
                  <label class="form-label">Tipo</label>
                  <select class="form-control" [(ngModel)]="form.tipo" name="tipo">
                    <option value="manual">Manual</option>
                    <option value="asistencia">Por asistencia</option>
                  </select>
                </div>

                @if (form.tipo === 'asistencia') {
                  <div class="form-group">
                    <label class="form-label">Meta de asistencia (%)</label>
                    <input class="form-control" type="number" [(ngModel)]="form.meta_porcentaje"
                      name="meta_porcentaje" min="1" max="100" />
                  </div>
                }

                <div class="form-group">
                  <label class="form-label">Fecha inicio *</label>
                  <input class="form-control" type="date" [(ngModel)]="form.fecha_inicio" name="fecha_inicio" required />
                </div>

                <div class="form-group">
                  <label class="form-label">Fecha fin</label>
                  <input class="form-control" type="date" [(ngModel)]="form.fecha_fin" name="fecha_fin" />
                </div>

              </div>

              @if (modalError()) {
                <div class="alert alert--error" style="margin-top:16px">{{ modalError() }}</div>
              }

              <div class="modal__footer">
                <button type="button" class="btn btn--ghost" (click)="cerrarModal()">Cancelar</button>
                <button type="submit" class="btn btn--primary" [disabled]="guardando()">
                  {{ guardando() ? 'Guardando...' : (modalMode() === 'crear' ? 'Crear reto' : 'Guardar cambios') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .retos-toggle-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: #938c84; cursor: pointer; user-select: none;
    }
    .retos-toggle-label input { accent-color: #A61F24; width: 14px; height: 14px; }

    .retos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      padding: 20px 24px;
    }

    .reto-card {
      border: 1px solid #2b3033; border-radius: 16px;
      background: rgba(18,20,22,0.96); padding: 18px;
      cursor: pointer; transition: border-color 0.2s, transform 0.2s, background 0.2s;
      display: flex; flex-direction: column; gap: 10px;
    }
    .reto-card:hover { border-color: rgba(166,31,36,0.4); transform: translateY(-2px); }
    .reto-card--selected { border-color: rgba(166,31,36,0.6); background: rgba(166,31,36,0.08); }
    .reto-card--inactivo { opacity: 0.55; }

    .reto-card__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .reto-card__tipo { font-size: 10px; color: #938c84; letter-spacing: 0.08em; text-transform: uppercase; }
    .reto-card__titulo { margin: 0; color: #f4f1eb; font-size: 16px; line-height: 1.25; }
    .reto-card__descripcion {
      margin: 0; color: #d2cbc1; font-size: 12px; line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .reto-card__premio { display: flex; align-items: center; gap: 6px; color: #d9a441; font-size: 12px; font-weight: 600; }
    .reto-card__meta { font-size: 11px; color: #938c84; }
    .reto-card__fechas { font-size: 11px; color: #938c84; }
    .reto-card__actions { display: flex; gap: 8px; margin-top: 4px; }
    .reto-card__footer { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
    .reto-card__inscrito-badge { font-size: 11px; color: #4CAF50; font-weight: 600; }

    .badge--inactivo { background: rgba(100,100,100,0.15); color: #938c84; border-color: rgba(100,100,100,0.3); }

    .retos-participantes-panel { margin-top: 24px; }

    /* ── Leaderboard ── */
    .retos-leaderboard { padding: 8px 20px 20px; }

    .retos-lb-head {
      display: grid;
      grid-template-columns: 44px minmax(0,1fr) 130px 90px 64px 40px;
      gap: 12px; padding: 0 4px 10px;
      border-bottom: 1px solid #2b3033;
      font-size: 10px; color: #938c84; letter-spacing: 0.08em; text-transform: uppercase;
    }
    .retos-lb-head--atleta {
      grid-template-columns: 44px minmax(0,1fr) 90px 64px;
    }

    .retos-lb-row {
      display: grid;
      grid-template-columns: 44px minmax(0,1fr) 130px 90px 64px 40px;
      gap: 12px; align-items: center;
      padding: 12px 4px;
      border-bottom: 1px solid #2b3033;
      transition: background 0.15s;
    }
    .retos-lb-row:last-child { border-bottom: none; }
    .retos-lb-row:hover { background: rgba(166,31,36,0.04); border-radius: 10px; }
    .retos-lb-row--atleta { grid-template-columns: 44px minmax(0,1fr) 90px 64px; }
    .retos-lb-row--top { }
    .retos-lb-row--yo { background: rgba(166,31,36,0.06); border-radius: 10px; }

    .retos-lb-rank {
      font-size: 18px; text-align: center;
      font-family: 'Bebas Neue', sans-serif; color: #938c84;
    }

    .retos-lb-atleta { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .retos-lb-atleta-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .retos-lb-atleta-info strong { color: #f4f1eb; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .retos-lb-atleta-info span { color: #938c84; font-size: 11px; }

    .retos-lb-avatar {
      width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
      border: 1px solid rgba(166,31,36,0.3);
    }
    .retos-lb-avatar--sm { width: 26px; height: 26px; }
    .retos-lb-avatar--initials {
      background: #A61F24; display: inline-flex; align-items: center; justify-content: center;
      font-family: 'Bebas Neue', sans-serif; font-size: 13px; color: #f4f1eb;
    }
    .retos-lb-avatar--sm.retos-lb-avatar--initials { font-size: 10px; }

    .retos-lb-fecha { font-size: 11px; color: #938c84; }

    .retos-lb-stat { display: flex; align-items: baseline; gap: 4px; }
    .retos-lb-stat__num { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #f4f1eb; letter-spacing: 0.04em; }
    .retos-lb-stat__label { font-size: 10px; color: #938c84; text-transform: uppercase; }

    .retos-lb-pct {
      font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: #938c84; text-align: right;
    }
    .retos-lb-pct--meta { color: #4CAF50; }

    .retos-lb-actions { display: flex; justify-content: flex-end; }

    /* ── Lista simple atletas ── */
    .retos-atletas-list { padding: 8px 20px 20px; display: flex; flex-direction: column; }
    .retos-atleta-row {
      display: grid; grid-template-columns: 34px minmax(0,1fr) auto;
      align-items: center; gap: 12px; padding: 10px 0;
      border-bottom: 1px solid #2b3033;
    }
    .retos-atleta-row:last-child { border-bottom: none; }
    .retos-atleta-rank {
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(166,31,36,0.12); border: 1px solid rgba(166,31,36,0.22);
      color: #f4f1eb; display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
    }
    .retos-atleta-fecha { color: #938c84; font-size: 11px; white-space: nowrap; }

    .retos-atleta-cell { display: flex; align-items: center; gap: 8px; }

    .retos-empty { padding: 48px 24px; text-align: center; color: #938c84; }

    @media (max-width: 640px) {
      .retos-grid { grid-template-columns: 1fr; padding: 16px; }
      .retos-lb-head { grid-template-columns: 36px minmax(0,1fr) 64px 52px; }
      .retos-lb-head span:nth-child(3) { display: none; }
      .retos-lb-row { grid-template-columns: 36px minmax(0,1fr) 64px 52px; }
      .retos-lb-fecha { display: none; }
      .retos-lb-head--atleta { grid-template-columns: 36px minmax(0,1fr) 64px 52px; }
    }
  `],
})
export class RetosComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly sentry = inject(SentryService);

  retos = signal<Reto[]>([]);
  selectedReto = signal<Reto | null>(null);
  participantes = signal<RetoParticipante[]>([]);
  leaderboard = signal<RetoLeaderboardRow[]>([]);
  loadingRetos = signal(true);
  loadingPanel = signal(false);
  inscribiendo = signal(false);
  guardando = signal(false);
  modalMode = signal<'crear' | 'editar' | null>(null);
  modalError = signal<string | null>(null);
  misInscripciones = signal<string[]>([]);
  mostrarInactivos = false;

  form: RetoForm = emptyForm();
  private editandoId: string | null = null;

  miUserId = () => this.auth.currentUser()?.id ?? null;

  async ngOnInit() {
    await Promise.all([this.cargarRetos(), this.cargarMisInscripciones()]);
  }

  async cargarRetos() {
    this.loadingRetos.set(true);
    try {
      const isCoach = this.auth.canManageBusinessOperations();
      const { data, error } = isCoach
        ? await this.supabase.getAllRetos()
        : await this.supabase.getRetos();

      if (error) {
        this.toast.error('No se pudieron cargar los retos');
        this.sentry.captureError(error, { action: 'cargarRetos' });
        return;
      }

      let lista = (data ?? []) as Reto[];
      if (isCoach && !this.mostrarInactivos) lista = lista.filter(r => r.activo);
      this.retos.set(lista);
    } finally {
      this.loadingRetos.set(false);
    }
  }

  async cargarMisInscripciones() {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    const { data } = await this.supabase.client
      .from('reto_participantes')
      .select('reto_id')
      .eq('user_id', userId);
    this.misInscripciones.set((data ?? []).map((r: any) => r.reto_id));
  }

  estaInscrito(retoId: string): boolean {
    return this.misInscripciones().includes(retoId);
  }

  async seleccionarReto(reto: Reto) {
    if (this.selectedReto()?.id === reto.id) {
      this.selectedReto.set(null);
      return;
    }
    this.selectedReto.set(reto);
    await this.cargarPanel(reto);
  }

  async refrescarPanel() {
    if (this.selectedReto()) await this.cargarPanel(this.selectedReto()!);
  }

  private async cargarPanel(reto: Reto) {
    this.loadingPanel.set(true);
    this.leaderboard.set([]);
    this.participantes.set([]);
    try {
      if (reto.tipo === 'asistencia') {
        const { data, error } = await this.supabase.getRetoLeaderboard(reto.id);
        if (error) { this.toast.error('No se pudo cargar el ranking'); return; }
        this.leaderboard.set((data ?? []) as RetoLeaderboardRow[]);
      } else {
        const { data, error } = await this.supabase.getRetoParticipantes(reto.id);
        if (error) { this.toast.error('No se pudieron cargar los participantes'); return; }
        this.participantes.set((data ?? []) as RetoParticipante[]);
      }
    } finally {
      this.loadingPanel.set(false);
    }
  }

  async inscribirse(reto: Reto) {
    const user = this.auth.currentUser();
    const profile = this.auth.profile();
    if (!user || !profile) return;

    this.inscribiendo.set(true);
    try {
      const { error } = await this.supabase.inscribirseReto(
        reto.id, user.id, profile.nombre_completo, profile.id_cliente ?? '',
      );
      if (error) { this.toast.error('No se pudo completar la inscripción'); return; }
      this.misInscripciones.update(ids => [...ids, reto.id]);
      this.toast.success(`¡Inscrito en "${reto.titulo}"!`);
      if (this.selectedReto()?.id === reto.id) await this.cargarPanel(reto);
    } finally {
      this.inscribiendo.set(false);
    }
  }

  async desinscribirse(reto: Reto) {
    const confirmed = await this.confirm.open({ title: '¿Salir del reto?', message: `Te darás de baja de "${reto.titulo}".` });
    if (!confirmed) return;

    const userId = this.auth.currentUser()?.id;
    if (!userId) return;

    this.inscribiendo.set(true);
    try {
      const { error } = await this.supabase.desinscribirseReto(reto.id, userId);
      if (error) { this.toast.error('No se pudo procesar la desinscripción'); return; }
      this.misInscripciones.update(ids => ids.filter(id => id !== reto.id));
      this.toast.success('Te has dado de baja del reto');
      if (this.selectedReto()?.id === reto.id) await this.cargarPanel(reto);
    } finally {
      this.inscribiendo.set(false);
    }
  }

  async quitarParticipante(p: RetoParticipante) {
    const confirmed = await this.confirm.open({ title: '¿Quitar participante?', message: `Se eliminará a "${p.nombre_atleta}" del reto.` });
    if (!confirmed) return;

    const { error } = await this.supabase.desinscribirseReto(p.reto_id, p.user_id);
    if (error) { this.toast.error('No se pudo quitar al participante'); return; }
    this.participantes.update(list => list.filter(x => x.id !== p.id));
    this.toast.success('Participante eliminado del reto');
  }

  async quitarParticipanteLb(row: RetoLeaderboardRow) {
    const confirmed = await this.confirm.open({ title: '¿Quitar participante?', message: `Se eliminará a "${row.nombre_atleta}" del reto.` });
    if (!confirmed) return;

    const { error } = await this.supabase.desinscribirseReto(this.selectedReto()!.id, row.user_id);
    if (error) { this.toast.error('No se pudo quitar al participante'); return; }
    this.leaderboard.update(list => list.filter(r => r.user_id !== row.user_id));
    this.toast.success('Participante eliminado del reto');
  }

  async toggleActivo(reto: Reto) {
    const accion = reto.activo ? 'desactivar' : 'activar';
    const confirmed = await this.confirm.open({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} reto?`,
      message: `"${reto.titulo}" quedará ${reto.activo ? 'oculto para los atletas' : 'visible para los atletas'}.`,
    });
    if (!confirmed) return;

    const { error } = await this.supabase.updateReto(reto.id, { activo: !reto.activo });
    if (error) { this.toast.error(`No se pudo ${accion} el reto`); return; }
    this.retos.update(list => list.map(r => r.id === reto.id ? { ...r, activo: !reto.activo } : r));
    if (!this.mostrarInactivos) {
      this.retos.update(list => list.filter(r => r.activo));
      if (this.selectedReto()?.id === reto.id) this.selectedReto.set(null);
    }
    this.toast.success(`Reto ${reto.activo ? 'desactivado' : 'activado'}`);
  }

  abrirModalCrear() {
    this.editandoId = null;
    this.form = emptyForm();
    this.modalError.set(null);
    this.modalMode.set('crear');
  }

  abrirModalEditar(reto: Reto) {
    this.editandoId = reto.id;
    this.form = {
      titulo: reto.titulo,
      descripcion: reto.descripcion ?? '',
      tipo: reto.tipo,
      premio: reto.premio,
      meta_porcentaje: reto.meta_porcentaje ?? 90,
      fecha_inicio: reto.fecha_inicio,
      fecha_fin: reto.fecha_fin ?? '',
    };
    this.modalError.set(null);
    this.modalMode.set('editar');
  }

  cerrarModal() { this.modalMode.set(null); this.modalError.set(null); }

  async guardarReto() {
    if (this.guardando()) return;
    if (!this.form.titulo.trim() || !this.form.premio.trim() || !this.form.fecha_inicio) {
      this.modalError.set('Completa título, premio y fecha de inicio.');
      return;
    }
    this.guardando.set(true);
    this.modalError.set(null);
    try {
      const userId = this.auth.currentUser()?.id;
      const payload: RetoPayload = {
        titulo: this.form.titulo.trim(),
        descripcion: this.form.descripcion.trim(),
        tipo: this.form.tipo,
        premio: this.form.premio.trim(),
        meta_porcentaje: this.form.tipo === 'asistencia' ? Number(this.form.meta_porcentaje) : null,
        fecha_inicio: this.form.fecha_inicio,
        fecha_fin: this.form.fecha_fin || null,
        activo: true,
        ...(this.modalMode() === 'crear' && userId ? { created_by: userId } : {}),
      };

      if (this.modalMode() === 'crear') {
        const { data, error } = await this.supabase.createReto(payload as unknown as Record<string, unknown>);
        if (error) { this.modalError.set('No se pudo crear el reto.'); return; }
        this.retos.update(list => [data as Reto, ...list]);
        this.toast.success('Reto creado');
      } else if (this.editandoId) {
        const { data, error } = await this.supabase.updateReto(this.editandoId, payload as unknown as Record<string, unknown>);
        if (error) { this.modalError.set('No se pudo actualizar el reto.'); return; }
        this.retos.update(list => list.map(r => r.id === this.editandoId ? (data as Reto) : r));
        this.toast.success('Reto actualizado');
      }
      this.cerrarModal();
    } finally {
      this.guardando.set(false);
    }
  }

  getAvatarUrl(path: string | null): string {
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;
    return this.supabase.getProfileAvatarUrl(path);
  }

  initials(name: string): string {
    return (name || 'A').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }
}
