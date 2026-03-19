import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { getEcuadorNow } from '../../shared/utils/date-ecuador';

interface AttendanceRewardConfig {
  rewardName: string;
  description: string;
  targetPercentage: number;
  monthKey: string;
  competitionStartDate?: string;
  participantUserIds?: string[];
}

interface RewardCatalogItem {
  id: string;
  title: string;
  category: string;
  reward: string;
  description: string;
  participantUserIds?: string[];
}

interface RewardOption {
  id: string;
  title: string;
  reward: string;
  description: string;
  category: string;
  type: 'attendance' | 'catalog';
  participantUserIds?: string[];
}

interface AttendanceRecord {
  estado: string;
  user_id: string;
  profiles?: {
    id_cliente?: string | null;
    nombre_completo?: string | null;
    avatar_url?: string | null;
  } | null;
  clases?: {
    fecha?: string | null;
    cancelada?: boolean | null;
  } | null;
}

interface AttendanceLeaderboardRow {
  userId: string;
  idCliente: string;
  nombre: string;
  asistio: number;
  ausencias: number;
  pendientes: number;
  porcentaje: number;
  elegible: boolean;
}

const DEFAULT_TARGET_PERCENTAGE = 95;

@Component({
  selector: 'app-premios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Comunidad</span>
      <h2 class="page-header__title">Retos</h2>
      <p class="page-header__subtitle">Todos pueden ver qué reto está activo y cómo va la competencia del mes.</p>
    </div>

    <section class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Retos activos del mes</span>
        <div class="premios-header-actions">
          <span class="premios-month-chip">{{ monthLabel() }}</span>
          @if (auth.canManageBusinessOperations()) {
            <button class="btn btn--primary btn--sm" type="button" (click)="toggleRewardForm()">
              {{ rewardFormOpen() ? 'Cerrar' : 'Agregar premio' }}
            </button>
          }
        </div>
      </div>

      @if (rewardOptions().length === 0) {
        <div class="premios-empty">Aún no hay retos publicados para este mes.</div>
      } @else {
        <div class="premios-tabs">
          @for (reward of rewardOptions(); track reward.id) {
            <button
              type="button"
              class="premios-tab"
              [class.premios-tab--active]="selectedRewardId() === reward.id"
              (click)="selectedRewardId.set(reward.id)"
            >
              <span class="premios-tab__category">{{ reward.category }}</span>
              <strong>{{ reward.title }}</strong>
            </button>
          }
        </div>
        <div class="premios-selected">
          <div class="premios-selected__reward">{{ selectedReward()!.reward }}</div>
          <p class="premios-selected__description">{{ selectedReward()!.description }}</p>

          @if (auth.canManageBusinessOperations()) {
            <div class="premios-selected__actions">
              <button class="btn btn--secondary btn--sm" type="button" (click)="openRewardForm(selectedReward()!.type)">
                Editar
              </button>
              @if (selectedReward()!.type === 'catalog') {
                <button class="btn btn--ghost btn--sm" type="button" (click)="removeCatalogItem(selectedReward()!.id)" [disabled]="savingCatalog()">
                  {{ savingCatalog() ? 'Quitando...' : 'Quitar' }}
                </button>
              }
            </div>

            @if (rewardFormOpen()) {
              <div class="premios-inline-editor">
                <div class="premios-editor-switch">
                  <button
                    type="button"
                    class="btn btn--sm"
                    [class.btn--primary]="editorMode() === 'attendance'"
                    [class.btn--ghost]="editorMode() !== 'attendance'"
                    (click)="editorMode.set('attendance')"
                  >
                    Asistencia
                  </button>
                  <button
                    type="button"
                    class="btn btn--sm"
                    [class.btn--primary]="editorMode() === 'catalog'"
                    [class.btn--ghost]="editorMode() !== 'catalog'"
                    (click)="editorMode.set('catalog')"
                  >
                    Otro premio
                  </button>
                </div>

                @if (editorMode() === 'attendance') {
                  <form (ngSubmit)="saveAttendanceConfig()" class="premios-form">
                    <div class="form-group">
                      <label class="form-label">Nombre del premio</label>
                      <input
                        class="form-control"
                        type="text"
                        [(ngModel)]="attendanceForm.rewardName"
                        name="rewardName"
                        placeholder="Ej: Lobo del Mes"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Meta de asistencia (%)</label>
                      <input
                        class="form-control"
                        type="number"
                        [(ngModel)]="attendanceForm.targetPercentage"
                        name="targetPercentage"
                        min="1"
                        max="100"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Qué se gana</label>
                      <textarea
                        class="form-control premios-form__textarea"
                        [(ngModel)]="attendanceForm.description"
                        name="description"
                        placeholder="Ej: Camiseta oficial + foto en historias del box"
                      ></textarea>
                    </div>

                    <div class="premios-preview">
                      <div class="premios-preview__label">Nuevo corte de competencia</div>
                      <strong>Al guardar, el ranking reinicia desde hoy.</strong>
                      <p>
                        El nuevo premio contará asistencias desde
                        <strong>{{ todayLabel() }}</strong>
                        y dejará atrás el progreso anterior.
                      </p>
                    </div>

                    <div class="premios-form__actions">
                      <button class="btn btn--ghost" type="button" (click)="rewardFormOpen.set(false)">Cancelar</button>
                      <button class="btn btn--primary" type="submit" [disabled]="savingAttendance()">
                        {{ savingAttendance() ? 'Guardando...' : 'Guardar premio' }}
                      </button>
                    </div>
                  </form>
                } @else {
                  <form (ngSubmit)="addCatalogItem()" class="premios-form">
                    <div class="form-group">
                      <label class="form-label">Nombre del premio</label>
                      <input
                        class="form-control"
                        type="text"
                        [(ngModel)]="catalogDraft.title"
                        name="catalogTitle"
                        placeholder="Ej: Best Lifter"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Categoría</label>
                      <input
                        class="form-control"
                        type="text"
                        [(ngModel)]="catalogDraft.category"
                        name="catalogCategory"
                        placeholder="Ej: Levantamiento"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Qué se gana</label>
                      <input
                        class="form-control"
                        type="text"
                        [(ngModel)]="catalogDraft.reward"
                        name="catalogReward"
                        placeholder="Ej: Muñequeras oficiales"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">Cómo se gana</label>
                      <textarea
                        class="form-control premios-form__textarea"
                        [(ngModel)]="catalogDraft.description"
                        name="catalogDescription"
                        placeholder="Ej: Se lo lleva quien domine el ranking de fuerza del mes."
                      ></textarea>
                    </div>

                    <div class="premios-form__actions">
                      <button class="btn btn--ghost" type="button" (click)="rewardFormOpen.set(false)">Cancelar</button>
                      <button class="btn btn--secondary" type="submit" [disabled]="savingCatalog()">
                        {{ savingCatalog() ? 'Guardando...' : 'Publicar premio' }}
                      </button>
                    </div>
                  </form>
                }
              </div>
            }
          }
        </div>
      }
    </section>
    @if (rewardOptions().length > 0) {
    <div class="premios-workspace premios-workspace--viewer">
      <section class="data-table-wrapper">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">
            {{ selectedReward()!.type === 'attendance' ? 'Atletas en competencia' : 'Seguimiento del reto' }}
          </span>
          @if (selectedReward()!.type === 'attendance') {
            <button class="btn btn--ghost btn--sm" type="button" (click)="loadLeaderboard()" [disabled]="loading()">
              {{ loading() ? 'Actualizando...' : '↻ Actualizar' }}
            </button>
          }
        </div>

        @if (selectedReward()!.type !== 'attendance') {
          <div class="premios-empty">
            <strong>{{ selectedRewardParticipantCount() }}</strong>
            atletas inscritos.
            <br />
            Este premio ya acepta participantes, pero su medición todavía se hace fuera del ranking automático.
          </div>
        } @else if (loading()) {
          <div class="premios-empty">Cargando ranking...</div>
        } @else if (leaderboard().length === 0) {
          <div class="premios-empty">Aún no hay asistencias marcadas este mes.</div>
        } @else {
          <div class="premios-leaderboard">
            <div class="premios-head">
              <span>#</span>
              <span>Atleta</span>
              <span>Asist.</span>
              <span>%</span>
              <span>Estado</span>
            </div>
            @for (row of leaderboard(); track row.userId) {
              <article class="premios-row">
                <div class="premios-row__rank">{{ $index + 1 }}</div>
                <div class="premios-row__main">
                  <div class="premios-row__identity">
                    <strong>{{ row.nombre }}</strong>
                    <span>{{ row.idCliente }}</span>
                    @if (row.pendientes > 0) {
                      <span>· {{ row.pendientes }} pendientes</span>
                    }
                  </div>
                </div>
                <div class="premios-row__stats">
                  <span>{{ row.asistio }}/{{ row.asistio + row.ausencias }}</span>
                </div>
                <div class="premios-row__percentage">{{ row.porcentaje }}%</div>
                <div class="premios-row__status">
                  <span class="badge" [class.badge--activo]="row.elegible" [class.badge--pendiente]="!row.elegible">
                    {{ row.elegible ? 'En meta' : 'Fuera' }}
                  </span>
                </div>
              </article>
            }
          </div>
        }
      </section>
    </div>
    }
  `,
  styles: [`
    .premios-admin-shell {
      margin-top: 24px;
    }

    .premios-admin-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 22px;
      border: 1px solid #2b3033;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(19, 21, 22, 0.96), rgba(25, 28, 30, 0.92));
    }

    .premios-admin-toolbar__title {
      margin: 4px 0 0;
      color: #f4f1eb;
      font-size: 20px;
      line-height: 1.1;
    }

    .premios-workspace {
      display: grid;
      grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
      gap: 24px;
      align-items: start;
      margin-top: 24px;
    }

    .premios-workspace--viewer {
      grid-template-columns: minmax(0, 1fr);
    }

    .premios-panel,
    .premios-leaderboard {
      padding: 24px;
    }

    .premios-tabs {
      display: flex;
      gap: 10px;
      padding: 16px 24px;
      overflow-x: auto;
    }

    .premios-tab {
      min-width: 180px;
      border: 1px solid #2b3033;
      border-radius: 16px;
      background: rgba(18, 20, 22, 0.96);
      padding: 12px 14px;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
    }

    .premios-tab:hover {
      border-color: rgba(166, 31, 36, 0.35);
      transform: translateY(-1px);
    }

    .premios-tab--active {
      border-color: rgba(166, 31, 36, 0.45);
      background: rgba(166, 31, 36, 0.12);
    }

    .premios-tab__category {
      display: block;
      font-size: 10px;
      color: #938c84;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .premios-tab strong {
      display: block;
      margin: 0;
      color: #f4f1eb;
      font-size: 14px;
      line-height: 1.25;
    }

    .premios-selected {
      padding: 0 24px 16px;
    }

    .premios-selected__reward {
      color: #d9a441;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .premios-selected__description {
      margin: 0;
      color: #d2cbc1;
      font-size: 11px;
      line-height: 1.35;
    }

    .premios-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .premios-form__actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .premios-form__textarea {
      min-height: 112px;
      resize: vertical;
    }

    .premios-month-chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(166, 31, 36, 0.3);
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(166, 31, 36, 0.1);
      color: #f4f1eb;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .premios-preview,
    .premios-catalog-row {
      border: 1px solid #2b3033;
      border-radius: 16px;
      padding: 16px;
      background: rgba(20, 22, 24, 0.92);
    }

    .premios-preview__label {
      font-size: 11px;
      color: #938c84;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .premios-preview p {
      margin: 8px 0 0;
      color: #d2cbc1;
      font-size: 13px;
      line-height: 1.5;
    }

    .premios-summary-card {
      display: flex;
      flex-direction: column;
      gap: 18px;
      border: 1px solid #2b3033;
      border-radius: 18px;
      background: rgba(20, 22, 24, 0.92);
      padding: 18px;
    }

    .premios-summary-card__title {
      margin: 0;
      color: #f4f1eb;
      font-size: 24px;
      line-height: 1;
    }

    .premios-summary-card__description {
      margin: 8px 0 0;
      color: #d2cbc1;
      font-size: 13px;
      line-height: 1.5;
    }

    .premios-summary-card__reward strong {
      display: block;
      color: #d9a441;
      font-size: 15px;
      line-height: 1.4;
    }

    .premios-summary-card__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .premios-editor-switch {
      display: flex;
      gap: 10px;
      margin-bottom: 18px;
    }

    .premios-leaderboard {
      max-height: 520px;
      overflow: auto;
    }

    .premios-head,
    .premios-row {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 72px 64px 92px;
      align-items: center;
      gap: 12px;
    }

    .premios-head {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 0 0 10px;
      margin-bottom: 4px;
      background: linear-gradient(180deg, rgba(21, 23, 24, 0.98), rgba(21, 23, 24, 0.94));
      border-bottom: 1px solid #2b3033;
    }

    .premios-head span {
      font-size: 10px;
      color: #938c84;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .premios-head span:nth-child(3),
    .premios-head span:nth-child(4),
    .premios-head span:nth-child(5) {
      text-align: right;
    }

    .premios-row {
      border-bottom: 1px solid #2b3033;
      padding: 10px 0;
    }

    .premios-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .premios-row__rank {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(166, 31, 36, 0.12);
      border: 1px solid rgba(166, 31, 36, 0.22);
      color: #f4f1eb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }

    .premios-row__identity {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      align-items: baseline;
    }

    .premios-row__identity strong {
      color: #f4f1eb;
      font-size: 13px;
      line-height: 1.2;
    }

    .premios-row__identity span {
      color: #938c84;
      font-size: 11px;
    }

    .premios-row__stats,
    .premios-row__status {
      text-align: right;
    }

    .premios-row__stats {
      color: #d2cbc1;
      font-size: 12px;
      font-weight: 600;
    }

    .premios-row__percentage {
      text-align: right;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 24px;
      color: #f4f1eb;
      letter-spacing: 0.05em;
    }

    .premios-empty {
      padding: 48px 24px;
      text-align: center;
      color: #938c84;
    }

    @media (max-width: 1280px) {
      .premios-workspace {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .premios-admin-toolbar {
        flex-direction: column;
        align-items: flex-start;
      }

      .premios-head {
        display: none;
      }

      .premios-row {
        grid-template-columns: 30px minmax(0, 1fr);
        align-items: start;
      }

      .premios-row__stats,
      .premios-row__percentage,
      .premios-row__status {
        grid-column: 2;
        text-align: left;
      }

      .premios-row__stats,
      .premios-row__percentage {
        margin-top: 4px;
      }
    }
  `],
})
export class PremiosComponent implements OnInit {
  protected readonly DEFAULT_TARGET_PERCENTAGE = DEFAULT_TARGET_PERCENTAGE;

  private readonly supabase = inject(SupabaseService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  savingAttendance = signal(false);
  savingCatalog = signal(false);
  leaderboard = signal<AttendanceLeaderboardRow[]>([]);
  catalogItems = signal<RewardCatalogItem[]>([]);
  monthLabel = signal(this.buildMonthLabel());
  todayLabel = signal(this.buildTodayLabel());
  attendanceEnabled = signal(false);
  selectedRewardId = signal('attendance');
  editorMode = signal<'attendance' | 'catalog'>('attendance');
  rewardFormOpen = signal(false);

  attendanceForm: AttendanceRewardConfig = this.defaultAttendanceConfig();
  catalogDraft: Omit<RewardCatalogItem, 'id'> = this.emptyCatalogDraft();

  async ngOnInit() {
    await Promise.all([
      this.loadAttendanceConfig(),
      this.loadCatalogConfig(),
      this.loadLeaderboard(),
    ]);
  }

  rewardOptions(): RewardOption[] {
    const attendanceCard: RewardOption[] = this.attendanceEnabled() ? [{
      id: 'attendance',
      title: this.attendanceForm.rewardName || 'Reto de asistencia',
      category: 'Asistencia',
      reward: this.attendanceForm.description || 'Reto por constancia del mes.',
      description: `Gana quien cierre el mes con al menos ${this.attendanceForm.targetPercentage || DEFAULT_TARGET_PERCENTAGE}% de asistencia marcada por el coach.`,
      type: 'attendance',
      participantUserIds: this.attendanceForm.participantUserIds ?? [],
    }] : [];

    return [
      ...attendanceCard,
      ...this.catalogItems().map((item) => ({
        ...item,
        type: 'catalog' as const,
      })),
    ];
  }

  selectedReward(): RewardOption | undefined {
    const options = this.rewardOptions();
    return options.find((reward) => reward.id === this.selectedRewardId()) ?? options[0];
  }

  async loadAttendanceConfig() {
    const { data, error } = await this.supabase.getAttendanceRewardConfig();
    if (error) {
      this.toast.error('No se pudo cargar la configuración de asistencia');
      return;
    }

    const detalle = data?.detalle as Partial<AttendanceRewardConfig> | undefined;
    if (!detalle) {
      this.attendanceEnabled.set(false);
      return;
    }

    this.attendanceForm = {
      rewardName: detalle.rewardName?.trim() || 'Premio de asistencia',
      description: detalle.description?.trim() || '',
      targetPercentage: Number(detalle.targetPercentage ?? DEFAULT_TARGET_PERCENTAGE),
      monthKey: detalle.monthKey?.trim() || this.currentMonthKey(),
      competitionStartDate: detalle.competitionStartDate?.trim() || `${this.currentMonthKey()}-01`,
      participantUserIds: Array.isArray(detalle.participantUserIds) ? detalle.participantUserIds : [],
    };
    this.attendanceEnabled.set(true);
  }

  async loadCatalogConfig() {
    const { data, error } = await this.supabase.getRewardCatalogConfig();
    if (error) {
      this.toast.error('No se pudo cargar el catálogo de premios');
      return;
    }

    const detalle = data?.detalle as { items?: RewardCatalogItem[] } | undefined;
    const items = Array.isArray(detalle?.items) ? detalle.items : [];
    this.catalogItems.set(
      items.map((item) => ({
        id: item.id,
        title: item.title?.trim() || 'Premio sin nombre',
        category: item.category?.trim() || 'General',
        reward: item.reward?.trim() || 'Premio por anunciar',
        description: item.description?.trim() || '',
        participantUserIds: Array.isArray(item.participantUserIds) ? item.participantUserIds : [],
      })),
    );
  }

  async loadLeaderboard() {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.getAttendanceRecordsForMonth();
      if (error) {
        this.toast.error('No se pudo cargar la asistencia del mes');
        return;
      }

      this.leaderboard.set(this.buildLeaderboard((data ?? []) as AttendanceRecord[]));
    } finally {
      this.loading.set(false);
    }
  }

  async saveAttendanceConfig() {
    if (this.savingAttendance()) return;

    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      this.toast.error('No se pudo identificar al usuario actual');
      return;
    }

    this.savingAttendance.set(true);
    try {
      const payload: AttendanceRewardConfig = {
        rewardName: this.attendanceForm.rewardName.trim() || 'Premio de asistencia',
        description: this.attendanceForm.description.trim(),
        targetPercentage: Math.min(100, Math.max(1, Number(this.attendanceForm.targetPercentage || DEFAULT_TARGET_PERCENTAGE))),
        monthKey: this.currentMonthKey(),
        competitionStartDate: this.todayYmd(getEcuadorNow()),
        participantUserIds: this.attendanceForm.participantUserIds ?? [],
      };

      const { error } = await this.supabase.saveAttendanceRewardConfig(userId, payload as unknown as Record<string, unknown>);
      if (error) {
        this.toast.error('No se pudo guardar el premio de asistencia');
        return;
      }

      this.attendanceForm = payload;
      this.attendanceEnabled.set(true);
      this.leaderboard.update((rows) =>
        rows.map((row) => ({ ...row, elegible: row.porcentaje >= payload.targetPercentage })),
      );
      this.selectedRewardId.set('attendance');
      this.rewardFormOpen.set(false);
      this.toast.success('Premio de asistencia actualizado');
    } finally {
      this.savingAttendance.set(false);
    }
  }

  async addCatalogItem() {
    if (this.savingCatalog()) return;

    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      this.toast.error('No se pudo identificar al usuario actual');
      return;
    }

    this.savingCatalog.set(true);
    try {
      const nextItem: RewardCatalogItem = {
        id: crypto.randomUUID(),
        title: this.catalogDraft.title.trim(),
        category: this.catalogDraft.category.trim(),
        reward: this.catalogDraft.reward.trim(),
        description: this.catalogDraft.description.trim(),
        participantUserIds: [],
      };

      if (!nextItem.title || !nextItem.category || !nextItem.reward) {
        this.toast.error('Completa nombre, categoría y premio');
        return;
      }

      const nextItems = [nextItem, ...this.catalogItems()];
      const { error } = await this.supabase.saveRewardCatalogConfig(userId, { items: nextItems } as Record<string, unknown>);
      if (error) {
        this.toast.error('No se pudo guardar el catálogo de premios');
        return;
      }

      this.catalogItems.set(nextItems);
      this.selectedRewardId.set(nextItem.id);
      this.rewardFormOpen.set(false);
      this.catalogDraft = this.emptyCatalogDraft();
      this.toast.success('Premio visible agregado');
    } finally {
      this.savingCatalog.set(false);
    }
  }

  async removeCatalogItem(itemId: string) {
    if (this.savingCatalog()) return;

    const userId = this.auth.currentUser()?.id;
    if (!userId) return;

    this.savingCatalog.set(true);
    try {
      const nextItems = this.catalogItems().filter((item) => item.id !== itemId);
      const { error } = await this.supabase.saveRewardCatalogConfig(userId, { items: nextItems } as Record<string, unknown>);
      if (error) {
        this.toast.error('No se pudo actualizar el catálogo');
        return;
      }

      this.catalogItems.set(nextItems);
      if (this.selectedRewardId() === itemId) {
        this.selectedRewardId.set('attendance');
      }
      this.toast.success('Premio removido del listado');
    } finally {
      this.savingCatalog.set(false);
    }
  }

  openRewardForm(mode: 'attendance' | 'catalog') {
    this.editorMode.set(mode);
    this.rewardFormOpen.set(true);
  }

  toggleRewardForm() {
    if (this.rewardFormOpen()) {
      this.rewardFormOpen.set(false);
      return;
    }

      this.openRewardForm(this.selectedReward()?.type === 'catalog' ? 'catalog' : 'attendance');
  }

  selectedRewardParticipantCount() {
    const selected = this.selectedReward();
    return selected?.participantUserIds?.length ?? 0;
  }

  private buildLeaderboard(records: AttendanceRecord[]): AttendanceLeaderboardRow[] {
    const now = getEcuadorNow();
    const monthKey = this.currentMonthKey();
    const competitionStartDate = this.attendanceForm.competitionStartDate?.trim() || `${monthKey}-01`;
    const target = Number(this.attendanceForm.targetPercentage || DEFAULT_TARGET_PERCENTAGE);
    const eligibleParticipants = new Set(this.attendanceForm.participantUserIds ?? []);
    const grouped = new Map<string, AttendanceLeaderboardRow>();

    for (const record of records) {
      const claseFecha = record.clases?.fecha ?? '';
      if (!claseFecha.startsWith(monthKey)) continue;
      if (claseFecha < competitionStartDate) continue;
      if (record.clases?.cancelada) continue;
      if (claseFecha > this.todayYmd(now)) continue;

      const userId = record.user_id;
      if (!userId) continue;
      if (eligibleParticipants.size > 0 && !eligibleParticipants.has(userId)) continue;

      const existing = grouped.get(userId) ?? {
        userId,
        idCliente: record.profiles?.id_cliente?.trim() || 'Sin cliente',
        nombre: record.profiles?.nombre_completo?.trim() || 'Atleta sin nombre',
        asistio: 0,
        ausencias: 0,
        pendientes: 0,
        porcentaje: 0,
        elegible: false,
      };

      if (record.estado === 'asistio') existing.asistio += 1;
      else if (record.estado === 'no_asistio') existing.ausencias += 1;
      else existing.pendientes += 1;

      grouped.set(userId, existing);
    }

    return Array.from(grouped.values())
      .map((row) => {
        const totalMarcadas = row.asistio + row.ausencias;
        const porcentaje = totalMarcadas > 0
          ? Math.round((row.asistio / totalMarcadas) * 100)
          : 0;

        return {
          ...row,
          porcentaje,
          elegible: totalMarcadas > 0 && porcentaje >= target,
        };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje || b.asistio - a.asistio || a.nombre.localeCompare(b.nombre));
  }

  private defaultAttendanceConfig(): AttendanceRewardConfig {
    return {
      rewardName: 'Premio de asistencia',
      description: 'Premio por constancia del mes.',
      targetPercentage: DEFAULT_TARGET_PERCENTAGE,
      monthKey: this.currentMonthKey(),
      competitionStartDate: `${this.currentMonthKey()}-01`,
      participantUserIds: [],
    };
  }

  private emptyCatalogDraft(): Omit<RewardCatalogItem, 'id'> {
    return {
      title: '',
      category: '',
      reward: '',
      description: '',
    };
  }

  private currentMonthKey() {
    return this.todayYmd(getEcuadorNow()).slice(0, 7);
  }

  private todayYmd(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildMonthLabel() {
    return new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(getEcuadorNow());
  }

  private buildTodayLabel() {
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(getEcuadorNow());
  }
}
