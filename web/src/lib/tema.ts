// Apariencia: claro, oscuro o automático (según el celular). CLAUDE.md §12.
export type Tema = 'claro' | 'oscuro' | 'auto'
const CLAVE = 'ritual-diario-tema'

export function temaGuardado(): Tema {
  try {
    const t = localStorage.getItem(CLAVE)
    return t === 'claro' || t === 'oscuro' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function aplicarTema(t: Tema): void {
  const raiz = document.documentElement
  if (t === 'auto') raiz.removeAttribute('data-tema')
  else raiz.setAttribute('data-tema', t)
  try { localStorage.setItem(CLAVE, t) } catch { /* nada */ }
}
