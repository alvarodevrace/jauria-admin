import { Component, OnInit, inject, signal } from '@angular/core';
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
      <div style="display:flex;flex-direction:column;gap:16px;">
        @for (conv of conversaciones(); track conv.id) {
          <div class="service-card" style="flex-direction:column;align-items:flex-start;gap:16px;">
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
              <div>
                <div style="font-weight:600;color:#fff;font-size:15px;">
                  {{ conv.clientes?.nombre_completo ?? 'Cliente' }}
                </div>
                <div style="font-size:12px;color:#666;margin-top:2px;">
                  {{ conv.telefono_whatsapp }} · Banco: {{ conv.banco_seleccionado || '—' }}
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span class="badge badge--{{ estadoBadge(conv.estado) }}">{{ conv.estado }}</span>
                <span style="font-size:12px;color:#666;">Intentos: {{ conv.intentos_validacion }}/3</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn--ghost btn--sm" (click)="escalar(conv.id)">Escalar a Coach</button>
              <button class="btn btn--danger btn--sm" (click)="cerrar(conv.id)">Cerrar</button>
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
