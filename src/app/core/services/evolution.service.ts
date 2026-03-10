import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const INSTANCE = 'jauriaCrossfit';

@Injectable({ providedIn: 'root' })
export class EvolutionService {
  private readonly base = environment.evolutionApiUrl;
  private readonly headers = new HttpHeaders({
    apikey: environment.evolutionApiKey,
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient) {}

  getInstances(): Observable<EvolutionInstance[]> {
    return this.http.get<EvolutionInstance[]>(
      `${this.base}/instance/fetchInstances`,
      { headers: this.headers }
    );
  }

  getInstanceStatus(): Observable<EvolutionInstance> {
    return this.http.get<EvolutionInstance>(
      `${this.base}/instance/fetchInstances?instanceName=${INSTANCE}`,
      { headers: this.headers }
    );
  }

  connectInstance(): Observable<{ code: string; count: number }> {
    return this.http.get<{ code: string; count: number }>(
      `${this.base}/instance/connect/${INSTANCE}`,
      { headers: this.headers }
    );
  }

  disconnectInstance(): Observable<unknown> {
    return this.http.delete(
      `${this.base}/instance/logout/${INSTANCE}`,
      { headers: this.headers }
    );
  }

  sendTextMessage(phone: string, text: string): Observable<unknown> {
    return this.http.post(
      `${this.base}/message/sendText/${INSTANCE}`,
      { number: phone, text },
      { headers: this.headers }
    );
  }
}

export interface EvolutionInstance {
  instance: {
    instanceName: string;
    status: string;
    connectionStatus: 'open' | 'close' | 'connecting';
  };
}
