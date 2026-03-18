import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OpsAlert {
  tipo: string;
  titulo: string;
  msg: string;
}

export interface OpsStatusPayload {
  status: 'online' | 'offline' | 'warning';
  [key: string]: unknown;
}

export interface DashboardOpsStatus {
  n8n: OpsStatusPayload & { totalWorkflows?: number; activeWorkflows?: number };
  evolution: OpsStatusPayload & { instanceName?: string | null; connectionStatus?: string };
  supabase: OpsStatusPayload & { detail?: string };
  alerts: OpsAlert[];
  checkedAt: string;
}

export type ServiceStatus = 'online' | 'offline' | 'checking' | 'warning';

export interface WhatsappStatusPayload {
  status: ServiceStatus;
  connectionStatus: 'open' | 'connecting' | 'close';
  instanceName: string | null;
  timestamp: string;
  details?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminOpsService {
  private readonly base = `${environment.backendApiUrl}/dashboard`;
  private readonly requestTimeoutMs = 20000;

  constructor(private http: HttpClient) {}

  getOpsStatus() {
    return this.http.get<DashboardOpsStatus>(`${this.base}/ops-status`).pipe(timeout(this.requestTimeoutMs));
  }

  connectWhatsApp() {
    return this.http.post<{ code?: string; count?: number }>(
      `${environment.backendApiUrl}/whatsapp/reconnect`,
      {},
    ).pipe(timeout(this.requestTimeoutMs));
  }

  getWhatsAppStatus() {
    return this.http.get<WhatsappStatusPayload>(
      `${environment.backendApiUrl}/whatsapp/status`,
    ).pipe(timeout(this.requestTimeoutMs));
  }
}
