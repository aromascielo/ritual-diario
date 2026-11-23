import { useCallback, useEffect, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio } from '../../componentes/Piezas'
import { PildoraAlDia } from '../../componentes/AlDia'
import { TareasDelPeriodo } from '../../componentes/TareasDelPeriodo'
import { cumplimiento, tareasVencidas } from '../../lib/datos'
import { finSemana, hoyISO, inicioSemana } from '../../lib/fechas'
import { ir } from '../../lib/ruta'
import { useSesion } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Cumplimiento } from '../../lib/tipos'

/** Áreas: grilla con el % al día de la semana de cada área. */
export function Areas() {
  const { areas, miembros, perfiles } = useSesion()
  const [datos, setDatos] = useState<{ semana: Cumplimiento[]; vencidas: Map<string, number> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    const hoy = hoyISO()
    try {
      const [semana, venc] = await Promise.all([cumplimiento(inicioSemana(hoy), finSemana(hoy)), tareasVencidas(null)])
      const vencidas = new Map<string, number>()
      for (const t of venc) for (const a of t.areas) vencidas.set(a, (vencidas.get(a) ?? 0) + 1)
      setDatos({ semana, vencidas })
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const activas = areas.filter((a) => a.activa)
  const activos = new Set(perfiles.filter((p) => p.activo).map((p) => p.id))

  return (
    <>
      <Encabezado titulo="Áreas" />
      <main className="contenido">
        <p className="ayuda">% al día de esta semana: tareas hechas sobre las que ya vencieron.</p>
        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {!datos && !error && <Cargando />}
        {datos && (
          <ul className="grilla-areas">
            {activas.map((a) => {
              const c = datos.semana.find((x) => x.tipo === 'area' && x.ref_id === a.id)
              const gente = miembros.filter((m) => m.area_id === a.id && activos.has(m.profile_id)).length
              const venc = datos.vencidas.get(a.id) ?? 0
              return (
                <li key={a.id}>
                  <button className="tarjeta tarjeta-area" style={{ borderTopColor: a.color }} onClick={() => ir(`area/${a.id}`)}>
                    <span className="tarjeta-area-emoji" aria-hidden="true">{a.emoji}</span>
                    <span className="tarjeta-area-nombre">{a.nombre}</span>
                    <PildoraAlDia c={c} />
                    <span className="ayuda">
                      {gente === 1 ? '1 persona' : `${gente} personas`}
                      {venc > 0 && <> · <span className="marca-vencida">{venc === 1 ? '1 vencida' : `${venc} vencidas`}</span></>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {datos && activas.length === 0 && <Vacio emoji="🌱">Todavía no hay áreas.</Vacio>}
      </main>
    </>
  )
}

/** Detalle de un área: quiénes están y sus tareas de hoy, la semana o el mes. */
export function DetalleArea({ id }: { id: string }) {
  const { areas, miembros, perfiles } = useSesion()
  const area = areas.find((a) => a.id === id)
  if (!area) {
    return (
      <>
        <Encabezado titulo="Área" atras="areas" />
        <main className="contenido"><Vacio emoji="🔎">No encontramos esta área.</Vacio></main>
      </>
    )
  }
  const gente = miembros
    .filter((m) => m.area_id === id)
    .map((m) => ({ m, p: perfiles.find((p) => p.id === m.profile_id) }))
    .filter((x) => x.p?.activo)
    .sort((a, b) => (a.m.rol_area === b.m.rol_area ? a.p!.nombre.localeCompare(b.p!.nombre) : a.m.rol_area === 'lider' ? -1 : 1))

  return (
    <>
      <Encabezado titulo={`${area.emoji} ${area.nombre}`} atras="areas" />
      <main className="contenido">
        {area.descripcion && <p className="ayuda">{area.descripcion}</p>}
        {gente.length > 0 && (
          <p className="gente-area">
            {gente.map(({ m, p }) => (
              <a key={p!.id} className="chip chip-persona" href={`#/miembro/${p!.id}`}>
                {p!.nombre.split(' ')[0]}{m.rol_area === 'lider' && <span className="ayuda"> · líder</span>}
              </a>
            ))}
          </p>
        )}
        <TareasDelPeriodo area={id} />
      </main>
    </>
  )
}
