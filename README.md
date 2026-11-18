# Ritual Diario v2 — guía para Cami

Esta carpeta tiene la **versión nueva** de la app. La app que usa Laura hoy (carpeta `claufer`, en Netlify) sigue igual
hasta que la nueva esté probada.

- **Qué hace la app y cómo funciona:** `CLAUDE.md`
- **En qué fase estamos y qué falta:** `docs/PLAN.md`
- **La app en sí:** carpeta `web/` (Claude escribe todo el código)

---

## Pasos pendientes para vos (fase 2)

### 1 y 2. Mail con código y dirección de prueba — ✅ hechos (18 nov 2026)

Claude los configuró desde el navegador de la app de Claude:
- **Supabase** (proyecto ritual-diario → Authentication → Emails): los mails salen desde el Gmail de Aromas Cielo
  (SMTP) y las plantillas **Confirm sign up** y **Magic link or OTP** traen el código.
  Si algún día cambiás la contraseña de Gmail o borrás la contraseña de aplicación "Supabase Ritual Diario",
  hay que crear una nueva y pegarla en **SMTP Settings → Password**.
- **Cloudflare** (Workers & Pages → ritual-diario): conectado a GitHub (solo el repositorio ritual-diario).
  Cada cambio que Claude sube se publica solo en **https://ritual-diario.aromascielo.workers.dev**.

### 3. Probar en el celular

1. Abrí **https://ritual-diario.aromascielo.workers.dev** en el celular (Chrome en Android).
2. Menú **⋮** → **Agregar a la pantalla principal** (o **Instalar app**).
3. Abrí la app desde el ícono, escribí `aromascielo@gmail.com`, tocá **Recibir código** y copiá el código del mail.
4. Probá: agregar una tarea para hoy y otra para mañana, tildarla, abrir una tarea, omitirla con un motivo, volverla a pendiente y comentar.
5. Contale a Claude qué anduvo, qué no y qué cambiarías.

---

## Cómo se prueban los cambios

No necesitás instalar nada. Cada cambio se publica en la dirección de prueba de Cloudflare.
La app de Laura (Netlify) no se toca hasta la fase 6.
