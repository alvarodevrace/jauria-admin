import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface CreatePayphoneLinkRequest {
  idCliente: string;
  montoCentavos: number;
  referencia: string;
}

export interface CreatePayphoneLinkResponse {
  paymentUrl?: string;
  link?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class AdminPaymentsService {
  private readonly base = `${environment.backendApiUrl}/payments`;

  constructor(private http: HttpClient) {}

  createPayphoneLink(payload: CreatePayphoneLinkRequest) {
    return this.http.post<CreatePayphoneLinkResponse>(`${this.base}/payphone-links`, payload);
  }
}
