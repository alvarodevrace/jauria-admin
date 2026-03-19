import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly base = `${environment.backendApiUrl}/clients`;
  private readonly requestTimeoutMs = 15000;

  constructor(private http: HttpClient) {}

  sendReminder(idCliente: string) {
    return this.http.post(`${this.base}/${idCliente}/send-reminder`, {}).pipe(timeout(this.requestTimeoutMs));
  }
}
