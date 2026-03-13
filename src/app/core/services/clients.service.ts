import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly base = `${environment.backendApiUrl}/clients`;

  constructor(private http: HttpClient) {}

  sendReminder(idCliente: string) {
    return this.http.post(`${this.base}/${idCliente}/send-reminder`, {});
  }
}
