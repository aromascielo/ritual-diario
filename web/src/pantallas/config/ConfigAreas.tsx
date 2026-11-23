import { useState } from 'react'
import { Encabezado, Vacio } from '../../componentes/Piezas'
import { Dialogo } from '../../componentes/Dialogo'
import { useAvisar } from '../../componentes/Avisos'
import { guardarArea, type DatosArea } from '../../lib/datos'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Area } from '../../lib/tipos'

// Colores de marca y sus variantes (CLAUDE.md §3 y §12).
const COLORES = ['#6F7C12', '#9AA544', '#1098F7', '#0B6FB8', '#F17300', '#B85700', '#6B5E62', '#9A8D91']
const EMOJIS = ['🕯️', '🛍️', '📦', '📱', '✨', '📣', '🚚', '📊', '🌿', '🧴', '🧼', '💐', '📸', '🎁', '🤝', '💰']

/** Configuración → Áreas (solo admin; la base lo exige). Archivar no borra el historial. */
export function ConfigAreas() {
  const { areas, miembros, recargarEquipo } = useSesion()
  const { esAdmin } = usePermisos()
  const avisar = useAvisar()
  const [editando, setEditando] = useState<{ id: string | null; datos: DatosArea } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!esAdmin) {
    return (<><Encabezado titulo="Áreas" atras="config" /><main className="contenido"><Vacio emoji="🔒">Solo la admin configura las áreas.</Vacio></main></>)
  }

  const activas = areas.filter((a) => a.activa)
  const archivadas = areas.filter((a) => !a.activa)

  function abrir(a: Area | null) {
    setError(null)
    setEditando(a
      ? { id: a.id, datos: { nombre: a.nombre, descripcion: a.descripcion ?? '', emoji: a.emoji, color: a.color, orden: a.orden, activa: a.activa } }
      : { id: null, datos: { nombre: '', descripcion: '', emoji: '🌿', color: COLORES[0], orden: (Math.max(0, ...areas.map((x) => x.orden)) + 1), activa: true } })
  }

  async function guardar(datos: DatosArea, id: string | null, mensaje: string) {
    if (!datos.nombre.trim()) { setError('Escribí el nombre del área.'); return }
    setGuardando(true)
    setError(null)
    try {
      await guardarArea(id, datos)
      await recargarEquipo()
      setEditando(null)
      avisar(mensaje)
    } catch (e) {
      setError(mensajeDeError(e))
      avisar(mensajeDeError(e), 'error')
    } finally {
      setGuardando(false)
    }
  }

  function cambiar<K extends keyof DatosArea>(k: K, v: DatosArea[K]) {
    setEditando((e) => (e ? { ...e, datos: { ...e.datos, [k]: v } } : e))
  }

  function Tarjeta({ a }: { a: Area }) {
    const personas = miembros.filter((m) => m.area_id === a.id).length
    return (
      <li>
        <button className="tarjeta fila-config" onClick={() => abrir(a)} style={{ borderLeftColor: a.color }}>
          <span className="fila-config-emoji" aria-hidden="true">{a.emoji}</span>
          <span className="fila-config-texto">
            <strong>{a.nombre}</strong>
            <span className="ayuda">{a.descripcion || 'Sin descripción'} · {personas === 1 ? '1 persona' : `${personas} personas`}</span>
          </span>
          <span className="fila-flecha" aria-hidden="true">›</span>
        </button>
      </li>
    )
  }

  const e = editando
  return (
    <>
      <Encabezado titulo="Áreas" atras="config" />
      <main className="contenido">
        <ul className="lista-config">{activas.map((a) => <Tarjeta key={a.id} a={a} />)}</ul>
        {archivadas.length > 0 && (
          <section className="bloque">
            <h2 className="bloque-titulo">Archivadas</h2>
            <ul className="lista-config archivadas">{archivadas.map((a) => <Tarjeta key={a.id} a={a} />)}</ul>
          </section>
        )}
        <p className="ayuda centrado">Las personas de cada área se eligen en Configuración → Personas.</p>
      </main>
      <button className="boton-flotante" onClick={() => abrir(null)}><span aria-hidden="true">＋</span> Nueva área</button>

      <Dialogo
        titulo={e?.id ? 'Editar área' : 'Nueva área'}
        abierto={!!e}
        alCerrar={() => { if (!guardando) setEditando(null) }}
        acciones={e && (
          <>
            {e.id && (
              <button className="boton boton-secundario" disabled={guardando}
                onClick={() => guardar({ ...e.datos, activa: !e.datos.activa }, e.id,
                  e.datos.activa ? 'Área archivada' : 'Área reactivada')}>
                {e.datos.activa ? 'Archivar' : 'Reactivar'}
              </button>
            )}
            <button className="boton" disabled={guardando} onClick={() => guardar(e.datos, e.id, e.id ? 'Área guardada' : 'Área creada 🌿')}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        )}
      >
        {e && (
          <div className="formulario">
            <label className="campo">
              <span>Nombre</span>
              <input value={e.datos.nombre} onChange={(x) => cambiar('nombre', x.target.value)} maxLength={60} />
            </label>
            <label className="campo">
              <span>Descripción (opcional)</span>
              <input value={e.datos.descripcion} onChange={(x) => cambiar('descripcion', x.target.value)} maxLength={160} placeholder="Qué incluye esta área" />
            </label>
            <fieldset className="campo">
              <legend>Emoji</legend>
              <div className="chips">
                {EMOJIS.map((em) => (
                  <button key={em} type="button" className={`chip chip-emoji${e.datos.emoji === em ? ' elegido' : ''}`}
                    aria-pressed={e.datos.emoji === em} onClick={() => cambiar('emoji', em)}>{em}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="campo">
              <legend>Color</legend>
              <div className="chips">
                {COLORES.map((c) => (
                  <button key={c} type="button" className={`muestra-color${e.datos.color === c ? ' elegido' : ''}`}
                    style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={e.datos.color === c}
                    onClick={() => cambiar('color', c)} />
                ))}
              </div>
            </fieldset>
            <label className="campo">
              <span>Orden en las listas</span>
              <input type="number" min={1} max={99} value={e.datos.orden} onChange={(x) => cambiar('orden', Number(x.target.value) || 1)} />
            </label>
            {e.id && e.datos.activa && <p className="ayuda">Archivar un área no borra su historial; deja de aparecer para tareas nuevas.</p>}
            {error && <p className="error-texto" role="alert">{error}</p>}
          </div>
        )}
      </Dialogo>
    </>
  )
}
