// Service worker de Ritual Diario: recibe los push y abre la tarea al tocarlos (CLAUDE.md §7).
// No guarda nada en caché: la app siempre se carga fresca desde Cloudflare.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { cuerpo: e.data ? e.data.text() : '' } }
  const titulo = d.titulo || 'Ritual Diario'
  e.waitUntil(self.registration.showNotification(titulo, {
    body: d.cuerpo || '',
    icon: '/icono-192.png',
    badge: '/icono-192.png',
    tag: d.tag || undefined,
    lang: 'es-AR',
    data: { url: d.url || '/#/hoy' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = new URL(e.notification.data?.url || '/#/hoy', self.location.origin).href
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of abiertas) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus()
        try { await c.navigate(destino) } catch { c.postMessage({ tipo: 'ir', url: destino }) }
        return
      }
    }
    await self.clients.openWindow(destino)
  })())
})
