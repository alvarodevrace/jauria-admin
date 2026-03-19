import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PayphoneService {
  private readonly base = `${environment.backendApiUrl}/payments`;

  constructor(private http: HttpClient) {}

  generarLink(idCliente: string, montoCentavos: number, referencia: string) {
    return this.http.post<{ paymentUrl: string }>(`${this.base}/payphone-links`, {
      idCliente,
      montoCentavos,
      referencia,
    });
  }
}
