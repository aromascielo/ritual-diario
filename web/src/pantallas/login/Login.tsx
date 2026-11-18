import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

const CLAVE_MAIL = 'ritual-diario-ultimo-mail'

/** Traduce los errores de Supabase Auth a mensajes claros. */
function explicar(m: string): string {
  if (/Database error|saving new user|not.*invit/i.test(m)) {
    return 'Ese mail no está invitado a Ritual Diario. Pedile a Cami que te invite.'
  }
  if (/Signups not allowed/i.test(m)) return 'El alta de cuentas está desactivada en Supabase. Avisale a Cami.'
  if (/after \d+ seconds?|only request this after/i.test(m)) {
    const s = m.match(/(\d+) seconds?/)?.[1]
    return `Esperá ${s ?? 'unos'} segundos antes de pedir otro código.`
  }
  if (/rate limit/i.test(m)) return 'Se mandaron muchos mails en poco tiempo. Esperá un rato y probá de nuevo.'
  if (/expired|invalid/i.test(m)) return 'El código no es correcto o ya venció. Revisalo o pedí uno nuevo.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisá internet y probá de nuevo.'
  return m
}

export function Login() {
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(CLAVE_MAIL) ?? '' } catch { return '' }
  })
  const [paso, setPaso] = useState<'mail' | 'codigo'>('mail')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  const mail = email.trim().toLowerCase()

  async function pedirCodigo(e?: FormEvent) {
    e?.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      setError('Escribí un mail válido.')
      return
    }
    setEnviando(true)
    setError(null)
    // shouldCreateUser: true → la primera vez se crea la cuenta, pero la base
    // la rechaza si el mail no está invitado (privado.al_crear_usuario, CLAUDE.md §8).
    const { error: err } = await supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: true } })
    setEnviando(false)
    if (err) {
      setError(explicar(err.message))
      return
    }
    try { localStorage.setItem(CLAVE_MAIL, mail) } catch { /* sin almacenamiento: no pasa nada */ }
    setCodigo('')
    setPaso('codigo')
    setEspera(60)
  }

  async function entrar(e: FormEvent) {
    e.preventDefault()
    const token = codigo.replace(/\D/g, '')
    if (token.length < 6) {
      setError('El código tiene al menos 6 números.')
      return
    }
    setEnviando(true)
    setError(null)
    const { error: err } = await supabase.auth.verifyOtp({ email: mail, token, type: 'email' })
    setEnviando(false)
    if (err) setError(explicar(err.message))
    // Si salió bien, la sesión cambia sola y se muestra la app.
  }

  return (
    <main className="login">
      <div className="login-caja tarjeta">
        <div className="login-logo" aria-hidden="true">🌿</div>
        <h1 className="titulo-serif">Ritual Diario</h1>
        <p className="login-sub">Aromas Cielo · equipo</p>

        {paso === 'mail' ? (
          <form onSubmit={pedirCodigo} noValidate>
            <label className="campo">
              <span>Tu mail</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@gmail.com"
                required
              />
            </label>
            {error && <p className="error-texto" role="alert">{error}</p>}
            <button className="boton boton-ancho" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Recibir código'}
            </button>
            <p className="ayuda centrado">Te llega un código por mail para entrar. Solo pueden entrar personas invitadas.</p>
          </form>
        ) : (
          <form onSubmit={entrar} noValidate>
            <p className="ayuda">Te mandamos un código a <strong>{mail}</strong>. Si no lo ves, revisá Spam o Promociones.</p>
            <label className="campo">
              <span>Código</span>
              <input
                className="input-codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="123456"
                autoFocus
              />
            </label>
            {error && <p className="error-texto" role="alert">{error}</p>}
            <button className="boton boton-ancho" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
            <div className="login-links">
              <button type="button" className="enlace" disabled={espera > 0 || enviando} onClick={() => pedirCodigo()}>
                {espera > 0 ? `Reenviar código (${espera} s)` : 'Reenviar código'}
              </button>
              <button type="button" className="enlace" onClick={() => { setPaso('mail'); setError(null) }}>
                Usar otro mail
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
