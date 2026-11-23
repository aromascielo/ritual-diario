// Consultas a la base. Los permisos los valida la base (RLS y funciones);
// acá solo se piden datos y se llaman las funciones RPC.
import { supabase } from './supabase'
import { sumarDias, hoyISO } from './fechas'
import type {
  Area, AreaInvitada, Avance, Comentario, Cumplimiento, Estado, Frecuencia, Instancia, Invitacion, Miembro, ObjetivoBreve, Perfil,
  Plantilla, Rol, RolArea, Objetivo, Plan, Aporte, Venta, ResumenVentas, Canal, TipoMedicion,
} from './tipos'

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
  frecuencia: Frecuencia
  creado_por: string | null
  dias_semana: number[] | null
  dia_mes: number | null
  activa: boolean
}

export async function traerTarea(id: string): Promise<DetalleTarea | null> {
  const r = await supabase
    .from('task_instances')
    .select(CAMPOS_INSTANCIA + ',task_templates(descripcion,frecuencia,creado_por,dias_semana,dia_mes,activa)')
    .eq('id', id)
    .maybeSingle()
  const fila = ok(r) as unknown as (FilaInstancia & {
    task_templates: {
      descripcion: string | null; frecuencia: Frecuencia; creado_por: string | null
      dias_semana: number[] | null; dia_mes: number | null; activa: boolean
    } | null
  }) | null
  if (!fila) return null
  const { task_templates, ...inst } = fila
  return {
    instancia: aInstancia(inst),
    descripcion: task_templates?.descripcion ?? null,
    frecuencia: task_templates?.frecuencia ?? 'unica',
    creado_por: task_templates?.creado_por ?? null,
    dias_semana: task_templates?.dias_semana ?? null,
    dia_mes: task_templates?.dia_mes ?? null,
    activa: task_templates?.activa ?? false,
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

export interface DatosTarea {
  id: string | null // null = tarea nueva
  titulo: string
  descripcion: string
  responsable: string
  areas: string[]
  frecuencia: Frecuencia
  fecha: string | null // solo 'unica'
  dias: number[] // solo 'semanal' (1 = lunes … 7 = domingo)
  diaMes: number | null // solo 'mensual' (0 = último día)
  hora: string | null // 'HH:MM' o null = sin horario
  objetivo: string | null
  peso: number // cuánto aporta a un objetivo medido por tareas
}

/** Crea o edita una tarea (guardar_tarea valida permisos y genera los días). Devuelve el id de la plantilla. */
export async function guardarTarea(t: DatosTarea): Promise<string> {
  return ok(await supabase.rpc('guardar_tarea', {
    p_id: t.id,
    p_titulo: t.titulo,
    p_responsable: t.responsable,
    p_frecuencia: t.frecuencia,
    p_areas: t.areas,
    p_descripcion: t.descripcion || null,
    p_fecha_unica: t.frecuencia === 'unica' ? t.fecha : null,
    p_dias_semana: t.frecuencia === 'semanal' ? t.dias : null,
    p_dia_mes: t.frecuencia === 'mensual' ? t.diaMes : null,
    p_hora_limite: t.hora,
    p_objective: t.objetivo,
    p_peso: t.peso,
  })) as string
}

const CAMPOS_PLANTILLA =
  'id,titulo,descripcion,responsable_id,creado_por,frecuencia,fecha_unica,dias_semana,dia_mes,hora_limite,objective_id,peso,activa,' +
  'task_template_areas(area_id)'

type FilaPlantilla = Omit<Plantilla, 'areas'> & { task_template_areas: { area_id: string }[] | null }
function aPlantilla(f: FilaPlantilla): Plantilla {
  const { task_template_areas, ...resto } = f
  return { ...resto, areas: (task_template_areas ?? []).map((x) => x.area_id) }
}

export async function traerPlantilla(id: string): Promise<Plantilla | null> {
  const fila = ok(await supabase.from('task_templates').select(CAMPOS_PLANTILLA).eq('id', id).maybeSingle()) as unknown as FilaPlantilla | null
  return fila ? aPlantilla(fila) : null
}

/** Tareas activas (las eliminadas no se listan). */
export async function traerPlantillas(): Promise<Plantilla[]> {
  const filas = ok(await supabase.from('task_templates').select(CAMPOS_PLANTILLA).eq('activa', true).order('titulo')) as unknown as FilaPlantilla[]
  return (filas ?? []).map(aPlantilla)
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

// Áreas (solo admin; la base lo exige con RLS) ------------------------------------
export interface DatosArea {
  nombre: string
  descripcion: string
  emoji: string
  color: string
  orden: number
  activa: boolean
}

export async function guardarArea(id: string | null, a: DatosArea): Promise<void> {
  const fila = { ...a, nombre: a.nombre.trim(), descripcion: a.descripcion.trim() || null }
  if (id) ok(await supabase.from('areas').update(fila).eq('id', id))
  else ok(await supabase.from('areas').insert(fila))
}

// Personas (solo admin; las funciones lo exigen) -----------------------------------
export async function traerInvitaciones(): Promise<Invitacion[]> {
  return ok(await supabase.from('team_invites').select('email,nombre,rol,carga_ventas,areas,created_at').order('created_at')) ?? []
}

export async function invitarPersona(email: string, nombre: string, rol: Rol, cargaVentas: boolean, areas: AreaInvitada[]): Promise<void> {
  ok(await supabase.rpc('invitar_persona', {
    p_email: email, p_nombre: nombre, p_rol: rol, p_carga_ventas: cargaVentas, p_areas: areas,
  }))
}

export async function cancelarInvitacion(email: string): Promise<void> {
  ok(await supabase.rpc('cancelar_invitacion', { p_email: email }))
}

export async function actualizarPersona(id: string, nombre: string, rol: Rol, activo: boolean, cargaVentas: boolean): Promise<void> {
  ok(await supabase.rpc('actualizar_persona', {
    p_id: id, p_nombre: nombre, p_rol: rol, p_activo: activo, p_carga_ventas: cargaVentas,
  }))
}

/** rol null = sacar a la persona del área. */
export async function asignarArea(persona: string, area: string, rol: RolArea | null): Promise<void> {
  ok(await supabase.rpc('asignar_area', { p_persona: persona, p_area: area, p_rol_area: rol }))
}

// Objetivos ----------------------------------------------------------------------
const CAMPOS_OBJETIVO =
  'id,plan_id,area_id,titulo,descripcion,periodo,fecha_inicio,fecha_fin,tipo_medicion,evaluacion,meta_numerica,unidad,' +
  'canal_ventas,valor_base,estado,creado_por'

export async function traerObjetivosTodos(): Promise<Objetivo[]> {
  return (ok(await supabase.from('objectives').select(CAMPOS_OBJETIVO).order('fecha_fin')) as unknown as Objetivo[]) ?? []
}

export async function traerObjetivo(id: string): Promise<Objetivo | null> {
  return ok(await supabase.from('objectives').select(CAMPOS_OBJETIVO).eq('id', id).maybeSingle()) as unknown as Objetivo | null
}

export async function traerPlanes(): Promise<Plan[]> {
  return ok(await supabase.from('planes').select('id,titulo,descripcion,area_id,fecha_inicio,fecha_fin,activo').order('fecha_fin')) ?? []
}

export interface DatosObjetivo {
  area_id: string | null
  titulo: string
  descripcion: string
  periodo: string
  fecha_inicio: string
  fecha_fin: string
  tipo_medicion: TipoMedicion
  evaluacion: 'periodo' | 'mensual'
  meta_numerica: number | null
  unidad: string | null
  canal_ventas: Canal | null
  valor_base: number | null
}

/** Crea o edita un objetivo (la base valida: admin todos; líder solo los de su área, no generales ni de planes). */
export async function guardarObjetivo(id: string | null, d: DatosObjetivo, creadoPor: string): Promise<string> {
  const fila = { ...d, titulo: d.titulo.trim(), descripcion: d.descripcion.trim() || null, unidad: d.unidad?.trim() || null }
  if (id) {
    ok(await supabase.from('objectives').update(fila).eq('id', id))
    return id
  }
  const r = ok(await supabase.from('objectives').insert({ ...fila, creado_por: creadoPor }).select('id').single()) as { id: string }
  return r.id
}

export async function cambiarEstadoObjetivo(id: string, estado: Objetivo['estado']): Promise<void> {
  ok(await supabase.from('objectives').update({ estado }).eq('id', id))
}

export async function evolucionObjetivo(id: string): Promise<{ mes: string; valor: number | null }[]> {
  return ok(await supabase.rpc('evolucion_objetivo', { p_id: id })) ?? []
}

export async function traerAportes(objetivo: string): Promise<Aporte[]> {
  return ok(await supabase.from('objective_aportes')
    .select('id,objective_id,instance_id,cantidad,nota,cargado_por,created_at')
    .eq('objective_id', objetivo).order('created_at', { ascending: false }).limit(200)) ?? []
}

export async function cargarAporte(objetivo: string, cantidad: number, nota: string, quien: string): Promise<void> {
  ok(await supabase.from('objective_aportes').insert({ objective_id: objetivo, cantidad, nota: nota.trim() || null, cargado_por: quien }))
}

export async function borrarAporte(id: string): Promise<void> {
  ok(await supabase.from('objective_aportes').delete().eq('id', id))
}

// Ventas -------------------------------------------------------------------------
export async function traerVentas(desde: string, hasta: string): Promise<Venta[]> {
  return ok(await supabase.from('ventas')
    .select('id,fecha,monto,canal,cliente,nota,cargado_por,created_at')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: false }).order('created_at', { ascending: false })) ?? []
}

export async function resumenVentas(desde: string, hasta: string): Promise<ResumenVentas> {
  const filas = ok(await supabase.rpc('resumen_ventas', { p_desde: desde, p_hasta: hasta })) as ResumenVentas[] | null
  return filas?.[0] ?? { total: 0, conocidos: 0, tienda_online: 0, mayorista: 0, cantidad: 0, proporcion_tienda: null, clientes_mayoristas: 0 }
}

/** Nombres de clientes mayoristas ya cargados (para sugerir y no escribirlos distinto). */
export async function clientesMayoristas(): Promise<string[]> {
  const filas = ok(await supabase.from('ventas').select('cliente').eq('canal', 'mayorista').order('created_at', { ascending: false }).limit(300)) as { cliente: string | null }[]
  const vistos = new Map<string, string>()
  for (const f of filas ?? []) if (f.cliente) { const k = f.cliente.trim().toLowerCase(); if (!vistos.has(k)) vistos.set(k, f.cliente.trim()) }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

export interface DatosVenta { fecha: string; monto: number; canal: Canal; cliente: string; nota: string }

export async function guardarVenta(id: string | null, v: DatosVenta, quien: string): Promise<void> {
  const fila = { fecha: v.fecha, monto: v.monto, canal: v.canal, cliente: v.cliente.trim() || null, nota: v.nota.trim() || null }
  if (id) ok(await supabase.from('ventas').update(fila).eq('id', id))
  else ok(await supabase.from('ventas').insert({ ...fila, cargado_por: quien }))
}

export async function borrarVenta(id: string): Promise<void> {
  ok(await supabase.from('ventas').delete().eq('id', id))
}
