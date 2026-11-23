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
