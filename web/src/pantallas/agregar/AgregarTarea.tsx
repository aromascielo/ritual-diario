import { useMemo, useState, type FormEvent } from 'react'
import { Encabezado } from '../../componentes/Piezas'
import { useAvisar } from '../../componentes/Avisos'
import { crearTareaUnica } from '../../lib/datos'
import { fechaCorta, fechaLarga, hoyISO, sumarDias } from '../../lib/fechas'
import { volver } from '../../lib/ruta'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'

/** Agregar una tarea de una sola vez, con fecha (las recurrentes llegan en la fase 3). */
export function AgregarTarea() {
  const { yo, areas, perfiles, miembros } = useSesion()
  const { esAdmin, esLider, esMiembro } = usePermisos()
  const avisar = useAvisar()
  const hoy = hoyISO()

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [conHora, setConHora] = useState(false)
  const [horaLimite, setHoraLimite] = useState('18:00')
  const [elegidas, setElegidas] = useState<string[]>([])
  const [responsable, setResponsable] = useState(yo?.id ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Áreas donde puede crear: la admin en todas; el resto, en las suyas.
  const areasPosibles = useMemo(
    () => areas.filter((a) => a.activa && (esAdmin || esMiembro(a.id))),
    [areas, esAdmin, esMiembro],
  )

  // A quién puede asignarla: admin a cualquiera; líder de todas las áreas elegidas, a gente de esas áreas.
  const puedeAsignar = esAdmin || (elegidas.length > 0 && elegidas.every((a) => esLider(a)))
  const responsables = useMemo(() => {
    const activos = perfiles.filter((p) => p.activo)
    if (esAdmin) return activos
    if (!puedeAsignar) return activos.filter((p) => p.id === yo?.id)
    const ids = new Set(miembros.filter((m) => elegidas.includes(m.area_id)).map((m) => m.profile_id))
    return activos.filter((p) => ids.has(p.id) || p.id === yo?.id)
  }, [perfiles, esAdmin, puedeAsignar, miembros, elegidas, yo])

  if (!yo) return null
  const responsableFinal = responsables.some((p) => p.id === responsable) ? responsable : yo.id

  function alternarArea(id: string) {
    setElegidas((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]))
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!titulo.trim()) return setError('Escribí qué hay que hacer.')
    if (elegidas.length === 0) return setError('Elegí al menos un área.')
    if (!fecha || fecha < hoy) return setError('La fecha no puede ser anterior a hoy.')
    setGuardando(true)
    try {
      await crearTareaUnica({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        responsable: responsableFinal,
        areas: elegidas,
        fecha,
        hora: conHora ? horaLimite : null,
        objetivo: null,
      })
      avisar(`Tarea agregada para ${fechaCorta(fecha).toLowerCase()} 🌿`)
      volver('hoy')
    } catch (err) {
      setError(mensajeDeError(err))
      setGuardando(false)
    }
  }

  return (
    <>
      <Encabezado titulo="Agregar tarea" atras="hoy" />
      <main className="contenido">
        <form className="tarjeta formulario" onSubmit={guardar} noValidate>
          <label className="campo">
            <span>¿Qué hay que hacer?</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Por ejemplo: armar pedido de velas" autoFocus />
          </label>

          <fieldset className="campo">
            <legend>Día</legend>
            <div className="chips">
              <button type="button" className={`chip${fecha === hoy ? ' elegido' : ''}`} onClick={() => setFecha(hoy)}>Hoy</button>
              <button type="button" className={`chip${fecha === sumarDias(hoy, 1) ? ' elegido' : ''}`} onClick={() => setFecha(sumarDias(hoy, 1))}>Mañana</button>
            </div>
            <input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} aria-label="Elegir fecha" />
            {fecha && <span className="ayuda">{fechaLarga(fecha)}</span>}
          </fieldset>

          <fieldset className="campo">
            <legend>Horario límite</legend>
            <label className="interruptor">
              <input type="checkbox" checked={conHora} onChange={(e) => setConHora(e.target.checked)} />
              <span className="interruptor-pista" aria-hidden="true" />
              {conHora ? 'Hasta las' : 'Sin horario (vence a las 23:59)'}
            </label>
            {conHora && <input type="time" value={horaLimite} onChange={(e) => setHoraLimite(e.target.value)} aria-label="Hora límite" />}
          </fieldset>

          <fieldset className="campo">
            <legend>Áreas</legend>
            {areasPosibles.length === 0 ? (
              <p className="ayuda">Todavía no estás en ninguna área. Pedile a Cami que te sume.</p>
            ) : (
              <div className="chips">
                {areasPosibles.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`chip${elegidas.includes(a.id) ? ' elegido' : ''}`}
                    style={elegidas.includes(a.id) ? { borderColor: a.color } : undefined}
                    aria-pressed={elegidas.includes(a.id)}
                    onClick={() => alternarArea(a.id)}
                  >
                    {a.emoji} {a.nombre}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <label className="campo">
            <span>Responsable</span>
            {responsables.length > 1 ? (
              <select value={responsableFinal} onChange={(e) => setResponsable(e.target.value)}>
                {responsables.map((p) => <option key={p.id} value={p.id}>{p.id === yo.id ? `${p.nombre} (vos)` : p.nombre}</option>)}
              </select>
            ) : (
              <span className="valor-fijo">{yo.nombre} (vos)</span>
            )}
          </label>

          <label className="campo">
            <span>Detalle (opcional)</span>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} maxLength={1000} placeholder="Algo que convenga saber" />
          </label>

          {error && <p className="error-texto" role="alert">{error}</p>}
          <button className="boton boton-ancho" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar tarea'}</button>
        </form>
      </main>
    </>
  )
}
