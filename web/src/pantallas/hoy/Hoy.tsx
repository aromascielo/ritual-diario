import { useCallback, useEffect, useMemo, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio } from '../../componentes/Piezas'
import { FilaTarea } from '../../componentes/FilaTarea'
import { useMarcar } from '../../componentes/useMarcar'
import { cumplimiento, tareasDelDia, tareasVencidas, traerObjetivos } from '../../lib/datos'
import { fechaLarga, finSemana, hoyISO, inicioSemana, saludo } from '../../lib/fechas'
import { ir } from '../../lib/ruta'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Area, Cumplimiento, Instancia, ObjetivoBreve } from '../../lib/tipos'

const CLAVE_EQUIPO = 'ritual-diario-ver-equipo'

interface Datos {
  hoy: Instancia[]
  vencidas: Instancia[]
  objetivos: ObjetivoBreve[]
  semana: Cumplimiento[]
}

function porcentaje(c: Cumplimiento | undefined): string {
  return c?.porcentaje == null ? '—' : `${Math.round(c.porcentaje)} %`
}

function resumenDelDia(pendientes: number, vencidas: number): string {
  const v = vencidas === 1 ? '1 vencida' : `${vencidas} vencidas`
  if (pendientes === 0 && vencidas === 0) return 'No te queda nada pendiente por hoy.'
  if (pendientes === 0) return `Lo de hoy está listo, pero tenés ${v}.`
  const p = pendientes === 1 ? 'Te queda 1 tarea' : `Te quedan ${pendientes} tareas`
  return vencidas > 0 ? `${p} para hoy y ${v}.` : `${p} para hoy.`
}

export function Hoy() {
  const { yo, areas, perfiles } = useSesion()
  const { puedeMarcar } = usePermisos()
  const [verEquipo, setVerEquipo] = useState(() => {
    try { return localStorage.getItem(CLAVE_EQUIPO) === '1' } catch { return false }
  })
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fecha, setFecha] = useState(hoyISO)

  const cargar = useCallback(async () => {
    if (!yo) return
    const d = hoyISO()
    setFecha(d)
    setError(null)
    try {
      const persona = verEquipo ? null : yo.id
      const [hoy, vencidas, objetivos, semana] = await Promise.all([
        tareasDelDia(d, persona),
        tareasVencidas(persona),
        traerObjetivos(),
        cumplimiento(inicioSemana(d), finSemana(d)),
      ])
      setDatos({ hoy, vencidas, objetivos, semana })
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [yo, verEquipo])

  useEffect(() => { cargar() }, [cargar])

  // Al volver a la app (por ejemplo, al otro día) se actualiza sola.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [cargar])

  function cambiarVista(v: boolean) {
    setVerEquipo(v)
    setDatos(null)
    try { localStorage.setItem(CLAVE_EQUIPO, v ? '1' : '0') } catch { /* nada */ }
  }

  const marcar = useMarcar(datos?.objetivos ?? [], cargar)

  const mapaAreas = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas])
  const mapaPerfiles = useMemo(() => new Map(perfiles.map((p) => [p.id, p])), [perfiles])

  // Tareas de hoy agrupadas por su primera área (las vencidas van en su propio bloque).
  const grupos = useMemo(() => {
    if (!datos) return []
    const idsVencidas = new Set(datos.vencidas.map((v) => v.id))
    const porArea = new Map<string, { area: Area | null; tareas: Instancia[] }>()
    for (const t of datos.hoy) {
      if (idsVencidas.has(t.id)) continue
      const principal = t.areas.map((a) => mapaAreas.get(a)).filter((a): a is Area => !!a)
        .sort((a, b) => a.orden - b.orden)[0] ?? null
      const clave = principal?.id ?? 'sin-area'
      if (!porArea.has(clave)) porArea.set(clave, { area: principal, tareas: [] })
      porArea.get(clave)!.tareas.push(t)
    }
    const orden = { pendiente: 0, hecha: 1, omitida: 2 }
    return [...porArea.values()]
      .map((g) => ({ ...g, tareas: g.tareas.sort((a, b) => orden[a.estado] - orden[b.estado]) }))
      .sort((a, b) => (a.area?.orden ?? 99) - (b.area?.orden ?? 99))
  }, [datos, mapaAreas])

  if (!yo) return null

  const mias = datos?.hoy.filter((t) => t.responsable_id === yo.id) ?? []
  const pendientesHoy = mias.filter((t) => t.estado === 'pendiente').length
  const vencidasMias = datos?.vencidas.filter((t) => t.responsable_id === yo.id).length ?? 0
  const miSemana = datos?.semana.find((c) => c.tipo === 'persona' && c.ref_id === yo.id)
  const equipoSemana = datos?.semana.find((c) => c.tipo === 'equipo')
  const primerNombre = yo.nombre.split(' ')[0]

  return (
    <>
      <Encabezado />
      <main className="contenido">
        <section className="saludo">
          <p className="saludo-fecha">{fechaLarga(fecha)}</p>
          <h1 className="titulo-serif">{saludo()}, {primerNombre}</h1>
          {datos && (
            <p className="saludo-resumen">
              {resumenDelDia(pendientesHoy, vencidasMias)}
            </p>
          )}
        </section>

        {datos && (
          <section className="tarjeta resumen-semana" aria-label="Cumplimiento de la semana">
            <div>
              <span className="resumen-numero">{porcentaje(miSemana)}</span>
              <span className="resumen-texto">tu semana al día</span>
            </div>
            <div>
              <span className="resumen-numero">{porcentaje(equipoSemana)}</span>
              <span className="resumen-texto">el equipo</span>
            </div>
          </section>
        )}

        <label className="interruptor">
          <input type="checkbox" checked={verEquipo} onChange={(e) => cambiarVista(e.target.checked)} />
          <span className="interruptor-pista" aria-hidden="true" />
          Ver todo el equipo
        </label>

        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {!datos && !error && <Cargando />}

        {datos && datos.vencidas.length > 0 && (
          <section className="bloque bloque-vencidas" aria-label="Vencidas">
            <h2 className="bloque-titulo">⏰ Vencidas</h2>
            <ul className="lista-tareas">
              {datos.vencidas.map((t) => (
                <FilaTarea
                  key={t.id}
                  instancia={t}
                  areas={mapaAreas}
                  perfiles={mapaPerfiles}
                  mostrarResponsable={verEquipo}
                  conFecha
                  puedeMarcar={puedeMarcar(t.responsable_id)}
                  ocupada={marcar.ocupada === t.id}
                  alMarcar={marcar.alternar}
                />
              ))}
            </ul>
          </section>
        )}

        {datos && grupos.map((g) => (
          <section key={g.area?.id ?? 'sin-area'} className="bloque" aria-label={g.area?.nombre ?? 'Sin área'}>
            <h2 className="bloque-titulo">
              <span className="punto-area" style={{ background: g.area?.color ?? 'var(--topo)' }} aria-hidden="true" />
              {g.area ? `${g.area.emoji} ${g.area.nombre}` : 'Sin área'}
            </h2>
            <ul className="lista-tareas">
              {g.tareas.map((t) => (
                <FilaTarea
                  key={t.id}
                  instancia={t}
                  areas={mapaAreas}
                  perfiles={mapaPerfiles}
                  mostrarResponsable={verEquipo}
                  conFecha={false}
                  puedeMarcar={puedeMarcar(t.responsable_id)}
                  ocupada={marcar.ocupada === t.id}
                  alMarcar={marcar.alternar}
                />
              ))}
            </ul>
          </section>
        ))}

        {datos && grupos.length === 0 && datos.vencidas.length === 0 && (
          <Vacio emoji="🌿">
            {verEquipo
              ? 'El equipo no tiene tareas para hoy.'
              : 'No tenés tareas para hoy. Si querés sumar una, tocá “Agregar tarea”.'}
          </Vacio>
        )}
      </main>

      <button className="boton-flotante" onClick={() => ir('agregar')}>
        <span aria-hidden="true">＋</span> Agregar tarea
      </button>
      {marcar.dialogos}
    </>
  )
}
