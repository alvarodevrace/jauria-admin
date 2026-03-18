import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const N8N_SERVICE_UUID = 'rwk0w08ggswcssc4c4ow4gwk';

@Injectable({ providedIn: 'root' })
export class CoolifyService {
  private readonly base = `${environment.backendApiUrl}/infra`;

  constructor(private http: HttpClient) {}

  getServices() {
    return this.http.get(`${this.base}/services`);
  }

  updateEnvVars(serviceUuid: string, vars: EnvVar[]) {
    return this.http.patch(`${this.base}/services/${serviceUuid}/envs/bulk`, { data: vars });
  }

  restartService(serviceUuid: string) {
    return this.http.post(`${this.base}/services/${serviceUuid}/restart`, {});
  }

  updateN8nEnvVar(key: string, value: string) {
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
