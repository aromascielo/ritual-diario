import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSesion } from './sesion'

export interface Alerta {
  id: string
  tipo: string
  titulo: string
  cuerpo: string | null
  instance_id: string | null
  objective_id: string | null
  area_id: string | null
  leida: boolean
  created_at: string
}

interface Alertas {
  lista: Alerta[] | null
  noLeidas: number
  error: string | null
  cargar: () => Promise<void>
  marcarLeida: (id: string) => Promise<void>
  leerTodas: () => Promise<void>
}

const Ctx = createContext<Alertas | null>(null)

/**
 * Alertas de la campana (solo admin). Una sola suscripción en vivo (Realtime) por sesión,
 * que se cierra al salir (CLAUDE.md §9). La base solo deja leer las alertas propias.
 */
export function ProveedorAlertas({ children }: { children: ReactNode }) {
  const { yo } = useSesion()
  const esAdmin = yo?.rol === 'admin' && yo.activo
  const uid = yo?.id ?? null
  const [lista, setLista] = useState<Alerta[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!uid) return
    const r = await supabase.from('app_notifications')
      .select('id,tipo,titulo,cuerpo,instance_id,objective_id,area_id,leida,created_at')
      .eq('destinatario_id', uid)
      .order('created_at', { ascending: false })
      .limit(100)
    if (r.error) setError(r.error.message)
    else { setError(null); setLista(r.data as Alerta[]) }
  }, [uid])

  useEffect(() => {
    if (!esAdmin || !uid) { setLista(null); return }
    cargar()
    const canal = supabase.channel(`alertas-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications', filter: `destinatario_id=eq.${uid}` },
        () => { cargar() })
      .subscribe()
    // Al volver a la app se pone al día (por si el celular cortó la conexión en vivo).
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      supabase.removeChannel(canal)
    }
  }, [esAdmin, uid, cargar])

  const marcarLeida = useCallback(async (id: string) => {
    setLista((l) => l?.map((a) => (a.id === id ? { ...a, leida: true } : a)) ?? l)
    await supabase.from('app_notifications').update({ leida: true }).eq('id', id)
  }, [])

  const leerTodas = useCallback(async () => {
    setLista((l) => l?.map((a) => ({ ...a, leida: true })) ?? l)
    const { error: e } = await supabase.rpc('leer_alertas')
    if (e) { setError(e.message); cargar() }
  }, [cargar])

  const noLeidas = lista?.filter((a) => !a.leida).length ?? 0
  return <Ctx.Provider value={{ lista, noLeidas, error, cargar, marcarLeida, leerTodas }}>{children}</Ctx.Provider>
}

export function useAlertas(): Alertas {
  const a = useContext(Ctx)
  if (!a) throw new Error('useAlertas fuera de ProveedorAlertas')
  return a
}

/** Adónde lleva tocar una alerta. */
export function destinoAlerta(a: Alerta): string | null {
  if (a.instance_id) return `tarea/${a.instance_id}`
  if (a.objective_id) return `objetivo/${a.objective_id}`
  if (a.area_id) return `area/${a.area_id}`
  return null
}
