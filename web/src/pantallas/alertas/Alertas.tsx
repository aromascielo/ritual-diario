import { Encabezado, Cargando, ErrorCarga, Vacio } from '../../componentes/Piezas'
import { destinoAlerta, useAlertas, type Alerta } from '../../lib/alertas'
import { fechaHora } from '../../lib/fechas'
import { ir } from '../../lib/ruta'
import { usePermisos } from '../../lib/sesion'

const TIPOS: Record<string, string> = {
  tarea_vencida: 'Vencida',
  tarea_omitida: 'Omitida',
  tarea_eliminada: 'Eliminada',
  objetivo_atrasado: 'Objetivo atrasado',
  area_bajo_cumplimiento: 'Área bajo 70 %',
  comentario: 'Comentario',
}

/** Alertas del equipo (solo admin): en vivo, las nuevas arriba. Tocar una la marca leída y abre lo que corresponde. */
export function Alertas() {
  const { esAdmin } = usePermisos()
  const { lista, noLeidas, error, cargar, marcarLeida, leerTodas } = useAlertas()

  if (!esAdmin) {
    return (
      <>
        <Encabezado titulo="Alertas" atras="hoy" />
        <main className="contenido"><Vacio emoji="🔒">Las alertas del equipo son solo para la admin.</Vacio></main>
      </>
    )
  }

  function abrir(a: Alerta) {
    if (!a.leida) marcarLeida(a.id)
    const destino = destinoAlerta(a)
    if (destino) ir(destino)
  }

  return (
    <>
      <Encabezado titulo="Alertas" atras="hoy" />
      <main className="contenido">
        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {!lista && !error && <Cargando />}
        {lista && noLeidas > 0 && (
          <button className="enlace" onClick={leerTodas}>Marcar todas como leídas ({noLeidas})</button>
        )}
        {lista && lista.length > 0 && (
          <ul className="lista-config">
            {lista.map((a) => (
              <li key={a.id}>
                <button className={`tarjeta fila-config alerta${a.leida ? ' leida' : ''}`} onClick={() => abrir(a)}>
                  <span className="fila-config-texto">
                    <span className="alerta-cabeza">
                      {!a.leida && <span className="punto-nueva" aria-label="Sin leer" />}
                      <span className="ayuda">{TIPOS[a.tipo] ?? 'Aviso'} · {fechaHora(a.created_at)}</span>
                    </span>
                    <strong>{a.titulo}</strong>
                    {a.cuerpo && <span className="ayuda">{a.cuerpo}</span>}
                  </span>
                  {destinoAlerta(a) && <span className="fila-flecha" aria-hidden="true">›</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {lista && lista.length === 0 && <Vacio emoji="🌿">No hay alertas. Todo tranquilo por ahora.</Vacio>}
        <p className="ayuda">Acá aparecen las tareas vencidas, omitidas o eliminadas por otra persona, los objetivos atrasados
          y las áreas que cierran la semana por debajo del 70 % al día.</p>
      </main>
    </>
  )
}
