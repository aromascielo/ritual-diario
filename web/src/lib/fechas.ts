// Fechas y horas — único lugar donde se define la zona horaria (CLAUDE.md §9).
// Las fechas "de calendario" se manejan como texto 'AAAA-MM-DD' (igual que en la base).
// Prohibido usar toISOString().slice(0, 10) para saber qué día es hoy: da el día en UTC.

export const ZONA = 'America/Argentina/Buenos_Aires'

const fmtISO = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtHora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
const fmtHoraNum = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hour12: false })

/** Día de calendario en Argentina para un instante. */
export function isoDe(instante: Date): string {
  return fmtISO.format(instante)
}

export function hoyISO(): string {
  return isoDe(new Date())
}

/** Suma días a una fecha 'AAAA-MM-DD' (sin problemas de zona horaria). */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + dias))
  return f.toISOString().slice(0, 10) // seguro: la fecha se armó en UTC a propósito
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha 'AAAA-MM-DD'. */
export function diaSemana(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return dow === 0 ? 7 : dow
}

export function inicioSemana(iso: string): string {
  return sumarDias(iso, 1 - diaSemana(iso))
}

export function finSemana(iso: string): string {
  return sumarDias(inicioSemana(iso), 6)
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "miércoles 18 de noviembre" */
export function fechaLarga(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${DIAS[diaSemana(iso) - 1]} ${d} de ${MESES[m - 1]}`
}

/** "Hoy", "Mañana", "Ayer" o "vie 20 nov" */
export function fechaCorta(iso: string): string {
  const hoy = hoyISO()
  if (iso === hoy) return 'Hoy'
  if (iso === sumarDias(hoy, 1)) return 'Mañana'
  if (iso === sumarDias(hoy, -1)) return 'Ayer'
  const [, m, d] = iso.split('-').map(Number)
  return `${DIAS[diaSemana(iso) - 1].slice(0, 3)} ${d} ${MESES[m - 1].slice(0, 3)}`
}

/** "14:30" en hora argentina. */
export function hora(instante: string | Date): string {
  return fmtHora.format(typeof instante === 'string' ? new Date(instante) : instante)
}

/** "Hoy 14:30" o "vie 20 nov 14:30" */
export function fechaHora(instante: string): string {
  const f = new Date(instante)
  return `${fechaCorta(isoDe(f))} ${hora(f)}`
}

export function yaPaso(instante: string): boolean {
  return new Date(instante).getTime() < Date.now()
}

export function saludo(): string {
  const h = Number(fmtHoraNum.format(new Date()))
  if (h >= 5 && h < 13) return 'Buen día'
  if (h >= 13 && h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export function inicioMes(iso: string): string {
  return iso.slice(0, 8) + '01'
}

export function finMes(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) // seguro: armada en UTC
}
