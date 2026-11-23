import { useCallback, useEffect, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio, Barra } from '../../componentes/Piezas'
import { estadoObjetivo } from '../../componentes/TarjetaObjetivo'
import { avanceObjetivos, evolucionObjetivo, traerObjetivosTodos, traerPlanes } from '../../lib/datos'
import { diasRestantes, formatoValor, nombreMes, numero } from '../../lib/formato'
import { ir } from '../../lib/ruta'
import { usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Avance, Objetivo, Plan } from '../../lib/tipos'

interface Meta { o: Objetivo; a: Avance | undefined; evol: { mes: string; valor: number | null }[] }

/** Plan VEA: cada meta con el valor de este mes y la evolución mes a mes desde la base (CLAUDE.md §4). */
export function PlanVea() {
  const { cargaVentas } = usePermisos()
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined)
  const [metas, setMetas] = useState<Meta[]>([])
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const [planes, objetivos, avances] = await Promise.all([traerPlanes(), traerObjetivosTodos(), avanceObjetivos()])
      const p = planes.find((x) => x.activo) ?? null
      setPlan(p)
      if (!p) return
      const delPlan = objetivos.filter((o) => o.plan_id === p.id && o.estado !== 'archivado')
      const evols = await Promise.all(delPlan.map((o) => evolucionObjetivo(o.id)))
      setMetas(delPlan.map((o, i) => ({ o, a: avances.find((a) => a.objective_id === o.id), evol: evols[i] })))
    } catch (e) { setError(mensajeDeError(e)) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  return (
    <>
      <Encabezado titulo="Plan VEA" atras="objetivos" />
      <main className="contenido">
        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {plan === undefined && !error && <Cargando />}
        {plan === null && <Vacio emoji="📊">No hay un plan activo.</Vacio>}
        {plan && (
          <>
            <section className="saludo">
              <h1 className="titulo-serif">{plan.titulo}</h1>
              {plan.descripcion && <p className="saludo-resumen">{plan.descripcion}</p>}
              <p className="saludo-fecha">
                Del {nombreMes(plan.fecha_inicio, true)} a {nombreMes(plan.fecha_fin, true)}
                {diasRestantes(plan.fecha_fin) >= 0 && ` · faltan ${diasRestantes(plan.fecha_fin)} días`}
              </p>
            </section>

            <button className="tarjeta fila-config" onClick={() => ir('ventas')}>
              <span className="fila-config-emoji" aria-hidden="true">🧾</span>
              <span className="fila-config-texto">
                <strong>Ventas</strong>
                <span className="ayuda">{cargaVentas ? 'Cargá cada venta y mirá los totales del mes' : 'Mirá las ventas y los totales del mes'}</span>
              </span>
              <span className="fila-flecha" aria-hidden="true">›</span>
            </button>

            {metas.map(({ o, a, evol }) => {
              const estado = estadoObjetivo(o, a)
              const max = Math.max(1, o.meta_numerica ?? 0, o.valor_base ?? 0, ...evol.map((e) => e.valor ?? 0))
              return (
                <section key={o.id} className="tarjeta meta-vea">
                  <div className="objetivo-cabeza">
                    <h2 className="objetivo-titulo">{o.titulo}</h2>
                    <span className={`etiqueta-estado ${estado.clase}`}>{estado.texto}</span>
                  </div>
                  <div className="avance-grande">
                    <span className="resumen-numero">{formatoValor(o, a?.valor)}</span>
                    <span className="ayuda">de {formatoValor(o, a?.meta)}{o.evaluacion === 'mensual' ? ' este mes' : ' en el plan'}{a?.porcentaje != null ? ` · ${numero.format(a.porcentaje)} %` : ''}</span>
                  </div>
                  <Barra porcentaje={a?.porcentaje ?? null} ritmo={a?.ritmo} atrasado={a?.atrasado} />
                  {(evol.length > 0 || o.valor_base != null) && (
                    <ul className="evolucion">
                      {o.valor_base != null && (
                        <li className="evol-base">
                          <span className="evol-mes">Base</span>
                          <span className="evol-barra"><span style={{ width: `${Math.min(100, 100 * o.valor_base / max)}%` }} /></span>
                          <span className="evol-valor">{formatoValor(o, o.valor_base)}</span>
                        </li>
                      )}
                      {evol.map((e) => (
                        <li key={e.mes}>
                          <span className="evol-mes">{nombreMes(e.mes)}</span>
                          <span className="evol-barra"><span style={{ width: `${Math.min(100, 100 * (e.valor ?? 0) / max)}%` }} /></span>
                          <span className="evol-valor">{formatoValor(o, e.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button className="enlace enlace-chico" onClick={() => ir(`objetivo/${o.id}`)}>Ver detalle</button>
                </section>
              )
            })}
          </>
        )}
      </main>
    </>
  )
}
