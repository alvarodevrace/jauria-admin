import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class N8nService {
  private readonly base = environment.backendApiUrl
    ? `${environment.backendApiUrl}/n8n`
    : environment.n8nApiUrl;
  private readonly headers = environment.backendApiUrl
    ? new HttpHeaders({ 'Content-Type': 'application/json' })
    : new HttpHeaders({
        'X-N8N-API-KEY': environment.n8nApiKey,
        'Content-Type': 'application/json',
      });

  constructor(private http: HttpClient) {}

  getWorkflows(): Observable<{ data: WorkflowSummary[] }> {
    return this.http.get<{ data: WorkflowSummary[] }>(
      `${this.base}/workflows`,
      { headers: this.headers }
    );
  }

  getWorkflow(id: string): Observable<WorkflowDetail> {
    return this.http.get<WorkflowDetail>(
      `${this.base}/workflows/${id}`,
      { headers: this.headers }
    );
  }

  activateWorkflow(id: string): Observable<unknown> {
    return this.http.post(
      `${this.base}/workflows/${id}/activate`,
      {},
      { headers: this.headers }
    );
  }

  deactivateWorkflow(id: string): Observable<unknown> {
    return this.http.post(
      `${this.base}/workflows/${id}/deactivate`,
      {},
      { headers: this.headers }
    );
  }

  getExecutions(workflowId?: string, limit = 10): Observable<{ data: Execution[] }> {
    let url = `${this.base}/executions?limit=${limit}`;
    if (workflowId) url += `&workflowId=${workflowId}`;
    return this.http.get<{ data: Execution[] }>(url, { headers: this.headers });
  }
}

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetail extends WorkflowSummary {
  nodes: unknown[];
  connections: unknown;
}

export interface Execution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt: string;
  status: 'success' | 'error' | 'waiting' | 'running';
}
