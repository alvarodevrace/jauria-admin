import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({ providedIn: 'root' })
export class AdminOpsService {
  private readonly base = `${environment.backendApiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getOpsStatus() {
    return this.http.get<DashboardOpsStatus>(`${this.base}/ops-status`);
  }

  connectWhatsApp() {
    return this.http.post<{ code?: string; count?: number }>(
      `${environment.backendApiUrl}/evolution/connect`,
      {},
    );
  }
}
