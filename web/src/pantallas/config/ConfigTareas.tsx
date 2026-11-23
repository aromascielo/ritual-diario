import { useCallback, useEffect, useMemo, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio } from '../../componentes/Piezas'
import { traerPlantillas } from '../../lib/datos'
import { describirFrecuencia } from '../../lib/frecuencia'
import { ir } from '../../lib/ruta'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Plantilla } from '../../lib/tipos'

/** Configuración → Tareas: todas las tareas activas, por área. Tocar una abre la edición (si tiene permiso). */
export function ConfigTareas() {
  const { yo, areas, perfiles } = useSesion()
  const { puedeEditarTarea } = usePermisos()
  const [lista, setLista] = useState<Plantilla[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [soloMias, setSoloMias] = useState(false)
  const [area, setArea] = useState<string>('todas')

  const cargar = useCallback(async () => {
    setError(null)
    try { setLista(await traerPlantillas()) } catch (e) { setError(mensajeDeError(e)) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const nombre = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles])
  const filtradas = (lista ?? []).filter((t) =>
    (!soloMias || t.responsable_id === yo?.id) && (area === 'todas' || t.areas.includes(area)))
  const recurrentes = filtradas.filter((t) => t.frecuencia !== 'unica')
  const unicas = filtradas.filter((t) => t.frecuencia === 'unica')
    .sort((a, b) => (a.fecha_unica ?? '').localeCompare(b.fecha_unica ?? ''))

  function Fila({ t }: { t: Plantilla }) {
    const editable = puedeEditarTarea(t)
    const emojis = t.areas.map((a) => areas.find((x) => x.id === a)?.emoji).filter(Boolean).join(' ')
    return (
      <li className="fila-tarea">
        <button type="button" className="fila-texto" disabled={!editable} onClick={() => ir(`editar/${t.id}`)}>
          <span className="fila-titulo">{t.titulo}</span>
          <span className="fila-meta">
            {describirFrecuencia(t)}
            {t.hora_limite ? ` · hasta las ${t.hora_limite.slice(0, 5)}` : ''}
            {` · ${nombre.get(t.responsable_id) ?? '—'}`} · {emojis}
          </span>
        </button>
        {editable && <span className="fila-flecha" aria-hidden="true">›</span>}
      </li>
    )
  }

  return (
    <>
      <Encabezado titulo="Tareas" atras="config" />
      <main className="contenido">
        <div className="filtros">
          <label className="interruptor">
            <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} />
            <span className="interruptor-pista" aria-hidden="true" />
            Solo las mías
          </label>
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área">
            <option value="todas">Todas las áreas</option>
            {areas.filter((a) => a.activa).map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.nombre}</option>)}
          </select>
        </div>
        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {!lista && !error && <Cargando />}
        {lista && filtradas.length === 0 && <Vacio emoji="📋">No hay tareas con estos filtros.</Vacio>}
        {recurrentes.length > 0 && (
          <section className="bloque" aria-label="Se repiten">
            <h2 className="bloque-titulo">🔁 Se repiten</h2>
            <ul className="lista-tareas">{recurrentes.map((t) => <Fila key={t.id} t={t} />)}</ul>
          </section>
        )}
        {unicas.length > 0 && (
          <section className="bloque" aria-label="De una sola vez">
            <h2 className="bloque-titulo">📌 De una sola vez</h2>
            <ul className="lista-tareas">{unicas.map((t) => <Fila key={t.id} t={t} />)}</ul>
          </section>
        )}
        <p className="ayuda centrado">Tocá una tarea para editarla o eliminarla.</p>
      </main>
      <button className="boton-flotante" onClick={() => ir('agregar')}><span aria-hidden="true">＋</span> Agregar tarea</button>
    </>
  )
}
