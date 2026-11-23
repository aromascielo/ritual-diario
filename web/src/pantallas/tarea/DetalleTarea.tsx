import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Encabezado, Cargando, ErrorCarga, ChipArea, Vacio } from '../../componentes/Piezas'
import { Dialogo } from '../../componentes/Dialogo'
import { useAvisar } from '../../componentes/Avisos'
import { useMarcar } from '../../componentes/useMarcar'
import {
  borrarComentario, comentar, eliminarTarea, traerComentarios, traerObjetivos, traerTarea, type DetalleTarea as Detalle,
} from '../../lib/datos'
import { fechaHora, fechaLarga, hora, yaPaso } from '../../lib/fechas'
import { useSesion, usePermisos } from '../../lib/sesion'
import { volver } from '../../lib/ruta'
import { mensajeDeError } from '../../lib/supabase'
import type { Area, Comentario, ObjetivoBreve } from '../../lib/tipos'

const FRECUENCIAS: Record<string, string> = {
  unica: 'Una sola vez',
  diaria: 'Todos los días',
  semanal: 'Todas las semanas',
  mensual: 'Todos los meses',
}

export function DetalleTarea({ id }: { id: string }) {
  const { yo, areas, perfiles } = useSesion()
  const { esAdmin, puedeMarcar, puedeEditarTarea } = usePermisos()
  const avisar = useAvisar()
  const [detalle, setDetalle] = useState<Detalle | null | undefined>(undefined)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [objetivos, setObjetivos] = useState<ObjetivoBreve[]>([])
  const [error, setError] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [paraBorrar, setParaBorrar] = useState<Comentario | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const [d, c, o] = await Promise.all([traerTarea(id), traerComentarios(id), traerObjetivos()])
      setDetalle(d)
      setComentarios(c)
      setObjetivos(o)
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const marcar = useMarcar(objetivos, cargar)
  const mapaPerfiles = useMemo(() => new Map(perfiles.map((p) => [p.id, p])), [perfiles])
  const nombre = (pid: string | null) => (pid && mapaPerfiles.get(pid)?.nombre) || '—'

  async function enviarComentario(e: FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t || !yo) return
    setEnviando(true)
    try {
      await comentar(id, yo.id, t)
      setTexto('')
      setComentarios(await traerComentarios(id))
    } catch (err) {
      avisar(mensajeDeError(err), 'error')
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarBorrado() {
    const c = paraBorrar
    setParaBorrar(null)
    if (!c) return
    try {
      await borrarComentario(c.id)
      setComentarios((cs) => cs.filter((x) => x.id !== c.id))
      avisar('Comentario borrado')
    } catch (err) {
      avisar(mensajeDeError(err), 'error')
    }
  }

  async function eliminar() {
    if (!detalle) return
    setEliminando(true)
    try {
      await eliminarTarea(detalle.instancia.template_id)
      setConfirmarEliminar(false)
      avisar('Tarea eliminada')
      volver('hoy')
    } catch (err) {
      avisar(mensajeDeError(err), 'error')
      setEliminando(false)
    }
  }

  if (error) return (<><Encabezado titulo="Tarea" atras="hoy" /><main className="contenido"><ErrorCarga mensaje={error} reintentar={cargar} /></main></>)
  if (detalle === undefined) return (<><Encabezado titulo="Tarea" atras="hoy" /><main className="contenido"><Cargando /></main></>)
  if (detalle === null) {
    return (
      <>
        <Encabezado titulo="Tarea" atras="hoy" />
        <main className="contenido"><Vacio emoji="🔍">No encontramos esta tarea. Puede que la hayan eliminado.</Vacio></main>
      </>
    )
  }

  const i = detalle.instancia
  const lasAreas = i.areas.map((a) => areas.find((x) => x.id === a)).filter((a): a is Area => !!a).sort((a, b) => a.orden - b.orden)
  const vencida = i.estado === 'pendiente' && yaPaso(i.fecha_limite)
  const puede = puedeMarcar(i.responsable_id)
  const ocupada = marcar.ocupada === i.id
  const objetivo = objetivos.find((o) => o.id === i.objective_id)
  const puedeEliminar = puedeEditarTarea({
    creado_por: detalle.creado_por, responsable_id: i.responsable_id, frecuencia: detalle.frecuencia, areas: i.areas,
  })
  const seRepite = detalle.frecuencia !== 'unica'

  return (
    <>
      <Encabezado titulo="Tarea" atras="hoy" />
      <main className="contenido">
        <section className="tarjeta detalle">
          <div className={`estado-etiqueta estado-${vencida ? 'vencida' : i.estado}`}>
            {vencida ? '⏰ Vencida' : i.estado === 'hecha' ? '✓ Hecha' : i.estado === 'omitida' ? '⏭️ Omitida' : 'Pendiente'}
          </div>
          <h1 className="titulo-serif detalle-titulo">{i.titulo}</h1>
          {detalle.descripcion && <p className="detalle-descripcion">{detalle.descripcion}</p>}

          <div className="chips">
            {lasAreas.map((a) => <ChipArea key={a.id} emoji={a.emoji} nombre={a.nombre} color={a.color} />)}
          </div>

          <dl className="datos">
            <div><dt>Responsable</dt><dd>{nombre(i.responsable_id)}</dd></div>
            <div><dt>Día</dt><dd>{fechaLarga(i.fecha)}</dd></div>
            <div><dt>Hasta</dt><dd>{i.sin_horario ? 'Sin horario (hasta las 23:59)' : `${hora(i.fecha_limite)} h`}</dd></div>
            <div><dt>Se repite</dt><dd>{FRECUENCIAS[detalle.frecuencia] ?? detalle.frecuencia}</dd></div>
            {objetivo && <div><dt>Suma a</dt><dd>{objetivo.titulo}</dd></div>}
            {detalle.creado_por && <div><dt>La creó</dt><dd>{nombre(detalle.creado_por)}</dd></div>}
            {i.estado === 'hecha' && i.completada_at && (
              <div><dt>Hecha</dt><dd>{fechaHora(i.completada_at)} · {nombre(i.completada_por)}</dd></div>
            )}
            {i.estado === 'omitida' && (
              <>
                <div><dt>Omitida</dt><dd>{i.omitida_at ? fechaHora(i.omitida_at) : ''} · {nombre(i.omitida_por)}</dd></div>
                <div><dt>Motivo</dt><dd className="texto-libre">{i.omitida_motivo}</dd></div>
              </>
            )}
          </dl>

          {puede ? (
            <div className="acciones-tarea">
              {i.estado === 'pendiente' ? (
                <>
                  <button className="boton" disabled={ocupada} onClick={() => marcar.pedir(i, 'hecha')}>✓ Hecha</button>
                  <button className="boton boton-secundario" disabled={ocupada} onClick={() => marcar.pedir(i, 'omitida')}>Omitir</button>
                </>
              ) : (
                <button className="boton boton-secundario" disabled={ocupada} onClick={() => marcar.pedir(i, 'pendiente')}>
                  Volver a pendiente
                </button>
              )}
            </div>
          ) : (
            <p className="ayuda">Solo {nombre(i.responsable_id)}{esAdmin ? '' : ' o la admin'} pueden cambiar el estado de esta tarea.</p>
          )}

          {puedeEliminar && (
            <button className="enlace enlace-peligro" onClick={() => setConfirmarEliminar(true)}>
              🗑️ Eliminar tarea
            </button>
          )}
        </section>

        <section className="bloque" aria-label="Comentarios">
          <h2 className="bloque-titulo">💬 Comentarios</h2>
          {comentarios.length === 0 && <p className="ayuda">Todavía no hay comentarios.</p>}
          <ul className="comentarios">
            {comentarios.map((c) => (
              <li key={c.id} className={`comentario${c.profile_id === yo?.id ? ' propio' : ''}`}>
                <div className="comentario-cabeza">
                  <strong>{nombre(c.profile_id)}</strong>
                  <span>{fechaHora(c.created_at)}</span>
                </div>
                <p className="texto-libre">{c.texto}</p>
                {(c.profile_id === yo?.id || esAdmin) && (
                  <button className="enlace enlace-chico" onClick={() => setParaBorrar(c)}>Borrar</button>
                )}
              </li>
            ))}
          </ul>
          <form className="nuevo-comentario" onSubmit={enviarComentario}>
            <label className="campo">
              <span className="solo-lectores">Escribir un comentario</span>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Escribí un comentario…"
              />
            </label>
            <button className="boton" disabled={enviando || !texto.trim()}>{enviando ? 'Enviando…' : 'Comentar'}</button>
          </form>
        </section>
      </main>
      {marcar.dialogos}
      <Dialogo
        titulo="¿Eliminar esta tarea?"
        abierto={confirmarEliminar}
        alCerrar={() => { if (!eliminando) setConfirmarEliminar(false) }}
        acciones={
          <>
            <button className="boton boton-secundario" disabled={eliminando} onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
            <button className="boton boton-peligro" disabled={eliminando} onClick={eliminar}>
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }
      >
        <p>
          “{i.titulo}”{seRepite
            ? ' deja de repetirse y se borran todos sus días pendientes, también los vencidos.'
            : i.estado === 'pendiente'
              ? ' se borra, con sus comentarios.'
              : ` ya está ${i.estado}: queda guardada en el historial y deja de aparecer en Hoy.`}
        </p>
        <p className="ayuda">
          {seRepite ? 'Los días que ya se hicieron u omitieron quedan en el historial. ' : ''}
          No se puede deshacer.{!esAdmin ? ' A la admin le llega un aviso.' : ''}
        </p>
      </Dialogo>
      <Dialogo
        titulo="¿Borrar el comentario?"
        abierto={!!paraBorrar}
        alCerrar={() => setParaBorrar(null)}
        acciones={
          <>
            <button className="boton boton-secundario" onClick={() => setParaBorrar(null)}>Cancelar</button>
            <button className="boton boton-peligro" onClick={confirmarBorrado}>Borrar</button>
          </>
        }
      >
        <p>No se puede deshacer.</p>
      </Dialogo>
    </>
  )
}
