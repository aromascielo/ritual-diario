import { useCallback, useEffect, useMemo, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio, Barra } from '../../componentes/Piezas'
import { avanceObjetivos, traerObjetivos } from '../../lib/datos'
import { mensajeDeError } from '../../lib/supabase'
import type { Avance, ObjetivoBreve } from '../../lib/tipos'

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

export function formatoValor(o: ObjetivoBreve, v: number | null): string {
  if (v == null) return '—'
  switch (o.tipo_medicion) {
    case 'ventas': return pesos.format(v)
    case 'tareas':
    case 'proporcion_ventas':
    case 'cumplimiento': return `${numero.format(v)} %`
    default: return `${numero.format(v)}${o.unidad ? ` ${o.unidad}` : ''}`
  }
}

/** Vista inicial de objetivos (solo lectura). La gestión completa llega en la fase 4. */
export function Objetivos() {
  const [objetivos, setObjetivos] = useState<ObjetivoBreve[] | null>(null)
  const [avances, setAvances] = useState<Avance[]>([])
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const [o, a] = await Promise.all([traerObjetivos(), avanceObjetivos()])
      setObjetivos(o)
      setAvances(a)
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const porId = useMemo(() => new Map(avances.map((a) => [a.objective_id, a])), [avances])

  return (
    <>
      <Encabezado titulo="Objetivos" />
      <main className="contenido">
        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {!objetivos && !error && <Cargando />}
        {objetivos && objetivos.length === 0 && <Vacio emoji="🎯">Todavía no hay objetivos cargados.</Vacio>}
        {objetivos && objetivos.length > 0 && (
          <ul className="lista-objetivos">
            {objetivos.map((o) => {
              const a = porId.get(o.id)
              return (
                <li key={o.id} className="tarjeta objetivo">
                  <div className="objetivo-cabeza">
                    <h2 className="objetivo-titulo">{o.titulo}</h2>
                    {a?.atrasado && <span className="etiqueta-atrasado">Atrasado</span>}
                  </div>
                  <Barra porcentaje={a?.porcentaje ?? null} ritmo={a?.ritmo} atrasado={a?.atrasado} />
                  <p className="objetivo-numeros">
                    <strong>{formatoValor(o, a?.valor ?? null)}</strong>
                    {a?.meta != null && <> de {formatoValor(o, a.meta)}</>}
                    {a?.porcentaje != null && <> · {numero.format(a.porcentaje)} %</>}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        <p className="ayuda centrado">Pronto: Plan VEA con evolución mes a mes, carga de ventas y objetivos por área.</p>
      </main>
    </>
  )
}
