import { useEffect, useState, type FormEvent } from 'react'
import { Encabezado, Cargando, Vacio } from '../../componentes/Piezas'
import { useAvisar } from '../../componentes/Avisos'
import { guardarObjetivo, traerObjetivo, type DatosObjetivo } from '../../lib/datos'
import { finSemana, hoyISO, inicioSemana, sumarDias } from '../../lib/fechas'
import { AYUDA_MEDICION, NOMBRES_CANAL, NOMBRES_MEDICION } from '../../lib/formato'
import { ir, volver } from '../../lib/ruta'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Canal, Objetivo, TipoMedicion } from '../../lib/tipos'

const TIPOS: TipoMedicion[] = ['numerico', 'tareas', 'ventas', 'proporcion_ventas', 'clientes_mayoristas', 'cumplimiento']

function finDeMes(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) // fecha armada en UTC a propósito
}
function inicioDeMes(iso: string): string { return iso.slice(0, 8) + '01' }

/** Crear (id = 'nuevo') o editar un objetivo. La base valida los permisos (RLS de objectives). */
export function FormObjetivo({ id }: { id: string }) {
  const { yo, areas } = useSesion()
  const { esAdmin, esLider, puedeEditarObjetivo } = usePermisos()
  const avisar = useAvisar()
  const nuevo = id === 'nuevo'
  const hoy = hoyISO()
  const [original, setOriginal] = useState<Objetivo | null | undefined>(nuevo ? null : undefined)

  const misAreasLider = areas.filter((a) => a.activa && (esAdmin || esLider(a.id)))
  const [d, setD] = useState<DatosObjetivo>({
    area_id: esAdmin ? null : misAreasLider[0]?.id ?? null,
    titulo: '', descripcion: '', periodo: 'mensual',
    fecha_inicio: inicioDeMes(hoy), fecha_fin: finDeMes(hoy),
    tipo_medicion: 'numerico', evaluacion: 'periodo', meta_numerica: null, unidad: '', canal_ventas: null, valor_base: null,
  })
  const [meta, setMeta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (nuevo) return
    traerObjetivo(id).then((o) => {
      setOriginal(o)
      if (o) {
        setD({
          area_id: o.area_id, titulo: o.titulo, descripcion: o.descripcion ?? '', periodo: o.periodo,
          fecha_inicio: o.fecha_inicio, fecha_fin: o.fecha_fin, tipo_medicion: o.tipo_medicion, evaluacion: o.evaluacion,
          meta_numerica: o.meta_numerica, unidad: o.unidad ?? '', canal_ventas: o.canal_ventas, valor_base: o.valor_base,
        })
        setMeta(o.meta_numerica != null ? String(o.meta_numerica).replace('.', ',') : '')
      }
    }).catch((e) => setError(mensajeDeError(e)))
  }, [id, nuevo])

  const titulo = nuevo ? 'Nuevo objetivo' : 'Editar objetivo'
  if (!yo) return null
  if (original === undefined) return (<><Encabezado titulo={titulo} atras="objetivos" /><main className="contenido">{error ? <Vacio emoji="⚠️">{error}</Vacio> : <Cargando />}</main></>)
  if (!nuevo && (!original || !puedeEditarObjetivo(original))) {
    return (<><Encabezado titulo={titulo} atras="objetivos" /><main className="contenido"><Vacio emoji="🔒">No podés editar este objetivo.</Vacio></main></>)
  }
  if (nuevo && misAreasLider.length === 0 && !esAdmin) {
    return (<><Encabezado titulo={titulo} atras="objetivos" /><main className="contenido"><Vacio emoji="🔒">Los objetivos los crean la admin o la líder de un área.</Vacio></main></>)
  }

  const cambiar = <K extends keyof DatosObjetivo>(k: K, v: DatosObjetivo[K]) => setD((x) => ({ ...x, [k]: v }))
  const usaMeta = d.tipo_medicion !== 'tareas'
  const usaCanal = d.tipo_medicion === 'ventas' || d.tipo_medicion === 'proporcion_ventas'
  const esDePlan = !!original?.plan_id

  function rango(desde: string, hasta: string, periodo: string) {
    setD((x) => ({ ...x, fecha_inicio: desde, fecha_fin: hasta, periodo }))
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const m = meta.trim() ? Number(meta.replace(/\./g, '').replace(',', '.')) : null
    if (!d.titulo.trim()) return setError('Escribí el objetivo.')
    if (!esAdmin && !d.area_id) return setError('Elegí el área.')
    if (d.fecha_fin < d.fecha_inicio) return setError('La fecha de fin tiene que ser después del inicio.')
    if (usaMeta && !(m && m > 0)) return setError('Escribí la meta (un número mayor que cero).')
    if (d.tipo_medicion === 'proporcion_ventas' && !d.canal_ventas) return setError('Elegí el canal.')
    if ((d.tipo_medicion === 'proporcion_ventas' || d.tipo_medicion === 'cumplimiento') && m && m > 100) return setError('Es un porcentaje: la meta va de 1 a 100.')
    const unidad = d.tipo_medicion === 'ventas' ? '$' : d.tipo_medicion === 'clientes_mayoristas' ? 'clientes'
      : ['tareas', 'proporcion_ventas', 'cumplimiento'].includes(d.tipo_medicion) ? '%' : (d.unidad ?? '')
    const periodo = d.fecha_inicio === inicioDeMes(d.fecha_inicio) && d.fecha_fin === finDeMes(d.fecha_inicio) ? 'mensual'
      : d.fecha_inicio === inicioSemana(d.fecha_inicio) && d.fecha_fin === finSemana(d.fecha_inicio) ? 'semanal' : 'personalizado'
    setGuardando(true)
    try {
      const nuevoId = await guardarObjetivo(nuevo ? null : id, {
        ...d, periodo, unidad, meta_numerica: usaMeta ? m : null, canal_ventas: usaCanal ? d.canal_ventas : null,
      }, yo!.id)
      avisar(nuevo ? 'Objetivo creado 🎯' : 'Cambios guardados')
      if (nuevo) ir(`objetivo/${nuevoId}`); else volver('objetivos')
    } catch (err) {
      setError(mensajeDeError(err))
      setGuardando(false)
    }
  }

  return (
    <>
      <Encabezado titulo={titulo} atras="objetivos" />
      <main className="contenido">
        <form className="tarjeta formulario" onSubmit={guardar} noValidate>
          <label className="campo"><span>Objetivo</span>
            <input value={d.titulo} onChange={(e) => cambiar('titulo', e.target.value)} maxLength={120} placeholder="Por ejemplo: vender 40 velas en la feria" autoFocus={nuevo} />
          </label>
          <label className="campo"><span>Detalle (opcional)</span>
            <textarea value={d.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} rows={2} maxLength={500} />
          </label>

          {!esDePlan && (
            <label className="campo"><span>Área</span>
              <select value={d.area_id ?? ''} onChange={(e) => cambiar('area_id', e.target.value || null)}>
                {esAdmin && <option value="">🌐 General (de todo el equipo)</option>}
                {misAreasLider.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.nombre}</option>)}
              </select>
            </label>
          )}

          <fieldset className="campo">
            <legend>¿Cómo se mide?</legend>
            <select value={d.tipo_medicion} disabled={esDePlan} onChange={(e) => cambiar('tipo_medicion', e.target.value as TipoMedicion)}>
              {TIPOS.map((t) => <option key={t} value={t}>{NOMBRES_MEDICION[t]}</option>)}
            </select>
            <span className="ayuda">{AYUDA_MEDICION[d.tipo_medicion]}</span>
          </fieldset>

          {usaCanal && (
            <fieldset className="campo">
              <legend>Canal</legend>
              <div className="chips">
                {d.tipo_medicion === 'ventas' && (
                  <button type="button" className={`chip${!d.canal_ventas ? ' elegido' : ''}`} onClick={() => cambiar('canal_ventas', null)}>Todos</button>
                )}
                {(Object.keys(NOMBRES_CANAL) as Canal[])
                  .filter((c) => d.tipo_medicion === 'ventas' || c !== 'mayorista')
                  .map((c) => (
                    <button key={c} type="button" className={`chip${d.canal_ventas === c ? ' elegido' : ''}`} onClick={() => cambiar('canal_ventas', c)}>
                      {NOMBRES_CANAL[c]}
                    </button>
                  ))}
              </div>
            </fieldset>
          )}

          {usaMeta && (
            <div className="fila-form">
              <label className="campo crece"><span>Meta</span>
                <input inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)}
                  placeholder={d.tipo_medicion === 'ventas' ? '800000' : ['proporcion_ventas', 'cumplimiento'].includes(d.tipo_medicion) ? '80' : '40'} />
              </label>
              {d.tipo_medicion === 'numerico' && (
                <label className="campo crece"><span>Unidad</span>
                  <input value={d.unidad ?? ''} onChange={(e) => cambiar('unidad', e.target.value)} maxLength={20} placeholder="velas, posteos…" />
                </label>
              )}
            </div>
          )}

          <fieldset className="campo">
            <legend>Período</legend>
            <div className="chips">
              <button type="button" className="chip" onClick={() => rango(inicioSemana(hoy), finSemana(hoy), 'semanal')}>Esta semana</button>
              <button type="button" className="chip" onClick={() => rango(inicioDeMes(hoy), finDeMes(hoy), 'mensual')}>Este mes</button>
              <button type="button" className="chip" onClick={() => { const s = sumarDias(finDeMes(hoy), 1); rango(s, finDeMes(s), 'mensual') }}>El mes que viene</button>
            </div>
            <div className="fila-form">
              <label className="campo crece"><span>Desde</span>
                <input type="date" value={d.fecha_inicio} onChange={(e) => cambiar('fecha_inicio', e.target.value)} />
              </label>
              <label className="campo crece"><span>Hasta</span>
                <input type="date" value={d.fecha_fin} min={d.fecha_inicio} onChange={(e) => cambiar('fecha_fin', e.target.value)} />
              </label>
            </div>
          </fieldset>

          {d.fecha_fin.slice(0, 7) !== d.fecha_inicio.slice(0, 7) && (
            <fieldset className="campo">
              <legend>¿La meta es…</legend>
              <div className="chips" role="radiogroup">
                <button type="button" role="radio" aria-checked={d.evaluacion === 'periodo'} className={`chip${d.evaluacion === 'periodo' ? ' elegido' : ''}`} onClick={() => cambiar('evaluacion', 'periodo')}>Para todo el período</button>
                <button type="button" role="radio" aria-checked={d.evaluacion === 'mensual'} className={`chip${d.evaluacion === 'mensual' ? ' elegido' : ''}`} onClick={() => cambiar('evaluacion', 'mensual')}>Para cada mes</button>
              </div>
            </fieldset>
          )}

          {esDePlan && <p className="ayuda">Este objetivo es parte del Plan VEA: se puede cambiar el texto, la meta y las fechas.</p>}
          {error && <p className="error-texto" role="alert">{error}</p>}
          <button className="boton boton-ancho" disabled={guardando}>{guardando ? 'Guardando…' : nuevo ? 'Crear objetivo' : 'Guardar cambios'}</button>
        </form>
      </main>
    </>
  )
}
