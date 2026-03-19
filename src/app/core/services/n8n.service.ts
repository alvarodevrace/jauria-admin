import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class N8nService {
  private readonly base = `${environment.backendApiUrl}/n8n`;
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  private readonly requestTimeoutMs = 20000;

  constructor(private http: HttpClient) {}

  getWorkflows(): Observable<{ data: WorkflowSummary[] }> {
    return this.http.get<{ data: WorkflowSummary[] }>(
      `${this.base}/workflows`,
      { headers: this.headers }
    ).pipe(timeout(this.requestTimeoutMs));
  }

  getWorkflow(id: string): Observable<WorkflowDetail> {
    return this.http.get<WorkflowDetail>(
      `${this.base}/workflows/${id}`,
      { headers: this.headers }
    ).pipe(timeout(this.requestTimeoutMs));
  }

  activateWorkflow(id: string): Observable<unknown> {
    return this.http.post(
      `${this.base}/workflows/${id}/activate`,
      {},
      { headers: this.headers }
    ).pipe(timeout(this.requestTimeoutMs));
  }

  deactivateWorkflow(id: string): Observable<unknown> {
    return this.http.post(
      `${this.base}/workflows/${id}/deactivate`,
      {},
      { headers: this.headers }
    ).pipe(timeout(this.requestTimeoutMs));
  }

  getExecutions(workflowId?: string, limit = 10): Observable<{ data: Execution[] }> {
    let url = `${this.base}/executions?limit=${limit}`;
    if (workflowId) url += `&workflowId=${workflowId}`;
    return this.http.get<{ data: Execution[] }>(url, { headers: this.headers }).pipe(timeout(this.requestTimeoutMs));
  }

  runWorkflow(id: string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http.post(
      `${this.base}/workflows/${id}/run`,
      payload,
      { headers: this.headers }
    ).pipe(timeout(this.requestTimeoutMs));
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
