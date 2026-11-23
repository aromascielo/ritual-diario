import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio, Barra, ChipArea } from '../../componentes/Piezas'
import { Dialogo } from '../../componentes/Dialogo'
import { useAvisar } from '../../componentes/Avisos'
import { estadoObjetivo } from '../../componentes/TarjetaObjetivo'
import {
  avanceObjetivos, borrarAporte, cambiarEstadoObjetivo, cargarAporte, evolucionObjetivo, traerAportes, traerObjetivo,
} from '../../lib/datos'
import { fechaHora } from '../../lib/fechas'
import { AYUDA_MEDICION, NOMBRES_CANAL, NOMBRES_MEDICION, diaMes, diasRestantes, formatoValor, nombreMes, numero } from '../../lib/formato'
import { ir } from '../../lib/ruta'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Aporte, Avance, Objetivo } from '../../lib/tipos'

export function DetalleObjetivo({ id }: { id: string }) {
  const { yo, areas, perfiles } = useSesion()
  const { puedeEditarObjetivo, puedeCargarAporte } = usePermisos()
  const avisar = useAvisar()
  const [o, setO] = useState<Objetivo | null | undefined>(undefined)
  const [avance, setAvance] = useState<Avance | undefined>()
  const [evolucion, setEvolucion] = useState<{ mes: string; valor: number | null }[]>([])
  const [aportes, setAportes] = useState<Aporte[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [cargando, setCargando] = useState(false)
  const [confirmar, setConfirmar] = useState<'archivar' | 'cumplido' | 'reactivar' | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const obj = await traerObjetivo(id)
      setO(obj)
      if (!obj) return
      const [av, ev, ap] = await Promise.all([
        avanceObjetivos(),
        evolucionObjetivo(id),
        obj.tipo_medicion === 'numerico' ? traerAportes(id) : Promise.resolve([]),
      ])
      setAvance(av.find((a) => a.objective_id === id))
      setEvolucion(ev)
      setAportes(ap)
    } catch (e) { setError(mensajeDeError(e)) }
  }, [id])
  useEffect(() => { cargar() }, [cargar])

  const nombre = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles])

  async function enviarAporte(e: FormEvent) {
    e.preventDefault()
    const n = Number(cantidad.replace(/\./g, '').replace(',', '.'))
    if (!n) { avisar('Escribí una cantidad (puede ser negativa para corregir).', 'error'); return }
    setCargando(true)
    try {
      await cargarAporte(id, n, nota, yo!.id)
      setCantidad(''); setNota('')
      avisar('Avance cargado 🌿')
      await cargar()
    } catch (err) { avisar(mensajeDeError(err), 'error') } finally { setCargando(false) }
  }

  async function quitarAporte(a: Aporte) {
    try { await borrarAporte(a.id); avisar('Carga borrada'); await cargar() } catch (err) { avisar(mensajeDeError(err), 'error') }
  }

  async function cambiarEstado() {
    const accion = confirmar
    setConfirmar(null)
    if (!o || !accion) return
    const estado = accion === 'archivar' ? 'archivado' : accion === 'cumplido' ? 'cumplido' : 'activo'
    try {
      await cambiarEstadoObjetivo(o.id, estado)
      avisar(estado === 'archivado' ? 'Objetivo archivado' : estado === 'cumplido' ? '¡Objetivo cumplido! 🎉' : 'Objetivo reactivado')
      await cargar()
    } catch (err) { avisar(mensajeDeError(err), 'error') }
  }

  if (error) return (<><Encabezado titulo="Objetivo" atras="objetivos" /><main className="contenido"><ErrorCarga mensaje={error} reintentar={cargar} /></main></>)
  if (o === undefined) return (<><Encabezado titulo="Objetivo" atras="objetivos" /><main className="contenido"><Cargando /></main></>)
  if (o === null) return (<><Encabezado titulo="Objetivo" atras="objetivos" /><main className="contenido"><Vacio emoji="🔍">No encontramos este objetivo.</Vacio></main></>)

  const area = areas.find((a) => a.id === o.area_id)
  const estado = estadoObjetivo(o, avance)
  const editable = puedeEditarObjetivo(o)
  const quedan = diasRestantes(o.fecha_fin)
  const maxEvol = Math.max(1, ...evolucion.map((e) => e.valor ?? 0), o.meta_numerica ?? 0)

  return (
    <>
      <Encabezado titulo="Objetivo" atras="objetivos" />
      <main className="contenido">
        <section className="tarjeta detalle">
          <span className={`etiqueta-estado ${estado.clase}`}>{estado.texto}</span>
          <h1 className="titulo-serif detalle-titulo">{o.titulo}</h1>
          {o.descripcion && <p className="detalle-descripcion">{o.descripcion}</p>}
          <div className="chips">
            {area ? <ChipArea emoji={area.emoji} nombre={area.nombre} color={area.color} /> : <span className="chip-area">🌐 General</span>}
            {o.plan_id && <span className="chip-area">📊 Plan VEA</span>}
          </div>

          <div className="avance-grande">
            <span className="resumen-numero">{formatoValor(o, avance?.valor)}</span>
            <span className="ayuda">
              {avance?.meta != null ? `de ${formatoValor(o, avance.meta)}` : ''}
              {o.evaluacion === 'mensual' ? ' este mes' : ' en todo el período'}
              {avance?.porcentaje != null ? ` · ${numero.format(avance.porcentaje)} %` : ''}
            </span>
          </div>
          <Barra porcentaje={avance?.porcentaje ?? null} ritmo={avance?.ritmo} atrasado={avance?.atrasado} />
          {avance?.ritmo != null && (
            <p className="ayuda">Según el tiempo que pasó deberías ir por el {numero.format(avance.ritmo)} % (rayita azul).</p>
          )}

          <dl className="datos">
            <div><dt>Se mide con</dt><dd>{NOMBRES_MEDICION[o.tipo_medicion]}{o.canal_ventas ? ` · ${NOMBRES_CANAL[o.canal_ventas]}` : ''}</dd></div>
            <div><dt>Período</dt><dd>{diaMes(o.fecha_inicio)} al {diaMes(o.fecha_fin)} {o.fecha_fin.slice(0, 4)}{o.evaluacion === 'mensual' ? ' · meta por mes' : ''}</dd></div>
            {o.estado === 'activo' && quedan >= 0 && <div><dt>Quedan</dt><dd>{quedan === 1 ? '1 día' : `${quedan} días`}</dd></div>}
            {o.valor_base != null && <div><dt>Punto de partida</dt><dd>{formatoValor(o, o.valor_base)}</dd></div>}
            {o.creado_por && <div><dt>Lo creó</dt><dd>{nombre.get(o.creado_por) ?? '—'}</dd></div>}
          </dl>
          <p className="ayuda">{AYUDA_MEDICION[o.tipo_medicion]}</p>

          {editable && (
            <div className="acciones-secundarias">
              <button className="enlace" onClick={() => ir(`objetivo-form/${o.id}`)}>✏️ Editar</button>
              {o.estado === 'activo' && <button className="enlace" onClick={() => setConfirmar('cumplido')}>🎉 Marcar cumplido</button>}
              {o.estado === 'activo'
                ? <button className="enlace enlace-peligro" onClick={() => setConfirmar('archivar')}>Archivar</button>
                : <button className="enlace" onClick={() => setConfirmar('reactivar')}>Reactivar</button>}
            </div>
          )}
        </section>

        {evolucion.length > 1 && (
          <section className="bloque" aria-label="Evolución mes a mes">
            <h2 className="bloque-titulo">📈 Mes a mes</h2>
            <ul className="tarjeta evolucion">
              {o.valor_base != null && (
                <li className="evol-base">
                  <span className="evol-mes">Base</span>
                  <span className="evol-barra"><span style={{ width: `${Math.min(100, 100 * o.valor_base / maxEvol)}%` }} /></span>
                  <span className="evol-valor">{formatoValor(o, o.valor_base)}</span>
                </li>
              )}
              {evolucion.map((e) => (
                <li key={e.mes}>
                  <span className="evol-mes">{nombreMes(e.mes)}</span>
                  <span className="evol-barra"><span style={{ width: `${Math.min(100, 100 * (e.valor ?? 0) / maxEvol)}%` }} /></span>
                  <span className="evol-valor">{formatoValor(o, e.valor)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {o.tipo_medicion === 'numerico' && (
          <section className="bloque" aria-label="Cargas">
            <h2 className="bloque-titulo">➕ Cargas</h2>
            {puedeCargarAporte(o) && o.estado === 'activo' && (
              <form className="tarjeta formulario" onSubmit={enviarAporte}>
                <div className="fila-form">
                  <label className="campo crece"><span>Cantidad{o.unidad ? ` (${o.unidad})` : ''}</span>
                    <input inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
                  </label>
                  <button className="boton" disabled={cargando}>{cargando ? 'Cargando…' : 'Cargar'}</button>
                </div>
                <label className="campo"><span>Nota (opcional)</span>
                  <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Por ejemplo: feria del sábado" />
                </label>
              </form>
            )}
            {aportes.length === 0 ? <p className="ayuda">Todavía no hay cargas.</p> : (
              <ul className="lista-tareas">
                {aportes.map((a) => (
                  <li key={a.id} className="fila-tarea">
                    <span className="fila-texto">
                      <span className="fila-titulo">{a.cantidad > 0 ? '+' : ''}{numero.format(a.cantidad)}{o.unidad ? ` ${o.unidad}` : ''}</span>
                      <span className="fila-meta">
                        {fechaHora(a.created_at)} · {nombre.get(a.cargado_por ?? '') ?? '—'}
                        {a.instance_id ? ' · al tildar una tarea' : ''}{a.nota ? ` · ${a.nota}` : ''}
                      </span>
                    </span>
                    {!a.instance_id && puedeCargarAporte(o) && (
                      <button className="enlace enlace-chico" onClick={() => quitarAporte(a)}>Borrar</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
      <Dialogo
        titulo={confirmar === 'archivar' ? '¿Archivar el objetivo?' : confirmar === 'cumplido' ? '¿Marcarlo como cumplido?' : '¿Reactivar el objetivo?'}
        abierto={!!confirmar}
        alCerrar={() => setConfirmar(null)}
        acciones={
          <>
            <button className="boton boton-secundario" onClick={() => setConfirmar(null)}>Cancelar</button>
            <button className={`boton${confirmar === 'archivar' ? ' boton-peligro' : ''}`} onClick={cambiarEstado}>
              {confirmar === 'archivar' ? 'Archivar' : confirmar === 'cumplido' ? 'Sí, cumplido' : 'Reactivar'}
            </button>
          </>
        }
      >
        <p>
          {confirmar === 'archivar' && 'Deja de aparecer en la lista y no genera alertas. Su historial queda guardado y lo podés reactivar.'}
          {confirmar === 'cumplido' && 'Queda marcado como cumplido y deja de avisar si se atrasa.'}
          {confirmar === 'reactivar' && 'Vuelve a la lista de objetivos activos.'}
        </p>
      </Dialogo>
    </>
  )
}
