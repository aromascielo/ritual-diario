import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, mensajeDeError } from './supabase'
import { traerEquipo } from './datos'
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
    return {
      esAdmin,
      esLider,
      esMiembro,
      puedeMarcar: (responsable: string) => esAdmin || responsable === yo?.id,
    }
  }, [yo, miembros])
}
