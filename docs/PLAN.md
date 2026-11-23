# Plan de construcción — Ritual Diario v2

Una fase por vez. Al terminar cada fase: probar, marcarla como hecha acá y anotar lo pendiente.

| Fase | Qué incluye | Quién prueba | Estado |
|---|---|---|---|
| 0. Base | Especificación v2, carpeta, proyecto Supabase `ritual-diario` (San Pablo), repositorio GitHub privado | Cami revisa la spec | ✅ (código subido a GitHub el 18 nov 2026) |
| 1. Base de datos | Tablas v2, permisos (admin / líder / miembro), funciones de cálculo (cumplimiento al día, avance, VEA), generador de tareas, pruebas de permisos | Claude (pruebas automáticas) | ✅ 18 nov 2026 |
| 2. App: lo diario | Login con código, Hoy, detalle de tarea (hecha / omitir con motivo / comentarios), agregar tarea con fecha | Cami en el celular (URL de prueba) | ✅ 23 nov 2026 |
| 3. Gestión | Tareas (crear, editar, archivar; recurrentes para líderes), Áreas y Personas desde Configuración | Cami + Laura | 🧪 Hecha el 23 nov 2026; falta que la prueben Cami y Laura |
| 4. Objetivos y VEA | Objetivos de todos los tipos, aportes, Plan VEA, carga de ventas | Cami + Laura (ventas) | 🧪 Hecha el 23 nov 2026; falta probarla |
| 5. Seguimiento y avisos | Áreas y Equipo con % al día, push (previo, vencida, resumen, comentarios), campana de alertas | Cami (Android); iPhone con Candela | 🧪 Hecha el 23 nov 2026; falta que Cami active los avisos y los pruebe en su Android |
| 6. Publicación y cambio | Cloudflare con GitHub, limpiar datos de prueba, cargar equipo y tareas reales, pasar a Laura, apagar Netlify | Todo el equipo | ⬜ |
| 7. Sumar a Candela | Alta como líder de Redes, Campañas y Publicidad, tareas, prueba en iPhone | Candela | ⬜ (ene 2027) |

## Pendientes de Cami
- [x] Crear el repositorio privado `ritual-diario` en GitHub.
- [x] Responder las preguntas abiertas.
- [x] Darle a Claude permiso para subir al repositorio (app de Claude instalada en GitHub).
- [x] Pegar el texto de `docs/instrucciones-proyecto.md` en las instrucciones del Proyecto de claude.ai.
- [x] Fase 2: Gmail conectado en Supabase (SMTP) y plantillas con el código (lo hizo Claude desde el navegador, 18 nov).
- [x] Fase 2: Cloudflare conectado con GitHub; app publicada en https://ritual-diario.aromascielo.workers.dev (18 nov).
- [x] Fase 2: probar en el celular (Cami entró con el código el 23 nov).
- [ ] Fase 3: probar tareas que se repiten, editar, Configuración → Tareas / Áreas / Personas.
- [ ] Fase 4: probar Objetivos (crear uno, cargar avance, marcar cumplido), Plan VEA y Ventas (cargar ventas reales de noviembre).
- [ ] Fase 3: invitar a Laura desde Configuración → Personas (con sus 5 áreas como líder y "carga ventas") y pedirle que pruebe.
  Laura sigue usando la app vieja hasta la fase 6.
- [ ] Fase 5: mirar Áreas y Equipo; en el celular, Configuración → Notificaciones → "Activar avisos" → "Probar aviso".
  Comentar una tarea de otra persona (o pedirle a Laura que comente una tuya) y ver que llegue el aviso.
- [ ] Aprobar en Supabase la migración `pg_net_en_extensions` (saca un aviso de seguridad; quedó sin aplicar porque la
  pregunta de Supabase venció).

## Estado de la base de datos (proyecto `ritual-diario`, `oehrvzijfktxcoyfommj`)
- 10 migraciones aplicadas (`supabase/migrations/`; la 11.ª, `pg_net_en_extensions`, está escrita pero pendiente de aprobar).
  Cargadas: 8 áreas y el Plan VEA con sus 4 metas.
- Personas: Cami (admin, "carga ventas", líder en las 8 áreas desde el 23 nov).
- 8 migraciones (las últimas: `20261123120000_eliminar_tarea.sql`, `20261123130000_areas_en_invitacion.sql`).
  y `20261123140000_resumen_ventas.sql` (9 migraciones). Pruebas: permisos 24/24, eliminar_tarea 8/8,
  invitar_con_areas 8/8, resumen_ventas (coincide con el Plan VEA).
- Cron activos: `generar-instancias` (00:05 hora Argentina) y `avisos` (cada hora en punto).
- Edge Function `notificaciones` publicada (versión 1). Claves en Vault: `vapid_publica`, `vapid_privada`, `vapid_sujeto`,
  `notif_url`, `notif_clave`. Probada: la base llama a la función y responde bien (todavía sin celulares suscriptos).
- Pruebas de avisos: `supabase/tests/avisos.sql` → 17/17 OK.
- Pruebas: `supabase/tests/permisos.sql` → 24/24 OK. Cálculo VEA verificado con ventas de ejemplo.

## Registro
- 18 nov 2026 — Revisión de la v1 y decisiones de rumbo. Creado el proyecto Supabase `ritual-diario` (sa-east-1). Spec v2 escrita.
- 18 nov 2026 — Fase 1 terminada: base de datos v2 aplicada y probada.
- 18 nov 2026 — Primer envío del código al repositorio `aromascielo/ritual-diario` (rama `main`).
- 18 nov 2026 — Fase 2 programada en `web/` (Vite + React + TypeScript): login con código, Hoy (vencidas, tareas por área,
  ver todo el equipo, % al día de la semana), detalle (hecha / omitir con motivo / volver a pendiente, comentarios),
  agregar tarea única con fecha y horario, vista inicial de Objetivos (avance_objetivos), Configuración (nombre,
  apariencia, cerrar sesión). Probada en navegador con datos simulados y las llamadas probadas contra la base
  (se deshace sola): 8/8 OK. Decisión: login con `shouldCreateUser: true` (ver CLAUDE.md §8).
- 18 nov 2026 — Claude configuró desde el navegador: SMTP de Gmail y plantillas "Confirm sign up" y "Magic link or OTP"
  con `{{ .Token }}` en Supabase; Worker `ritual-diario` en Cloudflare conectado a GitHub (solo este repositorio).
- 23 nov 2026 — Supabase había pausado el proyecto por falta de uso (la app decía "Sin conexión"): reactivado,
  datos intactos. Cami entró por primera vez y quedó como líder en las 8 áreas.
- 23 nov 2026 — Eliminar tarea: migración `eliminar_tarea` (borra también los días vencidos sin hacer y avisa a la admin),
  botón "Eliminar tarea" en el detalle con confirmación, Hoy ya no muestra tareas eliminadas. Pruebas 8/8 y 24/24.
- 23 nov 2026 — Fase 3 programada: formulario único para crear/editar tareas con frecuencia (una vez, todos los días,
  días de la semana, una vez por mes; las que se repiten solo admin/líder), "Editar tarea" en el detalle, Configuración →
  Tareas (lista y filtros), Áreas (admin) y Personas (admin: invitar con rol y áreas, editar, baja). Migración
  `areas_en_invitacion` (las áreas elegidas al invitar se aplican en el primer ingreso). Probado en navegador con datos
  simulados y contra la base (8/8). Sin cambios de permisos.
- 23 nov 2026 — Fase 4 programada (Laura de vacaciones hasta el jueves 26): Objetivos (resumen VEA, por área, generales,
  archivados, detalle con evolución y cargas a mano, crear/editar, cumplido/archivar), Plan VEA con evolución desde la base,
  Ventas (mes a mes, totales de la base, cargar/editar/borrar), tareas vinculadas a objetivos con peso. Migración
  `resumen_ventas`. Probado en navegador con datos simulados y contra la base.
- 23 nov 2026 — Fase 5 programada: pantallas Áreas y Equipo (con detalle por área y por persona, pestañas Hoy / Semana / Mes),
  campana de alertas en vivo para la admin, Configuración → Notificaciones (activar, probar, alertas al celular), service
  worker `public/sw.js`, migración `avisos` (cola, cron cada hora, comentarios, silencio de 22 a 8) y función `notificaciones`.
  Pruebas 17/17. Advisors: sin avisos nuevos salvo pg_net en public (se arregla con `pg_net_en_extensions`).
