import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, mensajeDeError } from './supabase'
import { traerEquipo } from './datos'
import { desactivarPush } from './push'
import type { Area, Miembro, Perfil } from './tipos'

interface Sesion {
  cargando: boolean
  error: string | null
  session: Session | null
  yo: Perfil | null
  perfiles: Perfil[]
  areas: Area[]
  miembros: Miembro[]
  recargarEquipo: () => Promise<void>
  salir: () => Promise<void>
}

const Ctx = createContext<Sesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [listoAuth, setListoAuth] = useState(false)
  const [cargandoEquipo, setCargandoEquipo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setListoAuth(true)
    })
    // Sin async adentro del callback (deadlock conocido de supabase-js): se despacha con setTimeout.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setTimeout(() => setSession(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id ?? null

  const recargarEquipo = useCallback(async () => {
    if (!uid) return
    setCargandoEquipo(true)
    setError(null)
    try {
      const e = await traerEquipo()
      setPerfiles(e.perfiles)
      setAreas(e.areas)
      setMiembros(e.miembros)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoEquipo(false)
    }
  }, [uid])

  useEffect(() => {
    if (uid) {
      recargarEquipo()
    } else {
      setPerfiles([])
      setAreas([])
      setMiembros([])
    }
  }, [uid, recargarEquipo])

  const salir = useCallback(async () => {
    await desactivarPush() // este celular deja de recibir avisos de esta cuenta (CLAUDE.md §7)
    await supabase.auth.signOut()
    window.location.hash = '#/hoy'
  }, [])

  const yo = useMemo(() => perfiles.find((p) => p.id === uid) ?? null, [perfiles, uid])

  const valor: Sesion = {
    cargando: !listoAuth || (!!uid && cargandoEquipo && perfiles.length === 0),
    error,
    session,
    yo,
    perfiles,
    areas,
    miembros,
    recargarEquipo,
    salir,
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion(): Sesion {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSesion fuera de ProveedorSesion')
  return s
}

/** Permisos para mostrar u ocultar botones. La base valida igual (CLAUDE.md §2). */
export function usePermisos() {
  const { yo, miembros } = useSesion()
  return useMemo(() => {
    const esAdmin = yo?.rol === 'admin'
    const misAreas = miembros.filter((m) => m.profile_id === yo?.id)
    const esLider = (area: string) => misAreas.some((m) => m.area_id === area && m.rol_area === 'lider')
    const esMiembro = (area: string) => misAreas.some((m) => m.area_id === area)
    const esMiembroDe = (area: string, persona: string) =>
      miembros.some((m) => m.area_id === area && m.profile_id === persona)
    return {
      esAdmin,
      esLider,
      esMiembro,
      puedeMarcar: (responsable: string) => esAdmin || responsable === yo?.id,
      /** Igual que las políticas de objectives: admin todos; líder los de su área que no son de un plan. */
      puedeEditarObjetivo: (o: { area_id: string | null; plan_id: string | null }) =>
        esAdmin || (!!o.area_id && !o.plan_id && esLider(o.area_id)),
      puedeCrearObjetivo: esAdmin || misAreas.some((m) => m.rol_area === 'lider'),
      /** Aportes a mano en objetivos numéricos: admin o líder del área. */
      puedeCargarAporte: (o: { area_id: string | null; tipo_medicion: string }) =>
        o.tipo_medicion === 'numerico' && (esAdmin || (!!o.area_id && esLider(o.area_id))),
      cargaVentas: esAdmin || !!yo?.carga_ventas,
      /** Igual que privado.puede_editar_tarea en la base (CLAUDE.md §2: editar / eliminar). */
      puedeEditarTarea: (t: { creado_por: string | null; responsable_id: string; frecuencia: string; areas: string[] }) => {
        if (esAdmin) return true
        if (!yo || (t.creado_por !== yo.id && t.responsable_id !== yo.id) || t.areas.length === 0) return false
        const enCadaArea = t.areas.every(
          (a) => esLider(a) || (t.frecuencia === 'unica' && t.responsable_id === yo.id && esMiembro(a)),
        )
        return enCadaArea && t.areas.some((a) => esMiembroDe(a, t.responsable_id))
      },
    }
  }, [yo, miembros])
}
