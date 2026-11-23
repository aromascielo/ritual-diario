import { fechaCorta } from './fechas'
import type { Frecuencia } from './tipos'

export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] // 1 = lunes … 7 = domingo

export const NOMBRES_FRECUENCIA: Record<Frecuencia, string> = {
  unica: 'Una vez',
  diaria: 'Todos los días',
  semanal: 'Algunos días de la semana',
  mensual: 'Una vez por mes',
}

/** "Una vez · vie 20 nov", "Todos los días", "Lun, Mié y Vie", "El día 5 de cada mes"… */
export function describirFrecuencia(t: {
  frecuencia: Frecuencia | string
  fecha_unica?: string | null
  dias_semana?: number[] | null
  dia_mes?: number | null
}): string {
  switch (t.frecuencia) {
    case 'unica':
      return t.fecha_unica ? `Una vez · ${fechaCorta(t.fecha_unica)}` : 'Una vez'
    case 'diaria':
      return 'Todos los días'
    case 'semanal': {
      const dias = [...(t.dias_semana ?? [])].sort((a, b) => a - b)
      if (dias.length === 7) return 'Todos los días'
      if (dias.join() === '1,2,3,4,5') return 'De lunes a viernes'
      const nombres = dias.map((d) => DIAS_CORTOS[d - 1])
      return nombres.length <= 1 ? `Todos los ${nombres[0] ?? '—'}` : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
    }
    case 'mensual':
      return t.dia_mes === 0 ? 'El último día de cada mes' : `El día ${t.dia_mes} de cada mes`
    default:
      return String(t.frecuencia)
  }
}
