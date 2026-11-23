import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { traerObjetivosTodos, type DatosTarea } from '../lib/datos'
import { fechaLarga, hoyISO, sumarDias } from '../lib/fechas'
import { DIAS_CORTOS, NOMBRES_FRECUENCIA } from '../lib/frecuencia'
import { useSesion, usePermisos } from '../lib/sesion'
import type { Frecuencia, Objetivo } from '../lib/tipos'
import { mensajeDeError } from '../lib/supabase'

const FRECUENCIAS: Frecuencia[] = ['unica', 'diaria', 'semanal', 'mensual']

/**
 * Formulario de tarea, para crear y para editar. Solo arma los datos y los valida por arriba:
 * la base (guardar_tarea) vuelve a validar todo, incluidos los permisos.
 */
export function FormTarea({ inicial, nueva, alGuardar, textoBoton }: {
  inicial: DatosTarea
  nueva: boolean
  alGuardar: (t: DatosTarea) => Promise<void>
  textoBoton: string
}) {
  const { yo, areas, perfiles, miembros } = useSesion()
  const { esAdmin, esLider, esMiembro } = usePermisos()
  const hoy = hoyISO()

  const [titulo, setTitulo] = useState(inicial.titulo)
  const [descripcion, setDescripcion] = useState(inicial.descripcion)
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(inicial.frecuencia)
  const [fecha, setFecha] = useState(inicial.fecha ?? hoy)
  const [dias, setDias] = useState<number[]>(inicial.dias.length ? inicial.dias : [1, 2, 3, 4, 5])
  const [diaMes, setDiaMes] = useState<number>(inicial.diaMes ?? 1)
  const [conHora, setConHora] = useState(inicial.hora !== null)
  const [horaLimite, setHoraLimite] = useState(inicial.hora ?? '18:00')
  const [elegidas, setElegidas] = useState<string[]>(inicial.areas)
  const [responsable, setResponsable] = useState(inicial.responsable)
  const [objetivo, setObjetivo] = useState<string | null>(inicial.objetivo)
  const [peso, setPeso] = useState(inicial.peso)
  const [objetivos, setObjetivos] = useState<Objetivo[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    traerObjetivosTodos()
      .then((os) => setObjetivos(os.filter((o) => o.estado === 'activo' && (o.tipo_medicion === 'tareas' || o.tipo_medicion === 'numerico'))))
      .catch(() => setObjetivos([]))
  }, [])

  // Áreas donde puede crear: la admin en todas; el resto, en las suyas (al editar se muestran también las que ya tenía).
  const areasPosibles = useMemo(
    () => areas.filter((a) => (a.activa && (esAdmin || esMiembro(a.id))) || inicial.areas.includes(a.id)),
    [areas, esAdmin, esMiembro, inicial.areas],
  )

  // Líder en todas las áreas elegidas (o admin): puede repetir tareas y asignarlas a otras personas.
  const esLiderDeTodas = esAdmin || (elegidas.length > 0 && elegidas.every((a) => esLider(a)))
  const responsables = useMemo(() => {
    const activos = perfiles.filter((p) => p.activo)
    if (esAdmin) return activos
    if (!esLiderDeTodas) return activos.filter((p) => p.id === yo?.id)
    const ids = new Set(miembros.filter((m) => elegidas.includes(m.area_id)).map((m) => m.profile_id))
    return activos.filter((p) => ids.has(p.id) || p.id === yo?.id)
  }, [perfiles, esAdmin, esLiderDeTodas, miembros, elegidas, yo])

  // Objetivos a los que puede sumar: generales o de alguna de las áreas elegidas (más el que ya tenía).
  const objetivosPosibles = objetivos.filter((o) => !o.area_id || elegidas.includes(o.area_id) || o.id === inicial.objetivo)
  const objetivoElegido = objetivos.find((o) => o.id === objetivo)

  if (!yo) return null
  const responsableFinal = responsables.some((p) => p.id === responsable) ? responsable : yo.id
  const puedeRepetir = esLiderDeTodas || inicial.frecuencia !== 'unica'

  function alternarArea(id: string) {
    setElegidas((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]))
  }
  function alternarDia(d: number) {
    setDias((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d].sort((a, b) => a - b)))
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!titulo.trim()) return setError('Escribí qué hay que hacer.')
    if (elegidas.length === 0) return setError('Elegí al menos un área.')
    if (frecuencia === 'unica' && !fecha) return setError('Elegí el día.')
    if (frecuencia === 'unica' && nueva && fecha < hoy) return setError('La fecha no puede ser anterior a hoy.')
    if (frecuencia === 'semanal' && dias.length === 0) return setError('Elegí al menos un día de la semana.')
    if (frecuencia !== 'unica' && !esLiderDeTodas) {
      return setError('Solo la admin o la líder de todas las áreas elegidas pueden crear tareas que se repiten.')
    }
    setGuardando(true)
    try {
      await alGuardar({
        id: inicial.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        responsable: responsableFinal,
        areas: elegidas,
        frecuencia,
        fecha: frecuencia === 'unica' ? fecha : null,
        dias: frecuencia === 'semanal' ? dias : [],
        diaMes: frecuencia === 'mensual' ? diaMes : null,
        hora: conHora ? horaLimite : null,
        objetivo: objetivoElegido && objetivosPosibles.includes(objetivoElegido) ? objetivo : null,
        peso: objetivoElegido?.tipo_medicion === 'tareas' ? peso : 1,
      })
    } catch (err) {
      setError(mensajeDeError(err))
      setGuardando(false)
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={guardar} noValidate>
      <label className="campo">
        <span>¿Qué hay que hacer?</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Por ejemplo: armar pedido de velas" autoFocus={nueva} />
      </label>

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

      <fieldset className="campo">
        <legend>¿Cuándo?</legend>
        <div className="chips" role="radiogroup" aria-label="Frecuencia">
          {FRECUENCIAS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={frecuencia === f}
              className={`chip${frecuencia === f ? ' elegido' : ''}`}
              disabled={f !== 'unica' && !puedeRepetir}
              onClick={() => setFrecuencia(f)}
            >
              {NOMBRES_FRECUENCIA[f]}
            </button>
          ))}
        </div>
        {!puedeRepetir && <span className="ayuda">Las tareas que se repiten las crean la admin o la líder del área.</span>}

        {frecuencia === 'unica' && (
          <>
            <div className="chips">
              <button type="button" className={`chip${fecha === hoy ? ' elegido' : ''}`} onClick={() => setFecha(hoy)}>Hoy</button>
              <button type="button" className={`chip${fecha === sumarDias(hoy, 1) ? ' elegido' : ''}`} onClick={() => setFecha(sumarDias(hoy, 1))}>Mañana</button>
            </div>
            <input type="date" value={fecha} min={nueva ? hoy : undefined} onChange={(e) => setFecha(e.target.value)} aria-label="Elegir fecha" />
            {fecha && <span className="ayuda">{fechaLarga(fecha)}</span>}
          </>
        )}
        {frecuencia === 'semanal' && (
          <div className="chips dias" role="group" aria-label="Días de la semana">
            {DIAS_CORTOS.map((d, i) => (
              <button key={d} type="button" className={`chip chip-dia${dias.includes(i + 1) ? ' elegido' : ''}`}
                aria-pressed={dias.includes(i + 1)} onClick={() => alternarDia(i + 1)}>
                {d}
              </button>
            ))}
          </div>
        )}
        {frecuencia === 'mensual' && (
          <label className="campo">
            <span className="solo-lectores">Día del mes</span>
            <select value={diaMes} onChange={(e) => setDiaMes(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>El día {d}</option>)}
              <option value={0}>El último día del mes</option>
            </select>
            {diaMes > 28 && <span className="ayuda">Si un mes no tiene el día {diaMes}, se hace el último día de ese mes.</span>}
          </label>
        )}
        {frecuencia !== 'unica' && (
          <span className="ayuda">Los días se cargan solos con 2 semanas de anticipación.</span>
        )}
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

      <label className="campo">
        <span>Responsable</span>
        {responsables.length > 1 ? (
          <select value={responsableFinal} onChange={(e) => setResponsable(e.target.value)}>
            {responsables.map((p) => <option key={p.id} value={p.id}>{p.id === yo.id ? `${p.nombre} (vos)` : p.nombre}</option>)}
          </select>
        ) : (
          <span className="valor-fijo">{perfiles.find((p) => p.id === responsableFinal)?.nombre ?? yo.nombre}{responsableFinal === yo.id ? ' (vos)' : ''}</span>
        )}
      </label>

      {objetivosPosibles.length > 0 && (
        <label className="campo">
          <span>Suma a un objetivo (opcional)</span>
          <select value={objetivo ?? ''} onChange={(e) => setObjetivo(e.target.value || null)}>
            <option value="">No suma a ningún objetivo</option>
            {objetivosPosibles.map((o) => <option key={o.id} value={o.id}>🎯 {o.titulo}</option>)}
          </select>
          {objetivoElegido?.tipo_medicion === 'numerico' && (
            <span className="ayuda">Al tildarla te va a preguntar "¿cuántos?" y lo suma al objetivo.</span>
          )}
          {objetivoElegido?.tipo_medicion === 'tareas' && (
            <span className="fila-peso">
              <span className="ayuda">¿Cuánto pesa en el objetivo?</span>
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" className={`chip${peso === n ? ' elegido' : ''}`} aria-pressed={peso === n} onClick={() => setPeso(n)}>
                  {n === 1 ? 'Normal' : n === 2 ? 'Doble' : 'Triple'}
                </button>
              ))}
            </span>
          )}
        </label>
      )}

      <label className="campo">
        <span>Detalle (opcional)</span>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} maxLength={1000} placeholder="Algo que convenga saber" />
      </label>

      {!nueva && (
        <p className="ayuda">Los cambios se aplican desde hoy. Los días anteriores quedan como estaban.</p>
      )}
      {error && <p className="error-texto" role="alert">{error}</p>}
      <button className="boton boton-ancho" disabled={guardando}>{guardando ? 'Guardando…' : textoBoton}</button>
    </form>
  )
}
