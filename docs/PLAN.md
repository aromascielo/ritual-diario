# Plan de construcción — Ritual Diario v2

Una fase por vez. Al terminar cada fase: probar, marcarla como hecha acá y anotar lo pendiente.

| Fase | Qué incluye | Quién prueba | Estado |
|---|---|---|---|
| 0. Base | Especificación v2, carpeta, proyecto Supabase `ritual-diario` (San Pablo), repositorio GitHub privado | Cami revisa la spec | ✅ (código subido a GitHub el 18 nov 2026) |
| 1. Base de datos | Tablas v2, permisos (admin / líder / miembro), funciones de cálculo (cumplimiento al día, avance, VEA), generador de tareas, pruebas de permisos | Claude (pruebas automáticas) | ✅ 18 nov 2026 |
| 2. App: lo diario | Login con código, Hoy, detalle de tarea (hecha / omitir con motivo / comentarios), agregar tarea con fecha | Cami en el celular (URL de prueba) | ✅ 23 nov 2026 |
| 3. Gestión | Tareas (crear, editar, archivar; recurrentes para líderes), Áreas y Personas desde Configuración | Cami + Laura | 🧪 Cami la probó el 23 nov 2026 (todo OK tras el arreglo de los diálogos); falta Laura |
| 4. Objetivos y VEA | Objetivos de todos los tipos, aportes, Plan VEA, carga de ventas | Cami + Laura (ventas) | 🧪 Hecha el 23 nov 2026; falta probarla |
| 5. Seguimiento y avisos | Áreas y Equipo con % al día, push (previo, vencida, resumen, comentarios), campana de alertas | Cami (Android); iPhone con Candela | 🧪 Hecha el 23 nov 2026; push probado en el Android de Cami (23 nov). Falta: aviso de comentario entre dos personas (con Laura) y revisar Áreas/Equipo con datos reales |
| 6. Publicación y cambio | Cloudflare con GitHub, limpiar datos de prueba, cargar equipo y tareas reales, pasar a Laura, apagar Netlify | Todo el equipo | 🟡 Empezada el 23 nov 2026: Cloudflare listo, datos de prueba limpiados. Falta: Laura entra el jueves 26, cargar tareas, elegir día del cambio, apagar Netlify (con OK de Cami) |
| 7. Sumar a Candela | Alta como líder de Redes, Campañas y Publicidad, tareas, prueba en iPhone | Candela | ⬜ (ene 2027) |

## Pendientes de Cami
- [x] Crear el repositorio privado `ritual-diario` en GitHub.
- [x] Responder las preguntas abiertas.
- [x] Darle a Claude permiso para subir al repositorio (app de Claude instalada en GitHub).
- [x] Pegar el texto de `docs/instrucciones-proyecto.md` en las instrucciones del Proyecto de claude.ai.
- [x] Fase 2: Gmail conectado en Supabase (SMTP) y plantillas con el código (lo hizo Claude desde el navegador, 18 nov).
- [x] Fase 2: Cloudflare conectado con GitHub; app publicada en https://ritual-diario.aromascielo.workers.dev (18 nov).
- [x] Fase 2: probar en el celular (Cami entró con el código el 23 nov).
- [x] Fase 3: tareas que se repiten, editar (sin duplicar) y Configuración → Tareas: probado por Cami el 23 nov.
- [x] Fase 3: Configuración → Áreas y Personas, probado después del arreglo (23 nov).
- [ ] Fase 4: probar Objetivos (crear uno, cargar avance, marcar cumplido), Plan VEA y Ventas (cargar ventas reales de noviembre).
- [ ] Fase 3: invitar a Laura desde Configuración → Personas (con sus 5 áreas como líder y "carga ventas") y pedirle que pruebe.
  Laura sigue usando la app vieja hasta la fase 6.
- [x] Fase 5: avisos activados en el Android de Cami; "Probar aviso" llegó (23 nov).
- [ ] Fase 5: mirar Áreas, Equipo y la campana. El jueves, con Laura: que active los avisos y que comente una tarea tuya.
- [x] Aprobar la migración `pg_net_en_extensions` (aprobada el 23 nov).

### Fase 6 — decisiones del 23 nov 2026
- No se pasa nada de la app vieja: las tareas y objetivos se cargan de nuevo en la v2 (Cami lo eligió; se miró la base vieja
  solo para leer, sin cambios).
- Datos de prueba borrados: el objetivo "Vender $90mil en la feria" y la tarea eliminada "Ver la app". Quedan, porque son
  reales: las 3 ventas del 15/11 y las tareas "Mandar mensajes mayoristas", "Canva" y "Revisar números".
- Día del cambio (Laura deja la app vieja): se decide después de que Laura la pruebe.
- Apagar Netlify o poner un aviso en la app vieja: solo con el OK explícito de Cami, cuando Laura ya use la nueva.

## Estado de la base de datos (proyecto `ritual-diario`, `oehrvzijfktxcoyfommj`)
- 11 migraciones aplicadas (`supabase/migrations/`, la última `pg_net_en_extensions`).
  Cargadas: 8 áreas y el Plan VEA con sus 4 metas.
- Personas: Cami (admin, "carga ventas", líder en las 8 áreas desde el 23 nov).
- 8 migraciones (las últimas: `20261123120000_eliminar_tarea.sql`, `20261123130000_areas_en_invitacion.sql`).
  y `20261123140000_resumen_ventas.sql` (9 migraciones). Pruebas: permisos 24/24, eliminar_tarea 8/8,
  invitar_con_areas 8/8, resumen_ventas (coincide con el Plan VEA).
- Cron activos: `generar-instancias` (00:05 hora Argentina) y `avisos` (cada hora en punto).
- Edge Function `notificaciones` publicada (versión 1). Claves en Vault: `vapid_publica`, `vapid_privada`, `vapid_sujeto`,
  `notif_url`, `notif_clave`. Probada de punta a punta: el aviso de prueba llegó al Android de Cami (23 nov).
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
  Pruebas 17/17. Migración `pg_net_en_extensions` aplicada: advisors sin avisos nuevos (quedan los esperados: funciones
  RPC security definer que validan permisos adentro, y "leaked password" que no aplica porque se entra con código).
- 23 nov 2026 — Arreglo: en los diálogos (áreas, ventas, invitar persona…) cada letra escrita devolvía el cursor al primer
  campo. Causa: el diálogo ponía el foco cada vez que se redibujaba. Ahora solo al abrir. En el detalle de un objetivo
  de ventas se aclara que las ventas se cargan en la pantalla Ventas, con botón para ir.
- 23 nov 2026 — Decisión de Cami: metas de un evento (ej. "Vender $90mil en la feria") se miden como "Número cargado a mano"
  (option B): se cargan los montos en el objetivo y, para que cuenten en el VEA, también en Ventas. No hay canal "Feria".
