export type Rol = 'admin' | 'integrante'
export type RolArea = 'lider' | 'miembro'
export type Estado = 'pendiente' | 'hecha' | 'omitida'
export type Frecuencia = 'unica' | 'diaria' | 'semanal' | 'mensual'

export interface Perfil {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  carga_ventas: boolean
  push_alertas: boolean
}

export interface Area {
  id: string
  nombre: string
  descripcion: string | null
  color: string
  emoji: string
  orden: number
  activa: boolean
}

export interface Miembro {
  area_id: string
  profile_id: string
  rol_area: RolArea
}

export interface Instancia {
  id: string
  template_id: string
  responsable_id: string
  titulo: string
  fecha: string
  fecha_limite: string
  sin_horario: boolean
  estado: Estado
  objective_id: string | null
  completada_por: string | null
  completada_at: string | null
  omitida_motivo: string | null
  omitida_por: string | null
  omitida_at: string | null
  areas: string[]
}

export interface Comentario {
  id: string
  instance_id: string
  profile_id: string
  texto: string
  created_at: string
}

export interface ObjetivoBreve {
  id: string
  titulo: string
  tipo_medicion: string
  unidad: string | null
  area_id: string | null
  plan_id: string | null
  estado: string
}

export interface Avance {
  objective_id: string
  desde: string
  hasta: string
  valor: number | null
  meta: number | null
  porcentaje: number | null
  ritmo: number | null
  atrasado: boolean
}

export interface Cumplimiento {
  tipo: 'persona' | 'area' | 'equipo'
  ref_id: string | null
  hechas: number
  vencidas: number
  porcentaje: number | null
}

export interface Plantilla {
  id: string
  titulo: string
  descripcion: string | null
  responsable_id: string
  creado_por: string | null
  frecuencia: Frecuencia
  fecha_unica: string | null
  dias_semana: number[] | null
  dia_mes: number | null
  hora_limite: string | null // 'HH:MM:SS'
  objective_id: string | null
  peso: number
  activa: boolean
  areas: string[]
}

export interface AreaInvitada {
  area_id: string
  rol_area: RolArea
}

export interface Invitacion {
  email: string
  nombre: string
  rol: Rol
  carga_ventas: boolean
  areas: AreaInvitada[]
  created_at: string
}

export type TipoMedicion = 'tareas' | 'numerico' | 'ventas' | 'proporcion_ventas' | 'clientes_mayoristas' | 'cumplimiento'
export type Canal = 'conocidos' | 'tienda_online' | 'mayorista'

export interface Objetivo {
  id: string
  plan_id: string | null
  area_id: string | null
  titulo: string
  descripcion: string | null
  periodo: string
  fecha_inicio: string
  fecha_fin: string
  tipo_medicion: TipoMedicion
  evaluacion: 'periodo' | 'mensual'
  meta_numerica: number | null
  unidad: string | null
  canal_ventas: Canal | null
  valor_base: number | null
  estado: 'activo' | 'cumplido' | 'archivado'
  creado_por: string | null
}

export interface Plan {
  id: string
  titulo: string
  descripcion: string | null
  area_id: string | null
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
}

export interface Aporte {
  id: string
  objective_id: string
  instance_id: string | null
  cantidad: number
  nota: string | null
  cargado_por: string | null
  created_at: string
}

export interface Venta {
  id: string
  fecha: string
  monto: number
  canal: Canal
  cliente: string | null
  nota: string | null
  cargado_por: string | null
  created_at: string
}

export interface ResumenVentas {
  total: number
  conocidos: number
  tienda_online: number
  mayorista: number
  cantidad: number
  proporcion_tienda: number | null
  clientes_mayoristas: number
}
