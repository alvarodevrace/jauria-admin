import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import {
  ContenidoBox,
  ContenidoTipo,
} from '../../core/models/contenido-box.model';
import { SentryService } from '../../core/services/sentry.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

@Component({
  selector: 'app-novedades',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Comunidad</span>
      <h2 class="page-header__title">Novedades</h2>
      <p class="page-header__subtitle">
        Noticias del box, eventos y anuncios del coach visibles para toda la comunidad.
      </p>
    </div>

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
    } @else if (destacados().length > 0) {
      <section class="novedades-featured">
        <div class="novedades-featured__header">
          <div>
            <span class="novedades-section-label">Destacado</span>
            <h3 class="novedades-section-title">Lo último del box</h3>
          </div>
          @if (destacados().length > 1) {
            <div class="novedades-featured__actions">
              <button class="btn btn--ghost btn--sm btn--icon" (click)="prevFeatured()" aria-label="Anterior">
                <i-lucide name="chevron-left" />
              </button>
              <button class="btn btn--ghost btn--sm btn--icon" (click)="nextFeatured()" aria-label="Siguiente">
                <i-lucide name="chevron-right" />
              </button>
            </div>
          }
        </div>

        <div class="novedades-carousel">
          <div
            class="novedades-carousel__track"
            [style.transform]="'translateX(-' + (featuredIndex() * 100) + '%)'"
          >
            @for (item of destacados(); track item.id) {
              <article class="novedades-hero-card" (click)="openDetail(item)">
                <div class="novedades-hero-card__image-wrap">
                  <img
                    class="novedades-hero-card__image"
                    [src]="imageUrl(item)"
                    [alt]="item.titulo"
                  />
                  <div class="novedades-hero-card__overlay"></div>
                </div>
                <div class="novedades-hero-card__body">
                  <div class="novedades-hero-card__meta">
                    <span class="novedades-type-pill" [class.novedades-type-pill--evento]="item.tipo === 'evento'">
                      {{ item.tipo }}
                    </span>
                    <span>{{ item.published_at || item.created_at | dateEc: 'dd/MM/yyyy' }}</span>
                  </div>
                  <h3 class="novedades-hero-card__title">{{ item.titulo }}</h3>
                  <p class="novedades-hero-card__desc">{{ excerpt(item.descripcion, 170) }}</p>

                  @if (item.tipo === 'evento') {
                    <div class="novedades-hero-card__event-meta">
                      <span>
                        <i-lucide name="calendar-days" />
                        {{ item.evento_fecha_inicio | dateEc: 'EEEE dd/MM · HH:mm' }}
                      </span>
                      <span>
                        <i-lucide name="map-pinned" />
                        {{ modalidadLabel(item) }}
                      </span>
                    </div>
                  }
                </div>
              </article>
            }
          </div>
        </div>

        @if (destacados().length > 1) {
          <div class="novedades-carousel__dots">
            @for (item of destacados(); track item.id; let i = $index) {
              <button
                class="novedades-carousel__dot"
                [class.active]="featuredIndex() === i"
                (click)="featuredIndex.set(i)"
                [attr.aria-label]="'Ir al destacado ' + (i + 1)"
              ></button>
            }
          </div>
        }
      </section>
    }

    <section class="novedades-feed">
      <div class="novedades-feed__toolbar">
        <div>
          <span class="novedades-section-label">Feed</span>
          <h3 class="novedades-section-title">Noticias y eventos</h3>
        </div>
        <div class="novedades-filters">
          @for (tipo of filtros; track tipo.value) {
            <button
              class="btn btn--sm"
              [class]="selectedFilter() === tipo.value ? 'btn--primary' : 'btn--ghost'"
              (click)="selectedFilter.set(tipo.value)"
            >
              {{ tipo.label }}
            </button>
          }
        </div>
      </div>

      @if (filtrados().length === 0) {
        <div class="data-table-wrapper">
          <div class="novedades-empty">
            <div class="auth-state-icon auth-state-icon--warning">
              <i-lucide name="newspaper" />
            </div>
            <h4>No hay novedades para este filtro</h4>
            <p>Cuando el coach publique contenido nuevo aparecerá aquí automáticamente.</p>
          </div>
        </div>
      } @else {
        <div class="novedades-grid">
          @for (item of filtrados(); track item.id) {
            <article class="novedades-card" (click)="openDetail(item)">
              <img class="novedades-card__image" [src]="imageUrl(item)" [alt]="item.titulo" />
              <div class="novedades-card__body">
                <div class="novedades-card__meta">
                  <span class="novedades-type-pill" [class.novedades-type-pill--evento]="item.tipo === 'evento'">
                    {{ item.tipo }}
                  </span>
                  <span>{{ item.published_at || item.created_at | dateEc: 'dd/MM/yyyy' }}</span>
                </div>
                <h4 class="novedades-card__title">{{ item.titulo }}</h4>
                <p class="novedades-card__desc">{{ excerpt(item.descripcion, 110) }}</p>

                @if (item.tipo === 'evento') {
                  <div class="novedades-card__event">
                    <span>{{ item.evento_fecha_inicio | dateEc: 'EEEE dd/MM · HH:mm' }}</span>
                    <span>{{ item.evento_ubicacion || modalidadLabel(item) }}</span>
                  </div>
                }
              </div>
            </article>
          }
        </div>
      }
    </section>

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
            <button class="btn btn--ghost btn--icon" (click)="selectedItem.set(null)">
              <i-lucide name="x" />
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
  `,
  styles: [`
    .novedades-loading-grid,
    .novedades-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }

    .novedades-skeleton {
      height: 320px;
    }

    .novedades-featured,
    .novedades-feed {
      margin-bottom: 32px;
    }

    .novedades-featured__header,
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

    .novedades-featured__actions,
    .novedades-filters {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .novedades-carousel {
      overflow: hidden;
      border-radius: 20px;
    }

    .novedades-carousel__track {
      display: flex;
      transition: transform 0.32s ease;
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

    .novedades-hero-card {
      position: relative;
      min-width: 100%;
      min-height: 380px;
      border: 1px solid #2b3033;
      border-radius: 20px;
      overflow: hidden;
      cursor: pointer;
      background: #151718;
    }

    .novedades-hero-card__image-wrap,
    .novedades-hero-card__image,
    .novedades-hero-card__overlay {
      position: absolute;
      inset: 0;
    }

    .novedades-hero-card__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .novedades-hero-card__overlay {
      background:
        linear-gradient(180deg, rgba(10, 10, 10, 0.08), rgba(10, 10, 10, 0.85) 72%),
        linear-gradient(90deg, rgba(10, 10, 10, 0.82), rgba(10, 10, 10, 0.12));
    }

    .novedades-hero-card__body {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 14px;
      min-height: 380px;
      padding: 28px;
    }

    .novedades-hero-card__title,
    .novedades-card__title {
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #f4f1eb;
    }

    .novedades-hero-card__title {
      font-size: clamp(28px, 4vw, 44px);
      line-height: 0.95;
      max-width: 640px;
    }

    .novedades-hero-card__desc,
    .novedades-card__desc,
    .novedades-modal__content {
      color: #d2cbc1;
      line-height: 1.6;
    }

    .novedades-hero-card__desc {
      max-width: 620px;
      font-size: 14px;
    }

    .novedades-hero-card__meta,
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

    .novedades-hero-card__event-meta,
    .novedades-card__event {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      color: #d2cbc1;
      font-size: 12px;
    }

    .novedades-hero-card__event-meta span,
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

    .novedades-card__image {
      width: 100%;
      height: 200px;
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
      font-size: 24px;
      line-height: 1;
    }

    .novedades-card__desc {
      font-size: 14px;
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
      .novedades-hero-card,
      .novedades-hero-card__body {
        min-height: 420px;
      }

      .novedades-modal__event-grid {
        grid-template-columns: 1fr;
      }

      .novedades-feed__toolbar {
        align-items: stretch;
      }
    }
  `],
})
export class NovedadesComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private sentry = inject(SentryService);

  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<ContenidoBox[]>([]);
  readonly selectedFilter = signal<ContenidoTipo | ''>('');
  readonly selectedItem = signal<ContenidoBox | null>(null);
  readonly featuredIndex = signal(0);

  readonly filtros = [
    { label: 'Todos', value: '' as const },
    { label: 'Noticias', value: 'noticia' as const },
    { label: 'Eventos', value: 'evento' as const },
  ];

  readonly filtrados = computed(() => {
    const filter = this.selectedFilter();
    return filter ? this.items().filter((item) => item.tipo === filter) : this.items();
  });

  readonly destacados = computed(() => this.items().slice(0, 5));

  async ngOnInit() {
    await this.loadContenido();
  }

  async loadContenido() {
    this.loading.set(true);
    this.error.set(false);

    const { data, error } = await this.supabase.getContenidoPublicado();

    this.loading.set(false);

    if (error) {
      this.error.set(true);
      this.sentry.captureError(error, { action: 'loadContenidoPublicado' });
      return;
    }

    this.items.set((data ?? []) as ContenidoBox[]);
    this.featuredIndex.set(0);
  }

  imageUrl(item: ContenidoBox) {
    return this.supabase.getContenidoImageUrl(item.imagen_path);
  }

  openDetail(item: ContenidoBox) {
    this.selectedItem.set(item);
  }

  prevFeatured() {
    const total = this.destacados().length;
    if (total <= 1) return;
    this.featuredIndex.update((current) => (current - 1 + total) % total);
  }

  nextFeatured() {
    const total = this.destacados().length;
    if (total <= 1) return;
    this.featuredIndex.update((current) => (current + 1) % total);
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
