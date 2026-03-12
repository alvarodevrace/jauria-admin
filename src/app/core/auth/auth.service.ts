import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import * as Sentry from '@sentry/angular';
import { SupabaseService } from '../services/supabase.service';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: string;
  id_cliente: string | null;
  nombre_completo: string;
  email: string;
  rol: 'atleta' | 'coach' | 'admin';
  avatar_url: string | null;
  activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<Session | null>(null);
  private _profile = signal<UserProfile | null>(null);
  private _loading = signal(true);

  readonly session  = this._session.asReadonly();
  readonly profile  = this._profile.asReadonly();
  readonly loading  = this._loading.asReadonly();

  readonly isAuthenticated = computed(() => !!this._session());
  readonly currentUser     = computed(() => this._session()?.user ?? null);
  readonly rol             = computed(() => this._profile()?.rol ?? null);
  readonly isAdmin         = computed(() => this._profile()?.rol === 'admin');
  readonly isCoach         = computed(() => ['coach', 'admin'].includes(this._profile()?.rol ?? ''));

  constructor(
    private supabase: SupabaseService,
    private router: Router
  ) { this.init(); }

  private async init() {
    try {
      const { data } = await this.supabase.client.auth.getSession();
      this._session.set(data.session);
      if (data.session) await this.loadProfile(data.session.user);
    } catch (error) {
      if (this.isInvalidRefreshTokenError(error)) {
        await this.resetLocalSession();
      } else if (environment.sentryEnabled && environment.sentryDsn) {
        Sentry.captureException(error);
      }
    } finally {
      this._loading.set(false);
    }

    this.supabase.client.auth.onAuthStateChange(async (_, session) => {
      this._session.set(session);
      if (session?.user) {
        await this.loadProfile(session.user);
      } else {
        this._profile.set(null);
        if (environment.sentryEnabled && environment.sentryDsn) Sentry.setUser(null);
      }
    });
  }

  private async resetLocalSession() {
    await this.supabase.clearLocalSession();
    this._session.set(null);
    this._profile.set(null);
    if (environment.sentryEnabled && environment.sentryDsn) Sentry.setUser(null);
  }

  private isInvalidRefreshTokenError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    return error.message.includes('Invalid Refresh Token')
      || error.message.includes('Refresh Token Not Found');
  }

  private async loadProfile(user: User) {
    const { data, error } = await this.supabase.getProfile(user.id);
    if (!error && data) {
      const p = data as UserProfile;
      this._profile.set(p);
      if (environment.sentryEnabled && environment.sentryDsn) {
        Sentry.setUser({ id: p.id, email: p.email, username: p.nombre_completo, segment: p.rol });
      }
    } else if (error?.code === 'PGRST116') {
      // Perfil no existe — buscamos si el email tiene un cliente vinculado
      let idCliente: string | null = null;
      if (user.email) {
        const { data: clienteData } = await this.supabase.client
          .from('clientes')
          .select('id_cliente')
          .eq('email', user.email.toLowerCase())
          .limit(1);
        idCliente = (clienteData?.[0] as { id_cliente?: string } | undefined)?.id_cliente ?? null;
      }

      const newProfile = {
        id: user.id,
        id_cliente: idCliente,
        nombre_completo: user.user_metadata['nombre_completo'] ?? user.email ?? 'Atleta',
        email: user.email ?? '',
        rol: 'atleta',
        activo: true,
      };
      const { data: created } = await this.supabase.client
        .from('profiles').insert(newProfile).select().single();
      if (created) {
        this._profile.set(created as UserProfile);
        if (environment.sentryEnabled && environment.sentryDsn) {
          const p = created as UserProfile;
          Sentry.setUser({ id: p.id, email: p.email, username: p.nombre_completo, segment: p.rol });
        }
      }
    }
  }

  async login(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) return { error: this.mapError(error.message) };
    if (data.session) {
      this._session.set(data.session);
      await this.loadProfile(data.session.user);
    }
    return { error: null };
  }

  async registro(email: string, password: string, nombreCompleto: string): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email, password,
      options: { data: { nombre_completo: nombreCompleto } },
    });
    if (error) return { error: this.mapError(error.message) };
    if (!data.user) return { error: 'No se pudo crear el usuario' };
    return { error: null };
  }

  async logout() {
    this._session.set(null);
    this._profile.set(null);
    if (environment.sentryEnabled && environment.sentryDsn) Sentry.setUser(null);

    try {
      await this.supabase.signOut();
    } catch (error) {
      if (environment.sentryEnabled && environment.sentryDsn) {
        Sentry.captureException(error);
      }
    } finally {
      await this.supabase.clearLocalSession();
      await this.router.navigate(['/auth/login'], { replaceUrl: true });
    }
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  private mapError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos';
    if (msg.includes('Email not confirmed'))       return 'Confirma tu email antes de ingresar';
    if (msg.includes('User already registered'))   return 'Este email ya está registrado';
    return msg;
  }
}
