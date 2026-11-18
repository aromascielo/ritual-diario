import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'ritual-diario-v2',
  },
})

/** Convierte un error de Supabase en un mensaje para la persona. */
export function mensajeDeError(e: unknown): string {
  const m = (e as { message?: string } | null)?.message ?? ''
  if (!m) return 'Algo salió mal. Probá de nuevo.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisá internet y probá de nuevo.'
  if (/JWT|expired/i.test(m)) return 'Tu sesión venció. Volvé a entrar.'
  return m
}
