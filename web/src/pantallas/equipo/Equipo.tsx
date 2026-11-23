import { useCallback, useEffect, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio } from '../../componentes/Piezas'
import { PildoraAlDia } from '../../componentes/AlDia'
import { TareasDelPeriodo } from '../../componentes/TareasDelPeriodo'
import { cumplimiento, tareasDelDia, tareasVencidas } from '../../lib/datos'
import { finMes, finSemana, hoyISO, inicioMes, inicioSemana, yaPaso } from '../../lib/fechas'
import { ir } from '../../lib/ruta'
import { useSesion } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Cumplimiento, Instancia } from '../../lib/tipos'

interface Datos {
  semana: Cumplimiento[]
  mes: Cumplimiento[]
  hoy: Instancia[]
  vencidas: Instancia[]
}

function iniciales(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join('')
}

/** Equipo: una tarjeta por persona con sus áreas, pendientes de hoy, vencidas y % al día de semana y mes. */
export function Equipo() {
  const { yo, perfiles, areas, miembros } = useSesion()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    const d = hoyISO()
    try {
      const [semana, mes, hoy, vencidas] = await Promise.all([
        cumplimiento(inicioSemana(d), finSemana(d)),
        cumplimiento(inicioMes(d), finMes(d)),
        tareasDelDia(d, null),
        tareasVencidas(null),
      ])
      setDatos({ semana, mes, hoy, vencidas })
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Primero yo, después el resto por nombre.
  const gente = perfiles.filter((p) => p.activo)
    .sort((a, b) => (a.id === yo?.id ? -1 : b.id === yo?.id ? 1 : a.nombre.localeCompare(b.nombre)))
  const equipoSemana = datos?.semana.find((c) => c.tipo === 'equipo')
  const equipoMes = datos?.mes.find((c) => c.tipo === 'equipo')

  return (
    <>
      <Encabezado titulo="Equipo" />
      <main className="contenido">
        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {!datos && !error && <Cargando />}
        {datos && (
          <>
            <section className="tarjeta resumen-semana" aria-label="Todo el equipo">
              <div><PildoraAlDia c={equipoSemana} grande /><span className="resumen-texto">equipo · semana</span></div>
              <div><PildoraAlDia c={equipoMes} grande /><span className="resumen-texto">equipo · mes</span></div>
            </section>
            <ul className="lista-config">
              {gente.map((p) => {
                const susAreas = miembros.filter((m) => m.profile_id === p.id)
                  .map((m) => ({ m, a: areas.find((a) => a.id === m.area_id) }))
                  .filter((x) => x.a?.activa)
                  .sort((x, y) => x.a!.orden - y.a!.orden)
                const pendientes = datos.hoy.filter((t) => t.responsable_id === p.id && t.estado === 'pendiente' && !yaPaso(t.fecha_limite)).length
                const venc = datos.vencidas.filter((t) => t.responsable_id === p.id).length
                return (
                  <li key={p.id}>
                    <button className="tarjeta tarjeta-persona" onClick={() => ir(`miembro/${p.id}`)}>
                      <span className="tarjeta-persona-cabeza">
                        <span className="avatar" aria-hidden="true">{iniciales(p.nombre)}</span>
                        <span className="fila-config-texto">
                          <strong>{p.nombre}{p.id === yo?.id && ' (vos)'}</strong>
                          <span className="ayuda">
                            {susAreas.length === 0 ? 'Sin áreas' : susAreas.map(({ a, m }) => `${a!.emoji}${m.rol_area === 'lider' ? '★' : ''}`).join('  ')}
                          </span>
                        </span>
                        <span className="fila-flecha" aria-hidden="true">›</span>
                      </span>
                      <span className="tarjeta-persona-numeros">
                        <span><strong>{pendientes}</strong> por hacer hoy</span>
                        <span>{venc > 0 ? <span className="marca-vencida"><strong>{venc}</strong> vencidas</span> : <><strong>0</strong> vencidas</>}</span>
                        <span>Semana <PildoraAlDia c={datos.semana.find((c) => c.tipo === 'persona' && c.ref_id === p.id)} /></span>
                        <span>Mes <PildoraAlDia c={datos.mes.find((c) => c.tipo === 'persona' && c.ref_id === p.id)} /></span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="ayuda">★ = líder del área.</p>
          </>
        )}
        {datos && gente.length === 0 && <Vacio emoji="🌱">Todavía no hay personas en el equipo.</Vacio>}
      </main>
    </>
  )
}

/** Detalle de una persona: sus áreas y sus tareas de hoy, la semana o el mes. */
export function DetalleMiembro({ id }: { id: string }) {
  const { perfiles, miembros, areas } = useSesion()
  const p = perfiles.find((x) => x.id === id)
  if (!p) {
    return (
      <>
        <Encabezado titulo="Persona" atras="equipo" />
        <main className="contenido"><Vacio emoji="🔎">No encontramos a esta persona.</Vacio></main>
      </>
    )
  }
  const susAreas = miembros.filter((m) => m.profile_id === id)
    .map((m) => ({ m, a: areas.find((a) => a.id === m.area_id) }))
    .filter((x) => x.a?.activa)
    .sort((x, y) => x.a!.orden - y.a!.orden)
  return (
    <>
      <Encabezado titulo={p.nombre} atras="equipo" />
      <main className="contenido">
        {susAreas.length > 0 && (
          <p className="gente-area">
            {susAreas.map(({ a, m }) => (
              <a key={a!.id} className="chip chip-persona" href={`#/area/${a!.id}`} style={{ borderColor: a!.color }}>
                {a!.emoji} {a!.nombre}{m.rol_area === 'lider' && <span className="ayuda"> · líder</span>}
              </a>
            ))}
          </p>
        )}
        <TareasDelPeriodo persona={id} />
      </main>
    </>
  )
}
