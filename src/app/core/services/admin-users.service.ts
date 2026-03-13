import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DeleteUserResponse {
  deleted: boolean;
  target: {
    id: string;
    email: string;
    nombre_completo: string;
    rol: 'atleta' | 'coach' | 'admin';
  };
}

export interface UpdateUserStatusResponse {
  updated: boolean;
  target: {
    id: string;
    email: string;
    nombre_completo: string;
    rol: 'atleta' | 'coach' | 'admin';
    activo: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly base = `${environment.backendApiUrl}/users`;

  constructor(private http: HttpClient) {}

  deleteUser(userId: string) {
    return this.http.delete<DeleteUserResponse>(`${this.base}/${userId}`);
  }

  updateUserStatus(userId: string, activo: boolean) {
    return this.http.patch<UpdateUserStatusResponse>(`${this.base}/${userId}/status`, { activo });
  }
}
