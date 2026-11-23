import type { Area, RolArea } from '../lib/tipos'

const SIGUIENTE: Record<string, RolArea | null> = { ninguno: 'miembro', miembro: 'lider', lider: null }
const TEXTO: Record<string, string> = { ninguno: 'No está', miembro: 'Miembro', lider: 'Líder' }

/** Cada área con un botón que alterna: No está → Miembro → Líder → No está. */
export function ElegirAreasRol({ areas, roles, alCambiar, deshabilitado }: {
  areas: Area[]
  roles: Record<string, RolArea | undefined>
  alCambiar: (area: string, rol: RolArea | null) => void
  deshabilitado?: boolean
}) {
  return (
    <ul className="areas-rol">
      {areas.map((a) => {
        const actual = roles[a.id] ?? 'ninguno'
        return (
          <li key={a.id}>
            <span className="areas-rol-nombre"><span aria-hidden="true">{a.emoji}</span> {a.nombre}</span>
            <button
              type="button"
              className={`chip chip-rol rol-${actual}`}
              disabled={deshabilitado}
              aria-label={`${a.nombre}: ${TEXTO[actual]}. Tocá para cambiar.`}
              onClick={() => alCambiar(a.id, SIGUIENTE[actual])}
            >
              {TEXTO[actual]}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
