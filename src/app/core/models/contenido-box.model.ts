export type ContenidoTipo = 'noticia' | 'evento';
export type EstadoPublicacion = 'draft' | 'published';
export type EventoModalidad = 'box' | 'externo';

export interface ContenidoAutor {
  nombre_completo: string;
}

export interface ContenidoBox {
  id: number;
  tipo: ContenidoTipo;
  titulo: string;
  descripcion: string;
  estado_publicacion: EstadoPublicacion;
  imagen_path: string;
  created_by: string;
  published_at: string | null;
  cta_label: string | null;
  cta_url: string | null;
  evento_fecha_inicio: string | null;
  evento_fecha_fin: string | null;
  evento_modalidad: EventoModalidad | null;
  evento_ubicacion: string | null;
  created_at: string;
  updated_at: string;
  profiles?: ContenidoAutor;
}

export interface ContenidoBoxPayload {
  tipo: ContenidoTipo;
  titulo: string;
  descripcion: string;
  estado_publicacion: EstadoPublicacion;
  imagen_path: string;
  created_by: string;
  published_at: string | null;
  cta_label: string | null;
  cta_url: string | null;
  evento_fecha_inicio: string | null;
  evento_fecha_fin: string | null;
  evento_modalidad: EventoModalidad | null;
  evento_ubicacion: string | null;
}

export interface ContenidoBoxFilters {
  tipo?: ContenidoTipo | '';
  estado?: EstadoPublicacion | '';
  search?: string;
}
