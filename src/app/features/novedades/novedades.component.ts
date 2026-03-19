import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import {
  ContenidoBox,
  ContenidoTipo,
} from '../../core/models/contenido-box.model';
import { SentryService } from '../../core/services/sentry.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

interface AttendanceRewardConfig {
  rewardName: string;
  description: string;
  targetPercentage: number;
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

interface RewardCard {
  id: string;
  title: string;
  reward: string;
  description: string;
  category: string;
  type: 'attendance' | 'catalog';
  participantUserIds?: string[];
}

interface Cumpleanero {
  id_cliente: string;
  nombre_completo: string;
  fecha_nacimiento: string;
  email: string;
  telefono_whatsapp: string;
}

@Component({
  selector: 'app-novedades',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, DateEcPipe],
  template: `
    <section class="cumpleanos-section">
      <div class="cumpleanos-section__header">
        <span class="novedades-section-label">Hoy celebramos</span>
        <h3 class="novedades-section-title">Cumpleañeros</h3>
      </div>

      @if (cumpleanerosLoading()) {
        <div class="cumpleanos-empty">Cargando cumpleañeros...</div>
      } @else if (cumpleanerosError()) {
        <div class="cumpleanos-empty">
          No pudimos cargar la lista de cumpleañeros del día. Intenta refrescar en un momento.
        </div>
      } @else if (cumpleaneros().length > 0) {
        <div class="cumpleanos-grid">
          @for (cumple of cumpleaneros(); track cumple.id_cliente) {
            <article class="cumpleanos-card">
              <div class="cumpleanos-card__emoji" aria-label="Cumpleaños">🎂</div>
              <div class="cumpleanos-card__meta">
                <strong>{{ cumple.nombre_completo }}</strong>
                <span>{{ cumple.fecha_nacimiento | dateEc: 'dd MMMM' }}</span>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="cumpleanos-empty">Hoy no hay cumpleañeros. ¡Revisamos mañana!</div>
      }
    </section>

    @if (error()) {
      <div class="alert alert--warning">
        <i-lucide name="triangle-alert" />
        <div>
          <strong>No se pudieron cargar las novedades.</strong> Intenta refrescar en un momento.
        </div>
      </div>
    }

    @if (loading()) {
      <div class="novedades-loading-grid">
        @for (item of [1, 2, 3]; track item) {
          <div class="skeleton skeleton--card novedades-skeleton"></div>
        }
      </div>
    } @else {
      @if (rewardCards().length > 0) {
      <section class="data-table-wrapper novedades-premios">
        <div class="data-table-wrapper__header">
          <span class="data-table-wrapper__title">Retos</span>
        </div>

        <div class="novedades-premios__grid">
          @for (reward of rewardCards(); track reward.id) {
            <article class="novedades-reto-card" (click)="openRewardDetail(reward)">
              <button class="novedades-reto-card__summary" type="button">
                <div>
                  <span class="novedades-section-label">{{ reward.category }}</span>
                  <h3 class="novedades-reto-card__title">{{ reward.title }}</h3>
                </div>
                <span class="novedades-reto-card__toggle">Ver reto</span>
              </button>
            </article>
          }
        </div>
      </section>
      }

      @if (items().length > 0) {
      <section class="novedades-feed">
      <div class="novedades-feed__toolbar">
        <div>
          <span class="novedades-section-label">Actualizado</span>
          <h3 class="novedades-section-title">Lo último del box</h3>
        </div>
      </div>

      <div class="novedades-horizontal-wrap">
        <div
          #featuredTrack
          class="novedades-horizontal-track"
          (scroll)="onFeaturedScroll()"
        >
          @for (item of items(); track item.id) {
            <article class="novedades-card novedades-card--horizontal" (click)="openDetail(item)">
              <img class="novedades-card__image" [src]="imageUrl(item)" [alt]="item.titulo" />
              <div class="novedades-card__body">
                <div class="novedades-card__meta">
                  <span class="novedades-type-pill" [class.novedades-type-pill--evento]="item.tipo === 'evento'">
                    {{ item.tipo }}
                  </span>
                  <span>{{ item.published_at || item.created_at | dateEc: 'dd/MM/yyyy' }}</span>
                </div>
                <h4 class="novedades-card__title">{{ item.titulo }}</h4>
                <p class="novedades-card__desc">{{ excerpt(item.descripcion, 82) }}</p>

                @if (item.tipo === 'evento') {
                  <div class="novedades-card__event">
                    <span>{{ item.evento_fecha_inicio | dateEc: 'dd/MM · HH:mm' }}</span>
                    <span>{{ item.evento_ubicacion || modalidadLabel(item) }}</span>
                  </div>
                }
              </div>
            </article>
          }
        </div>
      </div>

      @if (items().length > 1) {
        <div class="novedades-carousel__dots">
          @for (item of items(); track item.id; let i = $index) {
            <button
              class="novedades-carousel__dot"
              [class.active]="featuredIndex() === i"
              (click)="goToFeatured(i)"
              [attr.aria-label]="'Ir a la novedad ' + (i + 1)"
            ></button>
          }
        </div>
      }
    </section>
      } @else {
      <div class="data-table-wrapper">
        <div class="novedades-empty">
          <div class="auth-state-icon auth-state-icon--warning">
            <i-lucide name="clipboard" />
          </div>
          <h4>No hay novedades todavía</h4>
          <p>Cuando el coach publique contenido nuevo aparecerá aquí automáticamente.</p>
        </div>
      </div>
      }
    }

    @if (selectedItem()) {
      <div class="modal-backdrop" (click)="selectedItem.set(null)">
        <div class="modal modal--wide novedades-modal" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <div>
              <div class="novedades-card__meta">
                <span class="novedades-type-pill" [class.novedades-type-pill--evento]="selectedItem()!.tipo === 'evento'">
                  {{ selectedItem()!.tipo }}
                </span>
                <span>{{ selectedItem()!.published_at || selectedItem()!.created_at | dateEc: 'dd/MM/yyyy' }}</span>
              </div>
              <h3 class="modal__title">{{ selectedItem()!.titulo }}</h3>
            </div>
            <button class="btn btn--ghost btn--icon" (click)="selectedItem.set(null)" aria-label="Cerrar detalle">
              <i-lucide name="circle-x" />
            </button>
          </div>
          <div class="modal__body novedades-modal__body">
            <img class="novedades-modal__image" [src]="imageUrl(selectedItem()!)" [alt]="selectedItem()!.titulo" />

            @if (selectedItem()!.tipo === 'evento') {
              <div class="novedades-modal__event-grid">
                <div class="stat-card">
                  <div class="stat-card__label">Inicio</div>
                  <div class="novedades-modal__stat">{{ selectedItem()!.evento_fecha_inicio | dateEc: 'EEEE dd/MM · HH:mm' }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-card__label">Ubicación</div>
                  <div class="novedades-modal__stat">{{ selectedItem()!.evento_ubicacion || modalidadLabel(selectedItem()!) }}</div>
                </div>
              </div>
            }

            <div class="novedades-modal__content">
              <p>{{ selectedItem()!.descripcion }}</p>
            </div>

            @if (selectedItem()!.tipo === 'evento' && selectedItem()!.cta_url && selectedItem()!.cta_label) {
              <div class="novedades-modal__footer">
                <a class="btn btn--primary" [href]="selectedItem()!.cta_url!" target="_blank" rel="noreferrer">
                  {{ selectedItem()!.cta_label }}
                </a>
              </div>
            }
          </div>
        </div>
      </div>
    }

    @if (selectedRewardCard()) {
      <div class="modal-backdrop" (click)="selectedRewardCard.set(null)">
        <div class="modal modal--wide novedades-modal" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <div>
              <div class="novedades-card__meta">
                <span class="novedades-type-pill">{{ selectedRewardCard()!.category }}</span>
                <span>{{ rewardParticipantCount(selectedRewardCard()!) }} inscritos</span>
              </div>
              <h3 class="modal__title">{{ selectedRewardCard()!.title }}</h3>
            </div>
            <button class="btn btn--ghost btn--icon" (click)="selectedRewardCard.set(null)" aria-label="Cerrar reto">
              <i-lucide name="circle-x" />
            </button>
          </div>
          <div class="modal__body novedades-modal__body">
            <div class="stat-card">
              <div class="stat-card__label">Qué ganas</div>
              <div class="novedades-modal__stat">{{ selectedRewardCard()!.reward }}</div>
            </div>

            <div class="novedades-modal__content">
              <p>{{ selectedRewardCard()!.description }}</p>
            </div>

            @if (auth.rol() === 'atleta') {
              <div class="novedades-modal__footer">
                <button
                  class="btn btn--primary"
                  type="button"
                  (click)="joinReward(selectedRewardCard()!)"
                  [disabled]="joiningRewardId() === selectedRewardCard()!.id || isJoined(selectedRewardCard()!)"
                >
                  {{
                    joiningRewardId() === selectedRewardCard()!.id
                      ? 'Inscribiendo...'
                      : (isJoined(selectedRewardCard()!) ? 'Ya participas' : 'Inscribirme')
                  }}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .novedades-loading-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }

    .novedades-skeleton {
      height: 320px;
    }

    .novedades-feed {
      margin-bottom: 32px;
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    .novedades-premios {
      margin-bottom: 28px;
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    .novedades-premios__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      padding: 18px 24px 24px;
    }

    .novedades-reto-card {
      border: 1px solid #2b3033;
      border-radius: 18px;
      background: rgba(21, 23, 24, 0.94);
      overflow: hidden;
      transition: transform 0.22s ease, border-color 0.22s ease;
    }

    .novedades-reto-card:hover {
      transform: translateY(-2px);
      border-color: #a61f24;
    }

    .novedades-reto-card__summary {
      width: 100%;
      border: none;
      background: transparent;
      color: inherit;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 16px;
      text-align: left;
      cursor: pointer;
    }

    .novedades-reto-card__title {
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #f4f1eb;
      font-size: 20px;
      line-height: 1;
      margin: 0;
    }

    .novedades-reto-card__toggle {
      color: #938c84;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .novedades-premio-card__reward {
      color: #d9a441;
      font-weight: 700;
      font-size: 14px;
    }

    .novedades-premio-card__description,
    .novedades-premio-card__meta {
      color: #d2cbc1;
      font-size: 13px;
      line-height: 1.5;
    }

    .novedades-feed__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .novedades-section-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #a61f24;
      margin-bottom: 6px;
    }

    .novedades-section-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 26px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #f4f1eb;
    }

    .cumpleanos-section {
      margin-bottom: 30px;
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    .cumpleanos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }

    .cumpleanos-card {
      border-radius: 16px;
      background: rgba(21, 23, 24, 0.9);
      padding: 14px;
      border: 1px solid #2b3033;
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    .cumpleanos-card__emoji {
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      font-size: 22px;
      background: rgba(166, 31, 36, 0.14);
    }

    .cumpleanos-card__meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: #f4f1eb;
    }

    .cumpleanos-card__meta strong {
      font-size: 15px;
      line-height: 1.1;
    }

    .cumpleanos-card__meta span {
      font-size: 11px;
      color: #938c84;
    }

    .cumpleanos-empty {
      padding: 12px 0;
      color: #938c84;
      font-size: 14px;
    }

    .novedades-horizontal-wrap {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      border-radius: 20px;
      overflow: hidden;
    }

    .novedades-horizontal-track {
      display: flex;
      gap: 18px;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      padding-bottom: 4px;
    }

    .novedades-horizontal-track::-webkit-scrollbar {
      display: none;
    }

    .novedades-carousel__dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 14px;
    }

    .novedades-carousel__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: none;
      background: rgba(147, 140, 132, 0.35);
      cursor: pointer;
      transition: transform 0.2s ease, background 0.2s ease;
    }

    .novedades-carousel__dot.active {
      background: #a61f24;
      transform: scale(1.15);
    }

    .novedades-card__title {
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #f4f1eb;
    }

    .novedades-card__desc,
    .novedades-modal__content {
      color: #d2cbc1;
      line-height: 1.6;
    }

    .novedades-card__meta {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 12px;
      color: #d2cbc1;
    }

    .novedades-type-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(166, 31, 36, 0.16);
      color: #f4f1eb;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .novedades-type-pill--evento {
      background: rgba(61, 110, 145, 0.18);
    }

    .novedades-card__event {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      color: #d2cbc1;
      font-size: 12px;
    }

    .novedades-card__event span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .novedades-card {
      background: #151718;
      border: 1px solid #2b3033;
      border-radius: 18px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.22s ease, border-color 0.22s ease;
    }

    .novedades-card:hover {
      transform: translateY(-3px);
      border-color: #a61f24;
    }

    .novedades-card--horizontal {
      width: calc(50% - 9px);
      min-width: calc(50% - 9px);
      max-width: calc(50% - 9px);
      flex: 0 0 calc(50% - 9px);
      scroll-snap-align: start;
    }

    .novedades-card__image {
      width: 100%;
      height: 180px;
      object-fit: cover;
      background: #1d2022;
    }

    .novedades-card__body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 18px;
    }

    .novedades-card__title {
      font-size: 22px;
      line-height: 1;
    }

    .novedades-card__desc {
      font-size: 13px;
    }

    .novedades-empty {
      padding: 40px 24px;
      text-align: center;
    }

    .novedades-empty h4 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 24px;
      letter-spacing: 0.04em;
      color: #f4f1eb;
      margin-bottom: 8px;
    }

    .novedades-empty p {
      color: #938c84;
      max-width: 420px;
      margin: 0 auto;
    }

    .novedades-modal__body {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .novedades-modal__image {
      width: 100%;
      max-height: 360px;
      object-fit: cover;
      border-radius: 16px;
      background: #1d2022;
    }

    .novedades-modal__event-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .novedades-modal__stat {
      font-size: 18px;
      color: #f4f1eb;
      margin-top: 8px;
    }

    .novedades-modal__footer {
      display: flex;
      justify-content: flex-start;
    }

    @media (max-width: 768px) {
      .cumpleanos-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .novedades-modal__event-grid {
        grid-template-columns: 1fr;
      }

      .novedades-feed__toolbar {
        align-items: stretch;
      }

      .novedades-card--horizontal {
        width: calc(100% - 8px);
        min-width: calc(100% - 8px);
        max-width: calc(100% - 8px);
        flex-basis: calc(100% - 8px);
      }
    }

    @media (min-width: 769px) and (max-width: 1100px) {
      .novedades-card--horizontal {
        width: calc(50% - 9px);
        min-width: calc(50% - 9px);
        max-width: calc(50% - 9px);
      }
    }

    @media (max-width: 420px) {
      .cumpleanos-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (min-width: 1101px) {
      .novedades-card--horizontal {
        width: calc(50% - 9px);
        min-width: calc(50% - 9px);
        max-width: calc(50% - 9px);
      }
    }
  `],
})
export class NovedadesComponent implements OnInit {
  @ViewChild('featuredTrack') featuredTrack?: ElementRef<HTMLDivElement>;

  private supabase = inject(SupabaseService);
  private sentry = inject(SentryService);

  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<ContenidoBox[]>([]);
  readonly selectedItem = signal<ContenidoBox | null>(null);
  readonly selectedRewardCard = signal<RewardCard | null>(null);
  readonly featuredIndex = signal(0);
  readonly rewardCards = signal<RewardCard[]>([]);
  readonly rewardCatalog = signal<RewardCatalogItem[]>([]);
  readonly joiningRewardId = signal<string | null>(null);
  readonly cumpleaneros = signal<Cumpleanero[]>([]);
  readonly cumpleanerosLoading = signal(true);
  readonly cumpleanerosError = signal(false);

  async ngOnInit() {
    await Promise.all([
      this.loadContenido(),
      this.loadRewards(),
      this.loadCumpleaneros(),
    ]);
  }

  async loadContenido() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const { data, error } = await this.supabase.getContenidoPublicado();
      if (error) {
        this.error.set(true);
        if (!this.isTimeoutError(error)) {
          this.sentry.captureError(error, { action: 'loadContenidoPublicado' });
        }
        return;
      }

      this.items.set((data ?? []) as ContenidoBox[]);
      this.featuredIndex.set(0);
    } catch (error) {
      this.error.set(true);
      if (!this.isTimeoutError(error)) {
        this.sentry.captureError(error, { action: 'loadContenidoPublicadoUnexpected' });
      }
    } finally {
      this.loading.set(false);
    }
  }

  async loadRewards() {
    try {
      const [{ data: attendanceData }, { data: catalogData }] = await Promise.all([
        this.supabase.getAttendanceRewardConfig(),
        this.supabase.getRewardCatalogConfig(),
      ]);

      const attendanceDetail = attendanceData?.detalle as Partial<AttendanceRewardConfig> | undefined;
      const attendanceReward = attendanceDetail ? [{
        id: 'attendance',
        title: attendanceDetail.rewardName?.trim() || 'Reto de asistencia',
        reward: attendanceDetail.description?.trim() || 'Reto por constancia del mes.',
        description: `Inscríbete y mantén al menos ${Number(attendanceDetail.targetPercentage ?? 95)}% de asistencia del mes para competir por este reto.`,
        category: 'Asistencia',
        type: 'attendance' as const,
        participantUserIds: Array.isArray(attendanceDetail.participantUserIds) ? attendanceDetail.participantUserIds : [],
      }] : [];

      const catalogDetail = catalogData?.detalle as { items?: RewardCatalogItem[] } | undefined;
      const catalogItems = Array.isArray(catalogDetail?.items) ? catalogDetail.items : [];
      const normalizedCatalog = catalogItems.map((item) => ({
        id: item.id,
        title: item.title?.trim() || 'Premio sin nombre',
        reward: item.reward?.trim() || 'Premio por anunciar',
        description: item.description?.trim() || '',
        category: item.category?.trim() || 'General',
        type: 'catalog' as const,
        participantUserIds: Array.isArray(item.participantUserIds) ? item.participantUserIds : [],
      }));

      this.rewardCatalog.set(normalizedCatalog);
      this.rewardCards.set([...attendanceReward, ...normalizedCatalog]);
    } catch (error) {
      this.sentry.captureError(error, { action: 'loadRewards' });
    }
  }

  async loadCumpleaneros() {
    this.cumpleanerosLoading.set(true);
    this.cumpleanerosError.set(false);
    try {
      const { data, error } = await this.supabase.getCumpleanerosHoy();
      if (error) {
        this.cumpleanerosError.set(true);
        if (!this.isTimeoutError(error)) {
          this.sentry.captureError(error, { action: 'loadCumpleaneros' });
        }
        return;
      }

      this.cumpleaneros.set((data ?? []) as Cumpleanero[]);
    } catch (error) {
      this.cumpleanerosError.set(true);
      if (!this.isTimeoutError(error)) {
        this.sentry.captureError(error, { action: 'loadCumpleanerosUnexpected' });
      }
    } finally {
      this.cumpleanerosLoading.set(false);
    }
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('timed out after');
  }

  rewardParticipantCount(reward: RewardCard) {
    return reward.participantUserIds?.length ?? 0;
  }

  openRewardDetail(reward: RewardCard) {
    this.selectedRewardCard.set(reward);
  }

  isJoined(reward: RewardCard) {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return false;
    return reward.participantUserIds?.includes(userId) ?? false;
  }

  async joinReward(reward: RewardCard) {
    const userId = this.auth.currentUser()?.id;
    if (!userId || this.isJoined(reward) || this.joiningRewardId()) return;

    this.joiningRewardId.set(reward.id);
    try {
      if (reward.type === 'attendance') {
        const { data, error: loadError } = await this.supabase.getAttendanceRewardConfig();
        if (loadError) {
          this.sentry.captureError(loadError, { action: 'joinAttendanceReward', rewardId: reward.id });
          return;
        }

        const detail = (data?.detalle ?? {}) as AttendanceRewardConfig;
        const participantUserIds = Array.isArray(detail.participantUserIds) ? detail.participantUserIds : [];
        const { error } = await this.supabase.saveAttendanceRewardConfig(userId, {
          ...detail,
          participantUserIds: [...participantUserIds, userId],
        } as Record<string, unknown>);

        if (error) {
          this.sentry.captureError(error, { action: 'joinAttendanceReward', rewardId: reward.id });
          return;
        }

        this.rewardCards.update((cards) => cards.map((card) => (
          card.id === reward.id
            ? { ...card, participantUserIds: [...(card.participantUserIds ?? []), userId] }
            : card
        )));
        this.selectedRewardCard.update((current) => (
          current?.id === reward.id
            ? { ...current, participantUserIds: [...(current.participantUserIds ?? []), userId] }
            : current
        ));
        return;
      }

      const nextItems = this.rewardCatalog().map((item) => (
        item.id === reward.id
          ? {
              ...item,
              participantUserIds: [...(item.participantUserIds ?? []), userId],
            }
          : item
      ));

      const { error } = await this.supabase.saveRewardCatalogConfig(userId, { items: nextItems } as Record<string, unknown>);
      if (error) {
        this.sentry.captureError(error, { action: 'joinReward', rewardId: reward.id });
        return;
      }

      this.rewardCatalog.set(nextItems);
      this.rewardCards.update((cards) => cards.map((card) => (
        card.id === reward.id
          ? { ...card, participantUserIds: [...(card.participantUserIds ?? []), userId] }
          : card
      )));
      this.selectedRewardCard.update((current) => (
        current?.id === reward.id
          ? { ...current, participantUserIds: [...(current.participantUserIds ?? []), userId] }
          : current
      ));
    } finally {
      this.joiningRewardId.set(null);
    }
  }

  imageUrl(item: ContenidoBox) {
    return this.supabase.getContenidoImageUrl(item.imagen_path);
  }

  openDetail(item: ContenidoBox) {
    this.selectedItem.set(item);
  }

  goToFeatured(index: number) {
    this.featuredIndex.set(index);

    const track = this.featuredTrack?.nativeElement;
    const target = track?.children.item(index) as HTMLElement | null;
    if (!track || !target) return;

    track.scrollTo({
      left: target.offsetLeft,
      behavior: 'smooth',
    });
  }

  onFeaturedScroll() {
    const track = this.featuredTrack?.nativeElement;
    if (!track) return;

    const children = Array.from(track.children) as HTMLElement[];
    if (!children.length) return;

    const currentIndex = children.reduce((closestIndex, child, index) => {
      const closest = children[closestIndex];
      return Math.abs(child.offsetLeft - track.scrollLeft) < Math.abs(closest.offsetLeft - track.scrollLeft)
        ? index
        : closestIndex;
    }, 0);

    this.featuredIndex.set(currentIndex);
  }

  excerpt(text: string, max = 120) {
    if (text.length <= max) return text;
    return `${text.slice(0, max).trim()}…`;
  }

  modalidadLabel(item: ContenidoBox) {
    if (item.evento_modalidad === 'box') return 'En el box';
    if (item.evento_modalidad === 'externo') return 'Fuera del box';
    return 'Evento';
  }
}
