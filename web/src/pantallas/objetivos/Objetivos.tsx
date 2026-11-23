import { useCallback, useEffect, useMemo, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio, Barra } from '../../componentes/Piezas'
import { TarjetaObjetivo } from '../../componentes/TarjetaObjetivo'
import { avanceObjetivos, traerObjetivosTodos, traerPlanes } from '../../lib/datos'
import { formatoValor } from '../../lib/formato'
import { ir } from '../../lib/ruta'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Avance, Objetivo, Plan } from '../../lib/tipos'

export function Objetivos() {
  const { areas } = useSesion()
  const { puedeCrearObjetivo } = usePermisos()
  const [objetivos, setObjetivos] = useState<Objetivo[] | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [avances, setAvances] = useState<Avance[]>([])
  const [error, setError] = useState<string | null>(null)
  const [verArchivados, setVerArchivados] = useState(false)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const [o, p, a] = await Promise.all([traerObjetivosTodos(), traerPlanes(), avanceObjetivos()])
      setObjetivos(o); setPlanes(p); setAvances(a)
    } catch (e) { setError(mensajeDeError(e)) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const avance = useMemo(() => new Map(avances.map((a) => [a.objective_id, a])), [avances])
  const visibles = (objetivos ?? []).filter((o) => verArchivados ? o.estado === 'archivado' : o.estado !== 'archivado')
  const sueltos = visibles.filter((o) => !o.plan_id)
  const generales = sueltos.filter((o) => !o.area_id)
  const porArea = areas
    .map((a) => ({ a, lista: sueltos.filter((o) => o.area_id === a.id) }))
    .filter((g) => g.lista.length > 0)

  return (
    <>
      <Encabezado titulo="Objetivos" />
      <main className="contenido">
        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {!objetivos && !error && <Cargando />}

        {!verArchivados && planes.filter((p) => p.activo).map((p) => {
          const metas = (objetivos ?? []).filter((o) => o.plan_id === p.id && o.estado !== 'archivado')
          return (
            <button key={p.id} className="tarjeta plan-resumen" onClick={() => ir('vea')}>
              <div className="objetivo-cabeza">
                <h2 className="titulo-serif plan-titulo">📊 {p.titulo}</h2>
                <span className="fila-flecha" aria-hidden="true">›</span>
              </div>
              <ul className="plan-metas">
                {metas.map((o) => {
                  const a = avance.get(o.id)
                  return (
                    <li key={o.id}>
                      <span className="plan-meta-titulo">{o.titulo}</span>
                      <Barra porcentaje={a?.porcentaje ?? null} atrasado={a?.atrasado} />
                      <span className="ayuda">{formatoValor(o, a?.valor)} de {formatoValor(o, a?.meta)}{o.evaluacion === 'mensual' ? ' este mes' : ''}</span>
                    </li>
                  )
                })}
              </ul>
              <span className="enlace-falso">Ver evolución y ventas →</span>
            </button>
          )
        })}

        {porArea.map((g) => (
          <section key={g.a.id} className="bloque">
            <h2 className="bloque-titulo"><span className="punto-area" style={{ background: g.a.color }} aria-hidden="true" />{g.a.emoji} {g.a.nombre}</h2>
            <ul className="lista-objetivos">{g.lista.map((o) => <TarjetaObjetivo key={o.id} o={o} a={avance.get(o.id)} area={g.a} />)}</ul>
          </section>
        ))}
        {generales.length > 0 && (
          <section className="bloque">
            <h2 className="bloque-titulo">🌐 Generales</h2>
            <ul className="lista-objetivos">{generales.map((o) => <TarjetaObjetivo key={o.id} o={o} a={avance.get(o.id)} area={undefined} />)}</ul>
          </section>
        )}
        {objetivos && sueltos.length === 0 && (
          <Vacio emoji="🎯">
            {verArchivados ? 'No hay objetivos archivados.'
              : puedeCrearObjetivo ? 'Todavía no hay objetivos de área. Creá el primero con el botón de abajo.' : 'Todavía no hay objetivos de área.'}
          </Vacio>
        )}
        {objetivos && objetivos.some((o) => o.estado === 'archivado') && (
          <button className="enlace centrado" onClick={() => setVerArchivados((v) => !v)}>
            {verArchivados ? '← Volver a los objetivos activos' : 'Ver objetivos archivados'}
          </button>
        )}
        <p className="ayuda centrado">La rayita azul en cada barra marca dónde deberías estar según el tiempo que pasó.</p>
      </main>
      {puedeCrearObjetivo && !verArchivados && (
        <button className="boton-flotante" onClick={() => ir('objetivo-form/nuevo')}><span aria-hidden="true">＋</span> Nuevo objetivo</button>
      )}
    </>
  )
}
