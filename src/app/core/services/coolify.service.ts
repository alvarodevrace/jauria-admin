import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const N8N_SERVICE_UUID = 'rwk0w08ggswcssc4c4ow4gwk';
const EVOLUTION_SERVICE_UUID = 'dsg88c0wgsw0o0cs4400oc8s';

@Injectable({ providedIn: 'root' })
export class CoolifyService {
  private readonly base = environment.coolifyUrl;
  private readonly headers = new HttpHeaders({
    Authorization: `Bearer ${environment.coolifyToken}`,
    'Content-Type': 'application/json',
  });

  constructor(private http: HttpClient) {}

  getN8nService(): Observable<unknown> {
    return this.http.get(`${this.base}/services/${N8N_SERVICE_UUID}`, { headers: this.headers });
  }

  getEvolutionService(): Observable<unknown> {
    return this.http.get(`${this.base}/services/${EVOLUTION_SERVICE_UUID}`, { headers: this.headers });
  }

  updateEnvVars(serviceUuid: string, vars: EnvVar[]): Observable<unknown> {
    return this.http.patch(
      `${this.base}/services/${serviceUuid}/envs/bulk`,
      { data: vars },
      { headers: this.headers }
    );
  }

  restartService(serviceUuid: string): Observable<unknown> {
    return this.http.get(
      `${this.base}/services/${serviceUuid}/restart`,
      { headers: this.headers }
    );
  }

  updateN8nEnvVar(key: string, value: string): Observable<unknown> {
    return this.updateEnvVars(N8N_SERVICE_UUID, [{ key, value }]);
  }
}

export interface EnvVar {
  key: string;
  value: string;
}

export const N8N_ENV_UUIDS: Record<string, string> = {
  TELEFONO_COACH: 'xwso0scs0k0k4og0808sk0gg',
  BANCOS_ACEPTADOS: 'u8o4kccg848s0gkscck0koog',
  CUENTA_BANCARIA: 'nwsokwkcok4408gc8s4ws4sg',
  BENEFICIARIO: 'd40g404ccs8kokswwg4c8wok',
};
