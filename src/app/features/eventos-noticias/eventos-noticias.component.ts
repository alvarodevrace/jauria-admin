import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import {
  ContenidoBox,
  ContenidoBoxPayload,
  ContenidoTipo,
  EstadoPublicacion,
  EventoModalidad,
} from '../../core/models/contenido-box.model';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SentryService } from '../../core/services/sentry.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

interface ContenidoFormState {
  id: number | null;
  tipo: ContenidoTipo;
  titulo: string;
  descripcion: string;
  estado_publicacion: EstadoPublicacion;
  imagen_path: string;
  cta_label: string;
  cta_url: string;
  evento_fecha_inicio: string;
  evento_fecha_fin: string;
  evento_modalidad: EventoModalidad;
  evento_ubicacion: string;
}

@Component({
  selector: 'app-eventos-noticias',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Editorial</span>
      <h2 class="page-header__title">Eventos y Noticias</h2>
      <p class="page-header__subtitle">
        Publica noticias del box, eventos y llamados a la comunidad desde un solo lugar.
      </p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__label">Publicados</div>
        <div class="stat-card__value">{{ publicadosCount() }}</div>
        <div class="stat-card__trend">Contenido visible en Novedades</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Borradores</div>
        <div class="stat-card__value">{{ draftsCount() }}</div>
        <div class="stat-card__trend">Pendientes de revisión o publicación</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Próximos eventos</div>
        <div class="stat-card__value">{{ upcomingEventsCount() }}</div>
        <div class="stat-card__trend">Eventos con inicio futuro</div>
      </div>
    </div>

    @if (error()) {
      <div class="alert alert--warning">
        <i-lucide name="triangle-alert" />
        <div>
          <strong>No se pudo cargar el módulo editorial.</strong>
          Verifica la tabla contenido_box o intenta nuevamente.
        </div>
      </div>
    }

    <div class="data-table-wrapper">
      <div class="data-table-wrapper__header">
        <span class="data-table-wrapper__title">Contenido creado</span>

        <div class="editorial-toolbar">
          <button class="btn btn--ghost btn--sm filters-toggle" type="button" (click)="showFilters.set(!showFilters())">
            <i-lucide name="settings-2" />
            <span>Filtros</span>
          </button>

          <button class="btn btn--primary" (click)="openCreateModal()">
            <i-lucide name="check" />
            Nuevo
          </button>
        </div>
      </div>
      <div class="filters-panel" [class.filters-panel--open]="showFilters()">
        <div class="editorial-toolbar">
          <div class="search-input">
            <i-lucide class="icon" name="clipboard" />
            <input
              type="text"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="Buscar por título o descripción"
            />
          </div>

          <select class="form-control editorial-filter" [ngModel]="tipoFilter()" (ngModelChange)="tipoFilter.set($event)">
            <option value="">Todos los tipos</option>
            <option value="noticia">Noticias</option>
            <option value="evento">Eventos</option>
          </select>

          <select class="form-control editorial-filter" [ngModel]="estadoFilter()" (ngModelChange)="estadoFilter.set($event)">
            <option value="">Todos los estados</option>
            <option value="draft">Borradores</option>
            <option value="published">Publicados</option>
          </select>
        </div>
      </div>

      @if (loading()) {
        <div class="editorial-empty-state">Cargando contenido...</div>
      } @else if (filteredItems().length === 0) {
        <div class="editorial-empty-state">
          @if (items().length === 0) {
            Aún no has creado noticias ni eventos.
          } @else {
            No hay resultados para los filtros actuales.
          }
        </div>
      } @else {
        <table class="data-table editorial-table">
          <thead>
            <tr>
              <th>Contenido</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Autor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (item of filteredItems(); track item.id) {
              <tr>
                <td>
                  <div class="editorial-content-cell">
                    <img class="editorial-thumb" [src]="imageUrl(item)" [alt]="item.titulo" />
                    <div>
                      <div class="editorial-content-cell__title">{{ item.titulo }}</div>
                      <div class="editorial-content-cell__subtitle">{{ excerpt(item.descripcion, 82) }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="editorial-type-pill" [class.editorial-type-pill--evento]="item.tipo === 'evento'">
                    {{ item.tipo }}
                  </span>
                </td>
                <td>
                  <span class="badge" [class.badge--completado]="item.estado_publicacion === 'published'" [class.badge--pendiente]="item.estado_publicacion === 'draft'">
                    {{ publicationLabel(item.estado_publicacion) }}
                  </span>
                </td>
                <td>
                  @if (item.tipo === 'evento' && item.evento_fecha_inicio) {
                    {{ item.evento_fecha_inicio | dateEc: 'dd/MM/yyyy HH:mm' }}
                  } @else {
                    {{ item.published_at || item.created_at | dateEc: 'dd/MM/yyyy' }}
                  }
                </td>
                <td>{{ item.profiles?.nombre_completo ?? '—' }}</td>
                <td>
                  <div class="data-table__actions editorial-actions">
                    <button class="btn btn--ghost btn--sm btn--icon btn--icon-clean" (click)="previewItem(item)" title="Vista previa" aria-label="Vista previa">
                      <i-lucide name="info-circle" />
                    </button>
                    <button class="btn btn--ghost btn--sm" (click)="openEditModal(item)">
                      Editar
                    </button>
                    <button
                      class="btn btn--secondary btn--sm"
                      (click)="togglePublication(item)"
                      [disabled]="actionLoadingId() === item.id"
                    >
                      {{ item.estado_publicacion === 'published' ? 'Pasar a borrador' : 'Publicar' }}
                    </button>
                    <button
                      class="btn btn--danger btn--sm"
                      (click)="deleteItem(item)"
                      [disabled]="actionLoadingId() === item.id"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="editorial-mobile-list">
          @for (item of filteredItems(); track item.id) {
            <article class="editorial-mobile-card" [class.editorial-mobile-card--open]="isExpanded(item.id)">
              <button
                type="button"
                class="editorial-mobile-card__summary"
                (click)="toggleExpanded(item.id)"
                [attr.aria-expanded]="isExpanded(item.id)"
              >
                <div class="editorial-mobile-card__summary-main">
                  <img class="editorial-thumb editorial-thumb--mobile" [src]="imageUrl(item)" [alt]="item.titulo" />
                  <div class="editorial-mobile-card__summary-copy">
                    <strong>{{ item.titulo }}</strong>
                    <span>{{ item.tipo }}</span>
                  </div>
                </div>
                <i-lucide class="editorial-mobile-card__chevron" [name]="isExpanded(item.id) ? 'chevron-up' : 'chevron-down'" />
              </button>

              @if (isExpanded(item.id)) {
                <div class="editorial-mobile-card__details">
                  <div class="editorial-mobile-card__info-grid">
                    <div class="editorial-mobile-card__info-item">
                      <span class="editorial-mobile-card__info-label">Tipo</span>
                      <span class="editorial-type-pill" [class.editorial-type-pill--evento]="item.tipo === 'evento'">
                        {{ item.tipo }}
                      </span>
                    </div>
                    <div class="editorial-mobile-card__info-item">
                      <span class="editorial-mobile-card__info-label">Estado</span>
                      <span class="badge" [class.badge--completado]="item.estado_publicacion === 'published'" [class.badge--pendiente]="item.estado_publicacion === 'draft'">
                        {{ publicationLabel(item.estado_publicacion) }}
                      </span>
                    </div>
                    <div class="editorial-mobile-card__info-item">
                      <span class="editorial-mobile-card__info-label">Fecha</span>
                      <strong>
                        @if (item.tipo === 'evento' && item.evento_fecha_inicio) {
                          {{ item.evento_fecha_inicio | dateEc: 'dd/MM/yyyy HH:mm' }}
                        } @else {
                          {{ item.published_at || item.created_at | dateEc: 'dd/MM/yyyy' }}
                        }
                      </strong>
                    </div>
                    <div class="editorial-mobile-card__info-item">
                      <span class="editorial-mobile-card__info-label">Autor</span>
                      <strong>{{ item.profiles?.nombre_completo ?? '—' }}</strong>
                    </div>
                  </div>

                  <p class="editorial-mobile-card__desc">{{ excerpt(item.descripcion, 180) }}</p>

                  <div class="editorial-mobile-card__actions">
                    <button class="btn btn--ghost btn--sm btn--icon btn--icon-clean" (click)="previewItem(item)" title="Vista previa" aria-label="Vista previa">
                      <i-lucide name="info-circle" />
                    </button>
                    <button class="btn btn--ghost btn--sm" (click)="openEditModal(item)">
                      Editar
                    </button>
                    <button
                      class="btn btn--secondary btn--sm"
                      (click)="togglePublication(item)"
                      [disabled]="actionLoadingId() === item.id"
                    >
                      {{ item.estado_publicacion === 'published' ? 'Pasar a borrador' : 'Publicar' }}
                    </button>
                    <button
                      class="btn btn--danger btn--sm"
                      (click)="deleteItem(item)"
                      [disabled]="actionLoadingId() === item.id"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              }
            </article>
          }
        </div>
      }
    </div>

    @if (showEditorModal()) {
      <div class="modal-backdrop" (click)="closeEditorModal()">
        <div class="modal modal--wide editorial-modal" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">{{ form().id ? 'Editar contenido' : 'Nuevo contenido' }}</h3>
            <button class="btn btn--ghost btn--icon btn--icon-clean" (click)="closeEditorModal()" aria-label="Cerrar editor">
              <i-lucide name="circle-x" />
            </button>
          </div>
          <div class="modal__body">
            @if (formError()) {
              <div class="alert alert--error">{{ formError() }}</div>
            }

            <div class="two-column-grid">
              <div class="form-group">
                <label class="form-label">Tipo *</label>
                <select class="form-control" [ngModel]="form().tipo" (ngModelChange)="updateTipo($event)">
                  <option value="noticia">Noticia</option>
                  <option value="evento">Evento</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Estado *</label>
                <select class="form-control" [ngModel]="form().estado_publicacion" (ngModelChange)="updateFormField('estado_publicacion', $event)">
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                </select>
              </div>

              <div class="form-group editorial-form-group--full">
                <label class="form-label">Título *</label>
                <input class="form-control" type="text" [ngModel]="form().titulo" (ngModelChange)="updateFormField('titulo', $event)" />
              </div>

              <div class="form-group editorial-form-group--full">
                <label class="form-label">Descripción *</label>
                <textarea class="form-control editorial-textarea" [ngModel]="form().descripcion" (ngModelChange)="updateFormField('descripcion', $event)"></textarea>
              </div>

              <div class="form-group editorial-form-group--full">
                <label class="form-label">Foto *</label>
                <input class="form-control" type="file" accept="image/png,image/jpeg,image/webp" (change)="onFileSelected($event)" />
                <div class="editorial-image-hint">
                  @if (selectedFile()) {
                    Nueva imagen: {{ selectedFile()!.name }}
                  } @else if (form().imagen_path) {
                    Imagen actual cargada. Sube otra solo si quieres reemplazarla.
                  } @else {
                    Selecciona una imagen para publicar el contenido.
                  }
                </div>
                @if (imagePreview()) {
                  <img class="editorial-image-preview" [src]="imagePreview()!" alt="Vista previa" />
                }
              </div>

              @if (form().tipo === 'evento') {
                <div class="form-group">
                  <label class="form-label">Inicio del evento *</label>
                  <input class="form-control" type="datetime-local" [ngModel]="form().evento_fecha_inicio" (ngModelChange)="updateFormField('evento_fecha_inicio', $event)" />
                </div>

                <div class="form-group">
                  <label class="form-label">Fin del evento</label>
                  <input class="form-control" type="datetime-local" [ngModel]="form().evento_fecha_fin" (ngModelChange)="updateFormField('evento_fecha_fin', $event)" />
                </div>

                <div class="form-group">
                  <label class="form-label">Modalidad *</label>
                  <select class="form-control" [ngModel]="form().evento_modalidad" (ngModelChange)="updateModalidad($event)">
                    <option value="box">En el box</option>
                    <option value="externo">Fuera del box</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Ubicación</label>
                  <input class="form-control" type="text" [ngModel]="form().evento_ubicacion" (ngModelChange)="updateFormField('evento_ubicacion', $event)" />
                </div>

                <div class="form-group">
                  <label class="form-label">Texto del CTA</label>
                  <input class="form-control" type="text" [ngModel]="form().cta_label" (ngModelChange)="updateFormField('cta_label', $event)" placeholder="Ej: Más información" />
                </div>

                <div class="form-group">
                  <label class="form-label">URL del CTA</label>
                  <input class="form-control" type="url" [ngModel]="form().cta_url" (ngModelChange)="updateFormField('cta_url', $event)" placeholder="https://..." />
                </div>
              }
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--ghost" (click)="closeEditorModal()">Cancelar</button>
            <button class="btn btn--primary" (click)="saveContent()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : form().id ? 'Guardar cambios' : 'Crear contenido' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (previewSelected()) {
      <div class="modal-backdrop" (click)="previewSelected.set(null)">
        <div class="modal modal--wide editorial-preview-modal" (click)="$event.stopPropagation()">
          <div class="modal__header">
            <h3 class="modal__title">{{ previewSelected()!.titulo }}</h3>
            <button class="btn btn--ghost btn--icon btn--icon-clean" (click)="previewSelected.set(null)" aria-label="Cerrar vista previa">
              <i-lucide name="circle-x" />
            </button>
          </div>
          <div class="modal__body editorial-preview-modal__body">
            <img class="editorial-preview-modal__image" [src]="imageUrl(previewSelected()!)" [alt]="previewSelected()!.titulo" />
            <div class="editorial-preview-modal__meta">
              <span class="editorial-type-pill" [class.editorial-type-pill--evento]="previewSelected()!.tipo === 'evento'">
                {{ previewSelected()!.tipo }}
              </span>
              <span class="badge" [class.badge--completado]="previewSelected()!.estado_publicacion === 'published'" [class.badge--pendiente]="previewSelected()!.estado_publicacion === 'draft'">
                {{ publicationLabel(previewSelected()!.estado_publicacion) }}
              </span>
            </div>
            <p class="editorial-preview-modal__desc">{{ previewSelected()!.descripcion }}</p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .editorial-table {
      display: table;
    }

    .editorial-mobile-list {
      display: none;
      flex-direction: column;
      gap: 12px;
      padding: 18px;
    }

    .editorial-toolbar,
    .editorial-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .editorial-filter {
      width: auto;
      min-width: 160px;
      height: 38px;
    }

    .editorial-empty-state {
      padding: 40px 24px;
      text-align: center;
      color: #938c84;
    }

    .editorial-content-cell {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 240px;
    }

    .editorial-thumb {
      width: 72px;
      height: 72px;
      border-radius: 12px;
      object-fit: cover;
      background: #1d2022;
      flex-shrink: 0;
    }

    .editorial-thumb--mobile {
      width: 60px;
      height: 60px;
    }

    .editorial-content-cell__title {
      color: #f4f1eb;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .editorial-content-cell__subtitle {
      color: #938c84;
      font-size: 13px;
      line-height: 1.4;
    }

    .editorial-type-pill {
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

    .editorial-type-pill--evento {
      background: rgba(61, 110, 145, 0.18);
    }

    .editorial-modal .modal__body {
      padding-bottom: 8px;
    }

    .editorial-form-group--full {
      grid-column: 1 / -1;
    }

    .editorial-textarea {
      min-height: 160px;
      resize: vertical;
    }

    .editorial-image-preview,
    .editorial-preview-modal__image {
      width: 100%;
      max-height: 260px;
      object-fit: cover;
      border-radius: 14px;
      margin-top: 12px;
      background: #1d2022;
    }

    .editorial-image-hint {
      margin-top: 10px;
      color: #938c84;
      font-size: 12px;
      line-height: 1.5;
    }

    .editorial-preview-modal__body {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .editorial-preview-modal__meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .editorial-preview-modal__desc {
      color: #d2cbc1;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .editorial-mobile-card {
      border: 1px solid #2b3033;
      border-radius: 18px;
      background: rgba(21, 23, 24, 0.94);
      overflow: hidden;
    }

    .editorial-mobile-card--open {
      border-color: rgba(166, 31, 36, 0.5);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
    }

    .editorial-mobile-card__summary {
      width: 100%;
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 14px 16px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      text-align: left;
    }

    .editorial-mobile-card__summary-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .editorial-mobile-card__summary-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .editorial-mobile-card__summary-copy strong {
      color: #f4f1eb;
      font-size: 14px;
      line-height: 1.3;
    }

    .editorial-mobile-card__summary-copy span {
      color: #938c84;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .editorial-mobile-card__chevron {
      width: 18px;
      height: 18px;
      color: #938c84;
      flex-shrink: 0;
    }

    .editorial-mobile-card__details {
      border-top: 1px solid rgba(43, 48, 51, 0.9);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .editorial-mobile-card__info-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .editorial-mobile-card__info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(244, 241, 235, 0.03);
      border: 1px solid rgba(244, 241, 235, 0.06);
      min-width: 0;
    }

    .editorial-mobile-card__info-label {
      color: #938c84;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .editorial-mobile-card__info-item strong {
      color: #f4f1eb;
      font-size: 13px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .editorial-mobile-card__desc {
      color: #d2cbc1;
      font-size: 13px;
      line-height: 1.6;
    }

    .editorial-mobile-card__actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .editorial-mobile-card__actions .btn {
      width: 100%;
      justify-content: center;
    }

    @media (max-width: 900px) {
      .editorial-toolbar {
        width: 100%;
      }

      .editorial-filter,
      .editorial-toolbar .search-input {
        width: 100%;
      }
    }

    @media (max-width: 640px) {
      .editorial-table {
        display: none;
      }

      .editorial-mobile-list {
        display: flex;
        padding: 14px;
      }

      .editorial-mobile-card__info-grid,
      .editorial-mobile-card__actions {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class EventosNoticiasComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);
  private sentry = inject(SentryService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal(false);
  readonly showFilters = signal(false);
  readonly actionLoadingId = signal<number | null>(null);
  readonly items = signal<ContenidoBox[]>([]);
  readonly search = signal('');
  readonly tipoFilter = signal<ContenidoTipo | ''>('');
  readonly estadoFilter = signal<EstadoPublicacion | ''>('');
  readonly showEditorModal = signal(false);
  readonly previewSelected = signal<ContenidoBox | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly formError = signal('');
  readonly selectedFile = signal<File | null>(null);
  readonly expandedItemId = signal<number | null>(null);

  readonly form = signal<ContenidoFormState>(this.emptyForm());

  readonly filteredItems = computed(() => {
    const term = this.search().trim().toLowerCase();

    return this.items().filter((item) => {
      const matchesSearch = !term
        || item.titulo.toLowerCase().includes(term)
        || item.descripcion.toLowerCase().includes(term);
      const matchesTipo = !this.tipoFilter() || item.tipo === this.tipoFilter();
      const matchesEstado = !this.estadoFilter() || item.estado_publicacion === this.estadoFilter();

      return matchesSearch && matchesTipo && matchesEstado;
    });
  });

  readonly publicadosCount = computed(
    () => this.items().filter((item) => item.estado_publicacion === 'published').length,
  );

  readonly draftsCount = computed(
    () => this.items().filter((item) => item.estado_publicacion === 'draft').length,
  );

  readonly upcomingEventsCount = computed(
    () => this.items().filter((item) =>
      item.tipo === 'evento'
      && !!item.evento_fecha_inicio
      && new Date(item.evento_fecha_inicio).getTime() > Date.now(),
    ).length,
  );

  async ngOnInit() {
    await this.loadItems();
  }

  toggleExpanded(itemId: number) {
    this.expandedItemId.update((current) => current === itemId ? null : itemId);
  }

  isExpanded(itemId: number) {
    return this.expandedItemId() === itemId;
  }

  async loadItems() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const { data, error } = await this.supabase.getContenidoAdmin();
      if (error) {
        this.error.set(true);
        this.sentry.captureError(error, { action: 'loadContenidoAdmin' });
        return;
      }

      this.items.set((data ?? []) as ContenidoBox[]);
    } catch (error) {
      this.error.set(true);
      this.sentry.captureError(error, { action: 'loadContenidoAdminUnexpected' });
    } finally {
      this.loading.set(false);
    }
  }

  openCreateModal() {
    this.form.set(this.emptyForm());
    this.formError.set('');
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.showEditorModal.set(true);
  }

  openEditModal(item: ContenidoBox) {
    this.form.set({
      id: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      descripcion: item.descripcion,
      estado_publicacion: item.estado_publicacion,
      imagen_path: item.imagen_path,
      cta_label: item.cta_label ?? '',
      cta_url: item.cta_url ?? '',
      evento_fecha_inicio: this.toLocalInputValue(item.evento_fecha_inicio),
      evento_fecha_fin: this.toLocalInputValue(item.evento_fecha_fin),
      evento_modalidad: item.evento_modalidad ?? 'box',
      evento_ubicacion: item.evento_ubicacion ?? '',
    });
    this.formError.set('');
    this.selectedFile.set(null);
    this.imagePreview.set(this.imageUrl(item));
    if (item.tipo === 'evento' && item.evento_modalidad === 'box' && !item.evento_ubicacion) {
      this.updateFormField('evento_ubicacion', 'Jauría Strength and Fitness');
    }
    this.showEditorModal.set(true);
  }

  closeEditorModal() {
    this.showEditorModal.set(false);
    this.formError.set('');
    this.selectedFile.set(null);
    this.imagePreview.set(null);
  }

  previewItem(item: ContenidoBox) {
    this.previewSelected.set(item);
  }

  updateFormField<K extends keyof ContenidoFormState>(field: K, value: ContenidoFormState[K]) {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  updateTipo(tipo: ContenidoTipo) {
    this.form.update((current) => ({
      ...current,
      tipo,
      cta_label: tipo === 'evento' ? current.cta_label : '',
      cta_url: tipo === 'evento' ? current.cta_url : '',
      evento_fecha_inicio: tipo === 'evento' ? current.evento_fecha_inicio : '',
      evento_fecha_fin: tipo === 'evento' ? current.evento_fecha_fin : '',
      evento_modalidad: tipo === 'evento' ? current.evento_modalidad : 'box',
      evento_ubicacion: tipo === 'evento' ? current.evento_ubicacion : '',
    }));
  }

  updateModalidad(modalidad: EventoModalidad) {
    this.form.update((current) => ({
      ...current,
      evento_modalidad: modalidad,
      evento_ubicacion: modalidad === 'box' && !current.evento_ubicacion
        ? 'Jauría Strength and Fitness'
        : current.evento_ubicacion,
    }));
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);

    if (!file) {
      if (!this.form().imagen_path) this.imagePreview.set(null);
      return;
    }

    this.imagePreview.set(URL.createObjectURL(file));
  }

  async saveContent() {
    const validationError = this.validateForm();
    if (validationError) {
      this.formError.set(validationError);
      return;
    }

    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      this.formError.set('No se pudo identificar al usuario autenticado.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');
    try {
      let imagePath = this.form().imagen_path;

      if (this.selectedFile()) {
        const uploadResult = await this.supabase.uploadContenidoImage(this.selectedFile()!);
        if (uploadResult.error) {
          this.formError.set(uploadResult.error.message);
          return;
        }
        imagePath = uploadResult.filePath;
      }

      const payload = this.buildPayload(userId, imagePath);

      const result = this.form().id
        ? await this.supabase.updateContenido(this.form().id!, payload)
        : await this.supabase.createContenido(payload);

      if (result.error) {
        this.formError.set(result.error.message);
        return;
      }

      await this.supabase.logAuditoria(
        userId,
        this.form().id ? 'contenido_box_updated' : 'contenido_box_created',
        { contenidoId: (result.data as { id: number }).id, tipo: this.form().tipo },
      );

      this.toast.success(this.form().id ? 'Contenido actualizado' : 'Contenido creado');
      this.closeEditorModal();
      await this.loadItems();
    } catch {
      this.formError.set('No se pudo guardar el contenido');
    } finally {
      this.saving.set(false);
    }
  }

  async togglePublication(item: ContenidoBox) {
    this.actionLoadingId.set(item.id);
    try {
      const nextState: EstadoPublicacion = item.estado_publicacion === 'published' ? 'draft' : 'published';
      const { error } = await this.supabase.setContenidoPublicationState(item.id, nextState);

      if (error) {
        this.toast.error(error.message);
        return;
      }

      const userId = this.auth.currentUser()?.id;
      if (userId) {
        await this.supabase.logAuditoria(userId, 'contenido_box_publication_changed', {
          contenidoId: item.id,
          estado: nextState,
        });
      }

      this.toast.success(nextState === 'published' ? 'Contenido publicado' : 'Contenido movido a borrador');
      await this.loadItems();
    } catch {
      this.toast.error('No se pudo cambiar el estado de publicación');
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  async deleteItem(item: ContenidoBox) {
    const confirmed = await this.confirmDialog.open({
      title: 'Eliminar contenido',
      message: `Se eliminará "${item.titulo}" y su imagen asociada. Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'No, conservar',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.actionLoadingId.set(item.id);
    try {
      const { error } = await this.supabase.deleteContenido(item.id, item.imagen_path);

      if (error) {
        this.toast.error(error.message);
        return;
      }

      const userId = this.auth.currentUser()?.id;
      if (userId) {
        await this.supabase.logAuditoria(userId, 'contenido_box_deleted', { contenidoId: item.id });
      }

      this.toast.success('Contenido eliminado');
      await this.loadItems();
    } catch {
      this.toast.error('No se pudo eliminar el contenido');
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  imageUrl(item: ContenidoBox) {
    return this.supabase.getContenidoImageUrl(item.imagen_path);
  }

  publicationLabel(state: EstadoPublicacion) {
    return state === 'published' ? 'Publicado' : 'Borrador';
  }

  excerpt(text: string, max = 120) {
    if (text.length <= max) return text;
    return `${text.slice(0, max).trim()}…`;
  }

  private validateForm() {
    const value = this.form();

    if (!value.titulo.trim()) return 'El título es obligatorio.';
    if (!value.descripcion.trim()) return 'La descripción es obligatoria.';
    if (!value.imagen_path && !this.selectedFile()) return 'Debes seleccionar una imagen.';

    if (value.tipo === 'evento') {
      if (!value.evento_fecha_inicio) return 'El evento necesita fecha de inicio.';
      if ((value.cta_label && !value.cta_url) || (!value.cta_label && value.cta_url)) {
        return 'Si usas CTA, completa tanto el texto como la URL.';
      }
      if (value.cta_url && !this.isValidUrl(value.cta_url)) return 'La URL del CTA no es válida.';
    }

    return '';
  }

  private buildPayload(userId: string, imagePath: string): ContenidoBoxPayload {
    const value = this.form();
    const isPublished = value.estado_publicacion === 'published';
    const previousPublishedAt = this.items().find((item) => item.id === value.id)?.published_at ?? null;

    return {
      tipo: value.tipo,
      titulo: value.titulo.trim(),
      descripcion: value.descripcion.trim(),
      estado_publicacion: value.estado_publicacion,
      imagen_path: imagePath,
      created_by: this.form().id ? this.items().find((item) => item.id === value.id)?.created_by ?? userId : userId,
      published_at: isPublished ? previousPublishedAt ?? new Date().toISOString() : null,
      cta_label: value.tipo === 'evento' && value.cta_label.trim() ? value.cta_label.trim() : null,
      cta_url: value.tipo === 'evento' && value.cta_url.trim() ? value.cta_url.trim() : null,
      evento_fecha_inicio: value.tipo === 'evento' ? this.toIsoValue(value.evento_fecha_inicio) : null,
      evento_fecha_fin: value.tipo === 'evento' && value.evento_fecha_fin ? this.toIsoValue(value.evento_fecha_fin) : null,
      evento_modalidad: value.tipo === 'evento' ? value.evento_modalidad : null,
      evento_ubicacion: value.tipo === 'evento' && value.evento_ubicacion.trim() ? value.evento_ubicacion.trim() : null,
    };
  }

  private emptyForm(): ContenidoFormState {
    return {
      id: null,
      tipo: 'noticia',
      titulo: '',
      descripcion: '',
      estado_publicacion: 'draft',
      imagen_path: '',
      cta_label: '',
      cta_url: '',
      evento_fecha_inicio: '',
      evento_fecha_fin: '',
      evento_modalidad: 'box',
      evento_ubicacion: '',
    };
  }

  private isValidUrl(value: string) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private toLocalInputValue(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  private toIsoValue(value: string) {
    return value ? new Date(value).toISOString() : null;
  }
}
