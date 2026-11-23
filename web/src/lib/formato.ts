// Formatos para mostrar números, pesos y meses. Solo presentación: las cuentas las hace la base.
import { hoyISO } from './fechas'
import type { Canal, Objetivo, TipoMedicion } from './tipos'

export const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** '2026-11-01' → 'nov 2026' (o 'noviembre 2026' si largo). */
export function nombreMes(iso: string, largo = false): string {
  const [a, m] = iso.split('-').map(Number)
  return `${(largo ? MESES_LARGOS : MESES)[m - 1]} ${a}`
}

/** '2026-11-23' → '23 nov' */
export function diaMes(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m - 1]}`
}

export function diasRestantes(fechaFin: string): number {
  const [a, m, d] = fechaFin.split('-').map(Number)
  const [ha, hm, hd] = hoyISO().split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000)
}

export const NOMBRES_MEDICION: Record<TipoMedicion, string> = {
  tareas: 'Tareas hechas',
  numerico: 'Cantidad que se va cargando',
  ventas: 'Ventas en pesos',
  proporcion_ventas: '% de las ventas minoristas por un canal',
  clientes_mayoristas: 'Clientes mayoristas distintos',
  cumplimiento: '% de tareas al día',
}

export const AYUDA_MEDICION: Record<TipoMedicion, string> = {
  tareas: 'Se mide con las tareas vinculadas: cuánto se hizo de lo que tocaba (según el peso de cada tarea).',
  numerico: 'Se suma lo que se carga: al tildar una tarea vinculada (te pregunta "¿cuántos?") o a mano desde el objetivo.',
  ventas: 'Suma sola las ventas cargadas en la pantalla Ventas (todas o de un canal).',
  proporcion_ventas: 'Qué parte del monto minorista (conocidos + tienda online) vino por el canal elegido.',
  clientes_mayoristas: 'Cuenta los clientes mayoristas distintos que compraron en el período.',
  cumplimiento: 'El % al día de las tareas del área (o de todo el equipo si el objetivo es general).',
}

export const NOMBRES_CANAL: Record<Canal, string> = {
  conocidos: 'Conocidos',
  tienda_online: 'Tienda online',
  mayorista: 'Mayorista',
}

export const EMOJI_CANAL: Record<Canal, string> = { conocidos: '🤝', tienda_online: '🛍️', mayorista: '📦' }

/** Valor de un objetivo con su unidad: "$310.000", "52,5 %", "3 clientes". */
export function formatoValor(o: Pick<Objetivo, 'tipo_medicion' | 'unidad'>, v: number | null | undefined): string {
  if (v == null) return '—'
  switch (o.tipo_medicion) {
    case 'ventas': return pesos.format(v)
    case 'tareas':
    case 'proporcion_ventas':
    case 'cumplimiento': return `${numero.format(v)} %`
    case 'clientes_mayoristas': return `${numero.format(v)} ${v === 1 ? 'cliente' : 'clientes'}`
    default: return `${numero.format(v)}${o.unidad ? ` ${o.unidad}` : ''}`
  }
}
