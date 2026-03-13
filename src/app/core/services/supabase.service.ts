import { Injectable, inject } from '@angular/core';
import { processLock } from '@supabase/auth-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { SentryService } from './sentry.service';
import {
  ContenidoBoxFilters,
  ContenidoBoxPayload,
  ContenidoTipo,
  EstadoPublicacion,
} from '../models/contenido-box.model';
import { getEcuadorTodayYmd } from '../../shared/utils/date-ecuador';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;
  private sentry = inject(SentryService);
  private readonly storageKey = 'jauria-admin-auth-v2';
  private readonly legacyStorageKeys = ['jauria-admin-auth'];
  private readonly mutationTimeoutMs = 15000;

  constructor() {
    this.cleanupLegacyAuthStorage();
    this.client = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: this.storageKey,
          lock: processLock,
        },
      }
    );
  }

  async signOut() {
    return this.client.auth.signOut();
  }

  async clearLocalSession() {
    if (typeof window === 'undefined') return;

    window.localStorage.removeItem(this.storageKey);
    window.localStorage.removeItem(`${this.storageKey}-code-verifier`);
    window.localStorage.removeItem(`${this.storageKey}-user`);
  }

  private cleanupLegacyAuthStorage() {
    if (typeof window === 'undefined') return;

    for (const key of this.legacyStorageKeys) {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(`${key}-code-verifier`);
      window.localStorage.removeItem(`${key}-user`);
    }
  }

  // ── Helper con captura de errores ─────────────────────────────────────────
  private async q<T>(label: string, fn: () => Promise<{ data: T | null; error: unknown }>) {
    const result = await fn();
    if (result.error) {
      this.sentry.captureError(result.error, { query: label });
    }
    return result;
  }

  private async withMutationTimeout(label: string, operation: () => PromiseLike<unknown>): Promise<any> {
    try {
      return await Promise.race([
        Promise.resolve(operation()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${this.mutationTimeoutMs}ms`)), this.mutationTimeoutMs),
        ),
      ]);
    } catch (error) {
      this.sentry.captureError(error, { action: label, kind: 'timeout_or_exception' });
      return { data: null, error };
    }
  }

  // ── Clientes ──────────────────────────────────────────────────────────────

  async getClientes(filters?: { estado?: string; plan?: string }) {
    let query = this.client.from('clientes').select('*').order('fecha_vencimiento', { ascending: true });
    if (filters?.estado) query = query.eq('estado', filters.estado);
    if (filters?.plan)   query = query.eq('plan', filters.plan);
    return query;
  }

  async getCliente(id: string) {
    return this.client.from('clientes').select('*').eq('id_cliente', id).single();
  }

  async updateCliente(id: string, data: Record<string, unknown>) {
    return this.withMutationTimeout('updateCliente', () =>
      this.client.from('clientes').update(data).eq('id_cliente', id),
    );
  }

  async createCliente(data: Record<string, unknown>) {
    return this.withMutationTimeout('createCliente', () =>
      this.client.from('clientes').insert(data).select().single(),
    );
  }

  async setClienteEstado(id: string, estado: string) {
    const result = await this.withMutationTimeout('setClienteEstado', () =>
      this.client.from('clientes').update({ estado }).eq('id_cliente', id),
    );
    if (result.error) {
      this.sentry.captureError(result.error, { action: 'setClienteEstado', id, estado });
    }
    return result;
  }

  async getClienteDependencias(id: string) {
    const [profiles, pagos, conversaciones] = await Promise.all([
      this.client.from('profiles').select('id', { count: 'exact', head: true }).eq('id_cliente', id),
      this.client.from('historial_pagos').select('id', { count: 'exact', head: true }).eq('id_cliente', id),
      this.client.from('conversaciones_whatsapp').select('id', { count: 'exact', head: true }).eq('id_cliente', id),
    ]);

    if (profiles.error) this.sentry.captureError(profiles.error, { action: 'getClienteDependencias', source: 'profiles', id });
    if (pagos.error) this.sentry.captureError(pagos.error, { action: 'getClienteDependencias', source: 'historial_pagos', id });
    if (conversaciones.error) this.sentry.captureError(conversaciones.error, { action: 'getClienteDependencias', source: 'conversaciones_whatsapp', id });

    return {
      profiles: profiles.count ?? 0,
      pagos: pagos.count ?? 0,
      conversaciones: conversaciones.count ?? 0,
      error: profiles.error ?? pagos.error ?? conversaciones.error ?? null,
    };
  }

  // ── Historial Pagos ───────────────────────────────────────────────────────

  async getHistorialPagos(filters?: { id_cliente?: string; banco?: string; metodo?: string }) {
    let query = this.client.from('historial_pagos')
      .select('*, clientes(nombre_completo)')
      .order('fecha_pago', { ascending: false });
    if (filters?.id_cliente) query = query.eq('id_cliente', filters.id_cliente);
    if (filters?.banco)      query = query.eq('banco', filters.banco);
    if (filters?.metodo)     query = query.eq('metodo', filters.metodo);
    return query;
  }

  // ── Conversaciones WhatsApp ───────────────────────────────────────────────

  async getConversacionesActivas() {
    return this.client
      .from('conversaciones_whatsapp')
      .select('*, clientes(nombre_completo, telefono_whatsapp)')
      .not('estado', 'in', '(completado,fallido)')
      .order('updated_at', { ascending: false });
  }

  async updateConversacion(id: number, data: Record<string, unknown>) {
    return this.client.from('conversaciones_whatsapp').update(data).eq('id', id);
  }

  // ── Leads ─────────────────────────────────────────────────────────────────

  async getLeads() {
    return this.client.from('leads').select('*').order('created_at', { ascending: false });
  }

  // ── Contenido Box ────────────────────────────────────────────────────────

  async getContenidoPublicado(filters?: { tipo?: ContenidoTipo | '' }) {
    let query = this.client
      .from('contenido_box')
      .select('*, profiles(nombre_completo)')
      .eq('estado_publicacion', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (filters?.tipo) query = query.eq('tipo', filters.tipo);
    return query;
  }

  async getContenidoAdmin(filters?: ContenidoBoxFilters) {
    let query = this.client
      .from('contenido_box')
      .select('*, profiles(nombre_completo)')
      .order('updated_at', { ascending: false });

    if (filters?.tipo) query = query.eq('tipo', filters.tipo);
    if (filters?.estado) query = query.eq('estado_publicacion', filters.estado);
    if (filters?.search?.trim()) {
      const term = filters.search.trim().replace(/,/g, ' ');
      query = query.or(`titulo.ilike.%${term}%,descripcion.ilike.%${term}%`);
    }

    return query;
  }

  async createContenido(data: ContenidoBoxPayload) {
    const result = await this.withMutationTimeout('createContenido', () =>
      this.client.from('contenido_box').insert(data).select().single(),
    );
    if (result.error) this.sentry.captureError(result.error, { action: 'createContenido' });
    return result;
  }

  async updateContenido(id: number, data: Partial<ContenidoBoxPayload>) {
    const result = await this.withMutationTimeout('updateContenido', () =>
      this.client.from('contenido_box').update(data).eq('id', id).select().single(),
    );
    if (result.error) this.sentry.captureError(result.error, { action: 'updateContenido', id });
    return result;
  }

  async deleteContenido(id: number, imagenPath?: string | null) {
    const result = await this.client.from('contenido_box').delete().eq('id', id);
    if (result.error) {
      this.sentry.captureError(result.error, { action: 'deleteContenido', id });
      return result;
    }

    if (imagenPath) {
      const { error: storageError } = await this.client.storage
        .from('contenido-box')
        .remove([imagenPath]);

      if (storageError) {
        this.sentry.captureError(storageError, { action: 'deleteContenidoImage', id, imagenPath });
      }
    }

    return result;
  }

  async setContenidoPublicationState(id: number, estado: EstadoPublicacion) {
    const payload = {
      estado_publicacion: estado,
      published_at: estado === 'published' ? new Date().toISOString() : null,
    };

    const result = await this.client.from('contenido_box').update(payload).eq('id', id).select().single();
    if (result.error) {
      this.sentry.captureError(result.error, { action: 'setContenidoPublicationState', id, estado });
    }
    return result;
  }

  async uploadContenidoImage(file: File, fileName?: string) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const safeExtension = extension === 'jpeg' ? 'jpg' : extension;
    const generatedName = fileName ?? `${crypto.randomUUID()}.${safeExtension}`;
    const filePath = `contenido/${getEcuadorTodayYmd()}/${generatedName}`;

    const result = await this.client.storage
      .from('contenido-box')
      .upload(filePath, file, { upsert: false, contentType: file.type });

    if (result.error) {
      this.sentry.captureError(result.error, { action: 'uploadContenidoImage', filePath });
    }

    return {
      ...result,
      filePath,
    };
  }

  getContenidoImageUrl(path: string | null | undefined) {
    if (!path) return '';
    const { data } = this.client.storage.from('contenido-box').getPublicUrl(path);
    return data.publicUrl;
  }

  // ── Profiles ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    return this.client.from('profiles').select('*').eq('id', userId).single();
  }

  async updateProfile(userId: string, data: Record<string, unknown>) {
    return this.withMutationTimeout('updateProfile', () =>
      this.client.from('profiles').update(data).eq('id', userId),
    );
  }

  async getAllProfiles() {
    return this.client.from('profiles').select('*').order('created_at');
  }

  async uploadProfileAvatar(userId: string, file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const safeExtension = extension === 'jpeg' ? 'jpg' : extension;
    const filePath = `${userId}/avatar-${Date.now()}.${safeExtension}`;

    const result = await this.withMutationTimeout('uploadProfileAvatar', () =>
      this.client.storage
        .from('profile-avatars')
        .upload(filePath, file, { contentType: file.type }),
    );

    if (result.error) {
      this.sentry.captureError(result.error, { action: 'uploadProfileAvatar', userId, filePath });
    }

    return {
      ...result,
      filePath,
    };
  }

  getProfileAvatarUrl(path: string | null | undefined) {
    if (!path) return '';
    const { data } = this.client.storage.from('profile-avatars').getPublicUrl(path);
    return data.publicUrl;
  }

  async updateProfileRole(userId: string, rol: string) {
    const result = await this.withMutationTimeout('updateProfileRole', () =>
      this.client.from('profiles').update({ rol }).eq('id', userId),
    );
    if (result.error) {
      this.sentry.captureError(result.error, { action: 'updateProfileRole', userId, rol });
    }
    return result;
  }

  // ── Clases ────────────────────────────────────────────────────────────────

  async getClases(filters?: { fecha?: string; tipo?: string; formato?: string; semana?: string }) {
    let query = this.client
      .from('clases')
      .select('*, profiles(nombre_completo)')
      .eq('cancelada', false)
      .order('fecha')
      .order('hora_inicio');

    if (filters?.fecha)  query = query.eq('fecha', filters.fecha);
    if (filters?.tipo)   query = query.eq('tipo', filters.tipo);
    if (filters?.formato) query = query.eq('wod_formato', filters.formato);
    if (filters?.semana) {
      // Filtra la semana: fecha entre lunes y domingo
      const [inicio, fin] = filters.semana.split(',');
      query = query.gte('fecha', inicio).lte('fecha', fin);
    }
    return query;
  }

  async getClasesDesde(fechaDesde: string) {
    return this.client
      .from('clases')
      .select('*, profiles(nombre_completo)')
      .eq('cancelada', false)
      .gte('fecha', fechaDesde)
      .order('fecha')
      .order('hora_inicio');
  }

  async createClase(data: Record<string, unknown>) {
    const result = await this.withMutationTimeout('createClase', () =>
      this.client.from('clases').insert(data).select().single(),
    );
    if (result.error) this.sentry.captureError(result.error, { action: 'createClase' });
    return result;
  }

  async updateClase(id: number, data: Record<string, unknown>) {
    return this.withMutationTimeout('updateClase', () =>
      this.client.from('clases').update(data).eq('id', id),
    );
  }

  async deleteClase(id: number) {
    return this.client.from('clases').delete().eq('id', id);
  }

  // ── Inscripciones ─────────────────────────────────────────────────────────

  async inscribirseAClase(claseId: number, userId: string) {
    return this.client.from('inscripciones').insert({ clase_id: claseId, user_id: userId }).select().single();
  }

  async getInscripcionByClaseYUsuario(claseId: number, userId: string) {
    return this.client.from('inscripciones')
      .select('*')
      .eq('clase_id', claseId)
      .eq('user_id', userId)
      .maybeSingle();
  }

  async reactivarInscripcion(inscripcionId: number) {
    return this.client.from('inscripciones')
      .update({ estado: 'inscrito' })
      .eq('id', inscripcionId)
      .select()
      .single();
  }

  async cancelarInscripcion(claseId: number, userId: string) {
    return this.client.from('inscripciones')
      .update({ estado: 'cancelado' })
      .eq('clase_id', claseId).eq('user_id', userId);
  }

  async getInscripcionesByClase(claseId: number) {
    return this.client.from('inscripciones')
      .select('*, profiles(nombre_completo, avatar_url)')
      .eq('clase_id', claseId)
      .neq('estado', 'cancelado');
  }

  async getInscripcionesResumen(claseIds: number[]) {
    if (claseIds.length === 0) {
      return { data: [], error: null };
    }

    return this.client.from('inscripciones')
      .select('clase_id, estado')
      .in('clase_id', claseIds)
      .neq('estado', 'cancelado');
  }

  async deleteInscripcionesByClase(claseId: number) {
    return this.client.from('inscripciones')
      .delete()
      .eq('clase_id', claseId);
  }

  async getInscripcionesByUser(userId: string) {
    return this.client.from('inscripciones')
      .select('*, clases(id, tipo, fecha, hora_inicio, hora_fin, capacidad_maxima, cancelada, wod_formato, wod_plan, descripcion)')
      .eq('user_id', userId)
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false });
  }

  async marcarAsistencia(inscripcionId: number, asistio: boolean) {
    return this.client.from('inscripciones')
      .update({ estado: asistio ? 'asistio' : 'no_asistio' })
      .eq('id', inscripcionId);
  }

  // ── Auditoria ─────────────────────────────────────────────────────────────

  async logAuditoria(userId: string, accion: string, detalle?: Record<string, unknown>) {
    return this.client.from('auditoria_config').insert({ user_id: userId, accion, detalle });
  }

  async getAuditoria(limit = 50) {
    return this.client.from('auditoria_config')
      .select('*, profiles(nombre_completo, rol)')
      .order('created_at', { ascending: false })
      .limit(limit);
  }
}
