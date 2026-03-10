import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const PAYPHONE_API = 'https://pay.payphonetodoesposible.com/api/Links';
const STORE_ID = '5f49f41a-fa45-4e0d-842e-be9cc652a3be';
const WEBHOOK_URL = 'https://n8n.alvarodevrace.tech/webhook/payphone-notificacion';

@Injectable({ providedIn: 'root' })
export class PayphoneService {
  constructor(private http: HttpClient) {}

  generarLink(idCliente: string, montoCentavos: number, referencia: string): Observable<{ paymentUrl: string }> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${environment.n8nApiKey}`, // Payphone token via n8n env — usar token Payphone real en prod
      'Content-Type': 'application/json',
    });
    return this.http.post<{ paymentUrl: string }>(PAYPHONE_API, {
      amount: montoCentavos,
      amountWithTax: 0,
      amountWithoutTax: montoCentavos,
      tax: 0,
      currency: 'USD',
      storeId: STORE_ID,
      clientTransactionId: idCliente,
      responseUrl: WEBHOOK_URL,
      cancellationUrl: WEBHOOK_URL,
      reference: referencia,
    }, { headers });
  }
}
