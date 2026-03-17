export type RetoTipo = 'manual' | 'asistencia';

export interface Reto {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: RetoTipo;
  premio: string;
  meta_porcentaje: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  activo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetoParticipante {
  id: string;
  reto_id: string;
  user_id: string;
  nombre_atleta: string;
  id_cliente: string | null;
  inscrito_at: string;
  avatar_url?: string | null;
}

export interface RetoLeaderboardRow {
  user_id: string;
  nombre_atleta: string;
  id_cliente: string | null;
  avatar_url: string | null;
  asistencias: number;
  ausencias: number;
  pendientes: number;
  porcentaje: number;
  fecha_desde: string;
}

export interface RetoPayload {
  titulo: string;
  descripcion: string;
  tipo: RetoTipo;
  premio: string;
  meta_porcentaje: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  activo: boolean;
  created_by?: string;
}
