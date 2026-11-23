// Función "notificaciones": vacía la cola de avisos (privado.push_cola) y manda los push.
// La llaman el cron de cada hora y los disparadores (comentarios, "Probar aviso") con la clave de Vault.
// Se conecta directo a la base (SUPABASE_DB_URL): todas las reglas viven en SQL (migración avisos).
// Si un push devuelve 404 o 410, el celular ya no existe: se borra su suscripción (CLAUDE.md §7).
import postgres from 'npm:postgres@3.4.5'
import webpush from 'npm:web-push@3.6.7'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1, idle_timeout: 20 })

interface Fila {
  cola_id: string
  titulo: string
  cuerpo: string | null
  url: string
  endpoint: string
  p256dh: string
  auth: string
}

Deno.serve(async (req) => {
  try {
    const clave = req.headers.get('x-clave') ?? ''
    const [{ ok }] = await sql`select privado.clave_envio_ok(${clave}) as ok`
    if (!ok) return new Response('Sin permiso', { status: 401 })

    const [cfg] = await sql`select * from privado.config_push()`
    if (!cfg?.publica || !cfg?.privada) return new Response('Faltan las claves VAPID', { status: 500 })
    webpush.setVapidDetails(cfg.sujeto ?? 'mailto:aromascielo@gmail.com', cfg.publica, cfg.privada)

    const filas = await sql<Fila[]>`select * from privado.tomar_cola()`
    let enviados = 0
    const vencidas: string[] = []
    const errores: string[] = []

    await Promise.all(filas.map(async (f) => {
      const datos = JSON.stringify({ titulo: f.titulo, cuerpo: f.cuerpo ?? '', url: f.url, tag: f.cola_id })
      try {
        await webpush.sendNotification({ endpoint: f.endpoint, keys: { p256dh: f.p256dh, auth: f.auth } }, datos,
          { TTL: 60 * 60 * 12, urgency: 'normal' })
        enviados++
      } catch (e) {
        const estado = (e as { statusCode?: number }).statusCode
        if (estado === 404 || estado === 410) vencidas.push(f.endpoint)
        else errores.push(`${estado ?? '?'}: ${(e as Error).message}`.slice(0, 200))
      }
    }))

    if (vencidas.length > 0) {
      await sql`delete from public.push_subscriptions where endpoint = any(${vencidas})`
    }
    return Response.json({ enviados, suscripciones_borradas: vencidas.length, errores })
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, { status: 500 })
  }
})
