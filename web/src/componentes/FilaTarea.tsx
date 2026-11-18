import type { Area, Instancia, Perfil } from '../lib/tipos'
import { fechaCorta, hora, yaPaso } from '../lib/fechas'
import { ir } from '../lib/ruta'

export function Casilla({ estado, deshabilitada, ocupada, alTocar, etiqueta }: {
  estado: Instancia['estado']
  deshabilitada: boolean
  ocupada: boolean
  alTocar: () => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      className={`casilla casilla-${estado}${ocupada ? ' ocupada' : ''}`}
      role="checkbox"
      aria-checked={estado === 'hecha'}
      aria-label={etiqueta}
      disabled={deshabilitada || ocupada || estado === 'omitida'}
      onClick={alTocar}
    >
      {estado === 'hecha' && <span aria-hidden="true">✓</span>}
      {estado === 'omitida' && <span aria-hidden="true">–</span>}
    </button>
  )
}

/** Cuándo vence, en palabras cortas. */
export function textoVencimiento(i: Instancia, conFecha: boolean): string {
  const dia = conFecha ? `${fechaCorta(i.fecha)} · ` : ''
  if (i.sin_horario) return `${dia}sin horario`
  return `${dia}hasta las ${hora(i.fecha_limite)}`
}

export function FilaTarea({ instancia: i, areas, perfiles, mostrarResponsable, conFecha, puedeMarcar, ocupada, alMarcar }: {
  instancia: Instancia
  areas: Map<string, Area>
  perfiles: Map<string, Perfil>
  mostrarResponsable: boolean
  conFecha: boolean
  puedeMarcar: boolean
  ocupada: boolean
  alMarcar: (i: Instancia) => void
}) {
  const vencida = i.estado === 'pendiente' && yaPaso(i.fecha_limite)
  const otras = i.areas.map((a) => areas.get(a)).filter((a): a is Area => !!a)
  return (
    <li className={`fila-tarea${vencida ? ' vencida' : ''} estado-${i.estado}`}>
      <Casilla
        estado={i.estado}
        deshabilitada={!puedeMarcar}
        ocupada={ocupada}
        alTocar={() => alMarcar(i)}
        etiqueta={i.estado === 'hecha' ? `Desmarcar "${i.titulo}"` : `Marcar "${i.titulo}" como hecha`}
      />
      <button type="button" className="fila-texto" onClick={() => ir(`tarea/${i.id}`)}>
        <span className="fila-titulo">{i.titulo}</span>
        <span className="fila-meta">
          {vencida && <span className="marca-vencida">Venció · </span>}
          {i.estado === 'omitida' ? 'Omitida' : textoVencimiento(i, conFecha)}
          {mostrarResponsable && ` · ${perfiles.get(i.responsable_id)?.nombre ?? '—'}`}
          {otras.length > 1 && <span aria-label={`Áreas: ${otras.map((a) => a.nombre).join(', ')}`}> · {otras.map((a) => a.emoji).join(' ')}</span>}
        </span>
      </button>
      <span className="fila-flecha" aria-hidden="true">›</span>
    </li>
  )
}
