# Ritual Diario v2 — guía para Cami

Esta carpeta tiene la **versión nueva** de la app. La app que usa Laura hoy (carpeta `claufer`, en Netlify) sigue igual
hasta que la nueva esté probada.

- **Qué hace la app y cómo funciona:** `CLAUDE.md`
- **En qué fase estamos y qué falta:** `docs/PLAN.md`
- **La app en sí:** carpeta `web/` (Claude escribe todo el código)

---

## Pasos pendientes para vos (fase 2)

### 1. Que el mail traiga un código (Supabase, 5 minutos)

Supabase manda por defecto un link. Hay que cambiar dos plantillas para que mande un código de números.

1. Entrá a **https://supabase.com/dashboard** y abrí el proyecto **ritual-diario** (no el viejo "aromascielo's app").
2. En el menú de la izquierda tocá **Authentication** y después **Emails** (en algunas versiones se llama **Email Templates**).
3. Tocá la plantilla **Confirm signup** (es el mail del primer ingreso).
4. En **Subject** escribí: `Tu código para entrar a Ritual Diario`
5. En el cuadro grande del mensaje (**Message body**) borrá todo y pegá esto:

   ```html
   <h2>Ritual Diario · Aromas Cielo</h2>
   <p>Tu código para entrar es:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Escribilo en la app. Si no lo pediste, ignorá este mail.</p>
   ```

6. Tocá **Save changes**.
7. Repetí los pasos 4 a 6 en la plantilla **Magic Link** (es el mail de los ingresos siguientes).
8. En el mismo menú **Authentication**, abrí **Sign In / Providers** (o **Providers**) → **Email** y revisá que
   **Allow new users to sign up** esté **activado**. Tranqui: solo pueden entrar los mails invitados; la base rechaza al resto.
9. En **Authentication** → **Emails** fijate si hay una sección **SMTP Settings** con el Gmail de Aromas Cielo cargado.
   Si **no** está, igual podés probar: Supabase manda pocos mails por hora y solo a mails del equipo de Supabase.
   Para cuando se sume Laura conviene configurarlo; Claude te guía ese día.

### 2. Publicar la app en una dirección de prueba (Cloudflare, 10 minutos)

1. Entrá a **https://dash.cloudflare.com** (si no tenés cuenta, creá una gratis con el Gmail de Aromas Cielo).
2. En el menú de la izquierda tocá **Workers & Pages** (puede estar dentro de **Compute**).
3. Tocá **Create application** (o **Create**).
4. Al lado de **Import a repository** tocá **Get started**. Ojo: tiene que ser un **Worker**; si la pantalla dice "Pages", volvé atrás.
5. Elegí **GitHub** y tocá **Connect GitHub** (o **Add account**). Se abre GitHub:
   - Elegí la cuenta **aromascielo**.
   - En "Repository access" elegí **Only select repositories** y marcá **ritual-diario**.
   - Tocá **Install & Authorize**.
6. De vuelta en Cloudflare, elegí el repositorio **ritual-diario**.
7. Completá la configuración así:
   - **Project name**: `ritual-diario` (tiene que ser exactamente este nombre).
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy` (suele venir escrito).
   - Abrí **Advanced settings** y en **Root directory** (o **Path**) escribí: `web`
8. Tocá **Save and Deploy** (o **Deploy**) y esperá 1 o 2 minutos.
9. Cuando termine, Cloudflare te muestra una dirección del tipo `https://ritual-diario.<algo>.workers.dev`. **Copiala y pasásela a Claude.**

Desde ahí, cada cambio que Claude suba a GitHub se publica solo en esa misma dirección.

### 3. Probar en el celular

1. Abrí la dirección en el celular (Chrome en Android).
2. Menú **⋮** → **Agregar a la pantalla principal** (o **Instalar app**).
3. Abrí la app desde el ícono, escribí `aromascielo@gmail.com`, tocá **Recibir código** y copiá el código del mail.
4. Probá: agregar una tarea para hoy y otra para mañana, tildarla, abrir una tarea, omitirla con un motivo, volverla a pendiente y comentar.
5. Contale a Claude qué anduvo, qué no y qué cambiarías.

---

## Cómo se prueban los cambios

No necesitás instalar nada. Cada cambio se publica en la dirección de prueba de Cloudflare.
La app de Laura (Netlify) no se toca hasta la fase 6.
