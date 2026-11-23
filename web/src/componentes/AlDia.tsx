import type { Cumplimiento } from '../lib/tipos'

/** "85 %" o "—" si no hay nada vencido ni hecho todavía (CLAUDE.md §5). */
export function textoAlDia(c: Cumplimiento | undefined): string {
  return c?.porcentaje == null ? '—' : `${Math.round(c.porcentaje)} %`
}

/** Píldora con el % al día: oliva desde 80 %, naranja por debajo de 70 % (umbral de la alerta semanal). */
export function PildoraAlDia({ c, grande }: { c: Cumplimiento | undefined; grande?: boolean }) {
  const p = c?.porcentaje
  const clase = p == null ? 'sin-datos' : p >= 80 ? 'bien' : p < 70 ? 'bajo' : 'medio'
  const detalle = c && c.hechas + c.vencidas > 0
    ? `${c.hechas} hechas de ${c.hechas + c.vencidas} que ya vencieron`
    : 'Todavía no venció ninguna tarea'
  return (
    <span className={`pildora-aldia ${clase}${grande ? ' grande' : ''}`} title={detalle} aria-label={`${textoAlDia(c)} al día. ${detalle}`}>
      {textoAlDia(c)}
    </span>
  )
}
