import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import * as Sentry from '@sentry/angular';
import { SupabaseService } from '../services/supabase.service';
import { AppBusyService } from '../services/app-busy.service';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: string;
  id_cliente: string | null;
  nombre_completo: string;
  email: string;
  rol: 'atleta' | 'coach' | 'admin';
  avatar_url: string | null;
  bio?: string | null;
  activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<Session | null>(null);
  private _profile = signal<UserProfile | null>(null);
  private _loading = signal(true);
  private _logoutInProgress = signal(false);

  readonly session  = this._session.asReadonly();
  readonly profile  = this._profile.asReadonly();
  readonly loading  = this._loading.asReadonly();
  readonly logoutInProgress = this._logoutInProgress.asReadonly();

  readonly isAuthenticated = computed(() => !!this._session());
  readonly currentUser     = computed(() => this._session()?.user ?? null);
  readonly rol             = computed(() => this._profile()?.rol ?? null);
  readonly isAdmin         = computed(() => this._profile()?.rol === 'admin');
  readonly isCoach         = computed(() => ['coach', 'admin'].includes(this._profile()?.rol ?? ''));
  readonly canViewOperationalDashboard = computed(() => ['coach', 'admin'].includes(this._profile()?.rol ?? ''));
  readonly canViewTechnicalDashboard = computed(() => this._profile()?.rol === 'admin');
  readonly canManageBusinessOperations = computed(() => ['coach', 'admin'].includes(this._profile()?.rol ?? ''));
  readonly canManageInfrastructure = computed(() => this._profile()?.rol === 'admin');
  readonly canViewLeadInbox = computed(() => ['coach', 'admin'].includes(this._profile()?.rol ?? ''));
  readonly canExportLeads = computed(() => this._profile()?.rol === 'admin');
  readonly canViewWhatsappOperations = computed(() => this._profile()?.rol === 'admin');
  readonly canViewWorkflowOperations = computed(() => this._profile()?.rol === 'admin');
  readonly canManageUsers = computed(() => ['coach', 'admin'].includes(this._profile()?.rol ?? ''));
  readonly canManageRoles = computed(() => this._profile()?.rol === 'admin');

  constructor(
    private supabase: SupabaseService,
    private router: Router,
    private appBusy: AppBusyService,
  ) { this.init(); }

  private async init() {
    try {
      const { data } = await this.supabase.client.auth.getSession();
      this._session.set(data.session);
      if (data.session) {
        const profile = await this.loadProfile(data.session.user);
        if (profile && !profile.activo) {
          await this.forceLogoutForInactiveProfile();
        }
      }
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
        const profile = await this.loadProfile(session.user);
        if (profile && !profile.activo) {
          await this.forceLogoutForInactiveProfile();
        }
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

  private async loadProfile(user: User): Promise<UserProfile | null> {
    const { data, error } = await this.supabase.getProfile(user.id);
    if (!error && data) {
      const p = await this.syncProfileWithMembership(data as UserProfile, user);
      if (!p.activo) {
        this._profile.set(null);
        if (environment.sentryEnabled && environment.sentryDsn) Sentry.setUser(null);
        return p;
      }
      this._profile.set(p);
      if (environment.sentryEnabled && environment.sentryDsn) {
        Sentry.setUser({ id: p.id, email: p.email, username: p.nombre_completo, segment: p.rol });
      }
      return p;
    } else if (error?.code === 'PGRST116') {
      // Perfil no existe — buscamos si el email tiene un cliente vinculado
      // Usamos RPC SECURITY DEFINER para bypassar RLS (atleta sin perfil aún no tiene id_cliente)
      let idCliente: string | null = null;
      let nombreCompleto: string = user.user_metadata['nombre_completo'] ?? user.email ?? 'Atleta';
      if (user.email) {
        const { data: clienteData } = await this.supabase.client
          .rpc('verificar_membresia_por_email', { p_email: user.email.toLowerCase() });
        const rows = clienteData as { id_cliente: string; nombre_completo: string; estado: string }[] | null;
        if (rows && rows.length > 0) {
          idCliente = rows[0].id_cliente;
          nombreCompleto = rows[0].nombre_completo;
        }
      }

      const newProfile = {
        id: user.id,
        id_cliente: idCliente,
        nombre_completo: nombreCompleto,
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
        return created as UserProfile;
      }
    }
    return null;
  }

  private async syncProfileWithMembership(profile: UserProfile, user: User): Promise<UserProfile> {
    const membership = await this.findMembershipForProfile(profile, user);
    if (!membership) return profile;

    const nextProfile: UserProfile = {
      ...profile,
      id_cliente: membership.id_cliente,
      nombre_completo: membership.nombre_completo,
      email: membership.email,
      rol: 'atleta',
    };

    const needsUpdate = profile.id_cliente !== nextProfile.id_cliente
      || profile.nombre_completo !== nextProfile.nombre_completo
      || profile.email !== nextProfile.email
      || profile.rol !== nextProfile.rol;

    if (!needsUpdate) return nextProfile;

    const { error } = await this.supabase.updateProfile(profile.id, {
      id_cliente: nextProfile.id_cliente,
      nombre_completo: nextProfile.nombre_completo,
      email: nextProfile.email,
      rol: nextProfile.rol,
    });

    if (error) return profile;
    return nextProfile;
  }

  private async findMembershipForProfile(profile: UserProfile, user: User) {
    if (profile.id_cliente) {
      const { data, error } = await this.supabase.getCliente(profile.id_cliente);
      if (!error && data) {
        const cliente = data as {
          id_cliente: string;
          nombre_completo: string;
          email: string;
        };

        return {
          id_cliente: cliente.id_cliente,
          nombre_completo: cliente.nombre_completo,
          email: cliente.email,
        };
      }
    }

    if (!user.email) return null;

    // Usamos RPC SECURITY DEFINER para bypassar RLS (perfil con id_cliente=null no puede leer clientes)
    const { data: clienteData, error: rpcError } = await this.supabase.client
      .rpc('verificar_membresia_por_email', { p_email: user.email.toLowerCase() });
    const rows = clienteData as { id_cliente: string; nombre_completo: string; estado: string }[] | null;

    if (rpcError || !rows || rows.length === 0) return null;

    return {
      id_cliente: rows[0].id_cliente,
      nombre_completo: rows[0].nombre_completo,
      email: user.email.toLowerCase(),
    };
  }

  async login(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) return { error: this.mapError(error.message) };
    if (data.session) {
      this._session.set(data.session);
      const profile = await this.loadProfile(data.session.user);
      if (profile && !profile.activo) {
        await this.forceLogoutForInactiveProfile();
        return { error: 'Tu cuenta está inactiva. Pide al coach o al admin que la reactiven.' };
      }
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
    if (this._logoutInProgress()) return;

    this._logoutInProgress.set(true);
    this.appBusy.start('Cerrando sesión...');
    this._session.set(null);
    this._profile.set(null);
    if (environment.sentryEnabled && environment.sentryDsn) Sentry.setUser(null);

    try {
      await Promise.race([
        this.supabase.signOut(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Logout timed out after 8000ms')), 8000),
        ),
      ]);
    } catch (error) {
      if (environment.sentryEnabled && environment.sentryDsn) {
        Sentry.captureException(error);
      }
    } finally {
      try {
        await this.supabase.clearLocalSession();
        await this.router.navigate(['/auth/login'], { replaceUrl: true });
      } finally {
        this.appBusy.stop();
        this._logoutInProgress.set(false);
      }
    }
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async refreshProfile(): Promise<UserProfile | null> {
    const session = this._session();
    if (!session?.user) return null;
    return this.loadProfile(session.user);
  }

  patchProfile(partial: Partial<UserProfile>) {
    const current = this._profile();
    if (!current) return;
    this._profile.set({ ...current, ...partial });
  }

  private async forceLogoutForInactiveProfile() {
    try {
      await this.supabase.signOut();
    } catch {
      // noop
    }

    await this.resetLocalSession();
    await this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  private mapError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos';
    if (msg.includes('Email not confirmed'))       return 'Confirma tu email antes de ingresar';
    if (msg.includes('User already registered'))   return 'Este email ya está registrado';
    return msg;
  }
}
