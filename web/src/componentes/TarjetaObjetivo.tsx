import { Barra } from './Piezas'
import { diasRestantes, formatoValor, numero } from '../lib/formato'
import { ir } from '../lib/ruta'
import type { Area, Avance, Objetivo } from '../lib/tipos'

/** "En camino", "Atrasado", "Cumplido"… según lo que calculó la base. */
export function estadoObjetivo(o: Objetivo, a: Avance | undefined): { texto: string; clase: string } {
  if (o.estado === 'cumplido') return { texto: '✓ Cumplido', clase: 'ok' }
  if (o.estado === 'archivado') return { texto: 'Archivado', clase: 'gris' }
  if (diasRestantes(o.fecha_inicio) > 0) return { texto: 'Todavía no empezó', clase: 'gris' }
  if (a?.atrasado) return { texto: 'Atrasado', clase: 'atrasado' }
  if (a?.porcentaje != null && a.porcentaje >= 100) return { texto: '¡Meta alcanzada!', clase: 'ok' }
  if (a?.valor == null) return { texto: 'Sin datos todavía', clase: 'gris' }
  return { texto: 'En camino', clase: 'encamino' }
}

export function TarjetaObjetivo({ o, a, area }: { o: Objetivo; a: Avance | undefined; area: Area | undefined }) {
  const estado = estadoObjetivo(o, a)
  const quedan = diasRestantes(o.evaluacion === 'mensual' && a ? a.hasta : o.fecha_fin)
  return (
    <li>
      <button className="tarjeta objetivo" onClick={() => ir(`objetivo/${o.id}`)}>
        <div className="objetivo-cabeza">
          <h3 className="objetivo-titulo">{o.titulo}</h3>
          <span className={`etiqueta-estado ${estado.clase}`}>{estado.texto}</span>
        </div>
        <Barra porcentaje={a?.porcentaje ?? null} ritmo={a?.ritmo} atrasado={a?.atrasado} />
        <p className="objetivo-numeros">
          <strong>{formatoValor(o, a?.valor)}</strong>
          {a?.meta != null && <> de {formatoValor(o, a.meta)}</>}
          {a?.porcentaje != null && <> · {numero.format(a.porcentaje)} %</>}
          {o.evaluacion === 'mensual' && <> · este mes</>}
        </p>
        <p className="objetivo-pie">
          {area ? `${area.emoji} ${area.nombre}` : '🌐 General'}
          {o.estado === 'activo' && quedan >= 0 && <> · {quedan === 0 ? 'termina hoy' : quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`}</>}
        </p>
      </button>
    </li>
  )
}
