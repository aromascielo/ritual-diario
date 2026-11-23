# Ritual Diario v2 — App de tareas y objetivos del equipo Aromas Cielo

> Especificación viva del proyecto. Claude la lee siempre antes de trabajar en esta carpeta.
> Si una decisión cambia, se actualiza **este archivo** en el mismo cambio que la implementa.
> Versión: 2.5 · Última revisión: 23 nov 2026 (fase 5: Áreas, Equipo, campana y push)

---

## 1. Qué es

App web instalable en el celular (PWA) para el equipo interno de **Aromas Cielo** (cosmética natural y vegana, Neuquén).
Cada persona ve sus tareas del día, las marca como hechas y ve cómo eso alimenta los objetivos del negocio,
incluido el **plan VEA** (visión, evaluación y agenda) a abril de 2027.

- Idioma: español de Argentina, con **voseo** y tono cálido.
- Zona horaria: `America/Argentina/Buenos_Aires` (UTC-3). Se define **en un solo lugar** del código (ver §9).
- Alcance: **un solo emprendimiento** (Aromas Cielo). "Crecer" significa sumar más personas al equipo,
  no usar la app en otras empresas. No hay multi-empresa.

### Esta carpeta vs. la app vieja
- La app vieja (`C:\Users\camil\claufer`, publicada en `claufer.netlify.app`, Supabase `aromascielo's app`)
  **no se toca**. Laura la sigue usando hasta el cambio (fase 6).
- Todo el trabajo nuevo ocurre en esta carpeta y en el proyecto Supabase `ritual-diario`.

---

## 2. Personas y roles

| Persona | Rol global | Áreas | Notas |
|---|---|---|---|
| Camila (Cami) | **admin** — directora y creadora | Todas | Encargada también de Redes, Campañas y Publicidad junto con Candela |
| Laura | integrante, **carga ventas** (encargada del showroom) | Producción, Tienda online, Mayorista / B2B, Campañas creativas, Logística y envíos — **líder** en todas ellas | Android |
| Candela | integrante (CM) | Redes y contenido orgánico, Campañas creativas, Publicidad paga — **líder** en las tres | Se suma en ~2 meses (ene 2027). Usa **iPhone**: es la única con iPhone, así que el push en iPhone se prueba cuando se sume |

Los mails **no** se guardan en el repositorio: las personas se dan de alta desde la app (Configuración → Personas).

### Roles
- **admin**: puede todo.
- **líder de área**: rol *por área* (columna `rol_area` en `area_members`). Pensado para dar autonomía sin ser admin.
- **miembro de área**: hace sus tareas en esa área.

Se usa un rol por área (y no una excepción para Laura) para que al sumar gente solo haya que asignarle áreas y rol desde la app.

### Permisos

| Acción | Admin | Líder del área | Miembro |
|---|---|---|---|
| Ver todo (áreas, tareas, objetivos, VEA, equipo) | ✅ | ✅ | ✅ |
| Marcar hecha / omitida una tarea propia | ✅ | ✅ | ✅ |
| Marcar hecha / omitida una tarea de otra persona | ✅ | ❌ | ❌ |
| Comentar cualquier tarea | ✅ | ✅ | ✅ |
| Crear tareas (únicas **y recurrentes**) en el área | ✅ | ✅ | Solo únicas, para sí misma |
| Asignar tareas a otra persona del área | ✅ | ✅ | ❌ |
| Editar / eliminar una tarea | ✅ todas | Las que **creó** o de las que es **responsable** | Las únicas que creó ella |
| Crear / editar objetivos del área | ✅ | ✅ | ❌ |
| Objetivos generales y plan VEA | ✅ | ❌ | ❌ |
| Cargar ventas (VEA) | ✅ | Solo si la persona tiene el permiso "carga ventas" (Laura sí) | Igual |
| Áreas y personas (alta, edición, baja, roles) | ✅ | ❌ | ❌ |
| Campana de alertas del equipo | ✅ | ❌ | ❌ |

Toda regla de permisos se aplica **en la base de datos (RLS)**. La app solo oculta botones; nunca es la única barrera.

---

## 3. Áreas

| # | Área | Color | Emoji |
|---|---|---|---|
| 1 | Producción — velas, difusores, cosmética sólida, pedidos mayoristas (10 días de producción) | `#6F7C12` oliva | 🕯️ |
| 2 | Tienda online — fichas, stock en Tiendanube, consultas | `#1098F7` azul | 🛍️ |
| 3 | Mayorista / B2B — catálogo, pedidos, hoteles y turismo | `#6B5E62` topo | 📦 |
| 4 | Redes y contenido orgánico — Instagram, TikTok, UGC | `#F17300` naranja | 📱 |
| 5 | Campañas creativas — fechas especiales, conceptos, piezas | `#9AA544` oliva claro | ✨ |
| 6 | Publicidad paga — Meta/Instagram, presupuesto, resultados | `#0B6FB8` azul oscuro | 📣 |
| 7 | Logística y envíos — despachos martes y jueves por Correo Argentino, retiros en showroom | `#B85700` naranja oscuro | 🚚 |
| 8 | Administración — cobros, costos, cierre del mes y **plan VEA** | `#9A8D91` topo claro | 📊 |

Las áreas se crean, editan y archivan desde Configuración (solo admin). Archivar no borra historial.

---

## 4. Funciones

### Tareas
- **Plantillas** (`task_templates`) definen la tarea; **instancias** (`task_instances`) son cada vez que toca hacerla.
- Frecuencias: **única** (con **fecha** elegida, no solo "hoy"), **diaria**, **semanal** (días elegidos), **mensual** (día del mes; 0 = último día;
  si el mes no tiene ese día, por ejemplo 31 en febrero, se genera el último día del mes).
- Horario límite opcional ("sin horario" = vence a las 23:59).
- Una tarea puede pertenecer a **una o más áreas**; cuenta para el cumplimiento de cada una.
- Peso (cuánto aporta a un objetivo por tareas) y objetivo vinculado opcionales.
- **Estados de una instancia**: `pendiente`, `hecha`, `omitida`.
  - **Omitida**: la marca la responsable (o la admin) **escribiendo un motivo** obligatorio. Le llega un aviso a la admin.
    No cuenta como incumplida ni suma al total del cumplimiento.
  - Se puede volver de `hecha` u `omitida` a `pendiente`.
- **Eliminar una tarea = archivarla** (botón "Eliminar tarea" en el detalle, con confirmación): deja de generar
  instancias y se borran **todos sus días pendientes, también los vencidos** que nunca se hicieron (no cuentan como
  incumplidos). Los días hechos u omitidos quedan en el historial pero ya no se muestran en Hoy. Si elimina alguien
  que no es la admin, a la admin le llega una alerta. (Decisión de Cami, 23 nov 2026.)
- **Editar una tarea**: las instancias pendientes de hoy en adelante se actualizan en su mismo día (título, responsable, hora…),
  se borran las de días que ya no corresponden y se generan las que falten. Como hay una sola instancia por día y por tarea,
  cambiar la hora nunca duplica (bug de la v1).
- Las recurrentes se generan con 14 días de anticipación (cron diario + al guardar una plantilla).

### Comentarios
- Cualquiera comenta cualquier tarea desde el detalle de la tarea.
- Al comentar, le llega un **push a la responsable** (y a la admin si la responsable es otra persona). Nunca a quien comentó.

### Objetivos
- Pertenecen a un área o son **generales**. Pueden agruparse en un **plan** (ej. "Plan VEA abril 2027").
- Formas de medir (`tipo_medicion`):
  - `tareas`: suma del peso de las instancias hechas / suma del peso de todas las del período (sin omitidas).
  - `numerico`: suma de **aportes** cargados (al tildar una tarea vinculada "¿cuántos?", o cargados a mano).
    Destildar la tarea borra su aporte (en la v1 no se restaba).
  - `ventas`: suma automática de la tabla `ventas` en el período, opcionalmente filtrada por canal.
  - `proporcion_ventas`: % del monto de un canal sobre el total minorista del período.
  - `clientes_mayoristas`: cantidad de clientes mayoristas distintos con ventas en el período.
  - `cumplimiento`: % de cumplimiento "al día" del equipo (ver §5) en el período.
- **Ritmo esperado**: % del período transcurrido. Si el avance está más de 15 puntos por debajo → "Atrasado" (naranja).
  No aplica a `proporcion_ventas` ni `cumplimiento` (son tasas, no acumulados): esos se comparan directo con la meta.

### Plan VEA (área Administración)
Visión a **30 de abril de 2027** (período 1 nov 2026 – 30 abr 2027):

| Meta | Cómo se mide | Valor |
|---|---|---|
| Duplicar ingresos | `ventas` del mes vs. base | Base: **octubre 2026 = $400.000** → meta **$800.000/mes** |
| Ventas minoristas: 1/3 a conocidos, 2/3 a desconocidos por la tienda online | `proporcion_ventas`, por **monto** | Tienda online ≥ 66 % del monto minorista |
| Al menos 2 clientes mayoristas | `clientes_mayoristas` | ≥ 2 |
| 80 % de tareas del equipo cumplidas | `cumplimiento` | ≥ 80 % |

- Lo ve todo el equipo. Los números de ventas se **cargan a mano** (montos en pesos) desde la pantalla Ventas.
- Pantalla "Plan VEA": tarjetas con cada meta, el valor del mes actual y la evolución mes a mes desde la base.

### Ventas (para el VEA)
Tabla `ventas`: fecha, monto ($), canal (`conocidos` | `tienda_online` | `mayorista`), cliente (texto, obligatorio si es mayorista), nota.
Se cargan **una por una**. "Duplicar ingresos" suma todos los canales; la proporción 1/3–2/3 usa solo los minoristas
(conocidos + tienda online); los clientes mayoristas se cuentan por nombre sin distinguir mayúsculas ni espacios.
Cargan ventas la admin y las personas con el permiso "carga ventas" (se activa en Configuración → Personas).

---

## 5. Cómo se calcula el cumplimiento ("al día")

Pantallas Áreas y Equipo, alerta semanal y meta VEA del 80 %:

```
cumplimiento = hechas / (hechas + pendientes ya vencidas)      · omitidas no cuentan
```

Solo cuentan las tareas cuyo vencimiento **ya pasó** (o que ya se hicieron antes de vencer).
Ejemplo: Laura tiene 10 tareas en la semana y el lunes a la noche hizo las 2 de ese día → **100 %**.
Si no hay ninguna tarea vencida ni hecha en el período, se muestra "—".

Todos los cálculos (cumplimiento, avance de objetivos, VEA) viven en **funciones SQL** y la app y la función de notificaciones
las consultan. No se duplican cálculos en JavaScript.

---

## 6. Pantallas

Navegación inferior: **Hoy · Objetivos · Áreas · Equipo**. Arriba: campana (solo admin) y engranaje.
Rutas con hash (`#/hoy`, `#/tarea/<id>`, `#/area/<id>`, `#/objetivo/<id>`, `#/vea`, `#/config/...`) para que funcione el botón "atrás" y los push abran la tarea exacta.

1. **Hoy**: saludo y cantidad de tareas; bloque **Vencidas** (borde naranja); mis tareas de hoy por área con checkbox grande;
   interruptor "Ver todo el equipo"; botón "Agregar tarea". Tocar el texto de una tarea abre su **detalle**.
2. **Detalle de tarea**: datos, estado, botones Hecha / Omitir (pide motivo) / Volver a pendiente, comentarios, editar (si tiene permiso).
3. **Objetivos**: arriba el resumen del Plan VEA (abre `#/vea`); después objetivos por área y generales: barra, % actual,
   marca de ritmo (rayita azul), días restantes, estado (En camino / Atrasado / Meta alcanzada / Cumplido); archivados aparte.
   Detalle `#/objetivo/<id>`: avance, evolución mes a mes, cargas a mano (numéricos), editar, marcar cumplido, archivar.
   Crear/editar en `#/objetivo-form/nuevo` o `#/objetivo-form/<id>` (admin; líder solo en su área; los del plan: solo admin).
4. **Plan VEA** (`#/vea`): cada meta con el valor del mes y la evolución desde la base. **Ventas** (`#/ventas`): mes a mes,
   totales por canal, % tienda online y clientes mayoristas (de `resumen_ventas`), cargar / editar / borrar una por una.
   Un cliente mayorista escrito con otras mayúsculas se guarda con el nombre que ya estaba cargado.
   Al crear o editar una tarea se puede elegir el objetivo al que suma (tareas o numérico) y su peso (normal, doble, triple).
5. **Áreas**: grilla con % al día de la semana (oliva desde 80 %, naranja debajo de 70 %), personas y vencidas;
   detalle `#/area/<id>` con pestañas Hoy / Semana / Mes, filtros por estado y por persona, y quiénes están (líder primero).
6. **Equipo**: tarjeta por persona con áreas (★ = líder), por hacer hoy, vencidas y % al día de semana y mes, más el total
   del equipo; detalle `#/miembro/<id>` con las mismas pestañas. Las tareas hechas de tareas eliminadas se muestran
   en estas pantallas porque cuentan en el %.
7. **Alertas** (admin, `#/alertas`): campana con badge en el encabezado; lista en vivo (una suscripción Realtime por sesión),
   tocar una la marca leída y abre la tarea, el objetivo o el área; "Marcar todas como leídas".
8. **Configuración**: Tareas (lista de todas, por área, tocar = editar o eliminar), Áreas (admin: crear, editar emoji/color/orden,
   archivar), Personas (admin: invitar por mail **eligiendo rol y áreas desde la invitación**, editar rol / "carga ventas" /
   áreas, dar de baja o reactivar, cancelar invitaciones), Notificaciones (activar avisos en este celular, "Probar aviso",
   pasos para iPhone y para avisos bloqueados; admin: "Que también me lleguen al celular"), Apariencia, Cerrar sesión.
   Rutas: `#/config/tareas`, `#/config/areas`, `#/config/personas`, `#/config/notificaciones`, `#/persona/<id>`,
   `#/editar/<plantilla>`, `#/agregar`.

Estados vacíos amables ("Todo hecho por hoy 🌿"). Nada de `alert()`/`prompt()`/`confirm()` del navegador: diálogos propios.

---

## 7. Notificaciones

Una función programada revisa **cada hora**. Silencio de 22:00 a 8:00 (lo acumulado sale a las 8:00).

**Push al celular**
1. Aviso previo para tareas no diarias: "Mañana vence…" o "Hoy vence a las HH:MM…" según corresponda (un solo aviso).
2. Aviso de vencida: "Venció sin completar…".
3. Resumen 9:00: "Hoy tenés N tareas" (incluye las vencidas pendientes).
4. Comentario nuevo en una tarea tuya (§4).
5. Si el push devuelve 404/410 se borra la suscripción. Al cerrar sesión se borra la suscripción de ese dispositivo.
6. Tocar la notificación abre `#/tarea/<id>`.

**Alertas para la admin (campana, en vivo)** — Cami confirmó que sirven:
- Tarea de otra persona vencida sin completar.
- Tarea omitida (con el motivo).
- Tarea eliminada por otra persona.
- Objetivo que pasa a "Atrasado" (una vez por objetivo y por semana).
- Área por debajo del 70 % al día al cierre de la semana (domingo 20:00).
Push de estas alertas a la admin: opcional, desactivado por defecto.

**Cómo funciona por dentro** (migración `avisos`, fase 5):
- Todo aviso entra a una cola en la base (`privado.push_cola`, con una clave única para no mandar dos veces).
- pg_cron corre a cada hora en punto `privado.preparar_avisos()` (genera vencidas de los últimos 2 días, avisos previos de
  hoy y mañana, el resumen a las 9, objetivos atrasados a las 9 y áreas bajo 70 % el domingo a las 20) y después
  `privado.disparar_envio()`, que con pg_net llama a la Edge Function `notificaciones`.
- Comentarios, alertas con push activado y "Probar aviso" llaman a `disparar_envio()` en el momento.
- La función `notificaciones` (`supabase/functions/notificaciones`, sin JWT, exige la clave `x-clave`) se conecta directo a la
  base, toma la cola con `privado.tomar_cola()` (de 22 a 8 solo sale "Probar aviso") y manda con web-push. 404/410 = borra la suscripción.
- Varias vencidas de una persona en la misma hora van en un solo push ("Vencieron N tareas sin completar").
- Claves en **Vault** de Supabase (nunca en el repositorio): `vapid_publica`, `vapid_privada`, `vapid_sujeto`, `notif_url`,
  `notif_clave`. La VAPID pública también está en `web/src/lib/config.ts` (es pública por diseño).
- Service worker: `web/public/sw.js` (solo push y abrir la tarea; no guarda caché).

**iPhone**: el push solo funciona con la app agregada a la pantalla de inicio (iOS 16.4+) y abierta desde el ícono.
Por eso el manifest usa `display: standalone` y el login (código de un solo uso) se hace dentro de la app instalada.

---

## 8. Login y seguridad

- Login con **código de un solo uso** por mail (no link mágico: el link fallaba desde la app de Gmail).
- **Solo entran personas invitadas**: la barrera está en la base. La app pide el código con `shouldCreateUser: true`
  (la primera vez Supabase crea la cuenta) y el disparador `privado.al_crear_usuario` rechaza cualquier mail que no
  esté en `team_invites`, así que la cuenta no llega a crearse. (Decisión del 18 nov 2026: con `shouldCreateUser: false`
  una persona invitada que todavía no tiene cuenta no podía recibir el código.)
- En Supabase Auth tienen que estar activados "Allow new users to sign up" y el código (`{{ .Token }}`) en las
  plantillas **Confirm signup** (primer ingreso) y **Magic Link** (los siguientes). Pasos en `README.md`.
- Mail saliente: SMTP de Gmail de Aromas Cielo (`smtp.gmail.com`, puerto 465, remitente "Ritual Diario · Aromas Cielo") con
  contraseña de aplicación, configurado en Supabase Auth el 18 nov 2026 (nunca en el código). Sin SMTP propio Supabase
  no deja editar las plantillas y manda solo un link.
- Las funciones SQL `security definer` tienen `search_path` fijo y se les revoca `EXECUTE` a `anon` (y a `authenticated` cuando no corresponde).
- Todo texto que escribe una persona (títulos, comentarios, motivos, notas) se muestra **escapado**: nunca `innerHTML` con datos.
- Revisar `get_advisors` (seguridad y rendimiento) de Supabase después de cada cambio de base de datos.

---

## 9. Arquitectura

| Pieza | Elección |
|---|---|
| Frontend | **Vite + React + TypeScript**, PWA con service worker propio (push) |
| Datos y login | **Supabase**: Postgres + Auth + RLS + Realtime + Edge Functions + pg_cron |
| Librería | `@supabase/supabase-js` instalada con versión **fija** (no desde CDN) |
| Código | Repositorio **privado** en GitHub (`aromascielo/ritual-diario`) |
| Hosting | **Cloudflare Workers (static assets)**, conectado a GitHub: cada cambio en `main` se publica solo; cada rama tiene su URL de prueba |
| Costo | $0. Si el negocio lo justifica: Supabase Pro (US$25/mes) por backups diarios y sin pausa por inactividad |

Por qué no "un solo `index.html`" como la v1: con build automático en Cloudflare ya no hace falta, y separar en módulos
permite probar, evitar que un cambio rompa otra pantalla y mantener la app a medida que crece.

### Reglas técnicas
- Zona horaria y helpers de fechas en `web/src/lib/fechas.ts`. Prohibido `toISOString().slice(0,10)` para "hoy".
- No usar `async` dentro de `supabase.auth.onAuthStateChange` (deadlock conocido de supabase-js). Despachar con `setTimeout`.
- Una sola suscripción Realtime por sesión; cerrarla al salir.
- Consultas con filtros en la base (joins/RPC), nunca listas gigantes de IDs en la URL. Ojo con el límite de 1000 filas.

### Entornos
| Entorno | Supabase | Web |
|---|---|---|
| v1 (actual, no tocar) | `aromascielo's app` (`ihprsixwwvlxmxszknti`, EE. UU.) | `claufer.netlify.app` |
| v2 (este proyecto) | `ritual-diario` (`oehrvzijfktxcoyfommj`, San Pablo) | Cloudflare Worker `ritual-diario` → **https://ritual-diario.aromascielo.workers.dev** |

La URL y la clave *publishable* de Supabase están en `web/src/lib/config.ts` (son públicas por diseño; se pueden
reemplazar con `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY`). Nunca poner la clave secreta en la app.

Cloudflare Workers Builds (cuenta de aromascielo@gmail.com) está conectado al repositorio con carpeta raíz `/web`,
build `npm run build`, deploy `npx wrangler deploy` y versiones de prueba activadas para las ramas (`npx wrangler preview`).
La app de Cloudflare en GitHub tiene acceso solo a `ritual-diario`.

**Plan gratis de Supabase:** un proyecto sin uso por varios días se pausa y la app muestra "Sin conexión".
Se reactiva desde el panel de Supabase o con `restore_project` (pasó el 23 nov 2026).

Mientras se construye, `ritual-diario` funciona como entorno de prueba. Antes del cambio (fase 6) se borran los datos de prueba
y se cargan los reales. Después se crea un segundo proyecto solo para pruebas (el plan gratis permite 2 activos).

---

## 10. Estructura de carpetas

```
App Aromas Claude/
├── CLAUDE.md                 ← esta especificación
├── README.md                 ← guía paso a paso para Cami
├── docs/
│   ├── PLAN.md               ← fases y estado actual
│   └── instrucciones-proyecto.md  ← texto para las instrucciones del Proyecto en claude.ai
├── web/                      ← la app (lo único que se publica)
│   ├── public/               ← manifest, íconos y sw.js (service worker del push)
│   └── src/
│       ├── lib/              ← supabase, fechas, permisos, formato, push, alertas
│       ├── pantallas/        ← una carpeta por pantalla
│       └── componentes/      ← piezas reutilizables
└── supabase/
    ├── migrations/           ← SQL versionado (estructura, permisos, funciones, cron)
    ├── seed.sql              ← datos de ejemplo SOLO para pruebas (sin mails reales)
    ├── tests/                ← pruebas de permisos y cálculos
    └── functions/notificaciones/
```

---

## 11. Modelo de datos v2

```
profiles            id (= auth.users.id), nombre, email, rol ('admin'|'integrante'), activo, carga_ventas, push_alertas, avatar_url, created_at
team_invites        email, nombre, rol, carga_ventas, invitado_por, areas jsonb [{area_id, rol_area}], created_at
areas               id, nombre, descripcion, color, emoji, orden, activa
area_members        area_id, profile_id, rol_area ('lider'|'miembro')

planes              id, titulo, descripcion, area_id, fecha_inicio, fecha_fin, activo        -- ej. Plan VEA abril 2027
objectives          id, plan_id?, area_id?, titulo, descripcion, periodo, fecha_inicio, fecha_fin,
                    tipo_medicion ('tareas'|'numerico'|'ventas'|'proporcion_ventas'|'clientes_mayoristas'|'cumplimiento'),
                    evaluacion ('periodo'|'mensual'), meta_numerica, unidad, canal_ventas?, valor_base?, estado, creado_por, created_at
objective_aportes   id, objective_id, instance_id?, cantidad, nota, cargado_por, created_at

task_templates      id, titulo, descripcion, responsable_id, creado_por, frecuencia,
                    fecha_unica (date, solo 'unica'), dias_semana int[], dia_mes, hora_limite?,
                    peso, objective_id?, activa, created_at, updated_at
task_template_areas template_id, area_id
task_instances      id, template_id, responsable_id, titulo, fecha (date), fecha_limite timestamptz, sin_horario,
                    estado, completada_por, completada_at, omitida_motivo, omitida_por, omitida_at,
                    objective_id?, notificada_previa, notificada_vencida
                    UNIQUE (template_id, fecha)
task_instance_areas instance_id, area_id
task_comments       id, instance_id, profile_id, texto, created_at

ventas              id, fecha, monto, canal ('conocidos'|'tienda_online'|'mayorista'), cliente?, nota, cargado_por, created_at

push_subscriptions  id, profile_id, endpoint, p256dh, auth, user_agent, created_at
app_notifications   id, destinatario_id, tipo, titulo, cuerpo, instance_id?, objective_id?, area_id?, leida, created_at
privado.push_cola   id, destinatario_id, titulo, cuerpo, url, clave (única), urgente, created_at, enviado_at   -- no se expone por la API
```

Cambios clave respecto de la v1: rol por área; `creado_por` en tareas y objetivos; fecha en tareas únicas;
unicidad por **día** (no por hora) para no duplicar; datos de omitida; aportes separados (se pueden deshacer);
ventas y planes para el VEA; sin `area_id` "principal" duplicado (las áreas van solo en las tablas puente).

---

## 12. Estilo visual

Paleta de marca (sin cambios respecto de la v1):

| Token | Hex | Uso |
|---|---|---|
| `--crema` | `#E3E4DB` | Fondo |
| `--blanco-calido` | `#F4F5EF` | Tarjetas |
| `--topo` | `#6B5E62` | Texto, íconos, bordes |
| `--oliva` | `#6F7C12` | Principal: botones, progreso, hechas |
| `--naranja` | `#F17300` | Alertas: vencidas, badge, por vencer |
| `--azul` | `#1098F7` | Información: ritmo esperado, links, filtros |

- Contraste: texto `--topo` sobre crema/blanco cálido; texto blanco solo sobre oliva (o grande/negrita sobre naranja y azul);
  nunca texto chico naranja o azul sobre crema.
- Modo oscuro: fondo `#2A2527`, tarjetas `#3A3336`, texto `#E3E4DB`; acentos iguales. Claro / oscuro / automático.
- Títulos en serif elegante, textos en sans limpia (Inter). Esquinas de 16 px, sombras suaves en topo.
- Mobile-first: botones de 44 px mínimo, navegación inferior fija; en escritorio, ancho máximo de 720 px.

---

## 13. Preguntas abiertas

Ninguna por ahora. Resueltas el 18 nov 2026: ventas una por una; Laura carga ventas (showroom);
Candela será líder de sus tres áreas (Cami también las gestiona como admin); push en iPhone se prueba cuando se sume Candela.

### Funciones de la base (resumen para la app)
- Tareas: `guardar_tarea`, `archivar_tarea`, `marcar_tarea(instancia, 'hecha'|'omitida'|'pendiente', motivo, cantidad)`.
- Cálculos: `cumplimiento(desde, hasta)`, `avance_objetivos(fecha)`, `evolucion_objetivo(id)`, `resumen_ventas(desde, hasta)`.
- Personas (admin): `invitar_persona(email, nombre, rol, carga_ventas, areas)` (las áreas se aplican solas en el primer
  ingreso), `actualizar_persona`, `asignar_area` (rol null = sacar del área), `cancelar_invitacion`; cada una: `actualizar_mi_nombre`.
- Avisos: `guardar_suscripcion(endpoint, p256dh, auth, user_agent)` (si el celular era de otra persona, pasa a la nueva),
  `probar_aviso()`, `mis_avisos(push_alertas)`, `leer_alertas()`. Al cerrar sesión la app borra la suscripción de ese celular.
- Escritura directa con RLS: áreas y planes (admin), objetivos (admin / líder del área), aportes manuales, comentarios, ventas, borrar la propia suscripción push, marcar alertas leídas.
- Pruebas (se deshacen solas al terminar): `supabase/tests/permisos.sql` (24), `eliminar_tarea.sql` (8), `invitar_con_areas.sql` (8),
  `resumen_ventas.sql` (mismas cifras que el Plan VEA), `avisos.sql` (17).

---

## 14. Cómo trabaja Claude en este proyecto

- Cami no programa: Claude escribe el código. Cuando haga falta que Cami haga algo (clics en Supabase, GitHub, Cloudflare),
  se lo explica **paso a paso, numerado**, con nombres exactos de botones, y le pregunta si algo no queda claro.
- Nunca tocar la app vieja (`claufer`, proyecto Supabase `ihprsixwwvlxmxszknti`) salvo pedido explícito.
- Cambios de base de datos: siempre como **migración nueva** en `supabase/migrations/` (nunca editar una ya aplicada),
  primero en el entorno de prueba, después `get_advisors`.
- Avanzar **una fase por vez** (ver `docs/PLAN.md`), probar y actualizar el estado del plan al terminar cada fase.
- Si se toma una decisión nueva, actualizar este archivo en el mismo cambio.
- **Contexto de la conversación:** cuando la conversación se esté por quedar sin espacio (contexto), avisarle a Cami
  con tiempo y darle un mensaje listo para pegar en un chat nuevo: en qué fase estamos, qué se hizo, qué falta,
  decisiones recientes y archivos clave. Antes, dejar `docs/PLAN.md` actualizado.
