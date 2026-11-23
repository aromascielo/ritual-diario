import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cargando, ErrorCarga, Vacio } from './Piezas'
import { FilaTarea } from './FilaTarea'
import { PildoraAlDia } from './AlDia'
import { useMarcar } from './useMarcar'
import { cumplimiento, tareasDelPeriodo, traerObjetivos } from '../lib/datos'
import { fechaCorta, finMes, finSemana, hoyISO, inicioMes, inicioSemana, yaPaso } from '../lib/fechas'
import { useSesion, usePermisos } from '../lib/sesion'
import { mensajeDeError } from '../lib/supabase'
import type { Cumplimiento, Instancia, ObjetivoBreve } from '../lib/tipos'

type Periodo = 'hoy' | 'semana' | 'mes'
type FiltroEstado = 'todas' | 'pendientes' | 'vencidas' | 'hechas' | 'omitidas'

const PERIODOS: { id: Periodo; texto: string }[] = [
  { id: 'hoy', texto: 'Hoy' }, { id: 'semana', texto: 'Semana' }, { id: 'mes', texto: 'Mes' },
]
const ESTADOS: { id: FiltroEstado; texto: string }[] = [
  { id: 'todas', texto: 'Todas' }, { id: 'pendientes', texto: 'Pendientes' }, { id: 'vencidas', texto: 'Vencidas' },
  { id: 'hechas', texto: 'Hechas' }, { id: 'omitidas', texto: 'Omitidas' },
]

function rango(p: Periodo, hoy: string): [string, string] {
  if (p === 'hoy') return [hoy, hoy]
  if (p === 'semana') return [inicioSemana(hoy), finSemana(hoy)]
  return [inicioMes(hoy), finMes(hoy)]
}

function pasaFiltro(i: Instancia, f: FiltroEstado): boolean {
  const vencida = i.estado === 'pendiente' && yaPaso(i.fecha_limite)
  if (f === 'pendientes') return i.estado === 'pendiente' && !vencida
  if (f === 'vencidas') return vencida
  if (f === 'hechas') return i.estado === 'hecha'
  if (f === 'omitidas') return i.estado === 'omitida'
  return true
}

/**
 * Detalle de un área o de una persona: pestañas Hoy / Semana / Mes, filtro por estado
 * (y por persona en un área) y el % al día del período, calculado por la base.
 */
export function TareasDelPeriodo({ area, persona }: { area?: string; persona?: string }) {
  const { areas, perfiles, miembros } = useSesion()
  const { puedeMarcar } = usePermisos()
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [estado, setEstado] = useState<FiltroEstado>('todas')
  const [quien, setQuien] = useState('todas')
  const [datos, setDatos] = useState<{ tareas: Instancia[]; al: Cumplimiento[]; objetivos: ObjetivoBreve[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    const [desde, hasta] = rango(periodo, hoyISO())
    try {
      const [tareas, al, objetivos] = await Promise.all([
        tareasDelPeriodo(desde, hasta, { area, persona }),
        cumplimiento(desde, hasta),
        traerObjetivos(),
      ])
      setDatos({ tareas, al, objetivos })
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [periodo, area, persona])

  useEffect(() => { cargar() }, [cargar])

  const marcar = useMarcar(datos?.objetivos ?? [], cargar)
  const mapaAreas = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas])
  const mapaPerfiles = useMemo(() => new Map(perfiles.map((p) => [p.id, p])), [perfiles])

  // En un área: se puede filtrar por cualquier persona que tenga tareas ahí o sea parte del área.
  const personasDelArea = useMemo(() => {
    if (!area) return []
    const ids = new Set([
      ...miembros.filter((m) => m.area_id === area).map((m) => m.profile_id),
      ...(datos?.tareas ?? []).map((t) => t.responsable_id),
    ])
    return perfiles.filter((p) => ids.has(p.id))
  }, [area, miembros, perfiles, datos])

  const visibles = (datos?.tareas ?? []).filter((t) => pasaFiltro(t, estado) && (quien === 'todas' || t.responsable_id === quien))
  const porDia = new Map<string, Instancia[]>()
  for (const t of visibles) {
    if (!porDia.has(t.fecha)) porDia.set(t.fecha, [])
    porDia.get(t.fecha)!.push(t)
  }

  // % al día del período: de la persona elegida, de la persona del detalle, o del área.
  const ref = area && quien === 'todas'
    ? datos?.al.find((c) => c.tipo === 'area' && c.ref_id === area)
    : datos?.al.find((c) => c.tipo === 'persona' && c.ref_id === (persona ?? quien))
  // Si se mira una persona dentro de un área, el % de la base es el de todas sus áreas: se aclara.
  const aclaracion = area && quien !== 'todas' ? 'en todas sus áreas' : null

  const cuenta = (f: FiltroEstado) => (datos?.tareas ?? []).filter((t) => pasaFiltro(t, f) && (quien === 'todas' || t.responsable_id === quien)).length
  const textoPeriodo = periodo === 'hoy' ? 'hoy' : periodo === 'semana' ? 'esta semana' : 'este mes'

  return (
    <>
      <div className="chips pestanas" role="tablist" aria-label="Período">
        {PERIODOS.map((p) => (
          <button key={p.id} role="tab" aria-selected={periodo === p.id}
            className={`chip${periodo === p.id ? ' elegido' : ''}`}
            onClick={() => { setPeriodo(p.id); setDatos(null) }}>
            {p.texto}
          </button>
        ))}
      </div>

      {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
      {!datos && !error && <Cargando />}

      {datos && (
        <>
          <section className="tarjeta resumen-periodo" aria-label="Cumplimiento del período">
            <PildoraAlDia c={ref} grande />
            <div>
              <p><strong>Al día {textoPeriodo}</strong>{aclaracion && <span className="ayuda"> ({aclaracion})</span>}</p>
              <p className="ayuda">
                {cuenta('hechas')} hechas · {cuenta('vencidas')} vencidas · {cuenta('pendientes')} por hacer
                {cuenta('omitidas') > 0 && ` · ${cuenta('omitidas')} omitidas`}
              </p>
            </div>
          </section>

          <div className="filtros">
            <select value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)} aria-label="Filtrar por estado">
              {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.texto}</option>)}
            </select>
            {area && personasDelArea.length > 1 && (
              <select value={quien} onChange={(e) => setQuien(e.target.value)} aria-label="Filtrar por persona">
                <option value="todas">Todas las personas</option>
                {personasDelArea.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
          </div>

          {[...porDia.entries()].map(([dia, tareas]) => (
            <section key={dia} className="bloque" aria-label={fechaCorta(dia)}>
              {periodo !== 'hoy' && <h2 className="bloque-titulo dia-titulo">{fechaCorta(dia)}</h2>}
              <ul className="lista-tareas">
                {tareas.map((t) => (
                  <FilaTarea
                    key={t.id}
                    instancia={t}
                    areas={mapaAreas}
                    perfiles={mapaPerfiles}
                    mostrarResponsable={!persona}
                    conFecha={false}
                    puedeMarcar={puedeMarcar(t.responsable_id)}
                    ocupada={marcar.ocupada === t.id}
                    alMarcar={marcar.alternar}
                  />
                ))}
              </ul>
            </section>
          ))}

          {visibles.length === 0 && (
            <Vacio emoji="🌿">
              {estado === 'todas' ? `No hay tareas ${textoPeriodo}.` : `No hay tareas con ese filtro ${textoPeriodo}.`}
            </Vacio>
          )}
        </>
      )}
      {marcar.dialogos}
    </>
  )
}
