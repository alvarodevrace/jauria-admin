import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';
import { PlanLabelPipe } from '../../shared/pipes/plan-label.pipe';
import { getEcuadorTodayYmd, parseEcuadorDateTime } from '../../shared/utils/date-ecuador';

interface ClientePlan {
  estado: string;
  plan: string;
  monto_plan: number;
  fecha_vencimiento: string;
}

interface MiInscripcion {
  clase_id: number;
  estado?: string;
  clases?: {
    tipo: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    cancelada: boolean;
  };
}

interface AttendanceRewardConfig {
  rewardName: string;
  description: string;
  targetPercentage: number;
}

interface AttendanceProgress {
  asistio: number;
  ausencias: number;
  pendientes: number;
  porcentaje: number;
  cumpleMeta: boolean;
  posicion: number | null;
  totalAtletas: number;
}

interface AttendanceMonthlyRow {
  userId: string;
  asistio: number;
  ausencias: number;
  porcentaje: number;
}

interface ClaseDisponible {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cancelada: boolean;
}

const PROFILE_BIO_MAX = 240;

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
            <div class="profile-card">
              <div class="profile-card__avatar-shell">
                @if (avatarPreview()) {
                  <img class="profile-card__avatar-image" [src]="avatarPreview()!" alt="Avatar del perfil" />
                } @else {
                  <div class="profile-card__avatar-fallback">{{ initials() }}</div>
                }
              </div>
              <div class="profile-card__meta">
                <div class="profile-card__title">Tu foto de perfil</div>
                <div class="profile-card__hint">
                  Ayuda a que el coach y tus compañeros te reconozcan cuando participas en clases.
                </div>
                <label class="btn btn--ghost btn--sm profile-card__file-btn">
                  Cambiar foto
                  <input type="file" accept="image/*" class="profile-card__file-input" (change)="onAvatarSelected($event)" />
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Nombre Completo</label>
              <input type="text" class="form-control" [(ngModel)]="nombre" name="nombre" />
            </div>
            <div class="form-group">
              <label class="form-label">Bio corta</label>
              <textarea
                class="form-control profile-card__bio"
                [(ngModel)]="bio"
                name="bio"
                [maxLength]="bioMax"
                placeholder="Cuéntale al box algo breve sobre ti, tus objetivos o tu energía al entrenar."
              ></textarea>
              <div class="profile-card__counter">{{ bio.length }}/{{ bioMax }}</div>
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
            @if (premioAsistenciaActivo() && progresoAsistencia()) {
              <div class="stat-card asistencia-card">
                <div class="stat-card__label">Reto del Mes</div>
                <div class="asistencia-card__headline">{{ premioAsistencia().rewardName }}</div>
                <div class="asistencia-card__progress-row">
                  <strong>{{ progresoAsistencia()!.porcentaje }}%</strong>
                  <span>Meta {{ premioAsistencia().targetPercentage }}%</span>
                </div>
                @if (progresoAsistencia()!.posicion) {
                  <div class="asistencia-card__rank">
                    Puesto actual:
                    <strong>#{{ progresoAsistencia()!.posicion }}</strong>
                    de {{ progresoAsistencia()!.totalAtletas }} atletas
                  </div>
                }
                <div class="asistencia-card__bar">
                  <span [style.width.%]="progresoBarWidth()"></span>
                </div>
                <div class="asistencia-card__meta">
                  <span>{{ progresoAsistencia()!.asistio }} asistencias</span>
                  <span>{{ progresoAsistencia()!.ausencias }} ausencias</span>
                  @if (progresoAsistencia()!.pendientes > 0) {
                    <span>{{ progresoAsistencia()!.pendientes }} pendientes</span>
                  }
                </div>
                <p class="asistencia-card__message">{{ asistenciaMessage() }}</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @media (max-width: 768px) {
      .cuenta-grid { grid-template-columns: 1fr !important; }
    }

    .profile-card {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding: 16px;
      border: 1px solid #2b3033;
      border-radius: 14px;
      background: rgba(20, 22, 24, 0.9);
    }

    .profile-card__avatar-shell {
      width: 88px;
      height: 88px;
      flex-shrink: 0;
    }

    .profile-card__avatar-image,
    .profile-card__avatar-fallback {
      width: 100%;
      height: 100%;
      border-radius: 50%;
    }

    .profile-card__avatar-image {
      object-fit: cover;
      border: 2px solid rgba(166, 31, 36, 0.4);
    }

    .profile-card__avatar-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #a61f24, #6f161a);
      color: #f4f1eb;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .profile-card__meta {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    .profile-card__title {
      color: #f4f1eb;
      font-size: 16px;
      font-weight: 700;
    }

    .profile-card__hint {
      color: #938c84;
      font-size: 13px;
      line-height: 1.5;
    }

    .profile-card__file-btn {
      width: fit-content;
      cursor: pointer;
    }

    .profile-card__file-input {
      display: none;
    }

    .profile-card__bio {
      min-height: 110px;
      resize: vertical;
    }

    .profile-card__counter {
      margin-top: 6px;
      font-size: 12px;
      color: #938c84;
      text-align: right;
    }

    .asistencia-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .asistencia-card__headline {
      font-size: 18px;
      color: #f4f1eb;
      margin-top: 4px;
    }

    .asistencia-card__progress-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #d2cbc1;
      font-size: 13px;
    }

    .asistencia-card__progress-row strong {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      color: #f4f1eb;
      letter-spacing: 0.05em;
    }

    .asistencia-card__bar {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      background: #1d2022;
      overflow: hidden;
    }

    .asistencia-card__bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #a61f24, #3d8b6d);
    }

    .asistencia-card__rank {
      color: #d2cbc1;
      font-size: 13px;
    }

    .asistencia-card__rank strong {
      color: #f4f1eb;
      margin: 0 4px;
    }

    .asistencia-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      color: #938c84;
      font-size: 12px;
    }

    .asistencia-card__message {
      margin: 0;
      color: #d2cbc1;
      font-size: 13px;
      line-height: 1.5;
    }

    @media (max-width: 640px) {
      .profile-card {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `],
})
export class MiCuentaComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  nombre = '';
  bio = '';
  readonly bioMax = PROFILE_BIO_MAX;
  saving = signal(false);
  perfilMsg = signal('');
  avatarPreview = signal<string | null>(null);
  cliente = signal<ClientePlan | null>(null);
  premioAsistencia = signal<AttendanceRewardConfig>({
    rewardName: 'Premio de asistencia',
    description: 'Mantén constancia este mes para ganar el reconocimiento del box.',
    targetPercentage: 95,
  });
  premioAsistenciaActivo = signal(false);
  progresoAsistencia = signal<AttendanceProgress | null>(null);
  proximaClase = signal<NonNullable<MiInscripcion['clases']> | null>(null);
  clasesDisponibles = signal(0);
  private avatarFile: File | null = null;
  private perfilMsgTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private claseStart(fecha: string, horaInicio: string): number {
    return parseEcuadorDateTime(fecha, horaInicio).getTime();
  }

  private claseEnd(fecha: string, horaInicio: string, horaFin?: string): number {
    return parseEcuadorDateTime(fecha, horaFin ?? horaInicio).getTime();
  }

  async ngOnInit() {
    this.nombre = this.auth.profile()?.nombre_completo ?? '';
    this.bio = this.auth.profile()?.bio ?? '';
    this.avatarPreview.set(this.resolveAvatarUrl(this.auth.profile()?.avatar_url ?? null));

    const idCliente = this.auth.profile()?.id_cliente;
    if (idCliente) {
      const { data } = await this.supabase.getCliente(idCliente);
      this.cliente.set(data as ClientePlan);
    }

    const rewardConfigRes = await this.supabase.getAttendanceRewardConfig();
    const rewardDetalle = rewardConfigRes.data?.detalle as Partial<AttendanceRewardConfig> | undefined;
    if (rewardDetalle) {
      this.premioAsistencia.set({
        rewardName: rewardDetalle.rewardName?.trim() || 'Premio de asistencia',
        description: rewardDetalle.description?.trim() || 'Mantén constancia este mes para ganar el reconocimiento del box.',
        targetPercentage: Number(rewardDetalle.targetPercentage ?? 95),
      });
      this.premioAsistenciaActivo.set(true);
    }

    const userId = this.auth.currentUser()?.id;
    if (userId && this.auth.rol() === 'atleta') {
      const [inscripcionesRes, clasesRes] = await Promise.all([
        this.supabase.getInscripcionesByUser(userId),
        this.supabase.getClasesDesde(getEcuadorTodayYmd()),
      ]);
      const attendanceRes = await this.supabase.getAttendanceRecordsForMonth();

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

      this.progresoAsistencia.set(
        this.buildAttendanceProgress(
          (inscripcionesRes.data ?? []) as unknown as MiInscripcion[],
          userId,
          attendanceRes.data ?? [],
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

  initials() {
    const name = this.nombre.trim() || this.auth.profile()?.nombre_completo || 'Usuario';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U';
  }

  progresoBarWidth() {
    const porcentaje = this.progresoAsistencia()?.porcentaje;
    if (typeof porcentaje !== 'number' || Number.isNaN(porcentaje)) return 0;
    return Math.max(0, Math.min(100, porcentaje));
  }

  asistenciaMessage() {
    const progreso = this.progresoAsistencia();
    if (!progreso) return '';

    if (progreso.cumpleMeta) {
      return `Vas cumpliendo la meta del ${this.premioAsistencia().targetPercentage}% este mes. Sigue así para ganar ${this.premioAsistencia().rewardName}.`;
    }

    if (progreso.asistio + progreso.ausencias === 0) {
      return 'Aún no hay asistencias marcadas este mes. Cuando el coach confirme tus clases aquí verás tu avance.';
    }

    return `Tu asistencia del mes va en ${progreso.porcentaje}%. Necesitas llegar al ${this.premioAsistencia().targetPercentage}% para ganar ${this.premioAsistencia().rewardName}.`;
  }

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.avatarFile = file;

    if (!file) {
      this.avatarPreview.set(this.resolveAvatarUrl(this.auth.profile()?.avatar_url ?? null));
      return;
    }

    this.avatarPreview.set(URL.createObjectURL(file));
  }

  async onSavePerfil() {
    const userId = this.auth.currentUser()?.id;
    if (!userId || !this.nombre) return;
    this.saving.set(true);
    try {
      let avatarPath = this.auth.profile()?.avatar_url ?? null;

      if (this.avatarFile) {
        const upload = await this.supabase.uploadProfileAvatar(userId, this.avatarFile);
        if (upload.error) {
          this.toast.error('No se pudo subir la foto de perfil');
          return;
        }
        avatarPath = upload.filePath;
      }

      const payload: Record<string, unknown> = {
        nombre_completo: this.nombre.trim(),
        bio: this.bio.trim() || null,
        avatar_url: avatarPath,
      };

      const { error } = await this.supabase.updateProfile(userId, payload);

      if (error) {
        this.toast.error('No se pudo actualizar el perfil');
        return;
      }

      const refreshedProfile = await this.auth.refreshProfile();
      const nextAvatarPath = refreshedProfile?.avatar_url ?? avatarPath;
      const nextBio = refreshedProfile?.bio ?? (this.bio.trim() || null);
      const nextName = refreshedProfile?.nombre_completo ?? this.nombre.trim();

      this.nombre = nextName;
      this.bio = nextBio ?? '';
      this.avatarFile = null;
      this.avatarPreview.set(this.resolveAvatarUrl(nextAvatarPath));
      this.perfilMsg.set('Perfil actualizado');
      this.toast.success('Perfil actualizado');
      if (this.perfilMsgTimeoutId) clearTimeout(this.perfilMsgTimeoutId);
      this.perfilMsgTimeoutId = setTimeout(() => this.perfilMsg.set(''), 3000);
    } catch {
      this.toast.error('No se pudo guardar el perfil');
    } finally {
      this.saving.set(false);
    }
  }

  ngOnDestroy() {
    if (this.perfilMsgTimeoutId) clearTimeout(this.perfilMsgTimeoutId);
  }

  private resolveAvatarUrl(path: string | null) {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return this.supabase.getProfileAvatarUrl(path);
  }

  private buildAttendanceProgress(
    inscripciones: MiInscripcion[],
    userId: string,
    attendanceRows: unknown[],
  ): AttendanceProgress {
    const monthKey = getEcuadorTodayYmd().slice(0, 7);
    const today = getEcuadorTodayYmd();

    const summary = inscripciones.reduce((acc, inscripcion) => {
      const clase = inscripcion.clases;
      if (!clase || clase.cancelada || !clase.fecha.startsWith(monthKey) || clase.fecha > today) {
        return acc;
      }

      if (inscripcion.estado === 'asistio') acc.asistio += 1;
      else if (inscripcion.estado === 'no_asistio') acc.ausencias += 1;
      else if (inscripcion.estado !== 'cancelado') acc.pendientes += 1;

      return acc;
    }, {
      asistio: 0,
      ausencias: 0,
      pendientes: 0,
      porcentaje: 0,
      cumpleMeta: false,
      posicion: null,
      totalAtletas: 0,
    });

    const totalMarcadas = summary.asistio + summary.ausencias;
    const porcentaje = totalMarcadas > 0 ? Math.round((summary.asistio / totalMarcadas) * 100) : 0;
    const ranking = this.buildAttendanceRanking(attendanceRows);
    const posicion = ranking.findIndex((row) => row.userId === userId);

    return {
      ...summary,
      porcentaje,
      cumpleMeta: totalMarcadas > 0 && porcentaje >= this.premioAsistencia().targetPercentage,
      posicion: posicion >= 0 ? posicion + 1 : null,
      totalAtletas: ranking.length,
    };
  }

  private buildAttendanceRanking(attendanceRows: unknown[]): AttendanceMonthlyRow[] {
    const monthKey = getEcuadorTodayYmd().slice(0, 7);
    const today = getEcuadorTodayYmd();
    const grouped = new Map<string, AttendanceMonthlyRow>();

    for (const raw of attendanceRows as Array<{
      user_id?: string;
      estado?: string;
      clases?: { fecha?: string | null; cancelada?: boolean | null } | null;
    }>) {
      const userId = raw.user_id;
      const fecha = raw.clases?.fecha ?? '';
      if (!userId || !fecha.startsWith(monthKey) || fecha > today || raw.clases?.cancelada) continue;

      const current = grouped.get(userId) ?? {
        userId,
        asistio: 0,
        ausencias: 0,
        porcentaje: 0,
      };

      if (raw.estado === 'asistio') current.asistio += 1;
      else if (raw.estado === 'no_asistio') current.ausencias += 1;

      grouped.set(userId, current);
    }

    return Array.from(grouped.values())
      .map((row) => {
        const totalMarcadas = row.asistio + row.ausencias;
        return {
          ...row,
          porcentaje: totalMarcadas > 0 ? Math.round((row.asistio / totalMarcadas) * 100) : 0,
        };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje || b.asistio - a.asistio || a.userId.localeCompare(b.userId));
  }
}
