// Consultas a la base. Los permisos los valida la base (RLS y funciones);
// acá solo se piden datos y se llaman las funciones RPC.
import { supabase } from './supabase'
import { sumarDias, hoyISO } from './fechas'
import type { Area, Avance, Comentario, Cumplimiento, Estado, Instancia, Miembro, ObjetivoBreve, Perfil } from './tipos'

const CAMPOS_INSTANCIA =
  'id,template_id,responsable_id,titulo,fecha,fecha_limite,sin_horario,estado,objective_id,' +
  'completada_por,completada_at,omitida_motivo,omitida_por,omitida_at,task_instance_areas(area_id)'

type FilaInstancia = Omit<Instancia, 'areas'> & { task_instance_areas: { area_id: string }[] | null }

function aInstancia(f: FilaInstancia & { task_templates?: unknown }): Instancia {
  const { task_instance_areas, task_templates: _plantilla, ...resto } = f
  void _plantilla
  return { ...resto, areas: (task_instance_areas ?? []).map((x) => x.area_id) }
}

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error
  return r.data as T
}

// Equipo -------------------------------------------------------------------
export async function traerEquipo(): Promise<{ perfiles: Perfil[]; areas: Area[]; miembros: Miembro[] }> {
  const [p, a, m] = await Promise.all([
    supabase.from('profiles').select('id,nombre,email,rol,activo,carga_ventas').order('nombre'),
    supabase.from('areas').select('id,nombre,descripcion,color,emoji,orden,activa').order('orden'),
    supabase.from('area_members').select('area_id,profile_id,rol_area'),
  ])
  return { perfiles: ok(p) ?? [], areas: ok(a) ?? [], miembros: ok(m) ?? [] }
}

// Tareas -------------------------------------------------------------------
/** Tareas de un día (de una persona, o de todo el equipo si persona es null). */
export async function tareasDelDia(fecha: string, persona: string | null): Promise<Instancia[]> {
  // Solo tareas no eliminadas: lo hecho de una tarea eliminada queda en el historial pero no se muestra en Hoy.
  let q = supabase
    .from('task_instances')
    .select(CAMPOS_INSTANCIA + ',task_templates!inner(activa)')
    .eq('fecha', fecha)
    .eq('task_templates.activa', true)
    .order('fecha_limite')
  if (persona) q = q.eq('responsable_id', persona)
  return (ok(await q) as unknown as FilaInstancia[] ?? []).map(aInstancia)
}

/** Pendientes cuyo vencimiento ya pasó (últimos 60 días). */
export async function tareasVencidas(persona: string | null): Promise<Instancia[]> {
  let q = supabase
    .from('task_instances')
    .select(CAMPOS_INSTANCIA)
    .eq('estado', 'pendiente')
    .lt('fecha_limite', new Date().toISOString())
    .gte('fecha', sumarDias(hoyISO(), -60))
    .order('fecha_limite')
  if (persona) q = q.eq('responsable_id', persona)
  return (ok(await q) as unknown as FilaInstancia[] ?? []).map(aInstancia)
}

export interface DetalleTarea {
  instancia: Instancia
  descripcion: string | null
  frecuencia: string
  creado_por: string | null
}

export async function traerTarea(id: string): Promise<DetalleTarea | null> {
  const r = await supabase
    .from('task_instances')
    .select(CAMPOS_INSTANCIA + ',task_templates(descripcion,frecuencia,creado_por)')
    .eq('id', id)
    .maybeSingle()
  const fila = ok(r) as unknown as (FilaInstancia & {
    task_templates: { descripcion: string | null; frecuencia: string; creado_por: string | null } | null
  }) | null
  if (!fila) return null
  const { task_templates, ...inst } = fila
  return {
    instancia: aInstancia(inst),
    descripcion: task_templates?.descripcion ?? null,
    frecuencia: task_templates?.frecuencia ?? 'unica',
    creado_por: task_templates?.creado_por ?? null,
  }
}

export async function marcarTarea(id: string, estado: Estado, motivo?: string, cantidad?: number): Promise<void> {
  ok(await supabase.rpc('marcar_tarea', {
    p_instancia: id,
    p_estado: estado,
    p_motivo: motivo ?? null,
    p_cantidad: cantidad ?? null,
  }))
}

/** Elimina la tarea: deja de repetirse y se borran todos sus días pendientes (también los vencidos).
 *  Lo hecho u omitido queda en el historial. La base valida el permiso. */
export async function eliminarTarea(templateId: string): Promise<void> {
  ok(await supabase.rpc('archivar_tarea', { p_id: templateId }))
}

export interface NuevaTarea {
  titulo: string
  descripcion: string
  responsable: string
  areas: string[]
  fecha: string
  hora: string | null // 'HH:MM' o null = sin horario
  objetivo: string | null
}

export async function crearTareaUnica(t: NuevaTarea): Promise<string> {
  return ok(await supabase.rpc('guardar_tarea', {
    p_id: null,
    p_titulo: t.titulo,
    p_responsable: t.responsable,
    p_frecuencia: 'unica',
    p_areas: t.areas,
    p_descripcion: t.descripcion || null,
    p_fecha_unica: t.fecha,
    p_hora_limite: t.hora,
    p_objective: t.objetivo,
  })) as string
}

/** Instancia de una plantilla en una fecha (para abrir la tarea recién creada). */
export async function instanciaDe(templateId: string, fecha: string): Promise<string | null> {
  const r = await supabase.from('task_instances').select('id').eq('template_id', templateId).eq('fecha', fecha).maybeSingle()
  return (ok(r) as { id: string } | null)?.id ?? null
}

// Comentarios ----------------------------------------------------------------
export async function traerComentarios(instancia: string): Promise<Comentario[]> {
  return ok(await supabase
    .from('task_comments')
    .select('id,instance_id,profile_id,texto,created_at')
    .eq('instance_id', instancia)
    .order('created_at')) ?? []
}

export async function comentar(instancia: string, perfil: string, texto: string): Promise<void> {
  ok(await supabase.from('task_comments').insert({ instance_id: instancia, profile_id: perfil, texto }))
}

export async function borrarComentario(id: string): Promise<void> {
  ok(await supabase.from('task_comments').delete().eq('id', id))
}

// Objetivos y cálculos (las cuentas las hace la base) ---------------------------
export async function traerObjetivos(): Promise<ObjetivoBreve[]> {
  return ok(await supabase
    .from('objectives')
    .select('id,titulo,tipo_medicion,unidad,area_id,plan_id,estado')
    .neq('estado', 'archivado')
    .order('fecha_fin')) ?? []
}

export async function avanceObjetivos(): Promise<Avance[]> {
  return ok(await supabase.rpc('avance_objetivos', { p_fecha: hoyISO() })) ?? []
}

export async function cumplimiento(desde: string, hasta: string): Promise<Cumplimiento[]> {
  return ok(await supabase.rpc('cumplimiento', { p_desde: desde, p_hasta: hasta })) ?? []
}

export async function actualizarMiNombre(nombre: string): Promise<void> {
  ok(await supabase.rpc('actualizar_mi_nombre', { p_nombre: nombre }))
}
