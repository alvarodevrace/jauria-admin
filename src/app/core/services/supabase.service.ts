import { Injectable, inject } from '@angular/core';
import { processLock } from '@supabase/auth-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { SentryService } from './sentry.service';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;
  private sentry = inject(SentryService);
  private readonly storageKey = 'jauria-admin-auth-v2';
  private readonly legacyStorageKeys = ['jauria-admin-auth'];

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

  async clearLocalSession() {
    await this.client.auth.signOut({ scope: 'local' });

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
    return this.client.from('clientes').update(data).eq('id_cliente', id);
  }

  async createCliente(data: Record<string, unknown>) {
    return this.client.from('clientes').insert(data).select().single();
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

  // ── Profiles ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    return this.client.from('profiles').select('*').eq('id', userId).single();
  }

  async updateProfile(userId: string, data: Record<string, unknown>) {
    return this.client.from('profiles').update(data).eq('id', userId);
  }

  async getAllProfiles() {
    return this.client.from('profiles').select('*').order('created_at');
  }

  async updateProfileRole(userId: string, rol: string) {
    const result = await this.client.from('profiles').update({ rol }).eq('id', userId);
    if (result.error) {
      this.sentry.captureError(result.error, { action: 'updateProfileRole', userId, rol });
    }
    return result;
  }

  // ── Clases ────────────────────────────────────────────────────────────────

  async getClases(filters?: { fecha?: string; tipo?: string; semana?: string }) {
    let query = this.client
      .from('clases')
      .select('*, profiles(nombre_completo)')
      .eq('cancelada', false)
      .order('fecha')
      .order('hora_inicio');

    if (filters?.fecha)  query = query.eq('fecha', filters.fecha);
    if (filters?.tipo)   query = query.eq('tipo', filters.tipo);
    if (filters?.semana) {
      // Filtra la semana: fecha entre lunes y domingo
      const [inicio, fin] = filters.semana.split(',');
      query = query.gte('fecha', inicio).lte('fecha', fin);
    }
    return query;
  }

  async createClase(data: Record<string, unknown>) {
    const result = await this.client.from('clases').insert(data).select().single();
    if (result.error) this.sentry.captureError(result.error, { action: 'createClase' });
    return result;
  }

  async updateClase(id: number, data: Record<string, unknown>) {
    return this.client.from('clases').update(data).eq('id', id);
  }

  // ── Inscripciones ─────────────────────────────────────────────────────────

  async inscribirseAClase(claseId: number, userId: string) {
    return this.client.from('inscripciones').insert({ clase_id: claseId, user_id: userId }).select().single();
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

  async getInscripcionesByUser(userId: string) {
    return this.client.from('inscripciones')
      .select('*, clases(id, tipo, fecha, hora_inicio, hora_fin, capacidad_maxima)')
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
