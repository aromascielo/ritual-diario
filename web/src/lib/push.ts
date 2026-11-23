// Avisos al celular (push). Las reglas de qué se avisa y cuándo viven en la base (migración avisos).
import { supabase } from './supabase'
import { VAPID_PUBLICA } from './config'

export type EstadoPush = 'sin-soporte' | 'iphone-sin-instalar' | 'bloqueado' | 'apagado' | 'activo'

function esIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function instalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* sin push */ }) })
  // Si el service worker no puede navegar la ventana, le pide a la app que cambie de pantalla.
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.tipo === 'ir' && typeof e.data.url === 'string') window.location.href = e.data.url
  })
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
}

export async function estadoPush(): Promise<EstadoPush> {
  if (esIOS() && !instalada()) return 'iphone-sin-instalar'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sin-soporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const r = await registro()
  const s = await r?.pushManager.getSubscription()
  return s && Notification.permission === 'granted' ? 'activo' : 'apagado'
}

function claveBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(b.length))
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i)
  return bytes
}

/** Pide permiso, suscribe este dispositivo y lo guarda en la base para la persona que entró. */
export async function activarPush(): Promise<EstadoPush> {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'apagado'
  const r = await registro()
  if (!r) return 'sin-soporte'
  await navigator.serviceWorker.ready
  const s = (await r.pushManager.getSubscription())
    ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(VAPID_PUBLICA) }))
  const j = s.toJSON()
  const { error } = await supabase.rpc('guardar_suscripcion', {
    p_endpoint: s.endpoint, p_p256dh: j.keys?.p256dh ?? '', p_auth: j.keys?.auth ?? '', p_user_agent: navigator.userAgent,
  })
  if (error) throw error
  return 'activo'
}

/** Deja de recibir avisos en este dispositivo (también se usa al cerrar sesión). */
export async function desactivarPush(): Promise<void> {
  try {
    const r = await navigator.serviceWorker?.getRegistration()
    const s = await r?.pushManager.getSubscription()
    if (!s) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
    await s.unsubscribe()
  } catch { /* si falla, la base la borra sola cuando el push devuelva 410 */ }
}

/** Manda un aviso de prueba a los dispositivos de quien lo pide. Devuelve cuántos tiene. */
export async function probarAviso(): Promise<number> {
  const { data, error } = await supabase.rpc('probar_aviso')
  if (error) throw error
  return data as number
}

export async function alertasAlCelular(activar: boolean): Promise<void> {
  const { error } = await supabase.rpc('mis_avisos', { p_push_alertas: activar })
  if (error) throw error
}
