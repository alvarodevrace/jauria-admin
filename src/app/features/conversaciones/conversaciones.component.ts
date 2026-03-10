import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { DateEcPipe } from '../../shared/pipes/date-ec.pipe';

interface Conversacion {
  id: number;
  id_cliente: string;
  telefono_whatsapp: string;
  estado: string;
  banco_seleccionado: string;
  intentos_validacion: number;
  created_at: string;
  expires_at: string;
  clientes?: { nombre_completo: string };
}

@Component({
  selector: 'app-conversaciones',
  standalone: true,
  imports: [CommonModule, DateEcPipe],
  template: `
    <div class="page-header">
      <span class="page-header__eyebrow">Monitor</span>
      <h2 class="page-header__title">Conversaciones WhatsApp</h2>
      <p class="page-header__subtitle">{{ conversaciones().length }} conversaciones activas</p>
    </div>

    @if (loading()) {
      <div style="text-align:center;padding:60px;color:#666;">Cargando...</div>
    } @else {
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="stat-card">
          <div class="stat-card__label">En riesgo</div>
          <div class="stat-card__value">{{ conversacionesRiesgo().length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Expiran hoy</div>
          <div class="stat-card__value">{{ expiranHoy() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Escalado recomendado</div>
          <div class="stat-card__value">{{ escalarRecomendado() }}</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
        @for (conv of conversacionesOrdenadas(); track conv.id) {
          <div
            class="service-card"
            style="flex-direction:column;align-items:flex-start;gap:16px;border-left:4px solid;"
            [style.border-left-color]="urgencyColor(conv)"
          >
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
              <div>
                <div style="font-weight:600;color:#fff;font-size:15px;">
                  {{ conv.clientes?.nombre_completo ?? 'Cliente' }}
                </div>
                <div style="font-size:12px;color:#666;margin-top:2px;">
                  {{ conv.telefono_whatsapp }} · Banco: {{ conv.banco_seleccionado || '—' }}
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                <span class="badge badge--{{ estadoBadge(conv.estado) }}">{{ conv.estado }}</span>
                <span class="badge" [style.background]="urgencyBg(conv)" [style.color]="urgencyColor(conv)">
                  {{ urgencyLabel(conv) }}
                </span>
                <span style="font-size:12px;color:#666;">Intentos: {{ conv.intentos_validacion }}/3</span>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:12px;width:100%;">
              <div class="stat-card">
                <div class="stat-card__label">Vencimiento</div>
                <div class="stat-card__value" style="font-size:18px;">{{ tiempoRestante(conv) }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-card__label">Próxima acción</div>
                <div class="stat-card__value" style="font-size:18px;">{{ nextAction(conv) }}</div>
              </div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn--ghost btn--sm" (click)="escalar(conv.id)">
                {{ conv.intentos_validacion >= 2 ? 'Escalar ahora' : 'Escalar a Coach' }}
              </button>
              <button class="btn btn--danger btn--sm" (click)="cerrar(conv.id)">Cerrar conversación</button>
            </div>

            <div style="font-size:11px;color:#444;">
              Iniciada: {{ conv.created_at | dateEc : 'dd/MM/yyyy HH:mm' }} ·
              Expira: {{ conv.expires_at | dateEc : 'dd/MM/yyyy HH:mm' }}
            </div>
          </div>
        } @empty {
          <div style="text-align:center;padding:60px;color:#666;">
            No hay conversaciones activas en este momento.
          </div>
        }
      </div>
    }
  `,
})
export class ConversacionesComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  conversaciones = signal<Conversacion[]>([]);
  loading = signal(true);

  conversacionesOrdenadas = computed(() => {
    return [...this.conversaciones()].sort((a, b) => this.urgencyScore(b) - this.urgencyScore(a));
  });

  conversacionesRiesgo = computed(() => this.conversaciones().filter((conv) => this.urgencyScore(conv) >= 3));
  expiranHoy = computed(() => this.conversaciones().filter((conv) => this.hoursUntilExpiry(conv) <= 24).length);
  escalarRecomendado = computed(() => this.conversaciones().filter((conv) => conv.intentos_validacion >= 2).length);

  async ngOnInit() {
    const { data, error } = await this.supabase.getConversacionesActivas();
    this.loading.set(false);
    if (error) { this.toast.error(error.message); return; }
    this.conversaciones.set((data ?? []) as unknown as Conversacion[]);
  }

  estadoBadge(estado: string): string {
    const map: Record<string, string> = {
      esperando_banco: 'esperando',
      esperando_comprobante: 'pendiente',
      completado: 'completado',
      fallido: 'fallido',
    };
    return map[estado] ?? 'inactivo';
  }

  hoursUntilExpiry(conv: Conversacion): number {
    return Math.ceil((new Date(conv.expires_at).getTime() - Date.now()) / 3600000);
  }

  urgencyScore(conv: Conversacion): number {
    const hours = this.hoursUntilExpiry(conv);
    if (hours <= 6 || conv.intentos_validacion >= 3) return 4;
    if (hours <= 24 || conv.intentos_validacion >= 2) return 3;
    if (hours <= 48) return 2;
    return 1;
  }

  urgencyLabel(conv: Conversacion): string {
    const score = this.urgencyScore(conv);
    if (score >= 4) return 'Critica';
    if (score === 3) return 'Alta';
    if (score === 2) return 'Media';
    return 'Estable';
  }

  urgencyColor(conv: Conversacion): string {
    const score = this.urgencyScore(conv);
    if (score >= 4) return '#ef5350';
    if (score === 3) return '#ff9800';
    if (score === 2) return '#fbc02d';
    return '#4caf50';
  }

  urgencyBg(conv: Conversacion): string {
    const score = this.urgencyScore(conv);
    if (score >= 4) return 'rgba(239,83,80,0.18)';
    if (score === 3) return 'rgba(255,152,0,0.18)';
    if (score === 2) return 'rgba(251,192,45,0.18)';
    return 'rgba(76,175,80,0.18)';
  }

  tiempoRestante(conv: Conversacion): string {
    const hours = this.hoursUntilExpiry(conv);
    if (hours <= 0) return 'Expirada';
    if (hours < 24) return `${hours} h restantes`;
    const days = Math.ceil(hours / 24);
    return `${days} dia(s) restantes`;
  }

  nextAction(conv: Conversacion): string {
    if (conv.intentos_validacion >= 2) return 'Revisar y escalar';
    if (this.hoursUntilExpiry(conv) <= 24) return 'Resolver hoy';
    if (conv.estado === 'esperando_banco') return 'Esperar banco';
    return 'Validar comprobante';
  }

  async escalar(id: number) {
    await this.supabase.updateConversacion(id, { estado: 'escalado' });
    this.toast.success('Conversación escalada');
    this.conversaciones.update((list) => list.filter((c) => c.id !== id));
  }

  async cerrar(id: number) {
    await this.supabase.updateConversacion(id, { estado: 'fallido' });
    this.toast.info('Conversación cerrada');
    this.conversaciones.update((list) => list.filter((c) => c.id !== id));
  }
}
